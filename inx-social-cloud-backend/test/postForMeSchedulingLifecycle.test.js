const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Post for Me is the only new future-scheduling queue for web Posts and Bulk Scheduler', () => {
  const publishing = read('src/services/postForMePublishingService.js');
  const routes = read('src/routes/socialPublicationRoutes.js');
  const bulkApi = read('frontend/src/lib/bulk-scheduler-api.ts');
  const server = read('src/server.js');
  const studio = read('src/controllers/studioController.js');

  assert.match(publishing, /scheduled_at: bundle\.input\.scheduledAt \|\| null/);
  assert.match(publishing, /postForMe\.apiRequest\('POST', '\/social-posts'/);
  assert.match(bulkApi, /\/api\/social-connections\/publications/);
  assert.match(bulkApi, /source: 'BULK_SCHEDULER'/);
  assert.doesNotMatch(bulkApi, /\/api\/studio\/direct-posts/);
  assert.match(studio, /Future scheduling uses the universal publishing queue/);
  assert.doesNotMatch(server, /startCloudPublishingQueue|startScheduledPublishingRuntime/);
  assert.match(routes, /scheduled-media/);
  assert.match(routes, /controller\.updateScheduled/);
});

test('scheduled Post for Me edits are restricted to draft or scheduled provider states', () => {
  const mutations = require('../src/services/postForMePostMutationService');
  assert.doesNotThrow(() => mutations.assertEditableProviderPost({ status: 'scheduled' }, { status: 'SCHEDULED' }));
  assert.doesNotThrow(() => mutations.assertEditableProviderPost({ status: 'draft' }, { status: 'DRAFT' }));
  assert.throws(
    () => mutations.assertEditableProviderPost({ status: 'processing' }, { status: 'PROCESSING' }),
    /already started processing/i
  );
  assert.throws(
    () => mutations.assertEditableProviderPost({ status: 'processed' }, { status: 'PUBLISHED' }),
    /already started processing/i
  );
});

test('Post for Me future scheduling has no INX Social maximum horizon', () => {
  const publishing = require('../src/services/postForMePublishingService');
  const farFuture = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(publishing.validateScheduledAt(farFuture), farFuture);
  assert.throws(
    () => publishing.validateScheduledAt(new Date(Date.now() - 60_000).toISOString()),
    /future/i
  );
});

test('scheduled editor exposes provider-supported caption media timing and cancellation controls', () => {
  const editor = read('frontend/src/components/posts/ScheduledPostEditorModal.tsx');
  const postsApi = read('frontend/src/lib/posts-api.ts');
  const bulkManager = read('frontend/src/components/bulk-scheduler/BulkScheduleManager.tsx');

  assert.match(editor, /Caption/);
  assert.match(editor, /Publishing date/);
  assert.match(editor, /Publishing time/);
  assert.match(editor, /Replace media/);
  assert.match(editor, /Cancel schedule/);
  assert.match(editor, /job\.status === 'SCHEDULED'/);
  assert.doesNotMatch(editor, />Title</);
  assert.match(postsApi, /updateScheduledPost/);
  assert.match(postsApi, /replaceScheduledPostMedia/);
  assert.match(postsApi, /cancelScheduledPost/);
  assert.match(bulkManager, /ScheduledPostEditorModal/);
});


test('provider submission failures persist into Needs Review instead of remaining Processing', () => {
  const publishing = read('src/services/postForMePublishingService.js');
  const stats = read('frontend/src/components/bulk-scheduler/BulkSchedulerStats.tsx');

  assert.match(publishing, /async function markBundleFailed/);
  assert.match(publishing, /status: 'FAILED'/);
  assert.match(publishing, /lastError: message/);
  assert.match(publishing, /await markBundleFailed\(bundle, error\)/);
  assert.match(publishing, /staleUnsubmittedText/);
  assert.match(publishing, /No provider schedule was created for this legacy attempt/);
  assert.match(stats, /job\.status === 'FAILED'/);
  assert.match(stats, /Needs Review/);
});

test('Post for Me post creation retries provider 429 responses with bounded backoff', () => {
  const publishing = read('src/services/postForMePublishingService.js');
  const provider = read('src/services/postForMeService.js');

  assert.match(publishing, /'\/social-posts'.*maxRetries: 5/);
  assert.match(provider, /status === 429/);
  assert.match(provider, /retryAfterMs/);
  assert.match(provider, /await sleep\(cooldown\)/);
});


test('failed provider submissions expose a safe retry endpoint and professional review workspace', () => {
  const publishing = read('src/services/postForMePublishingService.js');
  const controller = read('src/controllers/socialPublicationController.js');
  const routes = read('src/routes/socialPublicationRoutes.js');
  const manager = read('frontend/src/components/bulk-scheduler/BulkScheduleManager.tsx');
  const postsApi = read('frontend/src/lib/posts-api.ts');

  assert.match(publishing, /async function retryPublication/);
  assert.match(publishing, /Only failed or incomplete provider submissions can be retried/);
  assert.match(controller, /publishing\.retryPublication/);
  assert.match(routes, /:publicationId\/retry/);
  assert.match(postsApi, /retryFailedScheduledPost/);
  assert.match(manager, /Pending Review/);
  assert.match(manager, /Provider submission incomplete/);
  assert.match(manager, /Retry now/);
});


