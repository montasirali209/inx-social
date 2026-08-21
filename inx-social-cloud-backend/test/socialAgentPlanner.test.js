const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPlan } = require('../src/services/socialAgentPlanner');

test('Social Agent defaults economical social content to the INX template route', () => {
  const plan = buildPlan({ prompt: 'Create 14 educational posts for my cleaning company', platforms: ['facebook', 'instagram'] });
  assert.equal(plan.assetCount, 14);
  assert.equal(plan.executionMode, 'INX_TEMPLATE');
  assert.equal(plan.estimatedCostCents, 70);
  assert.deepEqual(plan.platforms, ['facebook', 'instagram']);
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
