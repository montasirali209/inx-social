'use strict';

const crypto = require('node:crypto');

function settings() {
  return {
    bucket: String(process.env.MEDIA_BUCKET || '').trim(),
    endpoint: String(process.env.MEDIA_S3_ENDPOINT || '').trim().replace(/\/$/, ''),
    region: String(process.env.MEDIA_S3_REGION || 'auto').trim() || 'auto',
    accessKeyId: String(process.env.MEDIA_S3_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: String(process.env.MEDIA_S3_SECRET_ACCESS_KEY || '').trim()
  };
}

function configured() {
  const value = settings();
  return Boolean(value.bucket && value.endpoint && value.accessKeyId && value.secretAccessKey);
}

function rfc3986(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalPath(key) {
  return '/' + String(key || '').split('/').filter(Boolean).map(rfc3986).join('/');
}

function objectUrl(key) {
  const value = settings();
  if (!configured()) throw new Error('Media object storage is not configured.');
  const url = new URL(value.endpoint);
  url.hostname = `${value.bucket}.${url.hostname}`;
  url.pathname = canonicalPath(key);
  url.search = '';
  return url;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function dateStamp(amzDate) {
  return amzDate.slice(0, 8);
}

function signingKey(secretAccessKey, stamp, region) {
  const kDate = hmac(Buffer.from(`AWS4${secretAccessKey}`, 'utf8'), stamp);
  const kRegion = crypto.createHmac('sha256', kDate).update(region, 'utf8').digest();
  const kService = crypto.createHmac('sha256', kRegion).update('s3', 'utf8').digest();
  return crypto.createHmac('sha256', kService).update('aws4_request', 'utf8').digest();
}

function signedHeaders(method, url, payloadHash, additional = {}) {
  const value = settings();
  const amzDate = timestamp();
  const stamp = dateStamp(amzDate);
  const headers = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...Object.fromEntries(Object.entries(additional)
      .filter(([, headerValue]) => headerValue != null && String(headerValue).trim() !== '')
      .map(([name, headerValue]) => [String(name).toLowerCase(), String(headerValue).trim()]))
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name].replace(/\s+/g, ' ')}\n`).join('');
  const signedHeaderNames = names.join(';');
  const canonicalRequest = [
    method.toUpperCase(),
    url.pathname || '/',
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaderNames,
    payloadHash
  ].join('\n');
  const scope = `${stamp}/${value.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(Buffer.from(canonicalRequest, 'utf8'))
  ].join('\n');
  const signature = crypto.createHmac('sha256', signingKey(value.secretAccessKey, stamp, value.region))
    .update(stringToSign, 'utf8')
    .digest('hex');
  return {
    ...additional,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    Authorization: `AWS4-HMAC-SHA256 Credential=${value.accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`
  };
}

async function request(method, key, options = {}) {
  const body = options.body == null ? null : Buffer.from(options.body);
  const payloadHash = sha256Hex(body || Buffer.alloc(0));
  const url = objectUrl(key);
  const additional = {};
  if (options.contentType) additional['content-type'] = options.contentType;
  const headers = signedHeaders(method, url, payloadHash, additional);
  if (options.range) headers.Range = options.range;
  const response = await fetch(url, {
    method,
    headers,
    body: body && method !== 'GET' && method !== 'HEAD' ? body : undefined
  });
  if (!response.ok && !(method === 'DELETE' && response.status === 404)) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Media object storage request failed (${method} ${response.status}).`);
    error.status = response.status;
    error.storageDetail = detail.slice(0, 500);
    throw error;
  }
  return response;
}

function safeFileName(value) {
  return String(value || 'media-asset')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'media-asset';
}

function keyFor(userId, assetId, originalName) {
  const date = new Date().toISOString().slice(0, 10);
  return `media/${rfc3986(userId)}/${date}/${rfc3986(assetId)}/${rfc3986(safeFileName(originalName))}`;
}

async function putObject(key, data, contentType) {
  await request('PUT', key, { body: data, contentType: contentType || 'application/octet-stream' });
  return key;
}

async function getObject(key) {
  const response = await request('GET', key);
  return Buffer.from(await response.arrayBuffer());
}

async function getObjectRange(key, start, length) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeLength = Math.max(1, Number(length) || 1);
  const response = await request('GET', key, {
    range: `bytes=${safeStart}-${safeStart + safeLength - 1}`
  });
  return Buffer.from(await response.arrayBuffer());
}

async function deleteObject(key) {
  if (!key || !configured()) return false;
  await request('DELETE', key);
  return true;
}

module.exports = {
  configured,
  keyFor,
  putObject,
  getObject,
  getObjectRange,
  deleteObject
};