test('destination-scoped Bulk Edit safely splits shared schedules and preserves unselected destinations', () => {
  const mutation = read('src/services/postForMePostMutationService.js');
  const publishing = read('src/services/postForMePublishingService.js');
  const controller = read('src/controllers/socialPublicationController.js');
  const routes = read('src/routes/socialPublicationRoutes.js');

  assert.match(mutation, /async function bulkEdit/);
  assert.match(mutation, /const remainingRows = allRows\.filter/);
  assert.match(mutation, /postForMe\.apiRequest\('POST', '\/social-posts'/);
  assert.match(mutation, /postForMe\.apiRequest\('PUT', `\/social-posts\/\$\{encodeURIComponent\(parentId\)\}`/);
  assert.match(mutation, /restoreOriginalParent/);
  assert.match(mutation, /externalPostId: String\(parentId\)/);
  assert.match(mutation, /selected destinations from the same scheduled post/i);
  assert.match(controller, /mutations\.bulkEdit/);
  assert.match(routes, /router\.patch\('\/bulk-edit'/);
  assert.match(publishing, /caption: publication\.platformCaption \|\| publication\.content\?\.caption/);
});

test('single scheduled edits and cancellation operate on the current provider schedule after a destination split', () => {
  const mutation = read('src/services/postForMePostMutationService.js');
  assert.match(mutation, /async function parentRows/);
  assert.match(mutation, /where: \{ externalPostId: String\(parentId\), profile: \{ userId \} \}/);
  assert.match(mutation, /const rows = await parentRows\(userId, publication\.externalPostId\)/);
  assert.match(mutation, /const rows = parentId \? await parentRows\(userId, parentId\) : \[publication\]/);
});


test('platform-result failures preserve detailed reasons and support safe recovery without duplicating published content', () => {
  const publishing = read('src/services/postForMePublishingService.js');
  const provider = read('src/services/postForMeService.js');
  const controller = read('src/controllers/socialPublicationController.js');
  const manager = read('frontend/src/components/bulk-scheduler/BulkScheduleManager.tsx');
  const editor = read('frontend/src/components/posts/ScheduledPostEditorModal.tsx');
  const postsApi = read('frontend/src/lib/posts-api.ts');

  assert.match(publishing, /usefulDetailStrings/);
  assert.match(publishing, /humanizePlatformFailure/);
  assert.match(publishing, /publicationError/);
  assert.match(publishing, /resultError\(data, publication\.platform\)/);
  assert.match(publishing, /async function retryFailedProviderResult/);
  assert.match(publishing, /if \(result\.platformPostId\)/);
  assert.match(publishing, /will not create a duplicate/);
  assert.match(publishing, /social_accounts: \[accountId\]/);
  assert.match(publishing, /retryHistory/);
  assert.match(provider, /providerErrorMessage/);
  assert.match(controller, /caption: req\.body\?\.caption/);
  assert.match(controller, /scheduledAt: req\.body\?\.scheduledAt/);
  assert.match(postsApi, /retryFailedScheduledPost\(jobId: string, input:/);
  assert.match(manager, /Fix & retry/);
  assert.match(manager, /Retry now/);
  assert.match(manager, /!job\.metaPostId/);
  assert.match(editor, /Fix & retry post/);
  assert.match(editor, /Retry with changes/);
  assert.match(editor, /Why it failed/);
});


test('successful provider lifecycle states never surface failure copy and Batch Run keeps accepted schedules stable', () => {
  const publishing = require('../src/services/postForMePublishingService');
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const panel = read('frontend/src/components/bulk-scheduler/BatchRunPanel.tsx');
  const table = read('frontend/src/components/bulk-scheduler/UploadResultsTable.tsx');

  const now = new Date();
  const published = publishing.publicationToJob({
    id: 'pub-1',
    status: 'PUBLISHED',
    scheduledAt: new Date(now.getTime() - 60_000),
    publishedAt: now,
    lastError: null,
    metricsJson: JSON.stringify({ details: { message: 'provider diagnostic metadata' }, platformPostId: 'x-123' }),
    mediaJson: JSON.stringify({ contentType: 'TEXT', providerPostStatus: 'processed' }),
    createdAt: new Date(now.getTime() - 120_000),
    updatedAt: now,
    contentId: 'content-1',
    platform: 'x',
    platformCaption: 'hello',
    externalPostId: 'sp-123',
    content: { title: null, caption: 'hello', source: 'BULK_SCHEDULER' },
    profile: { id: 'profile-1', platform: 'x', displayName: 'X', username: 'example', avatarUrl: null }
  });
  assert.equal(published.status, 'PUBLISHED');
  assert.equal(published.errorMessage, null);

  assert.match(page, /const alreadyAccepted = result\.status === 'scheduled' \|\| result\.status === 'published'/);
  assert.match(page, /status: 'scheduled'/);
  assert.match(page, /errorMessage: null/);
  assert.doesNotMatch(panel, /label: 'Published'/);
  assert.match(panel, /Actual publishing outcomes are tracked separately in Posts and Calendar/);
  assert.doesNotMatch(table, /id: 'published'/);
  assert.match(table, /result\.status === 'published' \? 'scheduled' : result\.status/);
});

test('generic provider errors do not reference a UI action that may not exist in Batch Run', () => {
  const publishing = read('src/services/postForMePublishingService.js');
  assert.doesNotMatch(publishing, /Open Fix & retry/);
  assert.match(publishing, /Review the post details before retrying/);
});
