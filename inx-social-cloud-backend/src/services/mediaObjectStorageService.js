'use strict';

const crypto = require('node:crypto');
const axios = require('axios');
const aws4 = require('aws4');

const PROVIDERS = {
  CLOUDFLARE_R2: 'CLOUDFLARE_R2',
  RAILWAY_S3: 'RAILWAY_S3'
};

function clean(value) {
  return String(value || '').trim();
}

function buildConfig(provider, envPrefix, defaults = {}) {
  const endpoint = clean(process.env[`${envPrefix}_ENDPOINT`]).replace(/\/+$/, '');
  const bucket = clean(process.env[`${envPrefix}_BUCKET`]);
  const accessKeyId = clean(process.env[`${envPrefix}_ACCESS_KEY_ID`]);
  const secretAccessKey = clean(process.env[`${envPrefix}_SECRET_ACCESS_KEY`]);
  const region = clean(process.env[`${envPrefix}_REGION`] || defaults.region || 'auto') || 'auto';
  return { provider, endpoint, bucket, accessKeyId, secretAccessKey, region };
}

function cloudflareR2Config() {
  return buildConfig(PROVIDERS.CLOUDFLARE_R2, 'R2_MEDIA', { region: 'auto' });
}

function railwayS3Config() {
  return {
    provider: PROVIDERS.RAILWAY_S3,
    endpoint: clean(process.env.MEDIA_S3_ENDPOINT).replace(/\/+$/, ''),
    bucket: clean(process.env.MEDIA_BUCKET),
    accessKeyId: clean(process.env.MEDIA_S3_ACCESS_KEY_ID),
    secretAccessKey: clean(process.env.MEDIA_S3_SECRET_ACCESS_KEY),
    region: clean(process.env.MEDIA_S3_REGION || 'auto') || 'auto'
  };
}

function complete(value) {
  return Boolean(value?.endpoint && value?.bucket && value?.accessKeyId && value?.secretAccessKey);
}

function configuredProviders() {
  // R2 is intentionally first. Once all R2 variables are present, new writes switch
  // to R2 automatically while the existing Railway bucket remains a read fallback.
  return [cloudflareR2Config(), railwayS3Config()].filter(complete);
}

function primaryConfig() {
  return configuredProviders()[0] || null;
}

function orderedConfigs(preferredProvider = null) {
  const configs = configuredProviders();
  if (!preferredProvider) return configs;
  return [
    ...configs.filter(value => value.provider === preferredProvider),
    ...configs.filter(value => value.provider !== preferredProvider)
  ];
}

function config() {
  return primaryConfig() || cloudflareR2Config();
}

function isConfigured() {
  return Boolean(primaryConfig());
}

function providerStatus() {
  const r2 = cloudflareR2Config();
  const railway = railwayS3Config();
  return {
    primary: primaryConfig()?.provider || null,
    cloudflareR2Configured: complete(r2),
    railwayLegacyConfigured: complete(railway)
  };
}

