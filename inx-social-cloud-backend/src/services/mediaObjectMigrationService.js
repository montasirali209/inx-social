'use strict';

const prisma = require('../db/prisma');
const objectStorage = require('./mediaObjectStorageService');

const BATCH_SIZE = Math.max(1, Math.min(5, Number(process.env.MEDIA_OBJECT_MIGRATION_BATCH_SIZE || 2)));
const INTERVAL_MS = Math.max(10000, Number(process.env.MEDIA_OBJECT_MIGRATION_INTERVAL_MS || 30000));

let running = false;
let timer = null;
let completedLogged = false;

async function runMediaObjectMigrationBatch(options = {}) {
  if (running || !objectStorage.configured()) return { migrated: 0, remaining: null };
  running = true;
  try {
    const limit = Math.max(1, Math.min(10, Number(options.limit || BATCH_SIZE)));
    const assets = await prisma.agentAsset.findMany({
      where: {
        storageKey: null,
        data: { not: null }
      },
      select: {
        id: true,
        userId: true,
        originalName: true,
        mimeType: true,
        data: true
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });

    let migrated = 0;
    for (const asset of assets) {
      const body = Buffer.isBuffer(asset.data) ? asset.data : Buffer.from(asset.data || []);
      if (!body.length) {
        console.warn('[MEDIA OBJECT MIGRATION] Skipping empty legacy asset', { assetId: asset.id });
        continue;
      }

      const storageKey = objectStorage.keyFor(asset.userId, asset.id, asset.originalName);
      try {
        await objectStorage.putObject(storageKey, body, asset.mimeType);
        await prisma.agentAsset.updateMany({
          where: { id: asset.id, storageKey: null },
          data: {
            storageProvider: 'RAILWAY_BUCKET',
            storageKey,
            data: null
          }
        });
        migrated += 1;
        console.info('[MEDIA OBJECT MIGRATION] migrated', {
          assetId: asset.id,
          sizeMB: Number((body.length / (1024 * 1024)).toFixed(2))
        });
      } catch (error) {
        console.error('[MEDIA OBJECT MIGRATION] asset failed', {
          assetId: asset.id,
          error: error?.message || String(error)
        });
        break;
      }
    }

    const remaining = await prisma.agentAsset.count({
      where: { storageKey: null, data: { not: null } }
    });

    if (remaining === 0 && !completedLogged) {
      completedLogged = true;
      console.info('[MEDIA OBJECT MIGRATION] complete', { migratedThisBatch: migrated });
      await prisma.$executeRawUnsafe('VACUUM (ANALYZE) "AgentAsset"').catch((error) => {
        console.warn('[MEDIA OBJECT MIGRATION] post-migration vacuum delayed', {
          error: error?.message || String(error)
        });
      });
    }

    return { migrated, remaining };
  } finally {
    running = false;
  }
}

function startMediaObjectMigration() {
  if (!objectStorage.configured()) {
    console.warn('[MEDIA OBJECT MIGRATION] disabled: object storage is not configured');
    return null;
  }

  setTimeout(() => {
    void runMediaObjectMigrationBatch().catch((error) => {
      console.error('[MEDIA OBJECT MIGRATION] initial batch failed', { error: error?.message || String(error) });
    });
  }, 15000).unref?.();

  if (!timer) {
    timer = setInterval(() => {
      void runMediaObjectMigrationBatch().catch((error) => {
        console.error('[MEDIA OBJECT MIGRATION] batch failed', { error: error?.message || String(error) });
      });
    }, INTERVAL_MS);
    timer.unref?.();
  }
  return timer;
}

module.exports = {
  BATCH_SIZE,
  INTERVAL_MS,
  runMediaObjectMigrationBatch,
  startMediaObjectMigration
};
