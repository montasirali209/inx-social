const JOB_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  AWAITING_UPLOAD: 'AWAITING_UPLOAD',
  READY: 'READY',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  SCHEDULED: 'SCHEDULED',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

const ASSET_STATUS = Object.freeze({
  AWAITING_UPLOAD: 'AWAITING_UPLOAD',
  UPLOADING: 'UPLOADING',
  READY: 'READY',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  DELETED: 'DELETED'
});

const TRANSITIONS = Object.freeze({
  DRAFT: new Set(['AWAITING_UPLOAD', 'CANCELLED']),
  AWAITING_UPLOAD: new Set(['READY', 'FAILED', 'CANCELLED']),
  READY: new Set(['QUEUED', 'CANCELLED']),
  QUEUED: new Set(['PROCESSING', 'FAILED', 'CANCELLED']),
  PROCESSING: new Set(['SCHEDULED', 'PUBLISHED', 'FAILED']),
  FAILED: new Set(['QUEUED', 'CANCELLED']),
  SCHEDULED: new Set(['PUBLISHED', 'FAILED']),
  PUBLISHED: new Set(),
  CANCELLED: new Set()
});

const TERMINAL_STATUSES = new Set([
  JOB_STATUS.PUBLISHED,
  JOB_STATUS.CANCELLED
]);

const EDITABLE_STATUSES = new Set([
  JOB_STATUS.DRAFT,
  JOB_STATUS.AWAITING_UPLOAD,
  JOB_STATUS.FAILED
]);

const MAX_CLOUD_FILE_BYTES = 10n * 1024n * 1024n * 1024n;
const MIN_SCHEDULE_LEAD_MS = 20 * 60 * 1000;
const MAX_SCHEDULE_AHEAD_MS = 25 * 24 * 60 * 60 * 1000;

function canTransition(from, to) {
  return Boolean(TRANSITIONS[String(from || '').toUpperCase()]?.has(String(to || '').toUpperCase()));
}

function validateScheduleTime(value, now = new Date()) {
  if (value === null || value === undefined || value === '') return null;
  const scheduledAt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(scheduledAt.getTime())) {
    const error = new Error('Choose a valid schedule date and time.');
    error.status = 400;
    error.publicMessage = error.message;
    throw error;
  }

  const delay = scheduledAt.getTime() - now.getTime();
  if (delay < MIN_SCHEDULE_LEAD_MS) {
    const error = new Error('Schedule time must be at least 20 minutes from now.');
    error.status = 400;
    error.publicMessage = error.message;
    throw error;
  }
  if (delay > MAX_SCHEDULE_AHEAD_MS) {
    const error = new Error('Schedule time cannot be more than 25 days ahead.');
    error.status = 400;
    error.publicMessage = error.message;
    throw error;
  }
  return scheduledAt;
}

function normaliseFileSize(value) {
  if (value === null || value === undefined || value === '') return null;
  let size;
  try {
    size = BigInt(value);
  } catch (_) {
    const error = new Error('Video file size must be a whole number of bytes.');
    error.status = 400;
    error.publicMessage = error.message;
    throw error;
  }
  if (size <= 0n || size > MAX_CLOUD_FILE_BYTES) {
    const error = new Error('Video must be larger than 0 bytes and no larger than 10 GB.');
    error.status = 400;
    error.publicMessage = error.message;
    throw error;
  }
  return size;
}

function summariseStatusRows(rows = []) {
  const summary = {
    total: 0,
    draft: 0,
    awaitingUpload: 0,
    ready: 0,
    queued: 0,
    processing: 0,
    scheduled: 0,
    published: 0,
    failed: 0,
    cancelled: 0
  };

  for (const row of rows) {
    const count = Number(row?._count?._all || row?.count || 0);
    summary.total += count;
    const key = {
      DRAFT: 'draft',
      AWAITING_UPLOAD: 'awaitingUpload',
      READY: 'ready',
      QUEUED: 'queued',
      PROCESSING: 'processing',
      SCHEDULED: 'scheduled',
      PUBLISHED: 'published',
      FAILED: 'failed',
      CANCELLED: 'cancelled'
    }[String(row?.status || '').toUpperCase()];
    if (key) summary[key] += count;
  }

  return summary;
}

module.exports = {
  JOB_STATUS,
  ASSET_STATUS,
  TERMINAL_STATUSES,
  EDITABLE_STATUSES,
  MAX_CLOUD_FILE_BYTES,
  MIN_SCHEDULE_LEAD_MS,
  MAX_SCHEDULE_AHEAD_MS,
  canTransition,
  validateScheduleTime,
  normaliseFileSize,
  summariseStatusRows
};
