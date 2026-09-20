const prisma = require('../db/prisma');
const { decryptToken } = require('../utils/tokenCrypto');
const metaPublisher = require('./cloudMetaPublisher');

const CHECKABLE_STATUSES = ['PROCESSING'];
const FAILURE_WORDS = new Set(['error', 'failed', 'failure', 'rejected', 'expired']);
const COMPLETE_WORDS = new Set(['complete', 'completed', 'ready', 'published', 'scheduled']);
const MAX_STATUS_CHECK_ATTEMPTS = 6;
const RATE_LIMIT_COOLDOWN_MS = 65 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000;
let intervalHandle = null;
let cycleRunning = false;
let metaCooldownUntil = 0;

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

function isDefinitiveMissingMetaObject(error) {
  const detail = error?.meta?.error || error?.response?.data?.error || null;
  const code = Number(detail?.code || 0);
  const subcode = Number(detail?.error_subcode || 0);
  const message = lower(detail?.message || error?.publicMessage || error?.message);
  return (code === 100 && (subcode === 33 || /unsupported get request|does not exist|cannot be loaded/.test(message)))
    || /object.*not found|reel.*not found|video.*not found/.test(message);
}

function isMetaRateLimitError(error) {
  const detail = error?.meta?.error || error?.response?.data?.error || null;
  const code = Number(detail?.code || 0);
  const status = Number(error?.response?.status || 0);
  const message = lower(detail?.message || error?.publicMessage || error?.message);
  return status === 429
    || [4, 17, 32, 613, 80001, 80004].includes(code)
    || /rate limit|too many calls|application request limit|user request limit/.test(message);
}

function statusCheckAttempts(job) {
  return Math.max(0, Number(parseRaw(job?.rawMetaResponse).verification?.statusCheckAttempts || 0));
}

function nextRetryDelayMs(attempts) {
  return Math.min(MAX_RETRY_DELAY_MS, 30000 * (2 ** Math.max(0, Number(attempts || 1) - 1)));
}

function cooldownRemainingMs(now = Date.now()) {
  return Math.max(0, metaCooldownUntil - now);
}

async function stopPolling(job, db, message, attempts = statusCheckAttempts(job)) {
  const result = { state: job.status || 'PROCESSING' };
  const updated = await db.scheduleJob.update({
    where: { id: job.id },
    data: {
      nextAttemptAt: null,
      claimedAt: null,
      errorMessage: message,
      rawMetaResponse: withVerification(job, null, result, {
        confirmedAt: null,
        statusCheckAttempts: attempts,
        pollingStoppedAt: new Date().toISOString(),
        lastCheckError: message
      })
    }
  });
  return { job: updated, state: result.state, pending: true, pollingStopped: true, error: message };
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

  const previousAttempts = statusCheckAttempts(job);
  if (previousAttempts >= MAX_STATUS_CHECK_ATTEMPTS) {
    return stopPolling(
      job,
      db,
      'Facebook accepted this Reel, but automatic confirmation stopped after six checks to protect the API quota. Verify its status in Facebook.',
      previousAttempts
    );
  }
  if (cooldownRemainingMs() > 0) {
    return { jobId: job.id, state: job.status, pending: true, rateLimited: true, skipped: true };
  }

  const attempts = previousAttempts + 1;

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
        caption: final ? null : job.caption,
        rawMetaResponse: withVerification(job, payload, result, { statusCheckAttempts: attempts }),
        completedAt: final ? (job.completedAt || new Date()) : null,
        nextAttemptAt: final ? null : new Date(Date.now() + nextRetryDelayMs(attempts)),
        claimedAt: null,
        errorMessage: result.error ? String(result.error).slice(0, 2000) : null
      }
    });
    return { job: updated, state: result.state, error: result.error || null };
  } catch (error) {
    const message = String(error.publicMessage || error.message || 'Facebook status check failed').slice(0, 1000);
    if (isDefinitiveMissingMetaObject(error)) {
      const updated = await db.scheduleJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          caption: null,
          completedAt: job.completedAt || new Date(),
          nextAttemptAt: null,
          claimedAt: null,
          errorMessage: 'Facebook no longer recognises this Reel. The local filename has been released for retry.',
          rawMetaResponse: withVerification(
            job,
            null,
            { state: 'FAILED' },
            { missingOnMeta: true, lastCheckError: message, statusCheckAttempts: attempts }
          )
        }
      });
      return { job: updated, state: 'FAILED', retryable: true, error: message };
    }

    if (isMetaRateLimitError(error)) {
      metaCooldownUntil = Math.max(metaCooldownUntil, Date.now() + RATE_LIMIT_COOLDOWN_MS);
      const publicMessage = 'Facebook rate limit reached. Automatic checks are paused for 65 minutes to protect the app quota.';
      await db.scheduleJob.update({
        where: { id: job.id },
        data: {
          nextAttemptAt: new Date(metaCooldownUntil),
          errorMessage: publicMessage,
          rawMetaResponse: withVerification(
            job,
            null,
            { state: job.status || 'PROCESSING' },
            { confirmedAt: null, statusCheckAttempts: attempts, rateLimitedAt: new Date().toISOString(), lastCheckError: message }
          )
        }
      });
      return { jobId: job.id, state: job.status, pending: true, rateLimited: true, error: publicMessage };
    }

    if (attempts >= MAX_STATUS_CHECK_ATTEMPTS) {
      return stopPolling(
        job,
        db,
        'Facebook accepted this Reel, but automatic confirmation stopped after repeated temporary errors. Verify its status in Facebook.',
        attempts
      );
    }
    await db.scheduleJob.update({
      where: { id: job.id },
      data: {
        nextAttemptAt: new Date(Date.now() + nextRetryDelayMs(attempts)),
        rawMetaResponse: withVerification(
          job,
          null,
          { state: job.status || 'PROCESSING' },
          { confirmedAt: null, statusCheckAttempts: attempts, lastCheckError: message }
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
    return !verification?.confirmedAt
      && !verification?.pollingStoppedAt
      && statusCheckAttempts(job) < MAX_STATUS_CHECK_ATTEMPTS;
  }).slice(0, limit);
  return mapWithConcurrency(due, 2, job => reconcileJob(job, dependencies));
}

async function runCycle() {
  if (cycleRunning) return;
  cycleRunning = true;
  try {
    await reconcileJobs({ limit: 10 });
  } catch (error) {
    console.error('Meta Reel status reconciliation failed:', error.message);
  } finally {
    cycleRunning = false;
  }
}

function startMetaReelStatusReconciliation() {
  if (intervalHandle) return intervalHandle;
  runCycle();
  intervalHandle = setInterval(runCycle, 60000);
  intervalHandle.unref?.();
  return intervalHandle;
}

module.exports = {
  normaliseReelStatus,
  isDefinitiveMissingMetaObject,
  isMetaRateLimitError,
  nextRetryDelayMs,
  cooldownRemainingMs,
  reconcileJob,
  reconcileJobs,
  startMetaReelStatusReconciliation
};
