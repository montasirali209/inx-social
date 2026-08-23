const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlan } = require('../src/services/socialAgentPlanner');

test('text-only draft missions avoid unavailable media and publishing workers', () => {
  const plan = buildPlan({ prompt: 'Create five Facebook captions only as a draft; do not publish or schedule them.' });
  const types = plan.tasks.map(item => item.type);
  assert.ok(types.includes('CONTENT_STRATEGY'));
  assert.ok(types.includes('COPY_GENERATION'));
  assert.ok(types.includes('PLATFORM_VARIANT'));
  assert.ok(!types.includes('MEDIA_GENERATION'));
  assert.ok(!types.includes('PUBLISH'));
  assert.ok(!types.includes('ANALYTICS'));
});

test('full media missions retain explicit worker-dependent tasks', () => {
  const plan = buildPlan({ prompt: 'Create three branded Facebook videos and publish them on a schedule.' });
  const types = plan.tasks.map(item => item.type);
  assert.ok(types.includes('VIDEO_GENERATION'));
  assert.ok(types.includes('COPY_GENERATION'));
  assert.ok(types.includes('PUBLISH'));
  assert.ok(types.includes('ANALYTICS'));
});
