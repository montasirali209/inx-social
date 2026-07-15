const { DateTime } = require('luxon');
const { FacebookClient } = require('./facebookClient');
const {
  findNextFreeSlot,
  metaScheduledPostsToSlotKeys,
  slotKey,
  BLOCKING_STATUSES
} = require('./slotPlanner');

class SchedulerStoppedError extends Error {
  constructor(message = 'Upload stopped by user.') {
    super(message);
    this.name = 'SchedulerStoppedError';
    this.code = 'SCHEDULER_STOPPED';
  }
}

async function runScheduler(appStore, onProgress = () => {}, control = {}) {
  const settings = appStore.getSettings();
  const client = new FacebookClient(settings);

  ensureNotStopped(control);

  onProgress({
    type: 'start',
    message: 'Starting safe scheduler: checking Meta first...',
    percent: 2,
    phase: 'Meta check',
    state: appStore.getState()
  });

  const metaOccupiedSlotKeys = await getMetaOccupiedSlots(client, appStore, settings, onProgress, control);

  ensureNotStopped(control);

  onProgress({
    type: 'planning',
    message: 'Checking local queue against live Meta scheduled slots...',
    percent: 12,
    phase: 'Planning',
    state: appStore.getState()
  });

  reassignConflictingPendingJobs(appStore, settings, metaOccupiedSlotKeys, onProgress);

  const jobs = appStore.getJobs()
    .filter(job => job.status === 'planned' || job.status === 'failed_retryable' || job.status === 'stopped')
    .sort((a, b) => a.scheduledUnix - b.scheduledUnix);

  if (!jobs.length) {
    const message = 'No planned jobs waiting to upload.';
    appStore.log('scheduler', message);
    onProgress({ type: 'done', message, percent: 100, phase: 'Done', current: 0, total: 0, state: appStore.getState() });
    return { uploaded: 0, failed: 0, stopped: false, state: appStore.getState() };
  }

  let uploaded = 0;
  let failed = 0;
  const total = jobs.length;

  onProgress({
    type: 'upload-start',
    message: `Upload queue ready: ${total} video${total === 1 ? '' : 's'} waiting.`,
    percent: 15,
    phase: 'Uploading',
    current: 0,
    total,
    uploaded,
    failed,
    state: appStore.getState()
  });

  for (let index = 0; index < jobs.length; index++) {
    ensureNotStopped(control);

    const job = jobs[index];
    const latestJob = appStore.getJobs().find(j => j.id === job.id) || job;
    const startPercent = progressPercent(index, total, 15, 85);

    if (!isSlotStillSafe(latestJob, appStore, settings, metaOccupiedSlotKeys)) {
      const moved = moveJobToNextAvailableSlot(appStore, latestJob, settings, metaOccupiedSlotKeys, onProgress);
      if (!moved) {
        appStore.updateJob(latestJob.id, {
          status: 'failed_retryable',
          error: 'No free schedule slot available within Max schedule days.'
        });
        failed++;
        onProgress({
          type: 'job-failed',
          jobId: latestJob.id,
          message: `${latestJob.videoName}: no free slot available within Max schedule days.`,
          percent: progressPercent(index + 1, total, 15, 85),
          phase: 'Uploading',
          current: index + 1,
          total,
          uploaded,
          failed,
          state: appStore.getState()
        });
        continue;
      }
    }

    const currentJob = appStore.getJobs().find(j => j.id === job.id) || job;
    onProgress({
      type: 'job-start',
      jobId: currentJob.id,
      message: `Uploading ${index + 1}/${total}: ${currentJob.videoName}`,
      percent: startPercent,
      phase: 'Uploading',
      current: index + 1,
      total,
      uploaded,
      failed,
      state: appStore.getState()
    });

    appStore.updateJob(currentJob.id, {
      status: 'uploading',
      attempts: Number(currentJob.attempts || 0) + 1,
      error: null
    });

    try {
      const result = await retry(
        () => {
          ensureNotStopped(control);
          return client.uploadScheduledVideo(appStore.getJobs().find(j => j.id === currentJob.id), { signal: control.signal });
        },
        Number(settings.maxRetries || 3),
        Number(settings.retryBaseDelayMs || 5000),
        delayMs => onProgress({
          type: 'retry',
          jobId: currentJob.id,
          message: `Retrying ${currentJob.videoName} in ${Math.round(delayMs / 1000)}s...`,
          percent: Math.min(95, startPercent + 2),
          phase: 'Retrying',
          current: index + 1,
          total,
          uploaded,
          failed,
          state: appStore.getState()
        }),
        control
      );

      ensureNotStopped(control);

      appStore.updateJob(currentJob.id, {
        status: 'scheduled',
        fbVideoId: result.id || null,
        fbPostId: result.post_id || null,
        rawResponse: result,
        error: null
      });
      const scheduledJob = appStore.getJobs().find(j => j.id === currentJob.id) || currentJob;
      metaOccupiedSlotKeys.add(slotKey(DateTime.fromISO(scheduledJob.scheduledAtISO, { zone: settings.timezone || 'Europe/London' }), settings.timezone || 'Europe/London'));
      appStore.log('facebook', `Scheduled ${currentJob.videoName}.`, { fbVideoId: result.id, fbPostId: result.post_id });
      uploaded++;
      onProgress({
        type: 'job-success',
        jobId: currentJob.id,
        message: `Scheduled ${index + 1}/${total}: ${currentJob.videoName}`,
        percent: progressPercent(index + 1, total, 15, 85),
        phase: 'Uploading',
        current: index + 1,
        total,
        uploaded,
        failed,
        result,
        state: appStore.getState()
      });
    } catch (err) {
      if (isStoppedError(err, control)) {
        appStore.updateJob(currentJob.id, {
          status: 'stopped',
          error: 'Stopped by user before Meta confirmed scheduling.'
        });
        appStore.log('scheduler', `Stopped by user while processing ${currentJob.videoName}.`);
        onProgress({
          type: 'stopped',
          jobId: currentJob.id,
          message: `Stopped safely. Current video was kept in local queue: ${currentJob.videoName}`,
          percent: progressPercent(index, total, 15, 85),
          phase: 'Stopped',
          current: index,
          total,
          uploaded,
          failed,
          state: appStore.getState()
        });
        return { uploaded, failed, stopped: true, state: appStore.getState() };
      }

      const retryable = isRetryableScheduleError(err) || isRetryableNetworkError(err);
      appStore.updateJob(currentJob.id, {
        status: retryable ? 'failed_retryable' : 'failed',
        error: err.message,
        rawError: err.meta || null
      });
      appStore.log('error', `Failed ${currentJob.videoName}: ${err.message}`, err.meta || {});
      failed++;
      onProgress({
        type: 'job-failed',
        jobId: currentJob.id,
        message: `Failed ${index + 1}/${total}: ${err.message}`,
        percent: progressPercent(index + 1, total, 15, 85),
        phase: 'Uploading',
        current: index + 1,
        total,
        uploaded,
        failed,
        state: appStore.getState()
      });
    }
  }

  const summary = `Scheduler finished. Uploaded: ${uploaded}. Failed: ${failed}.`;
  appStore.log('scheduler', summary);
  onProgress({
    type: 'done',
    message: summary,
    percent: 100,
    phase: 'Done',
    current: total,
    total,
    uploaded,
    failed,
    state: appStore.getState()
  });
  return { uploaded, failed, stopped: false, state: appStore.getState() };
}

