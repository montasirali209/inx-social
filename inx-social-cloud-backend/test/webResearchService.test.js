const assert = require('node:assert/strict');
const test = require('node:test');

const env = require('../src/config/env');
const research = require('../src/services/webResearchService');

const original = {
  webResearch: { ...env.webResearch },
  ollama: { ...env.ollama }
};

test.afterEach(() => {
  Object.assign(env.webResearch, original.webResearch);
  Object.assign(env.ollama, original.ollama);
});

function configure() {
  Object.assign(env.webResearch, {
    enabled: true,
    provider: 'openai',
    baseUrl: 'https://api.openai.test/v1',
    apiKey: 'openai-test',
    model: 'gpt-test',
    maxSources: 4,
    maxQueries: 3,
    country: 'GB',
    language: 'en',
    timeoutMs: 120000
  });
  Object.assign(env.ollama, { baseUrl: 'https://ollama.test', model: 'qwen3.5:test', apiKey: 'ollama-test', simpleContext: 8192, complexContext: 32768 });
}

const plan = {
  prompt: 'Create a current Facebook launch campaign for INX Social',
  platformsJson: '["facebook"]',
  strategyJson: '{"pageTargets":[{"name":"INX Social"}]}',
  researchSettings: { timezone: 'Europe/London' }
};

function openAIResponse() {
  return {
    output: [
      { type: 'web_search_call', action: { sources: [
        { title: 'Current source', url: 'https://example.com/current' },
        { title: 'Duplicate source', url: 'https://example.com/current' }
      ] } },
      { type: 'message', content: [{
        type: 'output_text',
        text: JSON.stringify({
          summary: 'Evidence-backed refined summary.',
          content: 'Current findings checked against the Ollama-first draft.',
          recommendations: ['Use the supported audience language.'],
          cautions: ['Do not invent performance claims.'],
          reusableLearning: 'Verify a launch angle against current sources before producing the final campaign.'
        }),
        annotations: [{ type: 'url_citation', title: 'Second source', url: 'https://example.org/second' }]
      }] }
    ]
  };
}

test('research requires both OpenAI web search and the private Ollama analyst', () => {
  configure();
  env.webResearch.apiKey = '';
  assert.equal(research.status().configured, false);
  env.webResearch.apiKey = 'openai-test';
  assert.equal(research.status().configured, true);
  env.ollama.baseUrl = '';
  assert.equal(research.status().configured, false);
});

test('complex research starts with Ollama then uses one OpenAI Responses web-search refinement', async () => {
  configure();
  const calls = [];
  const http = { post: async (url, body, options) => {
    calls.push({ url, body, options });
    if (url.endsWith('/api/chat')) return { data: { message: {
      content: JSON.stringify({
        summary: 'Ollama initial view.',
        content: 'Initial private reasoning based on mission and approved knowledge.',
        researchQueries: ['INX Social current UK audience needs', 'social scheduling competitor positioning'],
        uncertainties: ['Current engagement preferences require evidence.']
      }),
      thinking: 'must never be consumed or stored'
    } } };
    if (url.endsWith('/responses')) return { data: openAIResponse() };
    throw new Error(`Unexpected URL ${url}`);
  } };
  const result = await research.researchMission(plan, { http });
  assert.deepEqual(calls.map(call => call.url), ['https://ollama.test/api/chat', 'https://api.openai.test/v1/responses']);
  assert.equal(calls[0].body.model, 'qwen3.5:test');
  assert.equal(calls[0].body.think, true);
  assert.equal(calls[0].body.options.num_ctx, 32768);
  assert.equal(calls[1].body.model, 'gpt-test');
  assert.equal(calls[1].body.tool_choice, 'required');
  assert.deepEqual(calls[1].body.tools.map(tool => tool.type), ['web_search']);
  assert.match(calls[1].body.input, /OLLAMA FIRST DRAFT/);
  assert.doesNotMatch(calls[1].body.input, /must never be consumed/);
  assert.equal(result.summary, 'Evidence-backed refined summary.');
  assert.equal(result.refinementUsed, true);
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources[0].url, 'https://example.com/current');
  assert.match(result.reusableLearning, /Verify a launch angle/);
});

test('OpenAI response citations are deduplicated and unsafe URLs are rejected', () => {
  configure();
  const data = openAIResponse();
  data.sources = [{ title: 'Unsafe', url: 'javascript:alert(1)' }];
  const sources = research.extractResponseSources(data);
  assert.deepEqual(sources, [
    { title: 'Current source', url: 'https://example.com/current' },
    { title: 'Second source', url: 'https://example.org/second' }
  ]);
});

test('a paid response without live source citations is rejected', async () => {
  configure();
  const http = { post: async url => {
    if (url.endsWith('/api/chat')) return { data: { message: { content: JSON.stringify({ summary: 'Draft', content: 'Draft content', researchQueries: ['query'], uncertainties: [] }) } } };
    return { data: { output_text: JSON.stringify({ summary: 'Unsupported', content: 'No citations', recommendations: [], cautions: [], reusableLearning: '' }) } };
  } };
  await assert.rejects(() => research.researchMission(plan, { http }), error => error.code === 'WEB_RESEARCH_EMPTY');
});
