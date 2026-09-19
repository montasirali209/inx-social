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

test('Railway object storage remains the primary provider until R2 is fully configured', () => {
  const fixture = loadWithEnv({
    MEDIA_S3_ENDPOINT: 'https://railway.example',
    MEDIA_BUCKET: 'inxsocial-media',
    MEDIA_S3_ACCESS_KEY_ID: 'railway-key',
    MEDIA_S3_SECRET_ACCESS_KEY: 'railway-secret',
    MEDIA_S3_REGION: 'auto'
  });
  try {
    assert.equal(fixture.service.isConfigured(), true);
    assert.deepEqual(fixture.service.providerStatus(), {
      primary: 'RAILWAY_S3',
      cloudflareR2Configured: false,
      railwayLegacyConfigured: true
    });
  } finally {
    fixture.restore();
  }
});

test('Cloudflare R2 becomes primary while Railway stays available as legacy fallback', () => {
  const fixture = loadWithEnv({
    R2_MEDIA_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
    R2_MEDIA_BUCKET: 'inxsocial-media',
    R2_MEDIA_ACCESS_KEY_ID: 'r2-key',
    R2_MEDIA_SECRET_ACCESS_KEY: 'r2-secret',
    R2_MEDIA_REGION: 'auto',
    MEDIA_S3_ENDPOINT: 'https://railway.example',
    MEDIA_BUCKET: 'inxsocial-media',
    MEDIA_S3_ACCESS_KEY_ID: 'railway-key',
    MEDIA_S3_SECRET_ACCESS_KEY: 'railway-secret'
  });
  try {
    assert.equal(fixture.service.isConfigured(), true);
    assert.deepEqual(fixture.service.providerStatus(), {
      primary: 'CLOUDFLARE_R2',
      cloudflareR2Configured: true,
      railwayLegacyConfigured: true
    });
  } finally {
    fixture.restore();
  }
});

test('R2 can run as the only media backend', () => {
  const fixture = loadWithEnv({
    R2_MEDIA_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
    R2_MEDIA_BUCKET: 'inxsocial-media',
    R2_MEDIA_ACCESS_KEY_ID: 'r2-key',
    R2_MEDIA_SECRET_ACCESS_KEY: 'r2-secret'
  });
  try {
    assert.equal(fixture.service.config().provider, 'CLOUDFLARE_R2');
    assert.equal(fixture.service.config().region, 'auto');
  } finally {
    fixture.restore();
  }
});