async function getMetaOccupiedSlots(client, appStore, settings, onProgress, control) {
  ensureNotStopped(control);
  try {
    const result = await client.listScheduledPosts(500, { signal: control.signal });
    ensureNotStopped(control);
    const posts = result.data || [];
    const keys = metaScheduledPostsToSlotKeys(posts, settings.timezone || 'Europe/London');
    appStore.log('facebook', `Checked Meta before upload: ${keys.size} scheduled slot(s) already occupied.`);
    onProgress({
      type: 'meta-sync',
      message: `Checked Meta: ${keys.size} occupied scheduled slot(s).`,
      percent: 8,
      phase: 'Meta check',
      metaOccupiedSlots: keys.size,
      state: appStore.getState()
    });
    return keys;
  } catch (err) {
    if (isStoppedError(err, control)) throw new SchedulerStoppedError();
    appStore.log('warning', `Could not check existing Meta scheduled posts before upload: ${err.message}`);
    onProgress({
      type: 'meta-sync-warning',
      message: `Could not check Meta scheduled slots: ${err.message}`,
      percent: 8,
      phase: 'Meta check warning',
      state: appStore.getState()
    });
    return new Set();
  }
}

function reassignConflictingPendingJobs(appStore, settings, metaOccupiedSlotKeys, onProgress) {
  const timezone = settings.timezone || 'Europe/London';
  const pending = appStore.getJobs()
    .filter(job => job.status === 'planned' || job.status === 'failed_retryable' || job.status === 'stopped')
    .sort((a, b) => a.scheduledUnix - b.scheduledUnix);

  const fixedOccupied = new Set(metaOccupiedSlotKeys);
  for (const job of appStore.getJobs()) {
    if (pending.some(p => p.id === job.id)) continue;
    if (!BLOCKING_STATUSES.has(job.status)) continue;
    if (!job.scheduledAtISO) continue;
    const dt = DateTime.fromISO(job.scheduledAtISO, { zone: timezone });
    if (dt.isValid) fixedOccupied.add(slotKey(dt, timezone));
  }

  const usedByThisRun = new Set();

  for (const job of pending) {
    const dt = DateTime.fromISO(job.scheduledAtISO, { zone: timezone });
    const currentKey = dt.isValid ? slotKey(dt, timezone) : null;
    const conflict = !currentKey || fixedOccupied.has(currentKey) || usedByThisRun.has(currentKey);
    if (!conflict) {
      usedByThisRun.add(currentKey);
      if (job.status === 'stopped') appStore.updateJob(job.id, { status: 'planned', error: null });
      continue;
    }

    const occupiedForSearch = new Set([...fixedOccupied, ...usedByThisRun]);
    const next = findNextFreeSlot(settings, [], occupiedForSearch, job.scheduledAtISO);
    if (!next) {
      appStore.updateJob(job.id, {
        status: 'failed_retryable',
        error: 'No free schedule slot available within Max schedule days.'
      });
      appStore.log('planner', `Could not move ${job.videoName}; no free slot within Max schedule days.`);
      continue;
    }

    appStore.updateJob(job.id, {
      scheduledAtISO: next.scheduledAtISO,
      scheduledUnix: next.scheduledUnix,
      slotLabel: next.slotLabel,
      status: 'planned',
      error: null
    });
    usedByThisRun.add(slotKey(DateTime.fromISO(next.scheduledAtISO, { zone: timezone }), timezone));
    appStore.log('planner', `Moved ${job.videoName} to next free slot: ${next.slotLabel}.`);
    onProgress({
      type: 'slot-moved',
      jobId: job.id,
      message: `Moved ${job.videoName} to next free slot: ${next.slotLabel}.`,
      percent: 14,
      phase: 'Planning',
      state: appStore.getState()
    });
  }
}

