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
  assert.match(router, /path: 'analytics'/);
  assert.match(sidebar, /label: 'Analytics'.*reactPath: '\/analytics'/);
  assert.match(page, /AnalyticsTabs/);
  assert.match(page, /DashboardAccountSelector contextLabel="Analytics"/);
  assert.match(page, /sm:grid-cols-2 xl:grid-cols-6/);
  assert.match(page, /ExportReportButton/);
});

test('Analytics uses live Meta data and labels unavailable metrics without mock values', () => {
  const page = read('frontend/src/components/analytics/AnalyticsPage.tsx');
  const data = read('frontend/src/data/analyticsData.ts');
  const api = read('frontend/src/lib/dashboard-api.ts');
  assert.match(page, /fetchFacebookDashboardAnalytics/);
  assert.match(api, /force \? '&force=true'/);
  assert.match(data, /Profile Visits/);
  assert.match(data, /value: null/);
  assert.doesNotMatch(data, /128\.4K|2\.45M|89\.3K/);
  assert.match(page, /No analytics data yet/);
  assert.match(page, /Analytics are just starting/);
});

test('Analytics charts, tabs and report actions remain accessible and functional', () => {
  const chart = read('frontend/src/components/analytics/PerformanceOverTimeCard.tsx');
  const tabs = read('frontend/src/components/analytics/AnalyticsTabs.tsx');
  const exportButton = read('frontend/src/components/analytics/ExportReportButton.tsx');
  assert.match(chart, /onPointerMove/);
  assert.match(chart, /Performance chart interval/);
  assert.match(tabs, /aria-current/);
  assert.match(exportButton, /Export CSV/);
  assert.match(exportButton, /Export Excel/);
  assert.match(exportButton, /window\.print/);
  assert.match(exportButton, /mailto:/);
});
