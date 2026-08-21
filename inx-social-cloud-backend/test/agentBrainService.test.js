const assert = require('node:assert/strict');
const test = require('node:test');

const env = require('../src/config/env');
const brain = require('../src/services/agentBrainService');

const plan = { prompt: 'Create truthful educational posts', platformsJson: '["facebook"]' };
const task = { type: 'COPY_GENERATION', title: 'Write captions', description: 'Write three concise captions.' };
const original = {
  ollama: { ...env.ollama },
  aiFallback: { ...env.aiFallback }
};

test.afterEach(() => {
  Object.assign(env.ollama, original.ollama);
  Object.assign(env.aiFallback, original.aiFallback);
});

test('Ollama is always the first route and returns its selected task model', async () => {
  env.ollama.baseUrl = 'https://ollama.internal';
  const calls = [];
  const http = { post: async (url, body) => { calls.push({ url, body }); return { data: { message: { content: 'Ollama result' } } }; } };
  const result = await brain.generateTaskOutput(plan, task, { http, allowPaidFallback: true, route: { ollamaModel: 'qwen:test', fallbackEnabled: true, fallbackModel: 'paid/test' } });
  assert.equal(result.provider, 'ollama');
  assert.equal(result.model, 'qwen:test');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/chat$/);
});

test('paid fallback is used only after genuine Ollama unavailability', async () => {
  env.ollama.baseUrl = 'https://ollama.internal';
  Object.assign(env.aiFallback, { enabled: true, baseUrl: 'https://gateway.example/v1', apiKey: 'test-key', model: 'gateway/default' });
  let call = 0;
  const http = { post: async () => {
    call += 1;
    if (call === 1) throw Object.assign(new Error('offline'), { code: 'ECONNREFUSED' });
    return { data: { choices: [{ message: { content: 'Fallback result' } }] } };
  } };
  const result = await brain.generateTaskOutput(plan, task, { http, allowPaidFallback: true, route: { ollamaModel: 'qwen:test', fallbackEnabled: true, fallbackModel: 'gateway/small' } });
  assert.equal(result.provider, 'paid-fallback');
  assert.equal(result.model, 'gateway/small');
  assert.equal(call, 2);
});

test('an Ollama request error does not silently spend paid API credit', async () => {
  env.ollama.baseUrl = 'https://ollama.internal';
  Object.assign(env.aiFallback, { enabled: true, baseUrl: 'https://gateway.example/v1', apiKey: 'test-key', model: 'gateway/default' });
  let call = 0;
  const error = Object.assign(new Error('bad prompt'), { response: { status: 400 } });
  await assert.rejects(() => brain.generateTaskOutput(plan, task, {
    http: { post: async () => { call += 1; throw error; } },
    allowPaidFallback: true,
    route: { ollamaModel: 'qwen:test', fallbackEnabled: true, fallbackModel: 'gateway/small' }
  }), /bad prompt/);
  assert.equal(call, 1);
});

test('only approved playbooks supplied by runtime are included without chain-of-thought requests', () => {
  const prompt = brain.taskInstruction(plan, task, [{ title: 'Approved caption pattern', content: 'Lead with the audience problem, then one factual benefit.' }]);
  assert.match(prompt, /Approved caption pattern/);
  assert.match(prompt, /Do not reveal hidden chain-of-thought/);
});
