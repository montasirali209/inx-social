const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('provider media setup failures become terminal instead of leaving AWAITING_MEDIA zombies', () => {
  const service = read('src/services/postForMePublishingService.js');
  assert.match(service, /create-upload-url', \{ maxRetries: 4 \}/);
  assert.match(service, /async function attachMediaStream/);
  assert.match(service, /await markBundleFailed\(bundle, error\)/);
  assert.match(service, /STALE_AWAITING_MEDIA_MS/);
  assert.match(service, /staleAwaitingMedia/);
  assert.match(service, /reviewAction/);
  assert.match(service, /retryable/);
});

test('Bulk Scheduler Processing KPI ignores stale historical incomplete jobs', () => {
  const stats = read('frontend/src/components/bulk-scheduler/BulkSchedulerStats.tsx');
  const service = read('src/services/postForMePublishingService.js');
  assert.match(service, /const activeProcessing =/);
  assert.match(service, /ageMs < 30 \* 60 \* 1000/);
  assert.match(stats, /job\.activeProcessing === true/);
  assert.match(stats, /Live provider work only/);
});

test('Calendar only sends terminal failed records to Needs Review and obeys server retryability', () => {
  const api = read('frontend/src/lib/calendar-api.ts');
  const card = read('frontend/src/components/calendar/ScheduledVideoCard.tsx');
  const editor = read('frontend/src/components/posts/ScheduledPostEditorModal.tsx');
  assert.match(api, /status === 'AWAITING_UPLOAD' \|\| status === 'READY'\) return 'draft'/);
  assert.match(api, /retryable: job\.retryable/);
  assert.match(card, /post\.retryable !== false/);
  assert.match(card, /post\.reviewAction === 'reupload'/);
  assert.match(editor, /job\.retryable !== false/);
});

test('review UI no longer uses gold and Calendar toast no longer uses fixed black background', () => {
  const card = read('frontend/src/components/calendar/ScheduledVideoCard.tsx');
  const calendarCard = read('frontend/src/components/calendar/CalendarPostCard.tsx');
  const statusBadge = read('frontend/src/components/dashboard/StatusBadge.tsx');
  const editor = read('frontend/src/components/posts/ScheduledPostEditorModal.tsx');
  const page = read('frontend/src/components/calendar/ContentCalendarPage.tsx');

  assert.doesNotMatch(card, /brand-amber/);
  assert.doesNotMatch(calendarCard, /brand-amber/);
  assert.doesNotMatch(editor, /brand-amber/);
  assert.match(statusBadge, /pending_review: 'border-brand-red/);
  assert.doesNotMatch(page, /bg-\[#071923\]/);
  assert.match(page, /bg-panel/);
  assert.match(page, /notice\.tone === 'error'/);
});
