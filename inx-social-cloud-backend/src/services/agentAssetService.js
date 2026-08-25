const crypto = require('node:crypto');
const prisma = require('../db/prisma');

const UPLOAD_KINDS = new Set(['LOGO', 'PROFILE', 'REFERENCE']);
const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_UPLOAD_BYTES = 1024 * 1024;
const MAX_ASSETS_PER_USER = 20;

function publicAsset(asset) {
  return {
    id: asset.id,
    planId: asset.planId || null,
    kind: asset.kind,
    source: asset.source,
    status: asset.status,
    originalName: asset.originalName || null,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    contentUrl: `/api/agent/assets/${encodeURIComponent(asset.id)}/content`,
    createdAt: asset.createdAt
  };
}

function decodeDataUrl(value) {
  const match = String(value || '').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match || !MIME_TYPES.has(match[1])) throw Object.assign(new Error('Upload a PNG, JPEG or WebP image.'), { status: 400 });
  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > MAX_UPLOAD_BYTES) throw Object.assign(new Error('Each brand image must be 1 MB or smaller.'), { status: 400 });
  return { mimeType: match[1], data };
}

async function createUpload(userId, input = {}) {
  if (typeof prisma.agentAsset?.create !== 'function') throw Object.assign(new Error('Brand asset storage is not available until the Phase 11.4 database migration is deployed.'), { status: 503 });
  const kind = String(input.kind || '').toUpperCase();
  if (!UPLOAD_KINDS.has(kind)) throw Object.assign(new Error('Choose logo, profile or reference image.'), { status: 400 });
  const count = await prisma.agentAsset.count({ where: { userId, source: 'UPLOAD' } });
  if (count >= MAX_ASSETS_PER_USER) throw Object.assign(new Error(`You can keep up to ${MAX_ASSETS_PER_USER} Agent brand images. Remove an older image first.`), { status: 409 });
  const { mimeType, data } = decodeDataUrl(input.dataUrl);
  const checksum = crypto.createHash('sha256').update(data).digest('hex');
  const duplicate = await prisma.agentAsset.findFirst({ where: { userId, checksum, kind }, orderBy: { createdAt: 'desc' } });
  if (duplicate) return duplicate;
  return prisma.agentAsset.create({ data: {
    userId,
    kind,
    source: 'UPLOAD',
    status: 'READY',
    originalName: String(input.name || 'brand-image').replace(/[^a-zA-Z0-9._ -]/g, '').slice(0, 160) || 'brand-image',
    mimeType,
    byteSize: data.length,
    checksum,
    data,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  } });
}

async function list(userId, options = {}) {
  if (typeof prisma.agentAsset?.findMany !== 'function') return [];
  const where = { userId };
  if (options.source) where.source = String(options.source);
  return prisma.agentAsset.findMany({ where, orderBy: { createdAt: 'desc' }, take: MAX_ASSETS_PER_USER, select: { id: true, planId: true, kind: true, source: true, status: true, originalName: true, mimeType: true, byteSize: true, createdAt: true } });
}

async function resolveOwned(userId, ids = []) {
  const unique = [...new Set(ids.map(value => String(value || '').trim()).filter(Boolean))];
  if (unique.length > 10) throw Object.assign(new Error('Select no more than 10 brand/reference images for one mission.'), { status: 400 });
  if (!unique.length) return [];
  if (typeof prisma.agentAsset?.findMany !== 'function') throw Object.assign(new Error('Brand asset storage is not available.'), { status: 503 });
  const assets = await prisma.agentAsset.findMany({ where: { userId, id: { in: unique }, status: 'READY', source: 'UPLOAD', planId: null }, select: { id: true, kind: true, originalName: true, mimeType: true, byteSize: true } });
  if (assets.length !== unique.length) throw Object.assign(new Error('One or more selected brand images are unavailable.'), { status: 400 });
  return assets;
}

async function findContent(userId, id) {
  if (typeof prisma.agentAsset?.findFirst !== 'function') return null;
  return prisma.agentAsset.findFirst({ where: { id, userId, status: 'READY' }, select: { mimeType: true, data: true, checksum: true } });
}

async function remove(userId, id) {
  if (typeof prisma.agentAsset?.deleteMany !== 'function') return false;
  const result = await prisma.agentAsset.deleteMany({ where: { id, userId, planId: null, source: 'UPLOAD' } });
  return result.count > 0;
}

async function cleanupExpired(now = new Date()) {
  if (typeof prisma.agentAsset?.deleteMany !== 'function') return 0;
  const result = await prisma.agentAsset.deleteMany({ where: { planId: null, source: 'UPLOAD', expiresAt: { lt: now } } });
  return result.count;
}

module.exports = { UPLOAD_KINDS, MIME_TYPES, MAX_UPLOAD_BYTES, MAX_ASSETS_PER_USER, publicAsset, decodeDataUrl, createUpload, list, resolveOwned, findContent, remove, cleanupExpired };
