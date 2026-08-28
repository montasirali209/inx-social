const assert = require('node:assert/strict');
const test = require('node:test');

process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.TOKEN_ENCRYPTION_KEY ||= 'test-token-key';
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
process.env.OLLAMA_BASE_URL ||= 'https://private-ollama.example';
process.env.OLLAMA_API_KEY ||= 'test-gateway-token';
process.env.OLLAMA_IMAGE_MODEL ||= 'x/z-image-turbo';
process.env.OPENAI_IMAGE_API_KEY ||= 'test-openai-key';

const prismaPath = require.resolve('../src/db/prisma');
const brainPath = require.resolve('../src/services/agentBrainService');
let stored = null;
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { agentAsset: { count: async () => 0, create: async ({ data }) => { stored = data; return { id: 'generated-1', ...data }; } } } };
require.cache[brainPath] = { id: brainPath, filename: brainPath, loaded: true, exports: { ollamaHeaders: () => ({ Authorization: 'Bearer private' }) } };
const media = require('../src/services/agentMediaService');

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test('local image generation stores an authenticated mission asset without paid fallback', async () => {
  const result = await media.generateImages({ id: 'plan-1', userId: 'user-1', prompt: 'Create one branded post image', strategyJson: '{"assetCount":1}' }, { title: 'Generate image' }, {
    policy: { enabled: true, model: 'x/z-image-turbo', size: '1024x1024', maxAssetsPerMission: 1 },
    http: { post: async (url, body) => {
      if (url.endsWith('/api/chat')) {
        assert.equal(body.model, 'qwen3:8b');
        assert.equal(body.think, false);
        assert.equal(Array.isArray(body.messages[1].images), true);
        return { data: { message: { content: JSON.stringify({ approved: true, score: 91, issues: [], correction: '' }), thinking: 'private' } } };
      }
      assert.equal(url, 'https://private-ollama.example/v1/images/generations');
      assert.equal(body.response_format, 'b64_json');
      return { data: { data: [{ b64_json: png.toString('base64') }] } };
    } }
  });
  assert.equal(result.assets.length, 1);
  assert.equal(stored.source, 'OLLAMA_IMAGE');
  assert.equal(stored.mimeType, 'image/png');
  assert.equal(stored.planId, 'plan-1');
  assert.equal(result.assets[0].contentUrl, '/api/agent/assets/generated-1/content');
  assert.equal(result.assets[0].qualityReview.approved, true);
  assert.equal(result.assets[0].qualityReview.score, 91);
});

test('generated files must have a recognised image signature', () => {
  assert.throws(() => media.imageType(Buffer.from('not-an-image')), /unsupported image format/);
});

test('campaign custom instructions are placed above the hard no-interface contract', () => {
  const prompt = media.campaignImagePrompt({ prompt: 'Introduce the service', strategyJson: '{}' }, { sequence: 1, title: 'Welcome', visualBrief: 'Show a dashboard' }, { customerPrompt: 'Use an editorial paper-flow metaphor with no devices.' });
  assert.match(prompt, /HIGHEST-PRIORITY CUSTOMER DIRECTION: Use an editorial paper-flow metaphor with no devices/);
  assert.match(prompt, /NON-NEGOTIABLE OUTPUT CONTRACT/);
  assert.match(prompt, /Do not draw any words, letters, numbers/);
});

test('Premium uses the governed OpenAI image endpoint and one paid attempt', async () => {
  let openaiCalls = 0;
  const result = await media.regenerateCampaignImage(
    { id: 'plan-premium', userId: 'user-1', prompt: 'Create a premium first post', strategyJson: '{}' },
    { sequence: 1, title: 'Welcome', visualBrief: 'A precise editorial workflow' },
    { generationChoice: 'IMAGE_PREMIUM', customerPrompt: 'Use a navy and cyan paper-flow metaphor.' },
    {
      policy: { enabled: true, paidEnabled: true, route: 'LOCAL_ONLY', model: 'x/z-image-turbo', qualityModel: 'x/flux2-klein:4b', size: '1024x1536', maxPaidImagesPerMission: 1, openaiModel: 'gpt-image-2', openaiQuality: 'medium' },
      composeImage: async ({ data }) => data,
      http: { post: async (url, body, config) => {
        if (url.endsWith('/api/chat')) return { data: { message: { content: JSON.stringify({ approved: true, score: 94, issues: [], correction: '' }) } } };
        openaiCalls += 1;
        assert.equal(url, 'https://api.openai.com/v1/images/generations');
        assert.equal(body.model, 'gpt-image-2');
        assert.equal(body.quality, 'medium');
        assert.equal(body.size, '1024x1536');
        assert.equal(body.response_format, undefined);
        assert.equal(config.headers.Authorization, 'Bearer test-openai-key');
        return { data: { data: [{ b64_json: png.toString('base64') }] } };
      } }
    }
  );
  assert.equal(openaiCalls, 1);
  assert.equal(result.status, 'READY');
  assert.equal(stored.source, 'OPENAI_IMAGE');
  assert.equal(stored.generationChoice, 'IMAGE_PREMIUM');
});

test('Premium is blocked when administrator paid policy is off', async () => {
  await assert.rejects(() => media.assertPaidImageBudget({ id: 'plan-1' }, { paidEnabled: false, maxPaidImagesPerMission: 1 }), error => error.code === 'PAID_IMAGE_DISABLED' && error.status === 403);
});

test('local quality rejection can use one administrator-approved paid recovery image', async () => {
  let localCalls = 0;
  let openaiCalls = 0;
  let reviews = 0;
  const result = await media.regenerateCampaignImage(
    { id: 'plan-recovery', userId: 'user-1', prompt: 'Introduce a social scheduling service', strategyJson: '{}' },
    { sequence: 1, title: 'Welcome', visualBrief: 'Show organised publishing flow' },
    { generationChoice: 'IMAGE_QUALITY', customerPrompt: 'No phones, no dashboards and no generated text.' },
    {
      policy: { enabled: true, paidEnabled: true, route: 'LOCAL_THEN_OPENAI', model: 'x/z-image-turbo', qualityModel: 'x/flux2-klein:4b', size: '1024x1536', maxPaidImagesPerMission: 1, openaiModel: 'gpt-image-2', openaiQuality: 'medium' },
      composeImage: async ({ data }) => data,
      http: { post: async (url) => {
        if (url.endsWith('/api/chat')) {
          reviews += 1;
          return { data: { message: { content: JSON.stringify(reviews < 3 ? { approved: false, score: 30, issues: ['Contains fake interface'], correction: 'Use a clean abstract paper flow.' } : { approved: true, score: 92, issues: [], correction: '' }) } } };
        }
        if (url.includes('private-ollama.example')) localCalls += 1;
        else openaiCalls += 1;
        return { data: { data: [{ b64_json: png.toString('base64') }] } };
      } }
    }
  );
  assert.equal(localCalls, 2);
  assert.equal(openaiCalls, 1);
  assert.equal(reviews, 3);
  assert.equal(result.status, 'READY');
  assert.equal(stored.source, 'OPENAI_IMAGE');
});
