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
  const scopeNotice = read('frontend/src/components/analytics/AnalyticsScopeNotice.tsx');
  assert.match(router, /path: 'analytics'/);
  assert.match(sidebar, /label: 'Analytics'.*reactPath: '\/analytics'/);
  assert.match(page, /AnalyticsTabs/);
  assert.match(page, /AnalyticsAccountSelector/);
  assert.match(selector, /Select 1–3 accounts for a clearer comparison/);
  assert.match(selector, /MAX_ANALYTICS_SOURCES = 3/);
  assert.match(selector, /platformFilter/);
  assert.match(selector, /All accounts/);
  assert.doesNotMatch(selector, /overflow-x-auto/);
  assert.match(selector, /document\.addEventListener\('pointerdown', closeOnOutside\)/);
  assert.match(selector, /setOpen\(false\)/);
  assert.match(selector, /analytics-source-picker-menu/);
  assert.match(selector, /transition-\[opacity,transform\]/);
  assert.match(page, /sm:grid-cols-2 xl:grid-cols-6/);
  assert.match(page, /ExportReportButton/);
  assert.match(page, /AnalyticsScopeNotice/);
  assert.match(scopeNotice, /Current post performance/);
  assert.match(scopeNotice, />Live</);
  assert.match(scopeNotice, /Post metrics/);
  assert.match(scopeNotice, /Selected accounts/);
  assert.match(scopeNotice, /Last synced/);
  assert.match(scopeNotice, /Latest verified performance for published posts/);
});

