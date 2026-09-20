const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAX_CLOUD_FILE_BYTES,
  canTransition,
  validateScheduleTime,
  normaliseFileSize,
  summariseStatusRows
} = require('../src/services/cloudStudioService');

test('cloud job transitions allow only the reviewed queue path', () => {
  assert.equal(canTransition('DRAFT', 'AWAITING_UPLOAD'), true);
  assert.equal(canTransition('READY', 'QUEUED'), true);
  assert.equal(canTransition('PROCESSING', 'PUBLISHED'), true);
  assert.equal(canTransition('PUBLISHED', 'QUEUED'), false);
  assert.equal(canTransition('CANCELLED', 'PROCESSING'), false);
});

test('schedule validation enforces Meta lead time and horizon', () => {
  const now = new Date('2026-07-23T10:00:00.000Z');
  const valid = validateScheduleTime('2026-07-23T10:20:00.000Z', now);
  assert.equal(valid.toISOString(), '2026-07-23T10:20:00.000Z');
  assert.throws(
    () => validateScheduleTime('2026-07-23T10:19:59.999Z', now),
    /at least 20 minutes/
  );
  assert.throws(
    () => validateScheduleTime('2026-08-17T10:00:00.001Z', now),
    /more than 25 days/
  );
});

test('cloud file size is stored exactly and capped at 10 GB', () => {
  assert.equal(normaliseFileSize('1048576'), 1048576n);
  assert.equal(normaliseFileSize(MAX_CLOUD_FILE_BYTES.toString()), MAX_CLOUD_FILE_BYTES);
  assert.throws(() => normaliseFileSize('0'), /larger than 0 bytes/);
  assert.throws(() => normaliseFileSize((MAX_CLOUD_FILE_BYTES + 1n).toString()), /no larger than 10 GB/);
  assert.throws(() => normaliseFileSize('1.5'), /whole number of bytes/);
});

test('status summary is stable for missing and unknown rows', () => {
  assert.deepEqual(summariseStatusRows([
    { status: 'DRAFT', _count: { _all: 2 } },
    { status: 'PUBLISHED', _count: { _all: 3 } },
    { status: 'UNKNOWN', _count: { _all: 1 } }
  ]), {
    total: 6,
    draft: 2,
    awaitingUpload: 0,
    ready: 0,
    queued: 0,
    processing: 0,
    scheduled: 0,
    published: 3,
    failed: 0,
    cancelled: 0
  });
});
