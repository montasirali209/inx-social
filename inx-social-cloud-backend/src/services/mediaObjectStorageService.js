'use strict';

const crypto = require('node:crypto');
const axios = require('axios');
const aws4 = require('aws4');

function config() {
  const endpoint = String(process.env.MEDIA_S3_ENDPOINT || '').trim().replace(/\/+$/, '');
  const bucket = String(process.env.MEDIA_BUCKET || '').trim();
  const accessKeyId = String(process.env.MEDIA_S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.MEDIA_S3_SECRET_ACCESS_KEY || '').trim();
  const region = String(process.env.MEDIA_S3_REGION || 'auto').trim() || 'auto';
  return { endpoint, bucket, accessKeyId, secretAccessKey, region };
}

function isConfigured() {
  const value = config();
  return Boolean(value.endpoint && value.bucket && value.accessKeyId && value.secretAccessKey);
}

function encodeKey(key) {
  return String(key || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

function objectTarget(key) {
  const { endpoint, bucket } = config();
  const base = new URL(endpoint);
  const encoded = encodeKey(key);
  const host = base.hostname.startsWith(`${bucket}.`) ? base.hostname : `${bucket}.${base.hostname}`;
  const port = base.port ? `:${base.port}` : '';
  const basePath = base.pathname && base.pathname !== '/' ? base.pathname.replace(/\/$/, '') : '';
  const path = `${basePath}/${encoded}`;
  return {
    host: `${host}${port}`,
    path,
    url: `${base.protocol}//${host}${port}${path}`
  };
}

function signedRequest(method, key, { data, headers = {}, responseType = 'arraybuffer' } = {}) {
  if (!isConfigured()) {
    const error = new Error('Media object storage is not configured.');
    error.code = 'MEDIA_OBJECT_STORAGE_NOT_CONFIGURED';
    throw error;
  }
  const { accessKeyId, secretAccessKey, region } = config();
  const target = objectTarget(key);
  const body = data == null ? undefined : data;
  const request = {
    host: target.host,
    path: target.path,
    method,
    service: 's3',
    region,
    headers: {
      ...headers,
      Host: target.host
    },
    body
  };
  aws4.sign(request, { accessKeyId, secretAccessKey });
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

async function putBuffer({ key, data, mimeType }) {
  if (!Buffer.isBuffer(data) || !data.length) throw new Error('Cannot store an empty media object.');
  await signedRequest('PUT', key, {
    data,
    headers: {
      'Content-Type': String(mimeType || 'application/octet-stream'),
      'Content-Length': String(data.length),
      'x-amz-content-sha256': crypto.createHash('sha256').update(data).digest('hex')
    },
    responseType: 'text'
  });
  return key;
}

async function getBuffer(key, range = null) {
  const headers = {};
  if (range) headers.Range = range;
  const response = await signedRequest('GET', key, { headers, responseType: 'arraybuffer' });
  return Buffer.from(response.data || []);
}

async function deleteObject(key) {
  if (!key || !isConfigured()) return false;
  try {
    await signedRequest('DELETE', key, { responseType: 'text' });
    return true;
  } catch (error) {
    if (error?.response?.status === 404) return true;
    throw error;
  }
}

async function persistBuffer({ userId, data, mimeType, originalName, prefix }) {
  const key = createStorageKey({ userId, mimeType, originalName, prefix });
  await putBuffer({ key, data, mimeType });
  return {
    storageProvider: 'RAILWAY_S3',
    storageKey: key,
    data: null
  };
}

module.exports = {
  isConfigured,
  createStorageKey,
  putBuffer,
  getBuffer,
  deleteObject,
  persistBuffer
};
