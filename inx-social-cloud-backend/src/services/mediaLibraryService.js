const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const { expiresAtFor, VIDEO_RETENTION_DAYS, OTHER_MEDIA_RETENTION_DAYS } = require('./mediaRetentionService');
const objectStorage = require('./mediaObjectStorageService');

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const TRASH_RETENTION_DAYS = 30;
const STORAGE_LIMITS = Object.freeze({ TRIAL: 250 * 1024 * 1024, STARTER: 1024 * 1024 * 1024, PRO: 10 * 1024 * 1024 * 1024, LIFETIME: 10 * 1024 * 1024 * 1024, CREATOR: 10 * 1024 * 1024 * 1024, AGENCY: 25 * 1024 * 1024 * 1024, BUSINESS: 25 * 1024 * 1024 * 1024 });

const ASSET_INCLUDE = {
  folder: { select: { id: true, name: true } },
  campaignPosts: { select: { id: true, title: true, status: true, scheduleJobId: true }, take: 20, orderBy: { createdAt: 'desc' } },
  scheduleJobs: { select: { id: true, title: true, localFileName: true, status: true }, take: 20, orderBy: { createdAt: 'desc' } }
};


const LIBRARY_ASSET_SELECT = {
  id: true,
  userId: true,
  source: true,
  status: true,
  originalName: true,
  mimeType: true,
  byteSize: true,
  prompt: true,
  customerPrompt: true,
  qualityScore: true,
  expiresAt: true,
  createdAt: true,
  tagsJson: true,
  width: true,
  height: true,
  durationSeconds: true,
  archivedAt: true,
  folder: { select: { id: true, name: true } },
  campaignPosts: { select: { id: true, title: true, status: true, scheduleJobId: true }, take: 20, orderBy: { createdAt: 'desc' } },
  scheduleJobs: { select: { id: true, title: true, localFileName: true, status: true }, take: 20, orderBy: { createdAt: 'desc' } }
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
  const generated = ['OLLAMA_IMAGE', 'OPENAI_IMAGE', 'AI_STUDIO'].includes(String(asset.source || '').toUpperCase());
  const campaignUsage = (asset.campaignPosts || []).map(post => ({ id: post.id, title: post.title || 'Social Agent post', status: post.status }));
  const scheduledUsage = (asset.scheduleJobs || []).map(job => ({ id: job.id, title: job.title || job.localFileName || 'Scheduled post', status: job.status }));
  const usedIn = [...campaignUsage, ...scheduledUsage].filter((item, index, items) => items.findIndex(candidate => candidate.id === item.id) === index);
  const access = contentAccess(asset);
  const contentUrl = `/api/studio/media-library/assets/${encodeURIComponent(asset.id)}/content?access=${encodeURIComponent(access)}`;
  return {
    id: asset.id,
    fileName: asset.originalName || `${generated ? 'AI generated' : 'Media'} asset`,
    type: String(asset.mimeType || '').startsWith('video/') ? 'video' : String(asset.mimeType || '') === 'image/gif' ? 'gif' : 'image',
    source: generated ? 'ai_generated' : asset.source === 'LIBRARY_UPLOAD' || asset.source === 'UPLOAD' ? 'uploaded' : 'imported',
    collection: generated ? 'ai_generated' : asset.source === 'UPLOAD' ? 'brand_assets' : asset.source === 'LIBRARY_UPLOAD' ? 'uploaded_media' : 'imported',
    status: asset.archivedAt ? 'archived' : asset.status === 'REJECTED' ? 'needs_review' : usedIn.some(post => post.status === 'PUBLISHED') ? 'published' : usedIn.some(post => post.status === 'SCHEDULED') ? 'scheduled' : usedIn.length ? 'used' : 'unused',
    thumbnailUrl: contentUrl,
    fileUrl: contentUrl,
    width: asset.width || null,
    height: asset.height || null,
    duration: asset.durationSeconds || null,
    fileSize: asset.byteSize,
    createdAt: asset.createdAt,
    expiresAt: asset.expiresAt || expiresAtFor(asset.mimeType, asset.createdAt),
    archivedAt: asset.archivedAt || null,
    folder: asset.folder || null,
    tags: parseTags(asset.tagsJson),
    prompt: asset.customerPrompt || asset.prompt || null,
    qualityScore: asset.qualityScore ?? null,
    usedIn,
    contentAvailable: asset.status === 'READY'
  };
}

