const test = require('node:test');
const assert = require('node:assert/strict');
process.env.INX_OLLAMA_GATEWAY_TOKEN = 'test-token-that-is-at-least-32-characters-long';
const { createServer, secureEqual, config, imageDimensions } = require('./server');

test('gateway uses constant-time compatible token comparison', () => {
  assert.equal(secureEqual('same-token', 'same-token'), true);
  assert.equal(secureEqual('same-token', 'different-token'), false);
});

test('gateway rejects requests without its bearer token', async () => {
  const server = createServer().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
  assert.equal(response.status, 401);
  await new Promise(resolve => server.close(resolve));
});

test('gateway reports separately allow-listed image models', async () => {
  config.imageModels = new Set(['x/z-image-turbo']);
  const server = createServer().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/health`, { headers: { authorization: `Bearer ${process.env.INX_OLLAMA_GATEWAY_TOKEN}` } });
  const body = await response.json();
  assert.equal(body.imageGeneration, true);
  assert.deepEqual(body.imageModels, ['x/z-image-turbo']);
  await new Promise(resolve => server.close(resolve));
});

test('image dimensions accept bounded social formats and default safely', () => {
  assert.deepEqual(imageDimensions('1024x1536'), { width: 1024, height: 1536 });
  assert.deepEqual(imageDimensions('9999x9999'), { width: 1024, height: 1024 });
});

test('image route translates Ollama image output to b64_json', async () => {
  config.imageModels = new Set(['x/z-image-turbo']);
  const originalFetch = global.fetch;
  let forwarded = null;
  global.fetch = async (_url, options) => {
    forwarded = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ image: 'iVBORw0KGgo=' }) };
  };
  const server = createServer().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await originalFetch(`http://127.0.0.1:${server.address().port}/v1/images/generations`, {
      method: 'POST', headers: { authorization: `Bearer ${process.env.INX_OLLAMA_GATEWAY_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'x/z-image-turbo', prompt: 'A safe test image', size: '512x512', response_format: 'b64_json' })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data[0].b64_json, 'iVBORw0KGgo=');
    assert.deepEqual(forwarded, { model: 'x/z-image-turbo', prompt: 'A safe test image', stream: false, width: 512, height: 512 });
  } finally {
    global.fetch = originalFetch;
    await new Promise(resolve => server.close(resolve));
  }
});

test('image route rejects models outside the image allow-list before calling Ollama', async () => {
  config.imageModels = new Set(['x/z-image-turbo']);
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('must not run'); };
  const server = createServer().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await originalFetch(`http://127.0.0.1:${server.address().port}/v1/images/generations`, {
      method: 'POST', headers: { authorization: `Bearer ${process.env.INX_OLLAMA_GATEWAY_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'not-allowed', prompt: 'test' })
    });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
    await new Promise(resolve => server.close(resolve));
  }
});
