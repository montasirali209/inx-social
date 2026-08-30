const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/postEnhancementService');

test('caption enhancement uses the governed provider and returns only safe public fields', async () => {
  let request;
  const http = { post: async (...args) => {
    request = args;
    return { data: { choices: [{ message: { content: '```text\nA clearer caption with a focused CTA.\n```' } }] } };
  } };
  const result = await service.enhanceCaption(
    { caption: 'original caption', action: 'rewrite', tone: 'professional' },
    { http, config: { enabled: true, baseUrl: 'https://provider.example/v1', apiKey: 'test-secret', model: 'test-model', timeoutMs: 5000 } }
  );

  assert.deepEqual(result, { caption: 'A clearer caption with a focused CTA.', action: 'rewrite', tone: 'professional' });
  assert.equal(request[0], 'https://provider.example/v1/chat/completions');
  assert.equal(request[1].model, 'test-model');
  assert.equal(request[2].headers.Authorization, 'Bearer test-secret');
  assert.equal(JSON.stringify(result).includes('test-secret'), false);
});

test('caption enhancement fails closed when the provider is not configured', async () => {
  await assert.rejects(
    service.enhanceCaption(
      { caption: 'caption', action: 'shorten', tone: 'concise' },
      { config: { enabled: true, baseUrl: '', apiKey: '', model: '', timeoutMs: 5000 } }
    ),
    /not configured/i
  );
});