function encodeKey(key) {
  return String(key || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

function objectTarget(key, storageConfig) {
  const base = new URL(storageConfig.endpoint);
  const encoded = encodeKey(key);
  // Both Railway's S3-compatible bucket and Cloudflare R2 support virtual-hosted
  // object addressing. Cloudflare documents:
  // https://<bucket>.<ACCOUNT_ID>.r2.cloudflarestorage.com/<key>
  const host = base.hostname.startsWith(`${storageConfig.bucket}.`)
    ? base.hostname
    : `${storageConfig.bucket}.${base.hostname}`;
  const port = base.port ? `:${base.port}` : '';
  const basePath = base.pathname && base.pathname !== '/' ? base.pathname.replace(/\/$/, '') : '';
  const path = `${basePath}/${encoded}`;
  return {
    host: `${host}${port}`,
    path,
    url: `${base.protocol}//${host}${port}${path}`
  };
}

function notConfiguredError() {
  const error = new Error('Media object storage is not configured.');
  error.code = 'MEDIA_OBJECT_STORAGE_NOT_CONFIGURED';
  return error;
}

function signedRequest(method, key, { data, headers = {}, responseType = 'arraybuffer' } = {}, storageConfig = primaryConfig()) {
  if (!storageConfig || !complete(storageConfig)) throw notConfiguredError();
  const target = objectTarget(key, storageConfig);
  const body = data == null ? undefined : data;
  const request = {
    host: target.host,
    path: target.path,
    method,
    service: 's3',
    region: storageConfig.region,
    headers: {
      ...headers,
      Host: target.host
    },
    body
  };
  aws4.sign(request, {
    accessKeyId: storageConfig.accessKeyId,
    secretAccessKey: storageConfig.secretAccessKey
  });
  return axios({
    method,
    url: target.url,
    headers: request.headers,
    data: body,
    responseType,
    timeout: 180000,
    maxContentLength: 150 * 1024 * 1024,
    maxBodyLength: 150 * 1024 * 1024,
    validateStatus: status => status >= 200 && status < 300
  });
}

function createStorageKey({ userId, mimeType, originalName, prefix = 'media' }) {
  const ext = String(originalName || '').match(/\.([A-Za-z0-9]{1,8})$/)?.[1]
    || (String(mimeType || '').startsWith('video/') ? 'mp4' : 'bin');
  return [
    prefix,
    encodeURIComponent(String(userId || 'unknown')),
    new Date().toISOString().slice(0, 10),
    `${Date.now()}-${crypto.randomUUID()}.${ext.toLowerCase()}`
  ].join('/');
}

async function putBuffer({ key, data, mimeType, provider = null }) {
  if (!Buffer.isBuffer(data) || !data.length) throw new Error('Cannot store an empty media object.');
  const targetConfig = orderedConfigs(provider)[0];
  if (!targetConfig) throw notConfiguredError();
  await signedRequest('PUT', key, {
    data,
    headers: {
      'Content-Type': String(mimeType || 'application/octet-stream'),
      'Content-Length': String(data.length),
      'x-amz-content-sha256': crypto.createHash('sha256').update(data).digest('hex')
    },
    responseType: 'text'
  }, targetConfig);
  return { key, provider: targetConfig.provider };
}

async function getBuffer(key, range = null, provider = null) {
  const configs = orderedConfigs(provider);
  if (!configs.length) throw notConfiguredError();

  let lastNotFound = null;
  for (const storageConfig of configs) {
    try {
      const headers = {};
      if (range) headers.Range = range;
      const response = await signedRequest('GET', key, { headers, responseType: 'arraybuffer' }, storageConfig);
      return Buffer.from(response.data || []);
    } catch (error) {
      if (error?.response?.status === 404) {
        lastNotFound = error;
        continue;
      }
      throw error;
    }
  }
  throw lastNotFound || new Error('Media object was not found in configured storage providers.');
}

async function deleteObject(key, provider = null) {
  if (!key) return false;
  const configs = orderedConfigs(provider);
  if (!configs.length) return false;

  let deleted = false;
  let firstError = null;
  // Delete from every configured backend so a migrated object cannot leave a
  // stale duplicate behind in the Railway legacy bucket.
  for (const storageConfig of configs) {
    try {
      await signedRequest('DELETE', key, { responseType: 'text' }, storageConfig);
      deleted = true;
    } catch (error) {
      if (error?.response?.status === 404) continue;
      firstError ||= error;
    }
  }
  if (firstError && !deleted) throw firstError;
  return deleted;
}

async function persistBuffer({ userId, data, mimeType, originalName, prefix }) {
  const targetConfig = primaryConfig();
  if (!targetConfig) {
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
      const error = new Error('Media object storage is not configured; refusing to write binary media into PostgreSQL.');
      error.code = 'MEDIA_OBJECT_STORAGE_REQUIRED';
      throw error;
    }
    return { storageProvider: 'DATABASE', storageKey: null, data };
  }

  const key = createStorageKey({ userId, mimeType, originalName, prefix });
  await putBuffer({ key, data, mimeType, provider: targetConfig.provider });
  return {
    storageProvider: targetConfig.provider,
    storageKey: key,
    data: null
  };
}

module.exports = {
  PROVIDERS,
  config,
  isConfigured,
  providerStatus,
  createStorageKey,
  putBuffer,
  getBuffer,
  deleteObject,
  persistBuffer
};
