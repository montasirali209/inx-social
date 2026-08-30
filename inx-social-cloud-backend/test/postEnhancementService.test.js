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

test('caption enhancement converts provider authentication failures into an actionable public error', async () => {
  const providerFailure = new Error('Request failed and included private provider details');
  providerFailure.response = { status: 401, data: { error: { message: 'private upstream detail' } } };
  const http = { post: async () => { throw providerFailure; } };

  await assert.rejects(
    service.enhanceCaption(
      { caption: 'caption', action: 'rewrite', tone: 'professional' },
      { http, config: { enabled: true, baseUrl: 'https://api.openai.com/v1', apiKey: 'test-secret', model: 'gpt-4o-mini', timeoutMs: 5000 } }
    ),
    error => {
      assert.equal(error.status, 503);
      assert.match(error.publicMessage, /authenticate with OpenAI/i);
      assert.doesNotMatch(error.publicMessage, /private upstream detail|test-secret/i);
      return true;
    }
  );
});

test('caption enhancement reports temporary OpenAI rate limiting without exposing provider data', async () => {
  const providerFailure = new Error('provider quota metadata');
  providerFailure.response = { status: 429 };
  const http = { post: async () => { throw providerFailure; } };

  await assert.rejects(
    service.enhanceCaption(
      { caption: 'caption', action: 'shorten', tone: 'concise' },
      { http, config: { enabled: true, baseUrl: 'https://api.openai.com/v1', apiKey: 'test-secret', model: 'gpt-4o-mini', timeoutMs: 5000 } }
    ),
    error => error.status === 429 && /rate limited/i.test(error.publicMessage)
  );
});
