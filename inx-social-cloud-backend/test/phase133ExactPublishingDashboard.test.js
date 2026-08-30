const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 13.3 matches the publishing analytics dashboard information architecture', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const topbar = read('frontend/src/components/layout/Topbar.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');

  for (const component of ['PublishingActivityCard', 'PlatformDonutChart', 'RecentPostsCard', 'EngagementOverviewCard', 'TopPerformingContentCard', 'UpcomingScheduleCard']) {
    assert.match(dashboard, new RegExp(component));
  }
  assert.match(topbar, /workspaceRoutes/);
  assert.match(topbar, /title: 'Dashboard'/);
  assert.match(topbar, /Overview of your social media publishing performance/);
  assert.match(topbar, /Europe\/London/);
  for (const label of ['Dashboard', 'Bulk Scheduler', 'Content Calendar', 'Posts', 'Media Library', 'AI Content Studio', 'Analytics', 'Settings', 'Connected Accounts', 'Billing & Plans']) {
    assert.match(sidebar, new RegExp(label));
  }
  assert.doesNotMatch(sidebar, /Inbox|Team Members|Publishing Queue/);
});

test('Phase 13.3 is live-data driven and does not present fictional analytics', () => {
  const data = read('frontend/src/lib/dashboard-api.ts');
  const engagement = read('frontend/src/components/dashboard/EngagementOverviewCard.tsx');
  const topContent = read('frontend/src/components/dashboard/TopPerformingContentCard.tsx');

  assert.match(data, /\/api\/studio\/overview/);
  assert.match(data, /\/api\/studio\/jobs\?limit=250/);
  assert.match(data, /buildActivitySeries/);
  assert.match(data, /engagement: null/);
  assert.match(engagement, /permitted live analytics/);
  assert.match(topContent, /Performance ranking is waiting/);
  assert.doesNotMatch(`${data}${engagement}${topContent}`, /24\.8K|8\.2K|32\.4%/);
});

test('Phase 13.3 uses real responsive charts and accessible controls', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const activity = read('frontend/src/components/dashboard/PublishingActivityChart.tsx');
  const donut = read('frontend/src/components/dashboard/PlatformDonutChart.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');

  assert.match(dashboard, /md:grid-cols-2/);
  assert.match(dashboard, /xl:grid-cols-6/);
  assert.match(dashboard, /overflow-x-auto/);
  assert.match(activity, /role="img"/);
  assert.match(activity, /<svg/);
  assert.match(donut, /conic-gradient/);
  assert.match(sidebar, /focus-visible:outline/);
  assert.match(sidebar, /Create New Post/);
});


test('Dashboard analytics loads progressively and the activity card handles honest data states', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const activityCard = read('frontend/src/components/dashboard/PublishingActivityCard.tsx');
  const activityChart = read('frontend/src/components/dashboard/PublishingActivityChart.tsx');

  assert.match(dashboard, /fetchDashboardJobs/);
  assert.match(dashboard, /fetchFacebookDashboardAnalytics/);
  assert.match(dashboard, /enabled: Boolean\(resolvedAnalyticsAccountId\)/);
  assert.match(activityCard, /No publishing activity yet/);
  assert.match(activityCard, /Publishing activity is just starting/);
  assert.match(activityCard, /Open Calendar/);
  assert.doesNotMatch(activityCard, /Schedule Post/);
  assert.match(activityChart, /ActivityTooltip/);
  assert.match(activityChart, /onPointerMove/);
});
