const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 13.3 matches the all-account operational dashboard information architecture', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const topbar = read('frontend/src/components/layout/Topbar.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');

  for (const component of ['PublishingActivityCard', 'PlatformDonutChart', 'RecentPostsCard', 'TopPerformingContentCard', 'UpcomingScheduleCard', 'QuickActionsCard', 'AIStudioPromoCard']) {
    assert.match(dashboard, new RegExp(component));
  }
  assert.doesNotMatch(dashboard, /EngagementOverviewCard|DashboardAccountSelector/);
  assert.match(topbar, /workspaceRoutes/);
  assert.match(topbar, /title: 'Dashboard'/);
  assert.match(topbar, /Here’s what’s happening across all your social media accounts/);
  assert.match(topbar, /Europe\/London/);
  for (const label of ['Dashboard', 'Bulk Scheduler', 'Content Calendar', 'Posts', 'Media Library', 'AI Content Studio', 'Analytics', 'Settings', 'Connected Accounts', 'Billing & Plans']) {
    assert.match(sidebar, new RegExp(label));
  }
  assert.doesNotMatch(sidebar, /Inbox|Team Members|Publishing Queue/);
});

test('Phase 13.3 is live-data driven across connected accounts and does not present fictional analytics', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const data = read('frontend/src/lib/dashboard-api.ts');
  const recent = read('frontend/src/components/dashboard/RecentPostsCard.tsx');
  const topContent = read('frontend/src/components/dashboard/TopPerformingContentCard.tsx');

  assert.match(data, /\/api\/studio\/overview/);
  assert.match(data, /\/api\/studio\/jobs\?limit=250/);
  assert.match(data, /buildActivitySeries/);
  assert.match(dashboard, /fetchAnalyticsSources/);
  assert.match(dashboard, /fetchAnalyticsForSource/);
  assert.match(dashboard, /Promise\.all\(accounts\.map/);
  assert.match(recent, /likes \/ reactions/);
  assert.match(recent, /comments/);
  assert.match(recent, /shares/);
  assert.doesNotMatch(recent, /Eye|View All/);
  assert.match(topContent, /Total interactions/);
  assert.match(topContent, /Performance ranking is waiting/);
  assert.doesNotMatch(`${data}${dashboard}${recent}${topContent}`, /24\.8K|8\.2K|32\.4%/);
});

test('Phase 13.3 uses real responsive charts and accessible controls', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const activity = read('frontend/src/components/dashboard/PublishingActivityChart.tsx');
  const donut = read('frontend/src/components/dashboard/PlatformDonutChart.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');

  assert.match(dashboard, /md:grid-cols-3/);
  assert.match(dashboard, /xl:grid-cols-6/);
  assert.match(dashboard, /xl:grid-cols-3/);
  assert.match(dashboard, /overflow-x-auto/);
  assert.match(activity, /role="img"/);
  assert.match(activity, /<svg/);
  assert.match(activity, /Engagement/);
  assert.match(donut, /conic-gradient/);
  assert.match(sidebar, /focus-visible:outline/);
  assert.match(sidebar, /Create New Post/);
});

test('Dashboard analytics loads progressively and the activity card handles honest all-account data states', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const activityCard = read('frontend/src/components/dashboard/PublishingActivityCard.tsx');
  const activityChart = read('frontend/src/components/dashboard/PublishingActivityChart.tsx');

  assert.match(dashboard, /fetchDashboardJobs/);
  assert.match(dashboard, /fetchAnalyticsSources/);
  assert.match(dashboard, /fetchAnalyticsForSource/);
  assert.match(dashboard, /Live insights unavailable/);
  assert.match(activityCard, /No publishing activity yet/);
  assert.match(activityCard, /All accounts/);
  assert.match(activityCard, /Combined publishing and engagement across all connected platforms/);
  assert.doesNotMatch(activityCard, /Most active date|Publishing activity is just starting/);
  assert.match(activityChart, /ActivityTooltip/);
  assert.match(activityChart, /onPointerMove/);
});
