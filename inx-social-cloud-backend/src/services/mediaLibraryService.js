const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const prisma = require('../db/prisma');

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const STORAGE_LIMITS = Object.freeze({ TRIAL: 250 * 1024 * 1024, STARTER: 1024 * 1024 * 1024, PRO: 10 * 1024 * 1024 * 1024, LIFETIME: 10 * 1024 * 1024 * 1024, CREATOR: 10 * 1024 * 1024 * 1024, AGENCY: 25 * 1024 * 1024 * 1024, BUSINESS: 25 * 1024 * 1024 * 1024 });

const ASSET_INCLUDE = {
  folder: { select: { id: true, name: true } },
  campaignPosts: { select: { id: true, title: true, status: true, scheduleJobId: true }, take: 20, orderBy: { createdAt: 'desc' } }
};

function error(message, status = 400) {
  const value = new Error(message);
  value.status = status;
  value.publicMessage = message;
  return value;
}

function safeName(value) {
  return String(value || 'media-asset').replace(/[^a-zA-Z0-9._ ()-]/g, '').trim().slice(0, 180) || 'media-asset';
}

function parseTags(value) {
  try { const tags = JSON.parse(value || '[]'); return Array.isArray(tags) ? tags.map(String).slice(0, 20) : []; } catch (_) { return []; }
}

function contentAccess(asset) {
  if (!process.env.JWT_SECRET) throw error('Media access signing is not configured.', 503);
  return jwt.sign({ sub: asset.userId, mediaAssetId: asset.id, purpose: 'media-library-content' }, process.env.JWT_SECRET, { expiresIn: '20m' });
}

function verifyContentAccess(token, assetId) {
  if (!token || !process.env.JWT_SECRET) throw error('Media access has expired. Refresh the Media Library.', 401);
  try {
    const payload = jwt.verify(String(token), process.env.JWT_SECRET);
    if (payload.purpose !== 'media-library-content' || payload.mediaAssetId !== assetId || !payload.sub) throw new Error('invalid scope');
    return String(payload.sub);
  } catch (_) {
    throw error('Media access has expired. Refresh the Media Library.', 401);
  }
}

function publicAsset(asset) {
  const generated = ['OLLAMA_IMAGE', 'OPENAI_IMAGE'].includes(String(asset.source || '').toUpperCase());
  const usedIn = (asset.campaignPosts || []).map(post => ({ id: post.id, title: post.title || 'Social Agent post', status: post.status }));
  const access = contentAccess(asset);
  const contentUrl = `/api/studio/media-library/assets/${encodeURIComponent(asset.id)}/content?access=${encodeURIComponent(access)}`;
  return {
    id: asset.id,
    fileName: asset.originalName || `${generated ? 'AI generated' : 'Media'} asset`,
    type: String(asset.mimeType || '').startsWith('video/') ? 'video' : String(asset.mimeType || '') === 'image/gif' ? 'gif' : 'image',
    source: generated ? 'ai_generated' : asset.source === 'LIBRARY_UPLOAD' || asset.source === 'UPLOAD' ? 'uploaded' : 'imported',
    collection: generated ? 'ai_generated' : asset.source === 'UPLOAD' ? 'brand_assets' : asset.source === 'LIBRARY_UPLOAD' ? 'uploaded_media' : 'imported',
    status: asset.status === 'REJECTED' ? 'needs_review' : usedIn.some(post => post.status === 'PUBLISHED') ? 'published' : usedIn.some(post => post.status === 'SCHEDULED') ? 'scheduled' : usedIn.length ? 'used' : 'unused',
    thumbnailUrl: contentUrl,
    fileUrl: contentUrl,
    width: asset.width || null,
    height: asset.height || null,
    duration: asset.durationSeconds || null,
    fileSize: asset.byteSize,
    createdAt: asset.createdAt,
    folder: asset.folder || null,
    tags: parseTags(asset.tagsJson),
    prompt: asset.customerPrompt || asset.prompt || null,
    qualityScore: asset.qualityScore ?? null,
    usedIn,
    contentAvailable: asset.status === 'READY' && !asset.archivedAt
  };
}

async function workspace(userId, plan) {
  const [assets, folders, storage] = await Promise.all([
    prisma.agentAsset.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: 'desc' }, take: 1000, include: ASSET_INCLUDE }),
    prisma.mediaFolder.findMany({ where: { userId }, orderBy: { name: 'asc' }, include: { _count: { select: { assets: true } } } }),
    prisma.agentAsset.aggregate({ where: { userId, archivedAt: null }, _sum: { byteSize: true } })
  ]);
  const limit = STORAGE_LIMITS[String(plan || 'TRIAL').toUpperCase()] || STORAGE_LIMITS.TRIAL;
  return {
    assets: assets.map(publicAsset),
    folders: folders.map(folder => ({ id: folder.id, name: folder.name, count: folder._count.assets })),
    storage: { usedBytes: storage._sum.byteSize || 0, limitBytes: limit }
  };
}

