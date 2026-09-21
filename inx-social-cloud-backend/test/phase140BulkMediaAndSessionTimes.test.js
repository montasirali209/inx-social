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
  assert.match(api, /\/api\/social-connections\/publications/);
  assert.match(api, /publications\/\$\{encodeURIComponent\(jobId\)\}\/media/);
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


test('Bulk Scheduler uses Post for Me long-range scheduling with editable provider-held posts', () => {
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const utilities = read('frontend/src/lib/bulk-scheduler-utils.ts');
  const uploadPanel = read('frontend/src/components/bulk-scheduler/UploadBatchPanel.tsx');
  const panel = read('frontend/src/components/bulk-scheduler/BatchRunPanel.tsx');
  const results = read('frontend/src/components/bulk-scheduler/UploadResultsTable.tsx');
  const stats = read('frontend/src/components/bulk-scheduler/BulkSchedulerStats.tsx');
  const manager = read('frontend/src/components/bulk-scheduler/BulkScheduleManager.tsx');
  const api = read('frontend/src/lib/bulk-scheduler-api.ts');
  assert.doesNotMatch(utilities, /MAX_BULK_SCHEDULE_DAYS|getBulkScheduleCapacity|25-day scheduling window/);
  assert.match(uploadPanel, /Scheduled publishing/);
  assert.match(page, /BulkSchedulerStats/);
  assert.match(page, /BulkScheduleManager/);
  assert.match(stats, /Open to select and bulk edit/);
  assert.match(manager, /ScheduledPostEditorModal/);
  assert.match(manager, /Review future schedules/);
  assert.match(api, /updateBulkScheduledPost/);
  assert.match(api, /replaceBulkScheduledMedia/);
  assert.match(api, /deleteBulkJob/);
  assert.match(panel, /Needs review/);
  assert.match(panel, /Why items need review/);
  assert.match(results, /Retry upload/);
  assert.match(results, /Retry post/);
  assert.match(manager, /Retry All/);
  assert.match(manager, /onRetryJobs/);
  assert.match(page, /retryReviewJobs/);
  assert.match(page, /batchRunSection/);
  assert.match(page, /Retrying post/);
  assert.match(results, /Needs review/);
  assert.match(results, /PAGE_SIZE = 12/);
  assert.doesNotMatch(results, /results\.slice\(0, 12\)/);
  assert.doesNotMatch(api, /\/api\/studio\/direct-posts/);
});


test('Bulk Scheduler supports text-only batches in the same workflow', () => {
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const panel = read('frontend/src/components/bulk-scheduler/UploadBatchPanel.tsx');
  const input = read('frontend/src/components/bulk-scheduler/CaptionInput.tsx');
  const utilities = read('frontend/src/lib/bulk-scheduler-utils.ts');
  const results = read('frontend/src/components/bulk-scheduler/UploadResultsTable.tsx');

  assert.match(panel, /Media Posts/);
  assert.match(panel, /Text Posts/);
  assert.match(input, /One complete post per block/);
  assert.match(input, />---</);
  assert.match(utilities, /parseTextPosts/);
  assert.match(utilities, /split\(\/\^\\s\*---\\s\*\$\/m\)/);
  assert.match(page, /contentType: 'TEXT'/);
  assert.match(page, /mediaCount: batchCount/);
  assert.match(page, /bulk-text-/);
  assert.match(page, /TEXT_POST_PLATFORMS/);
  assert.match(results, /text post/);
  assert.match(results, /FileText/);
});


test('customer-facing scheduling UI never exposes the underlying publishing provider brand', () => {
  const roots = [
    path.join(root, 'frontend', 'src', 'components'),
    path.join(root, 'frontend', 'src', 'data'),
    path.join(root, 'frontend', 'src', 'lib'),
  ];
  const files = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(full);
    }
  };
  roots.forEach(walk);
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /Post for Me/i, `Provider branding leaked into ${path.relative(root, file)}`);
  }
});


