'use strict';

const crypto = require('node:crypto');
const axios = require('axios');
const aws4 = require('aws4');

const PROVIDERS = {
  CLOUDFLARE_R2: 'CLOUDFLARE_R2',
  RAILWAY_S3: 'RAILWAY_S3'
};

// R2 is intentionally reserved for high-volume customer generation outputs.
// Everything operational stays on Railway object storage.
const R2_GENERATED_MEDIA_PREFIXES = new Set([
  'ai-studio',
  'ai-video',
  'stock-video'
]);

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

function isGeneratedMediaPrefix(prefix) {
  return R2_GENERATED_MEDIA_PREFIXES.has(clean(prefix).toLowerCase());
}

function configuredProviders() {
  // Railway remains the default/operational backend. R2 is secondary and is
  // selected explicitly only for generated-media prefixes.
  return [railwayS3Config(), cloudflareR2Config()].filter(complete);
}

function operationalConfig() {
  const railway = railwayS3Config();
  return complete(railway) ? railway : null;
}

function generatedMediaConfig() {
  const r2 = cloudflareR2Config();
  if (complete(r2)) return r2;

  // Until R2 is configured, preserve today's production behavior and keep
  // generated media on Railway rather than falling back to PostgreSQL.
  const railway = railwayS3Config();
  return complete(railway) ? railway : null;
}

function config() {
  return operationalConfig() || generatedMediaConfig() || railwayS3Config();
}

function providerForPrefix(prefix) {
  const selected = isGeneratedMediaPrefix(prefix) ? generatedMediaConfig() : operationalConfig();
  return selected?.provider || null;
}

function storageConfigForPrefix(prefix) {
  return isGeneratedMediaPrefix(prefix) ? generatedMediaConfig() : operationalConfig();
}

function orderedConfigs(preferredProvider = null) {
  const configs = configuredProviders();
  if (!preferredProvider) return configs;
  return [
    ...configs.filter(value => value.provider === preferredProvider),
    ...configs.filter(value => value.provider !== preferredProvider)
  ];
}

function isConfigured() {
  return configuredProviders().length > 0;
}

function providerStatus() {
  const r2 = cloudflareR2Config();
  const railway = railwayS3Config();
  return {
    operationalProvider: complete(railway) ? PROVIDERS.RAILWAY_S3 : null,
    generatedMediaProvider: complete(r2)
      ? PROVIDERS.CLOUDFLARE_R2
      : (complete(railway) ? PROVIDERS.RAILWAY_S3 : null),
    cloudflareR2Configured: complete(r2),
    railwayConfigured: complete(railway)
  };
}

function encodeKey(key) {
  return String(key || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

function objectTarget(key, storageConfig) {
  const base = new URL(storageConfig.endpoint);
  const encoded = encodeKey(key);
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

function notConfiguredError(prefix = null) {
  const operational = prefix && !isGeneratedMediaPrefix(prefix);
  const error = new Error(
    operational
      ? 'Railway media object storage is not configured for operational media.'
      : 'Media object storage is not configured.'
  );
  error.code = 'MEDIA_OBJECT_STORAGE_NOT_CONFIGURED';
  return error;
}

function signedRequest(method, key, { data, headers = {}, responseType = 'arraybuffer' } = {}, storageConfig = config()) {
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
  for (const storageConfig of configs) {
    try {
      await signedRequest('DELETE', key, { responseType: 'text' }, storageConfig);
      deleted = true;
      if (provider) break;
    } catch (error) {
      if (error?.response?.status === 404) continue;
      firstError ||= error;
      if (provider) break;
    }
  }
  if (firstError && !deleted) throw firstError;
  return deleted;
}

async function persistBuffer({ userId, data, mimeType, originalName, prefix }) {
  const targetConfig = storageConfigForPrefix(prefix);
  if (!targetConfig) {
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
      const error = notConfiguredError(prefix);
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
  R2_GENERATED_MEDIA_PREFIXES,
  config,
  isConfigured,
  isGeneratedMediaPrefix,
  providerForPrefix,
  providerStatus,
  createStorageKey,
  putBuffer,
  getBuffer,
  deleteObject,
  persistBuffer
};
