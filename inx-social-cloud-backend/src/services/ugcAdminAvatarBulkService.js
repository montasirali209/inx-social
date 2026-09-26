const prisma = require('../db/prisma');
const objectStorage = require('./mediaObjectStorageService');

function clean(value, max = 160) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function serviceError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function normalizeIds(avatarIds) {
  return [...new Set((Array.isArray(avatarIds) ? avatarIds : [])
    .map(value => clean(value, 120))
    .filter(Boolean))]
    .slice(0, 200);
}

async function systemAvatarFiles(avatarIds = []) {
  const ids = normalizeIds(avatarIds);
  if (!ids.length) throw serviceError('Select at least one creator.', 'UGC_ADMIN_AVATAR_SELECTION_REQUIRED');

  const placeholders = ids.map((_, index) => '$' + (index + 1)).join(',');
  const rows = await prisma.$queryRawUnsafe(
    'SELECT * FROM "UGCAvatar" WHERE "scope"=\'SYSTEM\' AND "status"=\'READY\' AND "id" IN (' + placeholders + ') ORDER BY "name"',
    ...ids
  );

  const files = [];
  const missing = [];
  for (const row of rows) {
    if (!row.referenceStorageKey) {
      missing.push({ id: row.id, name: row.name });
      continue;
    }
    try {
      const data = await objectStorage.getBuffer(row.referenceStorageKey, null, row.referenceStorageProvider || null);
      const mimeType = row.referenceMimeType || 'image/png';
      const extension = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/webp' ? '.webp' : '.png';
      const safeName = clean(row.name, 80).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'creator';
      files.push({
        id: row.id,
        name: safeName + '-' + String(row.id).slice(0, 8) + extension,
        data,
        mimeType
      });
    } catch (_) {
      missing.push({ id: row.id, name: row.name });
    }
  }

  return { files, missing, requested: ids.length };
}

async function disableSystemAvatars(avatarIds = []) {
  const ids = normalizeIds(avatarIds);
  if (!ids.length) throw serviceError('Select at least one creator.', 'UGC_ADMIN_AVATAR_SELECTION_REQUIRED');

  const placeholders = ids.map((_, index) => '$' + (index + 1)).join(',');
  const rows = await prisma.$queryRawUnsafe(
    'UPDATE "UGCAvatar" SET "status"=\'DISABLED\',"featured"=false,"updatedAt"=CURRENT_TIMESTAMP WHERE "scope"=\'SYSTEM\' AND "status"=\'READY\' AND "id" IN (' + placeholders + ') RETURNING "id","name","slug"',
    ...ids
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    managedByAdmin: String(row.slug || '').startsWith('admin-ugc-')
  }));
}

module.exports = {
  systemAvatarFiles,
  disableSystemAvatars
};
