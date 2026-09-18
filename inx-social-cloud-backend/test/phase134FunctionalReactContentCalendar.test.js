const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 13.4 makes Content Calendar a first-class responsive React route', () => {
  const router = read('frontend/src/router.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const page = read('frontend/src/components/calendar/ContentCalendarPage.tsx');
  const toolbar = read('frontend/src/components/calendar/CalendarToolbar.tsx');

  assert.match(router, /content-calendar.*ContentCalendarPage/);
  assert.match(sidebar, /label: 'Content Calendar'.*reactPath: '\/content-calendar'/);
  assert.match(page, /CalendarGrid/);
  assert.match(page, /CalendarAgenda/);
  assert.match(page, /SelectedDatePanel/);
  assert.match(toolbar, /CalendarFilterMenu/);
  assert.match(toolbar, /Every platform/);
  assert.match(toolbar, /All connected accounts/);
  assert.match(toolbar, /Upcoming only/);
  assert.doesNotMatch(toolbar, /label: 'Published'/);
  assert.doesNotMatch(toolbar, /<select/);
  assert.match(toolbar, /Schedule Content/);
  assert.match(toolbar, /Import Batch/);
  assert.match(toolbar, /md:hidden/);
});

test('Phase 13.4 uses universal Post for Me publishing state without sample calendar posts', () => {
  const api = read('frontend/src/lib/calendar-api.ts');
  const page = read('frontend/src/components/calendar/ContentCalendarPage.tsx');
  const bestTime = read('frontend/src/components/calendar/BestTimeCard.tsx');
  const toolbar = read('frontend/src/components/calendar/CalendarToolbar.tsx');
  const selectedDate = read('frontend/src/components/calendar/SelectedDatePanel.tsx');

  assert.match(api, /fetchConnectionsWorkspace/);
  assert.match(api, /\/api\/social-publications\?limit=500/);
  assert.match(api, /source: 'post_for_me'/);
  assert.match(api, /post\.status === 'scheduled' \|\| post\.status === 'needs_review'/);
  assert.match(page, /queryKey: \['content-calendar', 'post-for-me', timezone\]/);
  assert.match(page, /refetchInterval: 30_000/);
  assert.match(page, /refetchIntervalInBackground: false/);
  assert.match(page, /fetchAnalyticsSources/);
  assert.match(page, /fetchAnalyticsForSource/);
  assert.match(page, /calculateBestPostTime/);
  assert.match(page, /calendar\.data\?\.stats/);
  assert.doesNotMatch(page, /fetchUniversalPublishingKpis|universalPublishingKpiQueryKey/);
  assert.doesNotMatch(selectedDate, /CalendarQuickActionsCard/);
  assert.match(page, /readSessionCache/);
  assert.match(page, /writeSessionCache/);
  assert.match(bestTime, /Use \{insight\.time\}/);
  assert.doesNotMatch(bestTime, /Analytics required/);
  assert.match(toolbar, /relative z-30/);
  assert.doesNotMatch(`${api}${page}`, /\/api\/studio\/facebook\/scheduled-posts|Product Update|Customer Story|Industry Insight|May 12, 2025/);
});

test('Content Calendar opens platform posts and manages universal provider schedules', () => {
  const api = read('frontend/src/lib/calendar-api.ts');
  const page = read('frontend/src/components/calendar/ContentCalendarPage.tsx');
  const selected = read('frontend/src/components/calendar/ScheduledVideoCard.tsx');
  const dialog = read('frontend/src/components/calendar/CalendarPostActionDialog.tsx');

  assert.match(page, /window\.open\(post\.platformUrl/);
  assert.match(selected, /Open on \{platformLabel\}/);
  assert.match(selected, /Delete from \{platformLabel\} & INXSocial/);
  assert.match(dialog, /scheduled post from \{platformLabel\}/);
  assert.match(api, /rescheduleCalendarPost/);
  assert.match(api, /deleteCalendarPost/);
  assert.match(api, /\/api\/social-publications\/\$\{encodeURIComponent\(post\.jobId\)\}\/schedule/);
  assert.match(api, /\/api\/social-publications\/\$\{encodeURIComponent\(post\.jobId\)\}/);
  assert.doesNotMatch(`${api}${selected}${dialog}`, /facebook\/posts|Open on Facebook|Delete from Facebook|Facebook requires/);
});

test('Calendar keeps scheduling focused without a redundant quick-actions panel', () => {
  const selectedDate = read('frontend/src/components/calendar/SelectedDatePanel.tsx');
  const toolbar = read('frontend/src/components/calendar/CalendarToolbar.tsx');
  const slots = read('frontend/src/components/calendar/AvailableSlotsCard.tsx');

  assert.doesNotMatch(selectedDate, /CalendarQuickActionsCard|Quick Actions/);
  assert.match(toolbar, /Schedule Content/);
  assert.match(slots, /disabled={!slot\.available}/);
});