function isSlotStillSafe(job, appStore, settings, metaOccupiedSlotKeys) {
  const timezone = settings.timezone || 'Europe/London';
  if (!job.scheduledAtISO) return false;
  const dt = DateTime.fromISO(job.scheduledAtISO, { zone: timezone });
  if (!dt.isValid) return false;
  const key = slotKey(dt, timezone);
  if (metaOccupiedSlotKeys.has(key)) return false;
  for (const other of appStore.getJobs()) {
    if (other.id === job.id) continue;
    if (!BLOCKING_STATUSES.has(other.status)) continue;
    if (!other.scheduledAtISO) continue;
    const otherDt = DateTime.fromISO(other.scheduledAtISO, { zone: timezone });
    if (otherDt.isValid && slotKey(otherDt, timezone) === key) return false;
  }
  return true;
}

function moveJobToNextAvailableSlot(appStore, job, settings, metaOccupiedSlotKeys, onProgress) {
  const timezone = settings.timezone || 'Europe/London';
  const occupied = new Set(metaOccupiedSlotKeys);
  for (const other of appStore.getJobs()) {
    if (other.id === job.id) continue;
    if (!BLOCKING_STATUSES.has(other.status)) continue;
    if (!other.scheduledAtISO) continue;
    const dt = DateTime.fromISO(other.scheduledAtISO, { zone: timezone });
    if (dt.isValid) occupied.add(slotKey(dt, timezone));
  }

  const next = findNextFreeSlot(settings, [], occupied, job.scheduledAtISO);
  if (!next) return false;
  appStore.updateJob(job.id, {
    scheduledAtISO: next.scheduledAtISO,
    scheduledUnix: next.scheduledUnix,
    slotLabel: next.slotLabel,
    status: 'planned',
    error: null
  });
  appStore.log('planner', `Moved ${job.videoName} to next free slot before upload: ${next.slotLabel}.`);
  onProgress({
    type: 'slot-moved',
    jobId: job.id,
    message: `Moved ${job.videoName} to next free slot before upload: ${next.slotLabel}.`,
    phase: 'Planning',
    state: appStore.getState()
  });
  return true;
}

