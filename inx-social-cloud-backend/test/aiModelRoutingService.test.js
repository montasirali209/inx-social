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
  assert.equal(routing.routeName({ type: 'IMAGE_GENERATION' }), 'mediaPrompt');
});

test('image policy defaults to local-only and remains bounded', () => {
  const policy = routing.normalizeImagePolicy({ enabled: true, paidEnabled: false, route: 'OPENAI_PREFERRED', model: 'x/z-image-turbo', size: 'invalid', maxAssetsPerMission: 99 });
  assert.equal(policy.provider, 'OLLAMA_IMAGE');
  assert.equal(policy.route, 'LOCAL_ONLY');
  assert.equal(policy.size, '1024x1536');
  assert.equal(policy.maxAssetsPerMission, 4);
});

test('administrator can enable a bounded OpenAI image route', () => {
  const policy = routing.normalizeImagePolicy({ paidEnabled: true, route: 'LOCAL_THEN_OPENAI', openaiModel: 'gpt-image-2', openaiQuality: 'high', maxPaidImagesPerMission: 99 });
  assert.equal(policy.route, 'LOCAL_THEN_OPENAI');
  assert.equal(policy.openaiModel, 'gpt-image-2');
  assert.equal(policy.openaiQuality, 'high');
  assert.equal(policy.maxPaidImagesPerMission, 4);
});

test('video provider policy is bounded and paid generation requires a cost policy', () => {
  const policy = routing.normalizeMediaPolicy({ provider: 'RUNPOD', model: 'wan-2.2', fallbackProvider: 'FAL', fallbackModel: 'ltx-video', paidGenerationAllowed: true, maxCostCentsPerAsset: 999999 });
  assert.equal(policy.provider, 'RUNPOD');
  assert.equal(policy.fallbackProvider, 'FAL');
  assert.equal(policy.maxCostCentsPerAsset, 10000);
  assert.equal(policy.paidGenerationAllowed, true);
});
