const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('UGC funnel analytics are privacy-safe and visible in Admin AI operations', () => {
  const service = read('src/services/ugcStudioAnalyticsService.js');
  const controller = read('src/controllers/adminController.js');
  const routes = read('src/routes/adminRoutes.js');
  const html = read('public/index.html');
  const admin = read('public/admin.js');

  assert.match(service, /UGCStudioEvent/);
  assert.match(service, /safeMetadata/);
  assert.doesNotMatch(service, /script.*metadata|prompt.*metadata/i);
  assert.match(service, /GENERATION_STARTED/);
  assert.match(service, /GENERATION_COMPLETED/);
  assert.match(service, /SCHEDULER_HANDOFF/);
  assert.match(controller, /ugcAnalyticsSummary/);
  assert.match(routes, /\/ugc-analytics/);
  assert.match(html, /UGC Studio funnel/);
  assert.match(admin, /renderUgcAnalytics/);
  assert.match(admin, /Quality/);
  assert.match(admin, /Ad style/);
});

test('UGC customer funnel captures home, wizard and editor milestones', () => {
  const api = read('frontend/src/lib/ugc-studio-api.ts');
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  const editor = read('frontend/src/components/ai-content-studio/UGCEditorPage.tsx');
  const backend = read('src/services/ugcStudioService.js');

  assert.match(api, /trackUGCStudioEvent/);
  assert.match(home, /STUDIO_OPENED/);
  assert.match(home, /CREATE_STARTED/);
  assert.match(home, /SCHEDULER_HANDOFF/);
  assert.match(wizard, /SOURCE_COMPLETED/);
  assert.match(wizard, /BRAND_ANALYZED/);
  assert.match(wizard, /FORMAT_SELECTED/);
  assert.match(wizard, /CREATOR_SELECTED/);
  assert.match(editor, /EDITOR_OPENED/);
  assert.match(backend, /GENERATION_STARTED/);
  assert.match(backend, /GENERATION_COMPLETED/);
  assert.match(backend, /GENERATION_FAILED/);
});

test('post-UGC integration keeps Analytics, Calendar, Connected Accounts and Media Library on shared production data paths', () => {
  const analytics = read('frontend/src/components/analytics/AnalyticsPage.tsx');
  const analyticsService = read('src/services/postForMeAnalyticsService.js');
  const calendar = read('frontend/src/components/calendar/ContentCalendarPage.tsx');
  const bulkApi = read('frontend/src/lib/bulk-scheduler-api.ts');
  const studioController = read('src/controllers/studioController.js');
  const media = read('frontend/src/components/media-library/MediaLibraryPage.tsx');
  const ugc = read('src/services/ugcStudioService.js');

  assert.match(analytics, /fetchAnalyticsForSource/);
  assert.match(analyticsService, /AnalyticsSourceCache|analyticsSourceCache/);
  assert.match(calendar, /ScheduleJob|schedule|calendar/i);
  assert.match(bulkApi, /status === 'connected'/);
  assert.match(studioController, /Choose at least one connected Page/);
  assert.match(studioController, /needs to be reconnected before publishing|must be reconnected before publishing/);
  assert.match(media, /Media Library/i);
  assert.match(ugc, /agentAsset\.create/);
  assert.match(ugc, /mediaAssetId/);
});
