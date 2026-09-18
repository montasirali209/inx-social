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
  assert.match(selector, /Select one account, multiple accounts, a whole platform, or everything/);
  assert.match(selector, /All accounts/);
  assert.match(page, /sm:grid-cols-2 xl:grid-cols-6/);
  assert.match(page, /ExportReportButton/);
});

test('Analytics uses live Post for Me platform data and derives transparent metrics without mock values', () => {
  const page = read('frontend/src/components/analytics/AnalyticsPage.tsx');
  const data = read('frontend/src/data/analyticsData.ts');
  const api = read('frontend/src/lib/analytics-api.ts');
  const service = read('src/services/postForMeAnalyticsService.js');
  const provider = read('src/services/postForMeService.js');
  const audience = read('frontend/src/components/analytics/AudienceCards.tsx');
  assert.match(page, /fetchAnalyticsForSource/);
  assert.match(api, /\/api\/studio\/analytics\/source/);
  assert.match(service, /getPostForMeAnalytics/);
  assert.match(service, /social-account-feeds/);
  assert.match(service, /providerMetricSummary/);
  assert.match(service, /ANALYTICS_CACHE_TTL_MS/);
  assert.match(service, /limit: '100'/);
  assert.match(service, /page < 3 && rows\.length < 300/);
  assert.match(service, /cacheState/);
  assert.match(provider, /retry-after/);
  assert.match(provider, /status === 429/);
  assert.match(page, /mapWithConcurrency\(selectedAccounts, 3/);
  assert.match(page, /refetchInterval: 5 \* 60_000/);
  assert.match(audience, /post-level analytics/);
  assert.match(service, /platform === 'youtube'/);
  assert.match(service, /platform === 'pinterest'/);
  assert.match(service, /platform === 'x'/);
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
