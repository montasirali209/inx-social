const test = require('node:test');
const assert = require('node:assert/strict');
process.env.INX_OLLAMA_GATEWAY_TOKEN = 'test-token-that-is-at-least-32-characters-long';
const { createServer, secureEqual, config } = require('./server');

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
