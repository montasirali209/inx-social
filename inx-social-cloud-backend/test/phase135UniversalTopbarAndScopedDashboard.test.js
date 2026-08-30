const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Every React workspace route uses the locked universal topbar contract', () => {
  const shell = read('frontend/src/components/layout/AppShell.tsx');
  const topbar = read('frontend/src/components/layout/Topbar.tsx');
  const bulk = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const hero = read('frontend/src/components/bulk-scheduler/BulkSchedulerHero.tsx');

  assert.match(shell, /<Topbar overview=/);
  assert.match(topbar, /data-design-standard="universal-workspace-topbar"/);
  for (const label of ['Dashboard', 'Bulk Scheduler', 'Content Calendar']) {
    assert.match(topbar, new RegExp(`title: '${label}'`));
  }
  assert.match(topbar, /Timezone · Europe\/London/);
  assert.match(topbar, /Theme · Midnight/);
  assert.match(topbar, /queryClient\.invalidateQueries\(\{ refetchType: 'active' \}\)/);
  assert.doesNotMatch(bulk, /<h1[^>]*>Bulk Scheduler/);
  assert.match(hero, /Open Bulk Scheduler/);
  assert.match(hero, /Stop Scheduler/);
});

test('Universal notifications are live, responsive, animated and accessible', () => {
  const topbar = read('frontend/src/components/layout/Topbar.tsx');
  const notifications = read('frontend/src/components/layout/NotificationCenter.tsx');
  const styles = read('frontend/src/index.css');

  assert.match(topbar, /<NotificationCenter overview=\{overview\}/);
  assert.match(notifications, /overview\.summary\.failed/);
  assert.match(notifications, /overview\.summary\.scheduled/);
  assert.match(notifications, /overview\.pages\.filter/);
  assert.match(notifications, /aria-expanded=\{open\}/);
  assert.match(notifications, /role="dialog"/);
  assert.match(notifications, /Mark all read/);
  assert.match(notifications, /inx-social-notification-fingerprint/);
  assert.match(notifications, /fixed inset-x-3/);
  assert.match(styles, /@keyframes notification-pop-in/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});

test('Selected analytics Page scopes every dashboard surface and active-date insight', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const data = read('frontend/src/lib/dashboard-api.ts');
  const activity = read('frontend/src/components/dashboard/PublishingActivityCard.tsx');
  const insight = read('frontend/src/components/dashboard/ActivityInsightRow.tsx');

  assert.match(dashboard, /const scopedJobs/);
  assert.match(dashboard, /job\.page\?\.id === resolvedAnalyticsAccountId/);
  assert.match(dashboard, /buildActivitySeries\(scopedJobs/);
  assert.match(dashboard, /buildDashboardView\(overview\.data, scopedJobs/);
  assert.match(dashboard, /engagementByDate=\{engagementByDate\}/);
  assert.match(data, /value: jobs\.length/);
  assert.match(data, /const scopedJobs = page \? jobs\.filter/);
  assert.doesNotMatch(data, /value: overview\.summary\.total/);
  assert.match(activity, /Math\.log10\(currentEngagement \+ 1\)/);
  assert.match(insight, /Most active date/);
  assert.match(insight, /selected Page activity and live engagement/);
});
