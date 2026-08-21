const test = require('node:test');
const assert = require('node:assert/strict');
process.env.INX_OLLAMA_GATEWAY_TOKEN = 'test-token-that-is-at-least-32-characters-long';
const { createServer, secureEqual } = require('./server');

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
