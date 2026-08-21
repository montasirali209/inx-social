const assert = require('node:assert/strict');
const test = require('node:test');

const routing = require('../src/services/aiModelRoutingService');

test('AI routes keep Ollama first and require an explicit fallback model', () => {
  assert.deepEqual(routing.normalizeRoute({ ollamaModel: 'qwen2.5:7b', fallbackEnabled: true, fallbackModel: '' }, 'local/default'), {
    ollamaModel: 'qwen2.5:7b',
    fallbackModel: '',
    fallbackEnabled: false
  });
  assert.equal(routing.routeName({ type: 'COPY_GENERATION' }), 'copy');
  assert.equal(routing.routeName({ type: 'MEDIA_GENERATION' }), 'mediaPrompt');
});

test('video provider policy is bounded and paid generation requires a cost policy', () => {
  const policy = routing.normalizeMediaPolicy({ provider: 'RUNPOD', model: 'wan-2.2', fallbackProvider: 'FAL', fallbackModel: 'ltx-video', paidGenerationAllowed: true, maxCostCentsPerAsset: 999999 });
  assert.equal(policy.provider, 'RUNPOD');
  assert.equal(policy.fallbackProvider, 'FAL');
  assert.equal(policy.maxCostCentsPerAsset, 10000);
  assert.equal(policy.paidGenerationAllowed, true);
});
