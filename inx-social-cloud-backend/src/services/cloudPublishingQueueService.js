'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const prisma = require('../db/prisma');
const { decryptToken } = require('../utils/tokenCrypto');
const metaPublisher = require('./cloudMetaPublisher');
const objectStorage = require('./mediaObjectStorageService');
const mediaLibrary = require('./mediaLibraryService');
const { JOB_STATUS, ASSET_STATUS } = require('./cloudStudioService');

const POLL_INTERVAL_MS = 15_000;
const CLAIM_STALE_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;

function retryDelayMs(attempt) {
  const delays = [60_000, 2 * 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000];
  return delays[Math.max(0, Math.min(delays.length - 1, Number(attempt || 1) - 1))];
}

async function materialiseVideo(job) {
  const suffix = path.extname(job.cloudAsset?.originalFileName || job.localFileName || '').slice(0, 12) || '.mp4';
  const tempPath = path.join(os.tmpdir(), `inx-social-queue-${crypto.randomUUID()}${suffix}`);

  if (job.cloudAsset?.storageKey) {
    const response = await objectStorage.getStream(job.cloudAsset.storageKey, job.cloudAsset.provider || null);
    await pipeline(response.data, fs.createWriteStream(tempPath));
    return { tempPath, byteSize: Number(job.cloudAsset.fileSizeBytes || 0n) || Number(response.headers?.['content-length'] || 0) };
  }

  if (job.mediaLibraryAssetId) {
    const asset = await mediaLibrary.findContent(job.userId, job.mediaLibraryAssetId);
    if (!asset) throw new Error('The queued Media Library asset is no longer available.');
    await fs.promises.writeFile(tempPath, asset.data);
    return { tempPath, byteSize: asset.data.length };
  }

  throw new Error('The queued video file is unavailable.');
}

async function queuedImage(job) {
  if (job.cloudAsset?.storageKey) {
    const data = await objectStorage.getBuffer(job.cloudAsset.storageKey, null, job.cloudAsset.provider || null);
    return {
      data,
      mimeType: job.cloudAsset.mimeType || 'image/jpeg',
      originalName: job.cloudAsset.originalFileName || job.localFileName || 'scheduled-image.jpg'
    };
  }
  if (job.mediaLibraryAssetId) {
    const asset = await mediaLibrary.findContent(job.userId, job.mediaLibraryAssetId);
    if (!asset) throw new Error('The queued Media Library asset is no longer available.');
    return { data: asset.data, mimeType: asset.mimeType, originalName: asset.originalName };
  }
  throw new Error('The queued image file is unavailable.');
}

async function cleanupQueueAsset(job) {
  if (!job.cloudAsset?.storageKey) return;
  await objectStorage.deleteObject(job.cloudAsset.storageKey, job.cloudAsset.provider || null).catch(error => {
    console.warn('[PUBLISH QUEUE] queued object cleanup failed', { jobId: job.id, error: error?.message });
  });
  await prisma.cloudAsset.update({
    where: { id: job.cloudAsset.id },
    data: { status: ASSET_STATUS.DELETED, storageKey: null }
  }).catch(() => {});
}

async function publishQueuedJob(job) {
  if (!job.connectedPage?.encryptedAccessToken) throw new Error('The connected Facebook Page must be reconnected before this post can publish.');
  const token = decryptToken(job.connectedPage.encryptedAccessToken);
  const pageId = job.connectedPage.facebookPageId;
  let tempPath = null;
  try {
    let result;
    if (job.contentType === 'TEXT') {
      result = await metaPublisher.publishOrganicPost({
        pageId,
        pageAccessToken: token,
        caption: job.caption || '',
        scheduledAt: null,
        publishMode: 'NOW'
      });
    } else if (job.contentType === 'IMAGE') {
      result = await metaPublisher.publishOrganicPost({
        pageId,
        pageAccessToken: token,
        caption: job.caption || '',
        scheduledAt: null,
        publishMode: 'NOW',
        asset: await queuedImage(job)
      });
    } else if (job.contentType === 'VIDEO') {
      const materialised = await materialiseVideo(job);
      tempPath = materialised.tempPath;
      result = await metaPublisher.publishReel({
        pageId,
        pageAccessToken: token,
        filePath: materialised.tempPath,
        fileSize: materialised.byteSize,
        caption: job.caption || '',
        scheduledAt: null,
        publishMode: 'NOW'
      });
    } else {
      throw new Error(`Unsupported queued content type: ${job.contentType}`);
    }

    const completedAt = new Date();
    await prisma.scheduleJob.update({
      where: { id: job.id },
      data: {
        status: JOB_STATUS.PUBLISHED,
        uploadStatus: job.contentType === 'TEXT' ? 'NOT_REQUIRED' : ASSET_STATUS.DELETED,
        completedAt,
        claimedAt: null,
        nextAttemptAt: null,
        errorMessage: null,
        metaPostId: result.postId || null,
        metaVideoId: result.videoId || null,
        rawMetaResponse: JSON.stringify({
          ...(result.response || result.finish || {}),
          verification: {
            state: 'PUBLISHED',
            serverQueue: true,
            publishedAt: completedAt.toISOString()
          }
        })
      }
    });
    await cleanupQueueAsset(job);
    return true;
  } finally {
    if (tempPath) await fs.promises.unlink(tempPath).catch(() => {});
  }
}

