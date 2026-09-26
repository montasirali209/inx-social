const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('Growth Command Centre aggregates realtime, daily, revenue, SEO and autopilot data',()=>{
  const service=read('src/services/growthDashboardService.js');
  assert.match(service,/googleAnalytics\.realtime\(\)/);
  assert.match(service,/googleAnalytics\.performance\(1\)/);
  assert.match(service,/googleAnalytics\.performance\(7\)/);
  assert.match(service,/attribution\.summary\(1\)/);
  assert.match(service,/attribution\.summary\(30\)/);
  assert.match(service,/googleSearchConsole\.performance\(28\)/);
  assert.match(service,/autopilot\.status\(\)/);
  assert.match(service,/seo\.status\(\)/);
  assert.match(service,/authority\.status\(\)/);
  assert.match(service,/optimization\.status\(\)/);
  assert.match(service,/FAST_TTL_MS = 25 \* 1000/);
  assert.match(service,/SLOW_TTL_MS = 5 \* 60 \* 1000/);
});

test('Daily dashboard summaries are supported by GA4 and first-party attribution',()=>{
  const ga=read('src/services/googleAnalyticsService.js');
  const attribution=read('src/services/growthAttributionService.js');
  assert.match(ga,/\[1, 7, 28, 90\]/);
  assert.match(attribution,/Math\.max\(1, Math\.min\(365/);
});

test('Growth Command Centre API is admin protected through admin routes',()=>{
  const routes=read('src/routes/adminRoutes.js');
  assert.match(routes,/router\.use\(requireAuth, requireAdmin\)/);
  assert.match(routes,/router\.get\('\/growth-dashboard', growthDashboard\.snapshot\)/);
});

test('Growth Command Centre is a dedicated mobile navigation surface',()=>{
  const html=read('public/index.html');
  const css=read('public/admin.css');
  const js=read('public/admin.js');
  assert.match(html,/data-page="growthDashboard"/);
  assert.match(html,/id="growthDashboardPage"/);
  assert.match(html,/Growth Command Centre/);
  assert.match(html,/Visitor → customer funnel/);
  assert.match(js,/loadGrowthDashboard/);
  assert.match(js,/\/api\/admin\/growth-dashboard/);
  assert.match(js,/30000/);
  assert.match(js,/window\.location\.hash==='#growthDashboard'/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/\.growth-command-primary/);
  assert.match(css,/\.growth-command-funnel/);
});

test('Dashboard exposes conversion, outreach and automation activity without recipient addresses',()=>{
  const service=read('src/services/growthDashboardService.js');
  assert.match(service,/visitorToSignupPercent/);
  assert.match(service,/signupToTrialPercent/);
  assert.match(service,/trialToPaidPercent/);
  assert.match(service,/visitorToPaidPercent/);
  assert.match(service,/Authority outreach sent:/);
  assert.doesNotMatch(service,/email\.recipient/);
  assert.match(service,/state\?\.recentEvents/);
});

test('Dashboard can be bookmarked directly on mobile',()=>{
  const js=read('public/admin.js');
  assert.match(js,/location\.pathname\+location\.search\+'#growthDashboard'/);
  assert.match(js,/history\.replaceState/);
});