async function retry(fn, maxAttempts, retryBaseDelayMs, onRetry, control) {
  let lastError;
  const attempts = Math.max(1, maxAttempts);
  for (let i = 0; i < attempts; i++) {
    ensureNotStopped(control);
    try {
      return await fn();
    } catch (err) {
      if (isStoppedError(err, control)) throw new SchedulerStoppedError();
      lastError = err;
      if (i >= attempts - 1) break;
      const delayMs = Number(retryBaseDelayMs || 5000) * (i + 1);
      onRetry(delayMs);
      await wait(delayMs, control);
    }
  }
  throw lastError;
}

function ensureNotStopped(control = {}) {
  if (control.isStopped && control.isStopped()) throw new SchedulerStoppedError();
  if (control.signal && control.signal.aborted) throw new SchedulerStoppedError();
}

function isStoppedError(err, control = {}) {
  if (err instanceof SchedulerStoppedError) return true;
  if (control.isStopped && control.isStopped()) return true;
  if (control.signal && control.signal.aborted) return true;
  const code = String(err && err.code ? err.code : '').toUpperCase();
  const name = String(err && err.name ? err.name : '').toLowerCase();
  const message = String(err && err.message ? err.message : '').toLowerCase();
  return code === 'ERR_CANCELED' || name.includes('canceled') || message.includes('canceled') || message.includes('cancelled');
}

function progressPercent(done, total, start = 0, span = 100) {
  if (!total) return start;
  return Math.max(0, Math.min(99, Math.round(start + (done / total) * span)));
}

function isRetryableScheduleError(err) {
  const msg = String(err && err.message ? err.message : '').toLowerCase();
  return msg.includes('scheduled publish time') || msg.includes('schedule') || msg.includes('too far') || msg.includes('invalid');
}

function isRetryableNetworkError(err) {
  const code = String(err && err.code ? err.code : '').toUpperCase();
  return ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code);
}

function wait(ms, control = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    if (control.signal) {
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new SchedulerStoppedError());
      };
      control.signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

module.exports = { runScheduler, reassignConflictingPendingJobs, SchedulerStoppedError };
