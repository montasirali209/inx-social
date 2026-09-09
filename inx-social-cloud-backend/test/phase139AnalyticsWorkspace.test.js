const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Analytics is a first-class responsive React workspace', () => {
  const router = read('frontend/src/router.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const page = read('frontend/src/components/analytics/AnalyticsPage.tsx');
  const selector = read('frontend/src/components/analytics/AnalyticsAccountSelector.tsx');
  assert.match(router, /path: 'analytics'/);
  assert.match(sidebar, /label: 'Analytics'.*reactPath: '\/analytics'/);
  assert.match(page, /AnalyticsTabs/);
  assert.match(page, /AnalyticsAccountSelector/);
  assert.match(selector, /Choose any connected account/);
  assert.match(page, /sm:grid-cols-2 xl:grid-cols-6/);
  assert.match(page, /ExportReportButton/);
});

test('Analytics uses live platform data and derives transparent metrics without mock values', () => {
  const page = read('frontend/src/components/analytics/AnalyticsPage.tsx');
  const data = read('frontend/src/data/analyticsData.ts');
  const api = read('frontend/src/lib/analytics-api.ts');
  const service = read('src/services/socialAnalyticsService.js');
  assert.match(page, /fetchAnalyticsForSource/);
  assert.match(api, /fetchFacebookDashboardAnalytics/);
  assert.match(api, /\/api\/studio\/analytics\/source/);
  assert.match(service, /getInstagramAnalytics/);
  assert.match(service, /getYouTubeAnalytics/);
  assert.match(data, /Total Interactions/);
  assert.match(data, /analytics\.summary\.totalInteractions/);
  assert.match(data, /Interactions divided by content views/);
  assert.doesNotMatch(data, /128\.4K|2\.45M|89\.3K/);
  assert.match(page, /Analytics are just starting/);
  assert.match(page, /analytics are partially available/);
});

test('Analytics charts, tabs and report actions remain accessible and functional', () => {
  const chart = read('frontend/src/components/analytics/PerformanceOverTimeCard.tsx');
  const tabs = read('frontend/src/components/analytics/AnalyticsTabs.tsx');
  const exportButton = read('frontend/src/components/analytics/ExportReportButton.tsx');
  const motion = read('frontend/src/components/analytics/analytics-motion.css');
  assert.match(chart, /onPointerMove/);
  assert.match(chart, /Performance chart interval/);
  assert.match(tabs, /aria-current/);
  assert.match(exportButton, /Export CSV/);
  assert.match(exportButton, /Export Excel/);
  assert.match(exportButton, /window\.print/);
  assert.match(exportButton, /mailto:/);
  assert.match(motion, /prefers-reduced-motion/);
});
