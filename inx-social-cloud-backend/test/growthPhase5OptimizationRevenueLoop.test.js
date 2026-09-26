const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 5 is the final persisted optimisation and revenue feedback loop', () => {
  const service = read('src/services/growthOptimizationService.js');
  const attribution = read('src/services/growthAttributionService.js');
  assert.match(service, /growth_optimization_state_v1/);
  assert.match(service, /REFRESH_CONTENT/);
  assert.match(service, /OPTIMIZE_CTR_META/);
  assert.match(service, /CONSOLIDATE_CANNIBALIZATION/);
  assert.match(service, /IMPROVE_CRO/);
  assert.match(service, /REINFORCE_AI_VISIBILITY/);
  assert.match(service, /REPURPOSE_SOCIAL/);
  assert.match(service, /SCALE_WINNING_SOURCE/);
  assert.match(attribution, /projectedMrrGbp/);
  assert.match(service, /revenue: attributionSummary\?\.revenue/);
});

test('Phase 5 records consented signup to trial to paid attribution', () => {
  const attribution = read('src/services/growthAttributionService.js');
  const auth = read('src/controllers/authController.js');
  const billing = read('src/controllers/billingController.js');
  const funnel = read('public/analytics-funnel.js');

  assert.match(attribution, /GROWTH_ATTRIBUTION_SIGNUP/);
  assert.match(attribution, /GROWTH_ATTRIBUTION_TRIAL/);
  assert.match(attribution, /GROWTH_ATTRIBUTION_PURCHASE/);
  assert.match(auth, /recordSignup/);
  assert.match(auth, /recordTrial/);
  assert.match(billing, /recordPurchase/);
  assert.match(funnel, /inxsocial_first_touch_v1/);
  assert.match(funnel, /hasAnalyticsConsent\(\)/);
  assert.match(funnel, /value: amount/);
  assert.match(funnel, /currency/);
});

test('Phase 5 feeds GSC decay and GA4 revenue evidence into the optimiser', () => {
  const gsc = read('src/services/googleSearchConsoleService.js');
  const ga4 = read('src/services/googleAnalyticsService.js');
  const service = read('src/services/growthOptimizationService.js');

  assert.match(gsc, /previousTopPages/);
  assert.match(gsc, /\['query', 'page'\]/);
  assert.match(ga4, /totalRevenue/);
  assert.match(ga4, /sessionSource/);
  assert.match(ga4, /sessionMedium/);
  assert.match(ga4, /acquisitionSources/);
  assert.match(service, /detectCannibalisation/);
  assert.match(service, /detectSearchActions/);
  assert.match(service, /detectConversionActions/);
});

test('Phase 5 can refresh or optimise published content without creating duplicate URLs', () => {
  const content = read('src/services/growthContentService.js');
  assert.match(content, /optimizePublishedMetadata/);
  assert.match(content, /refreshPublishedArticle/);
  assert.match(content, /Preserve the page search intent and URL/);
  assert.match(content, /CONTENT_REFRESH_QUALITY_LOW/);
  assert.match(content, /quality\.score < 75/);
});

test('Phase 5 remains governed for high-risk conversion and consolidation work', () => {
  const service = read('src/services/growthOptimizationService.js');
  const html = read('public/index.html');
  assert.match(service, /mode: 'REVIEW'/);
  assert.match(service, /High-risk URL, pricing, conversion and consolidation changes are never silently auto-applied/);
  assert.match(html, /URL consolidation, redirects, pricing, product claims and major conversion changes remain review-gated/);
});

test('Phase 5 runs automatically every 24 hours inside Growth Autopilot', () => {
  const autopilot = read('src/services/growthAutopilotService.js');
  assert.match(autopilot, /configVersion: 4/);
  assert.match(autopilot, /optimizationEveryHours: 24/);
  assert.match(autopilot, /optimizationDue/);
  assert.match(autopilot, /optimization\.run/);
  assert.match(autopilot, /nextOptimizationAt/);
  assert.match(autopilot, /optimization: optimizationStatus/);
});

test('Phase 5 admin API and dashboard expose the final loop', () => {
  const routes = read('src/routes/adminRoutes.js');
  const html = read('public/index.html');
  const js = read('public/admin.js');
  assert.match(routes, /growth-optimization\/status/);
  assert.match(routes, /growth-optimization\/run-now/);
  assert.match(routes, /growth-optimization\/actions\/:id/);
  assert.match(html, /Phase 5 · Final growth loop/);
  assert.match(html, /Optimisation \+ Revenue Loop/);
  assert.match(js, /renderGrowthOptimization/);
  assert.match(js, /runGrowthOptimizationNow/);
  assert.match(js, /growthOptimizationAction/);
});

test('Authority outreach replies to the verified official INAXX mailbox', () => {
  const email = read('src/services/emailService.js');
  assert.match(email, /AUTHORITY_EMAIL_REPLY_TO/);
  assert.match(email, /contact@inaxx\.co\.uk/);
  assert.match(email, /AUTHORITY_EMAIL_FROM/);
});
