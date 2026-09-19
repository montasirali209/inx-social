'use strict';

const prisma = require('../db/prisma');
const objectStorage = require('./mediaObjectStorageService');

function enabled() {
  return /^(?:1|true|yes|on)$/i.test(String(process.env.AGENT_ASSET_BUCKET_BACKFILL_ON_STARTUP || '').trim());
}

async function runAgentAssetBucketBackfill(options = {}) {
  if (!enabled() && !options.force) return { migrated: 0, failed: 0, skipped: true };
  if (!objectStorage.isConfigured()) throw new Error('AgentAsset bucket backfill requires configured media object storage.');

  const database = options.prisma || prisma;
  let migrated = 0;
  let failed = 0;
  const maxAssets = Math.max(1, Math.min(Number(options.maxAssets || 1000), 5000));

  for (let index = 0; index < maxAssets; index += 1) {
    const asset = await database.agentAsset.findFirst({
      where: {
        storageKey: null,
        data: { not: null }
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        userId: true,
        mimeType: true,
        originalName: true,
        data: true
      }
    });

    if (!asset) break;
    const data = Buffer.from(asset.data || []);
    if (!data.length) {
      await database.agentAsset.update({
        where: { id: asset.id },
        data: { data: null, storageProvider: 'DATABASE_EMPTY' }
      });
      continue;
    }

    let stored;
    try {
      stored = await objectStorage.persistBuffer({
        userId: asset.userId,
        data,
        mimeType: asset.mimeType,
        originalName: asset.originalName || asset.id,
        prefix: 'legacy-agent-assets'
      });
      if (!stored.storageKey) throw new Error('Backfill did not produce an object storage key.');

      await database.agentAsset.update({
        where: { id: asset.id },
        data: {
          storageProvider: stored.storageProvider,
          storageKey: stored.storageKey,
          data: null
        }
      });
      migrated += 1;
      console.info('[AGENT ASSET BACKFILL] migrated', { id: asset.id, bytes: data.length, storageKey: stored.storageKey });
    } catch (error) {
      failed += 1;
      if (stored?.storageKey) await objectStorage.deleteObject(stored.storageKey).catch(() => {});
      console.error('[AGENT ASSET BACKFILL] failed', { id: asset.id, error: error?.message || String(error) });
      break;
    }
  }

  console.info('[AGENT ASSET BACKFILL] complete', { migrated, failed });
  return { migrated, failed, skipped: false };
}

function startAgentAssetBucketBackfill() {
  if (!enabled()) return;
  setTimeout(() => {
    runAgentAssetBucketBackfill().catch((error) => {
      console.error('[AGENT ASSET BACKFILL] fatal', { error: error?.message || String(error) });
    });
  }, 5000).unref?.();
}

module.exports = { runAgentAssetBucketBackfill, startAgentAssetBucketBackfill };
