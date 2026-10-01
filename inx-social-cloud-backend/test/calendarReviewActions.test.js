const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Needs Review cards open a repair modal with delete and failed-media recovery', () => {
  const page = read('frontend/src/components/calendar/ContentCalendarPage.tsx');
  const card = read('frontend/src/components/calendar/ScheduledVideoCard.tsx');
  const editor = read('frontend/src/components/posts/ScheduledPostEditorModal.tsx');

  assert.match(page, /post\.status === 'needs_review'/);
  assert.match(page, /fixReviewPost\(post\)/);
  assert.match(card, /Review details & fix/);
  assert.match(card, /Delete failed item/);
  assert.match(card, /onFix\(post\)/);
  assert.match(card, /onDelete\(post\)/);
  assert.match(editor, /Review failed post/);
  assert.match(editor, /Replacement media required/);
  assert.match(editor, /Fix & resubmit/);
  assert.match(editor, /Delete failed item/);
  assert.match(editor, /Publishing date/);
  assert.match(editor, /Publishing time/);
});

test('failed local review draft can be updated before replacement media is resubmitted', () => {
  const service = read('src/services/postForMePublishingService.js');
  const controller = read('src/controllers/socialPublicationController.js');
  const routes = read('src/routes/socialPublicationRoutes.js');
  const api = read('frontend/src/lib/posts-api.ts');

  assert.match(service, /async function updateFailedReviewDraft/);
  assert.match(service, /const recoverableLocalFailure = !publication\.externalPostId/);
  assert.match(service, /publication\.status === 'AWAITING_MEDIA'/);
  assert.match(service, /publication\.status === 'READY'/);
  assert.match(service, /ageMs > STALE_AWAITING_MEDIA_MS/);
  assert.match(service, /ageMs > STALE_READY_MS/);
  assert.match(service, /platformCaption: caption/);
  assert.match(service, /scheduledAt: scheduledAt \? new Date\(scheduledAt\) : null/);
  assert.match(controller, /updateReviewDraft/);
  assert.match(routes, /review-draft/);
  assert.match(api, /updateFailedReviewDraft/);
  assert.match(api, /review-draft/);
});

test('Needs Review filter no longer uses amber styling', () => {
  const toolbar = read('frontend/src/components/calendar/CalendarToolbar.tsx');
  assert.match(toolbar, /needs_review/);
  assert.doesNotMatch(toolbar, /needs_review'.*brand-amber/);
});
