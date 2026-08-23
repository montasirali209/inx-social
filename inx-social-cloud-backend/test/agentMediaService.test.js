const assert = require('node:assert/strict');
const test = require('node:test');

process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.TOKEN_ENCRYPTION_KEY ||= 'test-token-key';
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
process.env.OLLAMA_BASE_URL ||= 'https://private-ollama.example';
process.env.OLLAMA_API_KEY ||= 'test-gateway-token';
process.env.OLLAMA_IMAGE_MODEL ||= 'x/z-image-turbo';

const prismaPath = require.resolve('../src/db/prisma');
const brainPath = require.resolve('../src/services/agentBrainService');
let stored = null;
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { agentAsset: { create: async ({ data }) => { stored = data; return { id: 'generated-1', ...data }; } } } };
require.cache[brainPath] = { id: brainPath, filename: brainPath, loaded: true, exports: { ollamaHeaders: () => ({ Authorization: 'Bearer private' }) } };
const media = require('../src/services/agentMediaService');

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test('local image generation stores an authenticated mission asset without paid fallback', async () => {
  const result = await media.generateImages({ id: 'plan-1', userId: 'user-1', prompt: 'Create one branded post image', strategyJson: '{"assetCount":1}' }, { title: 'Generate image' }, {
    policy: { enabled: true, model: 'x/z-image-turbo', size: '1024x1024', maxAssetsPerMission: 1 },
    http: { post: async (url, body) => {
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
});

test('generated files must have a recognised image signature', () => {
  assert.throws(() => media.imageType(Buffer.from('not-an-image')), /unsupported image format/);
});
