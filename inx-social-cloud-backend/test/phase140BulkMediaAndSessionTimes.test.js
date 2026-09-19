const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Bulk Scheduler accepts mixed image and video batches through the governed publisher', () => {
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const panel = read('frontend/src/components/bulk-scheduler/UploadBatchPanel.tsx');
  const api = read('frontend/src/lib/bulk-scheduler-api.ts');
  const results = read('frontend/src/components/bulk-scheduler/UploadResultsTable.tsx');
  assert.match(panel, /Select media/);
  assert.match(panel, /image\/png,image\/jpeg,image\/webp,video\/mp4/);
  assert.match(page, /contentType: action\.item\.kind === 'image' \? 'IMAGE' : 'VIDEO'/);
  assert.match(api, /\/api\/studio\/direct-posts/);
  assert.match(api, /direct-posts\/\$\{encodeURIComponent\(jobId\)\}\/media/);
  assert.match(results, /result\.mediaKind === 'image'/);
});

test('selected-date scheduling owns its multiple daily times inside the current session', () => {
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const selector = read('frontend/src/components/bulk-scheduler/DailyTimeSelector.tsx');
  const utilities = read('frontend/src/lib/bulk-scheduler-utils.ts');
  const settings = read('src/renderer/index.html');
  assert.match(page, /useState<string\[]>\(\['10:00'\]\)/);
  assert.match(selector, /Daily publishing times/);
  assert.match(selector, /Files fill these times in order each day/);
  assert.match(utilities, /input\.dailyTimes/);
  assert.doesNotMatch(settings, /id="settingSlots"/);
});


test('Bulk Scheduler preflights its 25-day window and exposes reviewable failed results', () => {
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const utilities = read('frontend/src/lib/bulk-scheduler-utils.ts');
  const panel = read('frontend/src/components/bulk-scheduler/BatchRunPanel.tsx');
  const results = read('frontend/src/components/bulk-scheduler/UploadResultsTable.tsx');
  assert.match(utilities, /MAX_BULK_SCHEDULE_DAYS = 25/);
  assert.match(utilities, /getBulkScheduleCapacity/);
  assert.match(page, /only \$\{scheduleCapacity\} fit inside the current/);
  assert.match(panel, /Needs review/);
  assert.match(panel, /Why items need review/);
  assert.match(results, /Retry upload/);
  assert.match(results, /Needs review/);
  assert.match(results, /PAGE_SIZE = 12/);
  assert.doesNotMatch(results, /results\.slice\(0, 12\)/);
});
