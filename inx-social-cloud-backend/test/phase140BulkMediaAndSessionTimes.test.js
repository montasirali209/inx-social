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
