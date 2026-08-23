const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPlan } = require('../src/services/socialAgentPlanner');

test('Social Agent routes economical post imagery to the local image worker without paid cost', () => {
  const plan = buildPlan({ prompt: 'Create 14 educational posts for my cleaning company', platforms: ['facebook', 'instagram'] });
  assert.equal(plan.assetCount, 14);
  assert.equal(plan.contentOutput, 'IMAGE');
  assert.equal(plan.executionMode, 'OLLAMA_IMAGE');
  assert.equal(plan.estimatedCredits, 0);
  assert.equal(plan.estimatedCostCents, 0);
  assert.deepEqual(plan.platforms, ['facebook', 'instagram']);
  const imageTask = plan.tasks.find(item => item.type === 'IMAGE_GENERATION');
  assert.ok(imageTask);
  assert.equal(imageTask.executionMode, 'OLLAMA_IMAGE');
  assert.equal(imageTask.estimatedCostCents, 0);
  assert.equal(plan.tasks.some(item => item.type === 'VIDEO_GENERATION'), false);
  assert.ok(plan.tasks.some(item => item.type === 'PUBLISH' && item.riskLevel === 'HIGH'));
});

test('Social Agent routes requested generative video to Wan and retains approval guardrails', () => {
  const plan = buildPlan({ prompt: 'Make 3 cinematic realistic videos for TikTok', platforms: ['tiktok'] });
  assert.equal(plan.executionMode, 'WAN_2_2_FAST');
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
    mediaModel: 'WAN_2_2_FAST',
    subscriptionPlan: 'PRO'
  });
  assert.equal(plan.contentOutput, 'REEL');
  assert.equal(plan.mediaModel, 'WAN_2_2_FAST');
  assert.equal(plan.estimatedCredits, 9);
  assert.equal(plan.tasks.some(item => item.type === 'VIDEO_GENERATION'), true);
  assert.throws(() => buildPlan({
    prompt: 'Create 3 short launch clips',
    platforms: ['facebook'],
    contentOutput: 'REEL',
    mediaModel: 'WAN_2_2_FAST',
    subscriptionPlan: 'STARTER'
  }), /requires the PRO plan/i);
});
