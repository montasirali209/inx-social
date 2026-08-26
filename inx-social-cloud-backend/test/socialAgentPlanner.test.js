const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPlan, needsCurrentResearch, normalizeContentOutput } = require('../src/services/socialAgentPlanner');

test('Social Agent routes economical post imagery to the local image worker without paid cost', () => {
  const plan = buildPlan({ prompt: 'Create 14 educational posts for my cleaning company', platforms: ['facebook', 'instagram'] });
  assert.equal(plan.assetCount, 14);
  assert.equal(plan.contentOutput, 'IMAGE');
  assert.equal(plan.executionMode, 'IMAGE_QUALITY');
  assert.equal(plan.estimatedCredits, 0);
  assert.equal(plan.estimatedCostCents, 0);
  assert.deepEqual(plan.platforms, ['facebook', 'instagram']);
  const imageTask = plan.tasks.find(item => item.type === 'IMAGE_GENERATION');
  assert.ok(imageTask);
  assert.equal(imageTask.executionMode, 'IMAGE_QUALITY');
  assert.equal(imageTask.estimatedCostCents, 0);
  assert.equal(plan.tasks.some(item => item.type === 'VIDEO_GENERATION'), false);
  assert.ok(plan.tasks.some(item => item.type === 'PUBLISH' && item.riskLevel === 'HIGH'));
});

test('Social Agent routes requested generative video to the private quality route and retains approval guardrails', () => {
  const plan = buildPlan({ prompt: 'Make 3 cinematic realistic videos for TikTok', platforms: ['tiktok'] });
  assert.equal(plan.executionMode, 'VIDEO_QUALITY');
  assert.equal(plan.estimatedCostCents, 33);
  assert.match(plan.guardrails.join(' '), /explicit approval/i);
});

test('Page creation becomes a high-risk guided task instead of an autonomous action', () => {
  const plan = buildPlan({ prompt: 'Set up a new Facebook Page and create 7 posts', platforms: ['facebook'] });
  const setup = plan.tasks.find(item => item.type === 'PAGE_SETUP');
  assert.equal(setup.riskLevel, 'HIGH');
  assert.match(setup.description, /guided manual step/i);
});

test('ordinary content creation for an existing connected Page never creates a Page setup blocker', () => {
  const plan = buildPlan({
    prompt: 'Create a brand pack and first post for the INXSocial Page which is newly created and already connected',
    platforms: ['facebook']
  });
  assert.equal(plan.tasks.some(item => item.type === 'PAGE_SETUP'), false);
  const conversational = buildPlan({
    prompt: 'Create our first Reel for the INXSocial Page which is newly just created and connected',
    platforms: ['facebook']
  });
  assert.equal(conversational.tasks.some(item => item.type === 'PAGE_SETUP'), false);
});

test('explicitly asking to create a new Facebook Page still creates the guided setup task', () => {
  const plan = buildPlan({ prompt: 'Create a new Facebook Page for our bakery and prepare its first post', platforms: ['facebook'] });
  assert.equal(plan.tasks.some(item => item.type === 'PAGE_SETUP'), true);
});

test('selected Reel model calculates media credits and respects the subscription gate', () => {
  const plan = buildPlan({
    prompt: 'Create 3 short launch clips',
    platforms: ['facebook'],
    contentOutput: 'REEL',
    mediaModel: 'VIDEO_QUALITY',
    subscriptionPlan: 'PRO'
  });
  assert.equal(plan.contentOutput, 'REEL');
  assert.equal(plan.mediaModel, 'VIDEO_QUALITY');
  assert.equal(plan.estimatedCredits, 9);
  assert.equal(plan.tasks.some(item => item.type === 'VIDEO_GENERATION'), true);
  assert.throws(() => buildPlan({
    prompt: 'Create 3 short launch clips',
    platforms: ['facebook'],
    contentOutput: 'REEL',
    mediaModel: 'VIDEO_QUALITY',
    subscriptionPlan: 'STARTER'
  }), /requires the PRO plan/i);
});

test('paid current-web refinement is reserved for complex or explicitly current missions', () => {
  assert.equal(needsCurrentResearch('Rewrite this caption to sound friendlier', 1), false);
  assert.equal(needsCurrentResearch('Create our first launch post using current market and competitor research', 1), true);
  assert.equal(needsCurrentResearch('Create five educational posts', 5), true);
});

test('an explicit image request overrides a stale text selector', () => {
  const prompt = 'Create and schedule a Facebook post with an image related to my service';
  assert.equal(normalizeContentOutput('TEXT', prompt), 'IMAGE');
  const plan = buildPlan({ prompt, contentOutput: 'TEXT', mediaModel: 'TEXT_ONLY' });
  assert.equal(plan.contentOutput, 'IMAGE');
  assert.ok(plan.tasks.some(item => item.type === 'IMAGE_GENERATION'));
});

test('wait for approval creates Campaign Review instead of becoming an invisible draft', () => {
  const plan = buildPlan({
    prompt: 'Create one Facebook post with an image. Propose a suitable time, wait for my approval and do not schedule or publish anything automatically.',
    operationMode: 'AUTOPILOT'
  });
  assert.equal(plan.approvalRequested, true);
  assert.equal(plan.draftOnly, false);
  assert.ok(plan.tasks.some(item => item.type === 'SCHEDULE'));
  assert.ok(plan.tasks.some(item => item.type === 'PUBLISH' && /Campaign Review/.test(item.title)));
});

test('even a draft-only content mission receives a visible Campaign Review', () => {
  const plan = buildPlan({ prompt: 'Create a Facebook launch post and save it as a draft' });
  assert.equal(plan.draftOnly, true);
  assert.equal(plan.tasks.some(item => item.type === 'SCHEDULE'), false);
  assert.equal(plan.tasks.some(item => item.type === 'PUBLISH'), true);
});