test('Bulk Scheduler bulk edits selected destinations with caption date and time controls', () => {
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const manager = read('frontend/src/components/bulk-scheduler/BulkScheduleManager.tsx');
  const modal = read('frontend/src/components/bulk-scheduler/BulkTextEditModal.tsx');
  const rules = read('frontend/src/lib/bulk-text-edit.ts');
  const postsApi = read('frontend/src/lib/posts-api.ts');
  const mutation = read('src/services/postForMePostMutationService.js');
  const routes = read('src/routes/socialPublicationRoutes.js');

  assert.match(manager, /Bulk edit scheduled posts/);
  assert.match(manager, /All destinations/);
  assert.match(manager, /Destination scope/);
  assert.match(manager, /Select all \(/);
  assert.match(manager, /Bulk Edit/);
  assert.doesNotMatch(manager, /Filter scheduled posts by platform/);
  assert.doesNotMatch(manager, /single-destination text posts/);
  assert.match(manager, /onBulkEditJobs/);

  assert.match(modal, /X clean text preset/);
  assert.match(modal, /Remove hashtags/);
  assert.match(modal, /Maximum one emoji/);
  assert.match(modal, /Optional find and replace/);
  assert.match(modal, /New start date/);
  assert.match(modal, /Set time for selected posts/);
  assert.match(modal, /Unselected destinations are not changed/);

  assert.match(rules, /applyBulkScheduleEdit/);
  assert.match(rules, /earliestLocalDate/);
  assert.match(rules, /startDate/);
  assert.match(rules, /time/);

  assert.match(postsApi, /bulkEditScheduledPosts/);
  assert.match(postsApi, /publications\/bulk-edit/);
  assert.match(page, /bulkEditScheduledJobs/);
  assert.match(page, /bulkEditScheduledPosts/);
  assert.match(page, /Updating .* selected destination/);
  assert.match(page, /destination schedule/);

  assert.match(routes, /router\.patch\('\/bulk-edit'/);
  assert.match(mutation, /async function bulkEdit/);
  assert.match(mutation, /remainingRows/);
  assert.match(mutation, /split:/);
  assert.match(mutation, /restoreOriginalParent/);
  assert.match(mutation, /maxRetries: 5/);
});


test('Bulk Edit stays discoverable through KPI and manager controls without redundant hero actions', () => {
  const hero = read('frontend/src/components/bulk-scheduler/BulkSchedulerHero.tsx');
  const stats = read('frontend/src/components/bulk-scheduler/BulkSchedulerStats.tsx');
  const manager = read('frontend/src/components/bulk-scheduler/BulkScheduleManager.tsx');

  assert.doesNotMatch(hero, /Start New Bulk Schedule/);
  assert.doesNotMatch(hero, /Manage Scheduled Posts/);
  assert.doesNotMatch(hero, /onManage|onOpen/);
  assert.match(stats, /Open to select and bulk edit/);
  assert.match(manager, /Need to change several scheduled posts\?/);
  assert.match(manager, /Bulk Edit Scheduled/);
  assert.match(manager, /onClick=\{\(\) => setView\('scheduled'\)\}/);
  assert.match(manager, /Bulk edit scheduled posts/);
  assert.match(manager, /Select all \(/);
});


test('Bulk Scheduler cancels selected future destinations without deleting unselected sibling schedules', () => {
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const manager = read('frontend/src/components/bulk-scheduler/BulkScheduleManager.tsx');
  const postsApi = read('frontend/src/lib/posts-api.ts');
  const mutation = read('src/services/postForMePostMutationService.js');
  const controller = read('src/controllers/socialPublicationController.js');
  const routes = read('src/routes/socialPublicationRoutes.js');

  assert.match(manager, /Cancel Selected/);
  assert.match(manager, /onBulkCancelJobs/);
  assert.match(manager, /window\.confirm/);
  assert.match(manager, /removed from the publishing queue and will not go live/);
  assert.match(manager, /bulkCancelling/);
  assert.match(manager, /Trash2/);

  assert.match(page, /bulkCancelScheduledJobs/);
  assert.match(page, /bulkCancelScheduledPosts/);
  assert.match(page, /onBulkCancelJobs=\{bulkCancelScheduledJobs\}/);

  assert.match(postsApi, /bulkCancelScheduledPosts/);
  assert.match(postsApi, /publications\/bulk-cancel/);
  assert.match(routes, /router\.post\('\/bulk-cancel', controller\.bulkCancelScheduled\)/);
  assert.match(controller, /mutations\.bulkCancel/);

  assert.match(mutation, /async function bulkCancel/);
  assert.match(mutation, /const remainingRows = allRows\.filter/);
  assert.match(mutation, /providerBody\(parent, remainingRows/);
  assert.match(mutation, /apiRequest\('PUT', `\/social-posts\/\$\{encodeURIComponent\(parentId\)\}`/);
  assert.match(mutation, /apiRequest\('DELETE', `\/social-posts\/\$\{encodeURIComponent\(parentId\)\}`/);
  assert.match(mutation, /markCancelledRows\(groupRows\)/);
  assert.match(mutation, /status: 'CANCELLED'/);
  assert.match(mutation, /failures/);
});


test('mobile publishing surfaces avoid fixed KPI widths and use full-screen workflow modals', () => {
  const bulkStats = read('frontend/src/components/bulk-scheduler/BulkSchedulerStats.tsx');
  const bulkManager = read('frontend/src/components/bulk-scheduler/BulkScheduleManager.tsx');
  const posts = read('frontend/src/components/posts/PostsPage.tsx');
  const postPrimitives = read('frontend/src/components/posts/PostPrimitives.tsx');
  const destinations = read('frontend/src/components/posts/DestinationSelector.tsx');
  const media = read('frontend/src/components/media-library/MediaLibraryPage.tsx');
  const mediaPrimitives = read('frontend/src/components/media-library/MediaPrimitives.tsx');
  const analytics = read('frontend/src/components/analytics/AnalyticsPage.tsx');
  const analyticsStat = read('frontend/src/components/analytics/AnalyticsStatCard.tsx');
  const stockVideo = read('frontend/src/components/ai-content-studio/StockVideoCreator.tsx');

  assert.match(bulkStats, /grid grid-cols-2/);
  assert.doesNotMatch(bulkStats, /min-w-\[210px\]/);
  assert.match(bulkManager, /h-dvh w-full/);
  assert.match(bulkManager, /grid grid-cols-2 gap-2/);

  assert.match(posts, /grid grid-cols-2 gap-2/);
  assert.doesNotMatch(postPrimitives, /min-w-\[210px\]/);
  assert.match(destinations, /h-dvh w-full/);
  assert.match(destinations, /basis-full flex-1/);

  assert.match(media, /grid grid-cols-2 gap-2/);
  assert.doesNotMatch(mediaPrimitives, /min-w-\[210px\]/);
  assert.match(analytics, /grid grid-cols-2 gap-2/);
  assert.doesNotMatch(analyticsStat, /min-w-\[205px\]/);

  assert.match(stockVideo, /h-dvh w-full/);
  assert.match(stockVideo, /overflow-y-auto lg:grid-cols-\[54%_46%\] lg:overflow-hidden/);
});
