const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const { MAX_SHIFT_MINUTES, validateAiTimes } = require('../src/services/smartTimingService');

test('Smart Timing validates AI timestamps inside the bounded window and preserves order', () => {
  const base = [
    new Date(Date.now() + 24 * 60 * 60_000),
    new Date(Date.now() + 27 * 60 * 60_000),
  ];
  const valid = [
    new Date(base[0].getTime() + 7 * 60_000).toISOString(),
    new Date(base[1].getTime() - 9 * 60_000).toISOString(),
  ];
  assert.deepEqual(validateAiTimes(valid, base), valid);

  const tooFar = [
    new Date(base[0].getTime() + (MAX_SHIFT_MINUTES + 1) * 60_000).toISOString(),
    valid[1],
  ];
  assert.equal(validateAiTimes(tooFar, base), null);

  const reversed = [
    new Date(base[0].getTime() + 10 * 60_000).toISOString(),
    new Date(base[0].getTime() + 5 * 60_000).toISOString(),
  ];
  assert.equal(validateAiTimes(reversed, base), null);
});

test('Bulk Scheduler Smart Timing is one optional control wired to one batch analysis', () => {
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const panel = read('frontend/src/components/bulk-scheduler/UploadBatchPanel.tsx');
  const api = read('frontend/src/lib/bulk-scheduler-api.ts');
  assert.match(panel, />Smart Timing</);
  assert.match(panel, /onSmartTimingChange/);
  assert.match(page, /optimiseBulkScheduleTimes/);
  assert.match(page, /baselinePublishingTimes/);
  assert.match(page, /smartTimingSource/);
  assert.match(api, /\/api\/social-connections\/publications\/smart-timing/);
});

test('Smart Timing metadata survives the existing publishing path and Calendar shows it', () => {
  const publishing = read('src/services/postForMePublishingService.js');
  const routes = read('src/routes/socialPublicationRoutes.js');
  const calendar = read('frontend/src/components/calendar/CalendarPostCard.tsx');
  const calendarApi = read('frontend/src/lib/calendar-api.ts');
  assert.match(routes, /router\.post\('\/smart-timing'/);
  assert.match(publishing, /smartTiming: meta\.smartTiming \|\| null/);
  assert.match(calendarApi, /smartTiming: Boolean\(job\.smartTiming\?\.enabled\)/);
  assert.match(calendar, /Smart Timing selected this exact publishing time/);
});
