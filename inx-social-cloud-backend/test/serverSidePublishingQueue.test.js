const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('scheduled cloud posts stay in the INX Social queue until their due time', () => {
  const controller = read('src/controllers/studioController.js');
  const queue = read('src/services/cloudPublishingQueueService.js');
  const storage = read('src/services/mediaObjectStorageService.js');
  const server = read('src/server.js');

  assert.match(controller, /status: JOB_STATUS\.QUEUED/);
  assert.match(controller, /prefix: 'scheduled-publishing'/);
  assert.match(controller, /queued: true/);
  assert.match(queue, /scheduledAt: \{ lte: now \}/);
  assert.match(queue, /publishMode: 'NOW'/);
  assert.match(queue, /status: JOB_STATUS\.PUBLISHED/);
  assert.match(storage, /'scheduled-publishing'/);
  assert.match(server, /startCloudPublishingQueue\(\)/);
});

test('scheduled universal single posts stay local until the publishing worker submits them', () => {
  const publishing = read('src/services/postForMePublishingService.js');
  const mutations = read('src/services/postForMePostMutationService.js');
  const server = read('src/server.js');

  assert.match(publishing, /queuedMedia/);
  assert.match(publishing, /status: 'SCHEDULED'/);
  assert.match(publishing, /externalPostId: null/);
  assert.match(publishing, /forceImmediate: true/);
  assert.match(publishing, /runScheduledPublishingQueue/);
  assert.match(mutations, /serverQueued: true/);
  assert.match(server, /startScheduledPublishingRuntime\(\)/);
});

test('INX Social no longer imposes the legacy 25-day schedule horizon', () => {
  const cloud = read('src/services/cloudStudioService.js');
  const bulk = read('frontend/src/lib/bulk-scheduler-utils.ts');

  assert.doesNotMatch(cloud, /MAX_SCHEDULE_AHEAD_MS|more than 25 days ahead/);
  assert.doesNotMatch(bulk, /MAX_BULK_SCHEDULE_DAYS|getBulkScheduleCapacity|25-day scheduling window/);
});
