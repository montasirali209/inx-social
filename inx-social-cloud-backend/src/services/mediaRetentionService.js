'use strict';

const prisma = require('../db/prisma');
const objectStorage = require('./mediaObjectStorageService');

const DAY_MS = 24 * 60 * 60 * 1000;
const VIDEO_RETENTION_DAYS = 10;
const OTHER_MEDIA_RETENTION_DAYS = 30;
const MEDIA_STORAGE_LIMIT_BYTES = 200 * 1024 * 1024;
const RETENTION_RUN_INTERVAL_MS = 60 * 60 * 1000;
const QUOTA_RUN_INTERVAL_MS = 60 * 1000;
const queuedQuotaUsers = new Set();

function retentionDays(mimeType) {
  return String(mimeType || '').toLowerCase().startsWith('video/')
    ? VIDEO_RETENTION_DAYS
    : OTHER_MEDIA_RETENTION_DAYS;
}

function expiresAtFor(mimeType, from = new Date()) {
  return new Date(new Date(from).getTime() + retentionDays(mimeType) * DAY_MS);
}

function removeStoredObjectsLater(assets, label) {
  const stored = (assets || []).filter(asset => asset.storageKey);
  if (!stored.length) return;
  void Promise.allSettled(
    stored.map(asset => objectStorage.deleteObject(asset.storageKey, asset.storageProvider || null))
  ).then(results => {
    const failed = results.filter(result => result.status === 'rejected').length;
    if (failed) console.warn(`[${label}] ${failed} object storage cleanup(s) will need retry.`);
  });
}

async function runMediaRetention(options = {}) {
  const database = options.prisma || prisma;
  const now = options.now || new Date();
  const videoCutoff = new Date(now.getTime() - VIDEO_RETENTION_DAYS * DAY_MS);
  const otherCutoff = new Date(now.getTime() - OTHER_MEDIA_RETENTION_DAYS * DAY_MS);
  const where = {
    OR: [
      { expiresAt: { lte: now } },
      { expiresAt: null, mimeType: { startsWith: 'video/' }, createdAt: { lte: videoCutoff } },
      { expiresAt: null, NOT: { mimeType: { startsWith: 'video/' } }, createdAt: { lte: otherCutoff } },
    ],
  };
  if (typeof database.agentAsset.findMany !== 'function') {
    const result = await database.agentAsset.deleteMany({ where });
    return result.count;
  }
  const expired = await database.agentAsset.findMany({
    where,
    select: { id: true, storageKey: true, storageProvider: true }
  });
  if (!expired.length) return 0;
  const result = await database.agentAsset.deleteMany({ where: { id: { in: expired.map(asset => asset.id) } } });
  removeStoredObjectsLater(expired, 'MEDIA RETENTION');
  return result.count;
}

async function runUserStorageQuota(userId, options = {}) {
  const database = options.prisma || prisma;
  const limitBytes = Number(options.limitBytes || MEDIA_STORAGE_LIMIT_BYTES);
  if (!userId || !Number.isFinite(limitBytes) || limitBytes < 1) return 0;
  if (typeof database.agentAsset.aggregate !== 'function' || typeof database.agentAsset.findMany !== 'function') return 0;

  const usage = await database.agentAsset.aggregate({
    where: { userId: String(userId) },
    _sum: { byteSize: true }
  });
  const usedBytes = Number(usage?._sum?.byteSize || 0);
  if (usedBytes <= limitBytes) return 0;

  const oldestFirst = await database.agentAsset.findMany({
    where: { userId: String(userId) },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      byteSize: true,
      storageKey: true,
      storageProvider: true,
      createdAt: true
    }
  });

  let bytesToFree = usedBytes - limitBytes;
  const victims = [];
  for (const asset of oldestFirst) {
    if (bytesToFree <= 0) break;
    victims.push(asset);
    bytesToFree -= Math.max(0, Number(asset.byteSize || 0));
  }
  if (!victims.length) return 0;

  const result = await database.agentAsset.deleteMany({
    where: {
      userId: String(userId),
      id: { in: victims.map(asset => asset.id) }
    }
  });
  removeStoredObjectsLater(victims, 'MEDIA QUOTA');
  return result.count;
}

async function runAllStorageQuotas(options = {}) {
  const database = options.prisma || prisma;
  if (typeof database.agentAsset.findMany !== 'function') return 0;
  const users = await database.agentAsset.findMany({
    where: { byteSize: { gt: 0 } },
    distinct: ['userId'],
    select: { userId: true },
    take: 10000
  });
  let removed = 0;
  for (const row of users) {
    removed += await runUserStorageQuota(row.userId, { ...options, prisma: database });
  }
  return removed;
}

function scheduleUserStorageQuota(userId) {
  const key = String(userId || '');
  if (!key || queuedQuotaUsers.has(key)) return;
  queuedQuotaUsers.add(key);
  Promise.resolve()
    .then(() => runUserStorageQuota(key))
    .then(count => {
      if (count) console.log(`[MEDIA QUOTA] Removed ${count} oldest media asset(s) for user ${key} to stay within 200 MB.`);
    })
    .catch(error => console.error('[MEDIA QUOTA]', error))
    .finally(() => queuedQuotaUsers.delete(key));
}

function startMediaRetention() {
  const runRetention = () => runMediaRetention()
    .then(count => {
      if (count) console.log(`[MEDIA RETENTION] Removed ${count} expired media asset(s).`);
    })
    .catch(error => console.error('[MEDIA RETENTION]', error));

  const runQuota = () => runAllStorageQuotas()
    .then(count => {
      if (count) console.log(`[MEDIA QUOTA] Removed ${count} oldest media asset(s) above the 200 MB per-user limit.`);
    })
    .catch(error => console.error('[MEDIA QUOTA]', error));

  runRetention();
  runQuota();

  const retentionTimer = setInterval(runRetention, RETENTION_RUN_INTERVAL_MS);
  const quotaTimer = setInterval(runQuota, QUOTA_RUN_INTERVAL_MS);
  retentionTimer.unref?.();
  quotaTimer.unref?.();
  return { retentionTimer, quotaTimer };
}

module.exports = {
  VIDEO_RETENTION_DAYS,
  OTHER_MEDIA_RETENTION_DAYS,
  MEDIA_STORAGE_LIMIT_BYTES,
  retentionDays,
  expiresAtFor,
  runMediaRetention,
  runUserStorageQuota,
  runAllStorageQuotas,
  scheduleUserStorageQuota,
  startMediaRetention,
};
