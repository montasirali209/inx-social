const prisma = require('../db/prisma');
const { decryptToken } = require('../utils/tokenCrypto');
const metaPublisher = require('./cloudMetaPublisher');

const CHECKABLE_STATUSES = ['PROCESSING', 'SCHEDULED', 'PUBLISHED'];
const FAILURE_WORDS = new Set(['error', 'failed', 'failure', 'rejected', 'expired']);
const COMPLETE_WORDS = new Set(['complete', 'completed', 'ready', 'published', 'scheduled']);
let intervalHandle = null;
let cycleRunning = false;

function parseRaw(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function lower(value) {
  return String(value || '').trim().toLowerCase();
}

function phaseErrors(phase) {
  const errors = Array.isArray(phase?.errors) ? phase.errors : [];
  return errors.map(item => {
    if (typeof item === 'string') return item;
    return item?.message || item?.error_subcode || item?.error_code || JSON.stringify(item);
  }).filter(Boolean);
}

function normaliseReelStatus(payload, publishMode = 'SCHEDULED') {
  const status = payload?.status || {};
  const upload = status.uploading_phase || {};
  const processing = status.processing_phase || {};
  const publishing = status.publishing_phase || {};
  const videoStatus = lower(status.video_status || payload?.video_status);
  const uploadStatus = lower(upload.status);
  const processingStatus = lower(processing.status);
  const publishingStatus = lower(publishing.status);
  const errors = [
    ...phaseErrors(upload),
    ...phaseErrors(processing),
    ...phaseErrors(publishing)
  ];
  const states = [videoStatus, uploadStatus, processingStatus, publishingStatus].filter(Boolean);
  const failed = errors.length > 0 || states.some(value => FAILURE_WORDS.has(value));
  if (failed) {
    return {
      state: 'FAILED',
      error: errors.join('; ') || `Facebook reported Reel processing status: ${states.join(', ') || 'failed'}.`
    };
  }

  const publishingComplete = COMPLETE_WORDS.has(publishingStatus);
  const videoPublished = videoStatus === 'published';
  const processingComplete = COMPLETE_WORDS.has(processingStatus) || COMPLETE_WORDS.has(videoStatus);
  if (String(publishMode || '').toUpperCase() === 'NOW') {
    if (publishingComplete || videoPublished) return { state: 'PUBLISHED', error: null };
    return { state: 'PROCESSING', error: null };
  }
  if (processingComplete) return { state: 'SCHEDULED', error: null };
  return { state: 'PROCESSING', error: null };
}

function withVerification(job, statusPayload, result, extra = {}) {
  const raw = parseRaw(job.rawMetaResponse);
  return JSON.stringify({
    ...raw,
    facebookStatus: statusPayload || raw.facebookStatus || null,
    verification: {
      ...(raw.verification || {}),
      checkedAt: new Date().toISOString(),
      state: result?.state || 'PROCESSING',
      confirmedAt: ['SCHEDULED', 'PUBLISHED', 'FAILED'].includes(result?.state)
        ? new Date().toISOString()
        : null,
      ...extra
    }
  });
}

async function reconcileJob(job, dependencies = {}) {
  const db = dependencies.prisma || prisma;
  const publisher = dependencies.metaPublisher || metaPublisher;
  const decrypt = dependencies.decryptToken || decryptToken;
  if (!job?.metaVideoId || !job.connectedPage?.encryptedAccessToken) return { skipped: true };

  try {
    const payload = await publisher.getReelStatus({
      videoId: job.metaVideoId,
      pageAccessToken: decrypt(job.connectedPage.encryptedAccessToken)
    });
    const result = normaliseReelStatus(payload, job.publishMode);
    const final = result.state !== 'PROCESSING';
    const updated = await db.scheduleJob.update({
      where: { id: job.id },
      data: {
        status: result.state,
        rawMetaResponse: withVerification(job, payload, result),
        completedAt: final ? (job.completedAt || new Date()) : null,
        nextAttemptAt: final ? null : new Date(Date.now() + 30000),
        claimedAt: null,
        errorMessage: result.error ? String(result.error).slice(0, 2000) : null
      }
    });
    return { job: updated, state: result.state, error: result.error || null };
  } catch (error) {
    const message = String(error.publicMessage || error.message || 'Facebook status check failed').slice(0, 1000);
    await db.scheduleJob.update({
      where: { id: job.id },
      data: {
        nextAttemptAt: new Date(Date.now() + 120000),
        rawMetaResponse: withVerification(
          job,
          null,
          { state: job.status || 'PROCESSING' },
          { confirmedAt: null, lastCheckError: message }
        )
      }
    });
    return { jobId: job.id, state: job.status, pending: true, error: message };
  }
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await callback(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function reconcileJobs({ userId = null, limit = 50 } = {}, dependencies = {}) {
  const db = dependencies.prisma || prisma;
  const now = new Date();
  const candidates = await db.scheduleJob.findMany({
    where: {
      ...(userId ? { userId } : {}),
      origin: 'CLOUD',
      metaVideoId: { not: null },
      status: { in: CHECKABLE_STATUSES }
    },
    orderBy: { createdAt: 'desc' },
    take: Math.max(20, Number(limit || 50) * 4),
    include: { connectedPage: true }
  });
  const due = candidates.filter(job => {
    if (job.nextAttemptAt && new Date(job.nextAttemptAt) > now) return false;
    const verification = parseRaw(job.rawMetaResponse).verification;
    return !verification?.confirmedAt;
  }).slice(0, limit);
  return mapWithConcurrency(due, 5, job => reconcileJob(job, dependencies));
}

async function runCycle() {
  if (cycleRunning) return;
  cycleRunning = true;
  try {
    await reconcileJobs({ limit: 50 });
  } catch (error) {
    console.error('Meta Reel status reconciliation failed:', error.message);
  } finally {
    cycleRunning = false;
  }
}

function startMetaReelStatusReconciliation() {
  if (intervalHandle) return intervalHandle;
  runCycle();
  intervalHandle = setInterval(runCycle, 30000);
  intervalHandle.unref?.();
  return intervalHandle;
}

module.exports = {
  normaliseReelStatus,
  reconcileJob,
  reconcileJobs,
  startMetaReelStatusReconciliation
};