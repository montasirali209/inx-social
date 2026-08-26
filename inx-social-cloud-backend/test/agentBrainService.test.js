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
const validCopy = JSON.stringify({ posts: [{
  title: 'A useful introduction',
  caption: 'Planning social content should feel clear, not chaotic. Our service helps creators and growing teams organise ideas, prepare consistent posts and keep their publishing work moving with confidence. Explore how a calmer content process can give your team more time to focus on the people it serves.',
  altText: 'Organised content ideas flowing into a clear publishing plan.',
  hashtags: ['SocialMediaPlanning', 'ContentStrategy'],
  visualBrief: 'A premium service-relevant visual showing scattered content ideas becoming an organised publishing flow.',
  objective: 'Introduce the service and encourage relevant Page visitors to learn more.'
}] });

test.afterEach(() => {
  Object.assign(env.ollama, original.ollama);
  Object.assign(env.aiFallback, original.aiFallback);
});

test('Ollama is always the first route and returns its selected task model', async () => {
  env.ollama.baseUrl = 'https://ollama.internal';
  const calls = [];
  const http = { post: async (url, body) => { calls.push({ url, body }); return { data: { message: { content: validCopy } } }; } };
  const result = await brain.generateTaskOutput(plan, task, { http, allowPaidFallback: true, route: { ollamaModel: 'qwen:test', fallbackEnabled: true, fallbackModel: 'paid/test' } });
  assert.equal(result.provider, 'ollama');
  assert.equal(result.model, 'qwen:test');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/chat$/);
  assert.equal(calls[0].body.think, false);
  assert.equal(calls[0].body.options.num_ctx, env.ollama.simpleContext);
});

test('complex strategy tasks use governed thinking and the verified 32K context', async () => {
  env.ollama.baseUrl = 'https://ollama.internal';
  env.ollama.complexContext = 32768;
  const calls = [];
  const strategyTask = { type: 'CONTENT_STRATEGY', title: 'Build strategy', description: 'Create the evidence-led campaign strategy.' };
  const http = { post: async (url, body) => { calls.push({ url, body }); return { data: { message: { content: 'Strategy result', thinking: 'private' } } }; } };
  await brain.generateTaskOutput(plan, strategyTask, { http, route: { ollamaModel: 'qwen3.5:9b', fallbackEnabled: false } });
  assert.equal(calls[0].body.think, true);
  assert.equal(calls[0].body.options.num_ctx, 32768);
});

test('brand review sends selected real assets to the vision model only when enabled', async () => {
  env.ollama.baseUrl = 'https://ollama.internal';
  env.ollama.visionEnabled = true;
  const calls = [];
  const brandTask = { type: 'BRAND_REVIEW', title: 'Review brand', description: 'Inspect the supplied logo and product screenshot.' };
  const http = { post: async (url, body) => { calls.push({ url, body }); return { data: { message: { content: 'Brand review' } } }; } };
  await brain.generateTaskOutput(plan, brandTask, {
    http,
    visionAssets: [{ id: 'logo-1', base64: 'aW1hZ2U=' }],
    route: { ollamaModel: 'qwen3.5:9b', fallbackEnabled: false }
  });
  assert.deepEqual(calls[0].body.messages[1].images, ['aW1hZ2U=']);
  assert.match(calls[0].body.messages[1].content, /Inspect the supplied images directly/);
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

test('mission-specific connected Facebook Page names are included in agent instructions', () => {
  const targetedPlan = { ...plan, strategyJson: JSON.stringify({ pageTargets: [{ id: 'page-1', name: 'North Shop' }, { id: 'page-2', name: 'South Shop' }] }) };
  const prompt = brain.taskInstruction(targetedPlan, task);
  assert.match(prompt, /Connected Facebook Page targets: North Shop, South Shop/);
});

test('a detailed delegated-research mission does not trigger an unnecessary clarification box', () => {
  const input = { prompt: 'Create a brand pack, Facebook cover photo and first post for INX Social. Research our website, competitors, current SEO keywords and suitable design direction before creating it.' };
  assert.equal(brain.instructionIsActionable(input), true);
  const parsed = brain.parsePreflight(JSON.stringify({
    needsClarification: true,
    understanding: 'Prepare the requested campaign.',
    question: 'Please provide competitors, SEO keywords and design preferences.',
    options: ['Provide competitors', 'Provide SEO keywords'],
    inferredContentOutput: 'IMAGE',
    generationPreference: 'QUALITY'
  }), input);
  assert.equal(parsed.needsClarification, false);
  assert.equal(parsed.question, '');
  assert.deepEqual(parsed.options, []);
});

test('a first Page post receives a benefit-led introduction brief and Quality generation', () => {
  const firstPostPlan = { prompt: 'Create the first Facebook post for our newly created INX Social page with an image related to the product', platformsJson: '["facebook"]' };
  const instruction = brain.taskInstruction(firstPostPlan, task);
  const fallback = brain.preflightFallback({ prompt: firstPostPlan.prompt });
  assert.equal(brain.isFirstPostMission(firstPostPlan.prompt), true);
  assert.equal(fallback.generationPreference, 'QUALITY');
  assert.match(instruction, /opening brand introduction/);
  assert.match(instruction, /what the product or business helps the customer accomplish/);
  assert.match(instruction, /70–140 words/);
  assert.match(instruction, /Do not request phones, fake dashboards/);
});

test('a content mission without a publishing decision asks one timing question', async () => {
  const analysis = await brain.analyseMission({ prompt: 'Create a Facebook post for my Page', platforms: ['facebook'] });
  assert.equal(analysis.needsClarification, true);
  assert.match(analysis.question, /When should/i);
  assert.deepEqual(analysis.options, ['Use AI-recommended researched time', 'Show the proposed date and time for my approval', 'Save it as a draft']);
});