test('Analytics uses live Post for Me platform data and derives transparent metrics without mock values', () => {
  const page = read('frontend/src/components/analytics/AnalyticsPage.tsx');
  const data = read('frontend/src/data/analyticsData.ts');
  const api = read('frontend/src/lib/analytics-api.ts');
  const service = read('src/services/postForMeAnalyticsService.js');
  const provider = read('src/services/postForMeService.js');
  const insights = read('frontend/src/components/analytics/ContentInsightsCards.tsx');
  const providerMetrics = read('frontend/src/components/analytics/ProviderMetricsCard.tsx');
  assert.match(page, /fetchAnalyticsForSource/);
  assert.match(api, /\/api\/studio\/analytics\/source/);
  assert.match(service, /getPostForMeAnalytics/);
  assert.match(service, /social-account-feeds/);
  assert.match(service, /providerMetricSummary/);
  assert.match(service, /ANALYTICS_CACHE_TTL_MS/);
  assert.match(service, /limit: '100'/);
  assert.match(service, /FEED_HISTORY_MAX_PAGES = 30/);
  assert.match(service, /FEED_HISTORY_MAX_POSTS = 3000/);
  assert.match(service, /seenCursors/);
  assert.match(service, /newest && newest < since\.getTime\(\)/);
  assert.match(service, /cacheState/);
  assert.match(service, /persistMetricSnapshots/);
  assert.match(service, /buildMeasuredSeries/);
  assert.match(service, /measured_snapshot_delta/);
  assert.match(service, /startAnalyticsSnapshotRuntime/);
  assert.match(service, /ANALYTICS_BACKGROUND_SNAPSHOT_ENABLED/);
  assert.match(service, /forceRefresh/);
  assert.doesNotMatch(service, /incrementSeries\(viewsSeries, date, metrics\.views\)/);
  assert.match(provider, /retry-after/);
  assert.match(provider, /status === 429/);
  assert.match(provider, /PROVIDER_GET_MAX_PER_SECOND/);
  assert.match(provider, /PROVIDER_GET_MAX_PER_MINUTE/);
  assert.match(provider, /reserveProviderReadSlot/);
  assert.match(provider, /CONNECTION_SYNC_TTL_MS/);
  assert.match(page, /mapWithConcurrency\(selectedAccounts, 2/);
  assert.match(page, /fetchAnalyticsForSource\(account, days, 'full', true\)/);
  assert.match(page, /Last sync ·/);
  assert.match(page, /analytics\.isFetching[\s\S]*AnalyticsKpiSkeleton/);
  assert.match(page, /refetchInterval: 5 \* 60_000/);
  assert.match(page, /readSessionCache/);
  assert.match(page, /writeSessionCache/);
  assert.match(insights, /Content Efficiency/);
  assert.match(insights, /Publishing Rhythm/);
  assert.match(insights, /Avg interactions \/ post/);
  assert.match(page, /ContentEfficiencyCard/);
  assert.match(page, /PublishingRhythmCard/);
  assert.match(service, /platform === 'youtube'/);
  assert.match(service, /platform === 'pinterest'/);
  assert.match(service, /platform === 'x'/);
  assert.match(data, /Total Interactions/);
  assert.match(data, /analytics\.summary\.totalInteractions/);
  assert.match(data, /Interactions divided by content views/);
  assert.doesNotMatch(data, /128\.4K|2\.45M|89\.3K/);
  assert.match(page, /Analytics are just starting/);
  assert.match(page, /analytics are partially available/);
  assert.doesNotMatch(page, /Post for Me/i);
  assert.doesNotMatch(data, /Post for Me/i);
  assert.doesNotMatch(api, /Post for Me/i);
  assert.doesNotMatch(service, /Post for Me/i);
  assert.doesNotMatch(providerMetrics, /Post for Me/i);
});

test('Analytics charts, tabs and report actions remain accessible and functional', () => {
  const page = read('frontend/src/components/analytics/AnalyticsPage.tsx');
  const chart = read('frontend/src/components/analytics/PerformanceOverTimeCard.tsx');
  const tabs = read('frontend/src/components/analytics/AnalyticsTabs.tsx');
  const exportButton = read('frontend/src/components/analytics/ExportReportButton.tsx');
  const motion = read('frontend/src/components/analytics/analytics-motion.css');
  assert.match(chart, /onPointerMove/);
  assert.match(chart, /Performance metric/);
  assert.match(chart, /exactDate/);
  assert.match(chart, /areaPath/);
  assert.match(chart, /Hover for exact post-date performance/);
  assert.match(chart, /hoverValue/);
  assert.match(chart, /position: Math\.round|position,/);
  assert.match(chart, /Daily publish-date points/);
  assert.match(chart, /Content Performance by Publish Date/);
  assert.doesNotMatch(chart, /Live Performance Trend/);
  assert.doesNotMatch(chart, /Content history/);
  assert.doesNotMatch(chart, /Live trend/);
  assert.match(chart, /current performance of posts published on that date/i);
  assert.match(chart, /const tension = 0\.82/);
  assert.match(chart, /Views/);
  assert.match(chart, /Interactions/);
  assert.match(chart, /Clicks/);
  assert.match(chart, /own scale/);
  assert.match(page, /view\?\.publishedPerformance \|\| \[\]/);
  assert.doesNotMatch(page, /aggregatePerformance|chartInterval|setInterval/);
  assert.match(tabs, /aria-current/);
  assert.doesNotMatch(page, /activeTab === 'stories'|activeTab === 'competitors'/);
  assert.doesNotMatch(read('frontend/src/data/analyticsData.ts'), /\['stories', 'Stories'\]|\['competitors', 'Competitors'\]/);
  assert.match(exportButton, /Export CSV/);
  assert.match(exportButton, /Export Excel/);
  assert.match(exportButton, /window\.print/);
  assert.match(exportButton, /mailto:/);
  assert.match(motion, /prefers-reduced-motion/);
  assert.match(motion, /analytics-chart-tooltip/);
  assert.match(motion, /cubic-bezier\(\.16,1,\.3,1\)/);
});


test('only live-data workspaces use page-level loading states', () => {
  const main = read('frontend/src/main.tsx');
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const calendar = read('frontend/src/components/calendar/ContentCalendarPage.tsx');
  const analytics = read('frontend/src/components/analytics/AnalyticsPrimitives.tsx');
  const posts = read('frontend/src/components/posts/PostsPage.tsx');
  const media = read('frontend/src/components/media-library/MediaLibraryPage.tsx');
  const bulk = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const studio = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const settings = read('frontend/src/components/settings/SettingsPage.tsx');
  const connections = read('frontend/src/components/connections/ConnectedAccountsPageV4.tsx');
  const billing = read('frontend/src/components/billing/BillingPlansPage.tsx');

  assert.doesNotMatch(main, /WorkspaceLoadingState|Suspense fallback/);
  assert.match(dashboard, /DashboardSkeleton/);
  assert.match(calendar, /CalendarSkeleton/);
  assert.match(analytics, /AnalyticsKpiSkeleton/);
  assert.doesNotMatch(analytics, /Preparing your latest trend data|Bringing your analytics together|Engagement by Platform/);

  for (const page of [posts, media, bulk, studio, settings, connections, billing]) {
    assert.doesNotMatch(page, /WorkspaceLoadingState/);
    assert.doesNotMatch(page, /if \([^\n]*(?:isLoading|isPending)[^\n]*\) return/);
  }

  assert.match(posts, /post composer remains available/i);
  assert.match(media, /Media Library interface remains available/);
  assert.match(bulk, /Bulk Scheduler interface remains available/);
  assert.match(studio, /creation workspace is ready immediately/i);
  assert.match(settings, /Settings remain available/);
  assert.match(connections, /connection workspace remains available/);
  assert.match(billing, /BillingImmediateState/);
});

test('Dashboard uses lightweight paced analytics instead of deep feed history for every connected account', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const api = read('frontend/src/lib/analytics-api.ts');
  const controller = read('src/controllers/analyticsController.js');
  const service = read('src/services/postForMeAnalyticsService.js');

  assert.match(dashboard, /mapWithConcurrency\(accounts, 2/);
  assert.match(dashboard, /fetchAnalyticsForSource\(account, dashboardAnalyticsDays, 'summary'\)/);
  assert.match(api, /mode === 'summary'/);
  assert.match(controller, /feedMaxPages: 1/);
  assert.match(controller, /feedMaxPosts: 100/);
  assert.match(service, /cacheVariant/);
  assert.match(service, /feedMaxPages: 1, feedMaxPosts: 100/);
});