async function imageMetadata(mimeType, data) {
  if (!IMAGE_TYPES.has(mimeType)) return { width: null, height: null };
  try { const metadata = await sharp(data, { animated: false }).metadata(); return { width: metadata.width || null, height: metadata.height || null }; } catch (_) { return { width: null, height: null }; }
}

async function upload(userId, plan, input) {
  const mimeType = String(input.mimeType || '').toLowerCase().split(';')[0];
  if (!IMAGE_TYPES.has(mimeType) && !VIDEO_TYPES.has(mimeType)) throw error('Upload a PNG, JPEG, WebP, GIF, MP4, MOV or WebM file.', 415);
  if (!Buffer.isBuffer(input.data) || !input.data.length) throw error('Choose a non-empty media file.');
  if (input.data.length > MAX_FILE_BYTES) throw error('Media Library uploads must be 100 MB or smaller.', 413);
  const current = await prisma.agentAsset.aggregate({ where: { userId, archivedAt: null }, _sum: { byteSize: true } });
  const limit = STORAGE_LIMITS[String(plan || 'TRIAL').toUpperCase()] || STORAGE_LIMITS.TRIAL;
  if ((current._sum.byteSize || 0) + input.data.length > limit) throw error('This upload would exceed your Media Library storage allowance.', 413);
  const folder = input.folderId ? await prisma.mediaFolder.findFirst({ where: { id: input.folderId, userId }, select: { id: true } }) : null;
  if (input.folderId && !folder) throw error('Choose a folder that belongs to this account.');
  const checksum = crypto.createHash('sha256').update(input.data).digest('hex');
  const duplicate = await prisma.agentAsset.findFirst({ where: { userId, checksum, archivedAt: null }, include: ASSET_INCLUDE });
  if (duplicate) return publicAsset(duplicate);
  const metadata = await imageMetadata(mimeType, input.data);
  const created = await prisma.agentAsset.create({ data: {
    userId,
    folderId: folder?.id || null,
    kind: mimeType.startsWith('video/') ? 'LIBRARY_VIDEO' : mimeType === 'image/gif' ? 'LIBRARY_GIF' : 'LIBRARY_IMAGE',
    source: 'LIBRARY_UPLOAD',
    status: 'READY',
    originalName: safeName(input.fileName),
    mimeType,
    byteSize: input.data.length,
    checksum,
    data: input.data,
    width: metadata.width,
    height: metadata.height,
    tagsJson: '[]'
  }, include: ASSET_INCLUDE });
  return publicAsset(created);
}

async function createFolder(userId, name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (clean.length < 2) throw error('Folder names must contain at least two characters.');
  const count = await prisma.mediaFolder.count({ where: { userId } });
  if (count >= 50) throw error('You can create up to 50 Media Library folders.', 409);
  try { return await prisma.mediaFolder.create({ data: { userId, name: clean }, select: { id: true, name: true } }); } catch (value) { if (value.code === 'P2002') throw error('A folder with this name already exists.', 409); throw value; }
}

async function findContent(userId, id) {
  return prisma.agentAsset.findFirst({ where: { id, userId, status: 'READY', archivedAt: null }, select: { mimeType: true, data: true, checksum: true, originalName: true } });
}

async function rename(userId, id, fileName) {
  const existing = await prisma.agentAsset.findFirst({ where: { id, userId, archivedAt: null }, select: { id: true } });
  if (!existing) throw error('Media asset not found.', 404);
  return publicAsset(await prisma.agentAsset.update({ where: { id }, data: { originalName: safeName(fileName) }, include: ASSET_INCLUDE }));
}

async function duplicate(userId, id) {
  const existing = await prisma.agentAsset.findFirst({ where: { id, userId, status: 'READY', archivedAt: null } });
  if (!existing) throw error('Media asset not found.', 404);
  const copy = await prisma.agentAsset.create({ data: {
    userId, folderId: existing.folderId, kind: existing.kind, source: existing.source, status: 'READY',
    originalName: `Copy of ${existing.originalName || 'media asset'}`.slice(0, 180), mimeType: existing.mimeType,
    byteSize: existing.byteSize, checksum: `${existing.checksum}-copy-${crypto.randomUUID()}`, prompt: existing.prompt,
    customerPrompt: existing.customerPrompt, exactOverlayText: existing.exactOverlayText, generationChoice: existing.generationChoice,
    qualityScore: existing.qualityScore, qualityIssuesJson: existing.qualityIssuesJson, data: existing.data, tagsJson: existing.tagsJson,
    width: existing.width, height: existing.height, durationSeconds: existing.durationSeconds
  }, include: ASSET_INCLUDE });
  return publicAsset(copy);
}

async function archive(userId, id) {
  const result = await prisma.agentAsset.updateMany({ where: { id, userId, archivedAt: null }, data: { archivedAt: new Date() } });
  if (!result.count) throw error('Media asset not found.', 404);
  return true;
}

module.exports = { IMAGE_TYPES, VIDEO_TYPES, MAX_FILE_BYTES, STORAGE_LIMITS, publicAsset, verifyContentAccess, workspace, upload, createFolder, findContent, rename, duplicate, archive };
