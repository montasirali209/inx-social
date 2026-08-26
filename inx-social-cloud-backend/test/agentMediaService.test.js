const assert = require('node:assert/strict');
const test = require('node:test');
const sharp = require('sharp');

process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.TOKEN_ENCRYPTION_KEY ||= 'test-token-key';
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
process.env.OLLAMA_BASE_URL ||= 'https://private-ollama.example';
process.env.OLLAMA_API_KEY ||= 'test-gateway-token';
process.env.OLLAMA_IMAGE_MODEL ||= 'x/z-image-turbo';

const prismaPath = require.resolve('../src/db/prisma');
const brainPath = require.resolve('../src/services/agentBrainService');
let stored = null;
let selectedUploadLogo = null;
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { agentAsset: { create: async ({ data }) => { stored = data; return { id: 'generated-1', ...data }; }, findFirst: async () => selectedUploadLogo } } };
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

test('customer regeneration instructions are combined with AI context while generated text stays forbidden', () => {
  const prompt = media.campaignImagePrompt({ prompt: 'Launch INX Social', strategyJson: '{"pageTargets":[{"name":"INXSocial"}]}' }, {
    sequence: 1,
    title: 'Welcome to INX Social',
    visualBrief: 'A clean launch visual'
  }, { customerPrompt: 'Use a brighter cyan background and more negative space.' });
  assert.match(prompt, /Customer-requested change: Use a brighter cyan background/);
  assert.match(prompt, /Include no words, letters, numbers, logos/);
});

test('first-post imagery is treated as a product introduction instead of a dashboard advertisement', () => {
  const prompt = media.campaignImagePrompt({ prompt: 'Create our first Facebook post for the newly created INX Social page', strategyJson: '{"pageTargets":[{"name":"INX Social"}]}' }, {
    sequence: 1,
    title: 'Welcome to INX Social',
    visualBrief: 'Introduce the product and its customer benefit'
  });
  assert.match(prompt, /Page’s first post/);
  assert.match(prompt, /product’s customer benefit/);
  assert.match(prompt, /Do not turn it into a dashboard advertisement/);
});

test('exact uploaded logo and exact headline are composed after background generation', async () => {
  const base = await sharp({ create: { width: 600, height: 800, channels: 4, background: '#12324a' } }).png().toBuffer();
  const logo = await sharp({ create: { width: 180, height: 80, channels: 4, background: '#42dce5' } }).png().toBuffer();
  selectedUploadLogo = { data: logo, mimeType: 'image/png' };
  const result = await media.composeExactBranding({ userId: 'user-1', strategyJson: '{"referenceAssets":[{"id":"logo-1","kind":"LOGO"}]}' }, base, 'Welcome to INX Social');
  const metadata = await sharp(result).metadata();
  selectedUploadLogo = null;
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1350);
  assert.equal(metadata.format, 'png');
});

test('a second failed visual review is stored as rejected and never returned approval-ready', async () => {
  let imageCalls = 0;
  const result = await media.generateImages({ id: 'plan-2', userId: 'user-1', prompt: 'Create one branded post image', strategyJson: '{"assetCount":1,"mediaModel":"IMAGE_QUALITY"}' }, { title: 'Generate image' }, {
    policy: { enabled: true, model: 'fast-private', qualityModel: 'quality-private', size: '1024x1536', maxAssetsPerMission: 1 },
    http: { post: async (url, body) => {
      if (url.endsWith('/api/chat')) return { data: { message: { content: JSON.stringify({ approved: false, score: 31, issues: ['Gibberish text'], correction: 'Remove all lettering' }) } } };
      imageCalls += 1;
      assert.equal(body.model, 'quality-private');
      return { data: { data: [{ b64_json: png.toString('base64') }] } };
    } }
  });
  assert.equal(imageCalls, 2);
  assert.equal(result.assets.length, 0);
  assert.equal(result.rejectedCount, 1);
  assert.equal(stored.status, 'REJECTED');
  assert.equal(stored.qualityScore, 31);
  assert.match(stored.qualityIssuesJson, /Gibberish text/);
});
