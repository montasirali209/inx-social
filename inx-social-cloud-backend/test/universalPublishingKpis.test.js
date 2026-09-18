const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('analytics metric snapshots persist measured post deltas instead of fabricated historical dates', () => {
  const schema = read('prisma/schema.prisma');
  const service = read('src/services/postForMeAnalyticsService.js');
  const server = read('src/server.js');

  assert.match(schema, /model AnalyticsMetricSnapshot/);
  assert.match(schema, /externalPostId\s+String/);
  assert.match(schema, /capturedAt\s+DateTime/);
  assert.match(service, /positiveDelta/);
  assert.match(service, /SNAPSHOT_RUNTIME_INTERVAL_MS/);
  assert.match(service, /SNAPSHOT_RUNTIME_ACCOUNT_DELAY_MS/);
  assert.match(server, /startAnalyticsSnapshotRuntime/);
});

test('universal publishing API is mounted before the application fallback', () => {
  const app = read('src/app.js');
  const routes = read('src/routes/socialPublicationRoutes.js');
  assert.match(app, /const socialPublicationRoutes = require\('\.\/routes\/socialPublicationRoutes'\);/);
  assert.match(app, /app\.use\('\/api\/social-publications', socialPublicationRoutes\);/);
  assert.match(routes, /router\.get\('\/', controller\.list\);/);
  assert.match(routes, /router\.put\('\/:publicationId\/schedule', controller\.reschedule\);/);
  assert.match(routes, /router\.delete\('\/:publicationId', controller\.remove\);/);
});

test('universal publishing KPI source defines one Post for Me status policy', () => {
  const source = read('frontend/src/lib/universal-publishing-kpis.ts');
  assert.match(source, /\/api\/social-publications\?limit=500/);
  assert.match(source, /allPosts:\s*jobs\.length \+ localDrafts/);
  assert.match(source, /const drafts = jobs\.filter\(job => job\.status === 'DRAFT'\)\.length \+ localDrafts/);
  assert.match(source, /const scheduled = jobs\.filter\(job => job\.status === 'SCHEDULED'\)\.length/);
  assert.match(source, /const published = jobs\.filter\(job => job\.status === 'PUBLISHED'\)\.length/);
  assert.match(source, /\['FAILED', 'AWAITING_UPLOAD', 'READY'\]\.includes\(job\.status\)/);
  assert.match(source, /connectedAccounts:\s*activeSocialAccountCount\(social\.connections \|\| \[\]\)/);
  assert.doesNotMatch(source, /needsReview[^\n]*CANCELLED/i);
});

test('Dashboard and Posts share universal KPIs while Calendar uses calendar-scoped publication metrics', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const calendar = read('frontend/src/components/calendar/ContentCalendarPage.tsx');
  const calendarApi = read('frontend/src/lib/calendar-api.ts');
  const posts = read('frontend/src/components/posts/PostPrimitives.tsx');

  for (const source of [dashboard, posts]) {
    assert.match(source, /universalPublishingKpiQueryKey/);
    assert.match(source, /fetchUniversalPublishingKpis/);
  }

  assert.doesNotMatch(calendar, /universalPublishingKpiQueryKey|fetchUniversalPublishingKpis/);
  assert.match(calendar, /calendarData\?\.stats/);
  assert.match(calendarApi, /Scheduled This Week/);
  assert.match(calendarApi, /Published This Month/);
  assert.match(calendarApi, /Connected Accounts/);
  assert.match(calendarApi, /\/api\/social-publications\?limit=500/);
  assert.match(dashboard, /Published via INXSocial/);
  assert.match(posts, /All INXSocial publishing records/);
});

test('Media Library review KPI is explicitly asset-scoped', () => {
  const media = read('frontend/src/components/media-library/MediaPrimitives.tsx');
  assert.match(media, /Assets Needing Review/);
  assert.match(media, /Media assets needing attention/);
});

test('Media Library review KPI drills into the affected assets', () => {
  const primitives = read('frontend/src/components/media-library/MediaPrimitives.tsx');
  const tabs = read('frontend/src/components/media-library/MediaTabs.tsx');
  const data = read('frontend/src/data/mediaLibraryData.ts');
  const types = read('frontend/src/types/media-library.ts');
  assert.match(primitives, /inx-media-kpi-filter/);
  assert.match(primitives, /tab: 'needs_review'/);
  assert.match(tabs, /inx-media-kpi-filter/);
  assert.match(data, /id: 'needs_review', label: 'Needs Review'/);
  assert.match(types, /\| 'needs_review'/);
});
