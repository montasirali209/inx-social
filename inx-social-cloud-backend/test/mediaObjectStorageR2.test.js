'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const MODULE_PATH = require.resolve('../src/services/mediaObjectStorageService');

const ENV_KEYS = [
  'R2_MEDIA_ENDPOINT',
  'R2_MEDIA_BUCKET',
  'R2_MEDIA_ACCESS_KEY_ID',
  'R2_MEDIA_SECRET_ACCESS_KEY',
  'R2_MEDIA_REGION',
  'MEDIA_S3_ENDPOINT',
  'MEDIA_BUCKET',
  'MEDIA_S3_ACCESS_KEY_ID',
  'MEDIA_S3_SECRET_ACCESS_KEY',
  'MEDIA_S3_REGION'
];

function loadWithEnv(values) {
  const previous = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  delete require.cache[MODULE_PATH];
  const service = require(MODULE_PATH);

  return {
    service,
    restore() {
      delete require.cache[MODULE_PATH];
      for (const key of ENV_KEYS) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  };
}

const railway = {
  MEDIA_S3_ENDPOINT: 'https://railway.example',
  MEDIA_BUCKET: 'inxsocial-media',
  MEDIA_S3_ACCESS_KEY_ID: 'railway-key',
  MEDIA_S3_SECRET_ACCESS_KEY: 'railway-secret',
  MEDIA_S3_REGION: 'auto'
};

const r2 = {
  R2_MEDIA_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
  R2_MEDIA_BUCKET: 'inxsocial-generated-media',
  R2_MEDIA_ACCESS_KEY_ID: 'r2-key',
  R2_MEDIA_SECRET_ACCESS_KEY: 'r2-secret',
  R2_MEDIA_REGION: 'auto'
};

test('Railway remains the operational media provider when R2 is not configured', () => {
  const fixture = loadWithEnv(railway);
  try {
    assert.deepEqual(fixture.service.providerStatus(), {
      operationalProvider: 'RAILWAY_S3',
      generatedMediaProvider: 'RAILWAY_S3',
      cloudflareR2Configured: false,
      railwayConfigured: true
    });
    assert.equal(fixture.service.providerForPrefix('media-library'), 'RAILWAY_S3');
    assert.equal(fixture.service.providerForPrefix('agent-assets'), 'RAILWAY_S3');
    assert.equal(fixture.service.providerForPrefix('ai-studio'), 'RAILWAY_S3');
  } finally {
    fixture.restore();
  }
});

test('R2 is used only for high-volume customer generation outputs', () => {
  const fixture = loadWithEnv({ ...railway, ...r2 });
  try {
    assert.deepEqual(fixture.service.providerStatus(), {
      operationalProvider: 'RAILWAY_S3',
      generatedMediaProvider: 'CLOUDFLARE_R2',
      cloudflareR2Configured: true,
      railwayConfigured: true
    });

    for (const prefix of ['ai-studio', 'ai-video', 'stock-video']) {
      assert.equal(fixture.service.providerForPrefix(prefix), 'CLOUDFLARE_R2');
    }

    for (const prefix of ['media-library', 'agent-assets', 'media', 'uploads']) {
      assert.equal(fixture.service.providerForPrefix(prefix), 'RAILWAY_S3');
    }
  } finally {
    fixture.restore();
  }
});

test('R2 alone cannot silently take over operational Railway media storage', () => {
  const fixture = loadWithEnv(r2);
  try {
    assert.equal(fixture.service.providerForPrefix('ai-studio'), 'CLOUDFLARE_R2');
    assert.equal(fixture.service.providerForPrefix('ai-video'), 'CLOUDFLARE_R2');
    assert.equal(fixture.service.providerForPrefix('stock-video'), 'CLOUDFLARE_R2');
    assert.equal(fixture.service.providerForPrefix('media-library'), null);
    assert.equal(fixture.service.providerForPrefix('agent-assets'), null);
  } finally {
    fixture.restore();
  }
});
