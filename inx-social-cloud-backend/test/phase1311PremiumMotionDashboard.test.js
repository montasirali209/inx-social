const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Publishing analytics dashboard renders live data without fake metrics', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const styles = read('frontend/src/index.css');
  const activity = read('frontend/src/components/dashboard/PublishingActivityCard.tsx');
  const chart = read('frontend/src/components/dashboard/PublishingActivityChart.tsx');
  const data = read('frontend/src/lib/dashboard-api.ts');

  assert.match(dashboard, /data\.stats/);
  assert.match(dashboard, /data\.platformMetrics/);
  assert.match(dashboard, /data\.recentPosts/);
  assert.match(styles, /\.interactive-surface/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(chart, /<svg/);
  assert.match(activity, /No publishing activity yet/);
  assert.match(activity, /PublishingActivityChart/);
  assert.match(data, /engagement: null/);
  assert.doesNotMatch(`${dashboard}${data}`, /24\.8K|32\.4%|128 posts/);
});

test('Publishing analytics dashboard has the six premium responsive surfaces', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const activity = read('frontend/src/components/dashboard/PublishingActivityCard.tsx');
  const donut = read('frontend/src/components/dashboard/PlatformDonutChart.tsx');
  const engagement = read('frontend/src/components/dashboard/EngagementOverviewCard.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');

  assert.match(dashboard, /TopPerformingContentCard/);
  assert.match(dashboard, /UpcomingScheduleCard/);
  assert.match(activity, /Publishing Activity/);
  assert.match(donut, /Posts by Platform/);
  assert.match(engagement, /permitted live analytics/);
  assert.match(sidebar, /interactive-nav/);
});