async function workspace(userId, plan) {
  const trashCutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const visibleAssetWhere = {
    userId,
    OR: [
      { archivedAt: null },
      { archivedAt: { gte: trashCutoff } }
    ]
  };

  // Trash cleanup must never delay the visible Media Library request.
  void (async () => {
    const expiredTrash = await prisma.agentAsset.findMany({
      where: { userId, archivedAt: { lt: trashCutoff } },
      select: { id: true, storageKey: true }
    });
    if (!expiredTrash.length) return;
    await prisma.agentAsset.deleteMany({ where: { id: { in: expiredTrash.map(asset => asset.id) } } });
    await Promise.allSettled(expiredTrash.filter(asset => asset.storageKey).map(asset => objectStorage.deleteObject(asset.storageKey)));
  })().catch((cleanupError) => {
    console.warn('[media-library] expired trash cleanup delayed', { userId, error: cleanupError?.message || String(cleanupError) });
  });

  const [assets, folders, storage] = await Promise.all([
    // Do not fetch AgentAsset.data here. Loading binary media blobs for a metadata grid
    // made the library response scale with file sizes instead of the number of records.
    prisma.agentAsset.findMany({ where: visibleAssetWhere, orderBy: { createdAt: 'desc' }, take: 1000, select: LIBRARY_ASSET_SELECT }),
    prisma.mediaFolder.findMany({ where: { userId }, orderBy: { name: 'asc' }, include: { _count: { select: { assets: true } } } }),
    prisma.agentAsset.aggregate({ where: visibleAssetWhere, _sum: { byteSize: true } })
  ]);
  const limit = STORAGE_LIMITS[String(plan || 'TRIAL').toUpperCase()] || STORAGE_LIMITS.TRIAL;
  return {
    assets: assets.filter(asset => !asset.archivedAt).map(publicAsset),
    trashAssets: assets.filter(asset => asset.archivedAt).map(publicAsset),
    folders: folders.map(folder => ({ id: folder.id, name: folder.name, count: folder._count.assets })),
    storage: { usedBytes: storage._sum.byteSize || 0, limitBytes: limit, trashRetentionDays: TRASH_RETENTION_DAYS, videoRetentionDays: VIDEO_RETENTION_DAYS, otherMediaRetentionDays: OTHER_MEDIA_RETENTION_DAYS }
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
  const current = await prisma.agentAsset.aggregate({ where: { userId }, _sum: { byteSize: true } });
  const limit = STORAGE_LIMITS[String(plan || 'TRIAL').toUpperCase()] || STORAGE_LIMITS.TRIAL;
  if ((current._sum.byteSize || 0) + input.data.length > limit) throw error('This upload would exceed your Media Library storage allowance.', 413);
  const folder = input.folderId ? await prisma.mediaFolder.findFirst({ where: { id: input.folderId, userId }, select: { id: true } }) : null;
  if (input.folderId && !folder) throw error('Choose a folder that belongs to this account.');
  const checksum = crypto.createHash('sha256').update(input.data).digest('hex');
  const duplicate = await prisma.agentAsset.findFirst({ where: { userId, checksum }, include: ASSET_INCLUDE });
  if (duplicate) {
    if (duplicate.archivedAt) return publicAsset(await prisma.agentAsset.update({ where: { id: duplicate.id }, data: { archivedAt: null, originalName: safeName(input.fileName) }, include: ASSET_INCLUDE }));
    return publicAsset(duplicate);
  }
  const metadata = await imageMetadata(mimeType, input.data);
  const stored = await objectStorage.persistBuffer({
    userId,
    data: input.data,
    mimeType,
    originalName: safeName(input.fileName),
    prefix: 'media-library'
  });
  let created;
  try {
    created = await prisma.agentAsset.create({ data: {
    userId,
    folderId: folder?.id || null,
    kind: mimeType.startsWith('video/') ? 'LIBRARY_VIDEO' : mimeType === 'image/gif' ? 'LIBRARY_GIF' : 'LIBRARY_IMAGE',
    source: 'LIBRARY_UPLOAD',
    status: 'READY',
    originalName: safeName(input.fileName),
    mimeType,
    byteSize: input.data.length,
    checksum,
    data: stored.data,
    storageProvider: stored.storageProvider,
    storageKey: stored.storageKey,
    width: metadata.width,
    height: metadata.height,
    tagsJson: '[]',
    expiresAt: expiresAtFor(mimeType)
    }, include: ASSET_INCLUDE });
  } catch (createError) {
    if (stored.storageKey) await objectStorage.deleteObject(stored.storageKey).catch(() => {});
    throw createError;
  }
  return publicAsset(created);
}

async function createFolder(userId, name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (clean.length < 2) throw error('Folder names must contain at least two characters.');
  const count = await prisma.mediaFolder.count({ where: { userId } });
  if (count >= 50) throw error('You can create up to 50 Media Library folders.', 409);
  try { return await prisma.mediaFolder.create({ data: { userId, name: clean }, select: { id: true, name: true } }); } catch (value) { if (value.code === 'P2002') throw error('A folder with this name already exists.', 409); throw value; }
}

async function findContent(userId, id, options = {}) {
  const asset = await prisma.agentAsset.findFirst({
    where: { id, userId, status: 'READY', ...(options.includeArchived ? {} : { archivedAt: null }) },
    select: { mimeType: true, data: true, checksum: true, originalName: true, storageProvider: true, storageKey: true }
  });
  if (!asset) return null;
  if (asset.storageKey) {
    const data = await objectStorage.getBuffer(asset.storageKey);
    return { ...asset, data };
  }
  return asset;
}

async function findContentMetadata(userId, id, options = {}) {
  return prisma.agentAsset.findFirst({
    where: { id, userId, status: 'READY', ...(options.includeArchived ? {} : { archivedAt: null }) },
    select: { mimeType: true, byteSize: true, checksum: true, originalName: true, storageProvider: true, storageKey: true }
  });
}

async function findContentRange(userId, id, start, length, options = {}) {
  const asset = await prisma.agentAsset.findFirst({
    where: { id, userId, status: 'READY', ...(options.includeArchived ? {} : { archivedAt: null }) },
    select: { storageKey: true }
  });
  if (!asset) return null;
  if (asset.storageKey) {
    const safeStart = Math.max(0, Number(start));
    const safeLength = Math.max(1, Number(length));
    return objectStorage.getBuffer(asset.storageKey, `bytes=${safeStart}-${safeStart + safeLength - 1}`);
  }
  const archivedClause = options.includeArchived ? '' : 'AND "archivedAt" IS NULL';
  // Prisma binds raw numeric placeholders as bigint. PostgreSQL's bytea substring
  // overload requires integer offsets/lengths, so cast the bounded range explicitly.
  const rows = await prisma.$queryRawUnsafe(
    `SELECT substring("data" FROM CAST($3 AS integer) FOR CAST($4 AS integer)) AS "data" FROM "AgentAsset" WHERE "id"=$1 AND "userId"=$2 AND "status"='READY' ${archivedClause} LIMIT 1`,
    id, userId, Math.max(0, Number(start)) + 1, Math.max(1, Number(length))
  );
  return rows[0]?.data || null;
}

async function rename(userId, id, fileName) {
  const existing = await prisma.agentAsset.findFirst({ where: { id, userId, archivedAt: null }, select: { id: true } });
  if (!existing) throw error('Media asset not found.', 404);
  return publicAsset(await prisma.agentAsset.update({ where: { id }, data: { originalName: safeName(fileName) }, include: ASSET_INCLUDE }));
}

async function duplicate(userId, id) {
  const existing = await prisma.agentAsset.findFirst({ where: { id, userId, status: 'READY', archivedAt: null } });
  if (!existing) throw error('Media asset not found.', 404);
  const bytes = existing.storageKey
    ? await objectStorage.getBuffer(existing.storageKey)
    : Buffer.from(existing.data || []);
  if (!bytes.length) throw error('Media asset content is unavailable.', 404);
  const copyName = `Copy of ${existing.originalName || 'media asset'}`.slice(0, 180);
  const stored = await objectStorage.persistBuffer({
    userId,
    data: bytes,
    mimeType: existing.mimeType,
    originalName: copyName,
    prefix: 'media-library'
  });
  try {
    const copy = await prisma.agentAsset.create({ data: {
      userId, folderId: existing.folderId, kind: existing.kind, source: existing.source, status: 'READY',
      originalName: copyName, mimeType: existing.mimeType,
      byteSize: existing.byteSize, checksum: `${existing.checksum}-copy-${crypto.randomUUID()}`, prompt: existing.prompt,
      customerPrompt: existing.customerPrompt, exactOverlayText: existing.exactOverlayText, generationChoice: existing.generationChoice,
      qualityScore: existing.qualityScore, qualityIssuesJson: existing.qualityIssuesJson,
      data: stored.data, storageProvider: stored.storageProvider, storageKey: stored.storageKey, tagsJson: existing.tagsJson,
      width: existing.width, height: existing.height, durationSeconds: existing.durationSeconds,
      expiresAt: expiresAtFor(existing.mimeType)
    }, include: ASSET_INCLUDE });
    return publicAsset(copy);
  } catch (createError) {
    if (stored.storageKey) await objectStorage.deleteObject(stored.storageKey).catch(() => {});
    throw createError;
  }
}

async function archive(userId, id) {
  const result = await prisma.agentAsset.updateMany({ where: { id, userId, archivedAt: null }, data: { archivedAt: new Date() } });
  if (!result.count) throw error('Media asset not found.', 404);
  return true;
}

async function restore(userId, id) {
  const result = await prisma.agentAsset.updateMany({ where: { id, userId, archivedAt: { not: null } }, data: { archivedAt: null } });
  if (!result.count) throw error('Trashed media asset not found.', 404);
  return true;
}

async function purge(userId, id) {
  const existing = await prisma.agentAsset.findFirst({
    where: { id, userId, archivedAt: { not: null } },
    select: { id: true, storageKey: true }
  });
  if (!existing) throw error('Trashed media asset not found.', 404);
  const result = await prisma.agentAsset.deleteMany({ where: { id: existing.id, userId, archivedAt: { not: null } } });
  if (!result.count) throw error('Trashed media asset not found.', 404);
  if (existing.storageKey) await objectStorage.deleteObject(existing.storageKey).catch((deleteError) => {
    console.warn('[media-library] bucket purge delayed', { id, error: deleteError?.message || String(deleteError) });
  });
  return true;
}

module.exports = { IMAGE_TYPES, VIDEO_TYPES, MAX_FILE_BYTES, TRASH_RETENTION_DAYS, STORAGE_LIMITS, publicAsset, verifyContentAccess, workspace, upload, createFolder, findContent, findContentMetadata, findContentRange, rename, duplicate, archive, restore, purge };