async function failQueuedJob(job, error) {
  const attempt = Number(job.attemptCount || 0) + 1;
  const terminal = attempt >= MAX_ATTEMPTS;
  const message = String(error?.publicMessage || error?.message || 'Scheduled publishing failed.').slice(0, 1000);
  await prisma.scheduleJob.update({
    where: { id: job.id },
    data: {
      status: terminal ? JOB_STATUS.FAILED : JOB_STATUS.QUEUED,
      attemptCount: attempt,
      claimedAt: null,
      nextAttemptAt: terminal ? null : new Date(Date.now() + retryDelayMs(attempt)),
      errorMessage: message
    }
  }).catch(() => {});
  console.error('[PUBLISH QUEUE] job failed', { jobId: job.id, attempt, terminal, error: message });
}

async function claimAndPublish(job) {
  const claimed = await prisma.scheduleJob.updateMany({
    where: { id: job.id, status: JOB_STATUS.QUEUED },
    data: { status: JOB_STATUS.PROCESSING, claimedAt: new Date(), errorMessage: null }
  });
  if (claimed.count !== 1) return false;

  const fresh = await prisma.scheduleJob.findUnique({
    where: { id: job.id },
    include: { connectedPage: true, cloudAsset: true }
  });
  if (!fresh) return false;

  try {
    await publishQueuedJob(fresh);
    return true;
  } catch (error) {
    await failQueuedJob(fresh, error);
    return false;
  }
}

async function recoverStaleClaims(now = new Date()) {
  const cutoff = new Date(now.getTime() - CLAIM_STALE_MS);
  const result = await prisma.scheduleJob.updateMany({
    where: {
      origin: 'CLOUD',
      status: JOB_STATUS.PROCESSING,
      metaPostId: null,
      metaVideoId: null,
      claimedAt: { lt: cutoff },
      scheduledAt: { not: null },
      nextAttemptAt: { not: null }
    },
    data: {
      status: JOB_STATUS.QUEUED,
      claimedAt: null,
      nextAttemptAt: now,
      errorMessage: 'Recovered after an interrupted publishing worker.'
    }
  });
  return result.count;
}

async function runCloudPublishingQueue(options = {}) {
  const now = options.now || new Date();
  await recoverStaleClaims(now);
  const due = await prisma.scheduleJob.findMany({
    where: {
      origin: 'CLOUD',
      status: JOB_STATUS.QUEUED,
      scheduledAt: { lte: now },
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: now } }
      ]
    },
    include: { connectedPage: true, cloudAsset: true },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    take: 20
  });

  let published = 0;
  for (const job of due) {
    if (await claimAndPublish(job)) published += 1;
  }
  return published;
}

function startCloudPublishingQueue() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const count = await runCloudPublishingQueue();
      if (count) console.log(`[PUBLISH QUEUE] Published ${count} due cloud job(s).`);
    } catch (error) {
      console.error('[PUBLISH QUEUE]', error);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = {
  POLL_INTERVAL_MS,
  MAX_ATTEMPTS,
  retryDelayMs,
  recoverStaleClaims,
  runCloudPublishingQueue,
  startCloudPublishingQueue
};
