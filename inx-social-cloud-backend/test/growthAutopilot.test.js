const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Growth Autopilot is enabled by default with daily intelligence and a fixed UK morning article window', () => {
  const service = read('src/services/growthAutopilotService.js');

  assert.match(service, /enabled: true/);
  assert.match(service, /intelligenceEveryHours: 24/);
  assert.match(service, /editorialRadarEveryHours: 6/);
  assert.match(service, /hotTrendAutoEvaluate: true/);
  assert.match(service, /maxArticlesPerLocalDay: 2/);
  assert.match(service, /dailyPublishTimeLocal: '07:30'/);
  assert.match(service, /publishTimeZone: 'Europe\/London'/);
  assert.match(service, /dailyPublishDue/);
  assert.match(service, /minQualityScore: 90/);
  assert.match(service, /autoGenerateImage: true/);
  assert.match(service, /autoPublish: true/);
});

test('Growth Autopilot automatically chains intelligence, opportunity selection, research, quality gate and publishing', () => {
  const service = read('src/services/growthAutopilotService.js');

  assert.match(service, /runSiteAudit/);
  assert.match(service, /runOpenAIVisibilityScan/);
  assert.doesNotMatch(service, /discoverRedditOpportunities/);
  assert.match(service, /growthOpportunities\.build/);
  assert.match(service, /growthContent\.createDraft/);
  assert.match(service, /config\.minQualityScore/);
  assert.match(service, /growthContent\.generateFeaturedImage/);
  assert.match(service, /growthContent\.approveArticle/);
  assert.match(service, /growthContent\.publishArticle/);
  assert.match(service, /growthStrategy\.plan/);
  assert.match(service, /growthStrategy\.reviewDraft/);
  assert.match(service, /markDailyPublishDecision\(state, config, new Date\(publishedAt\)\)/);
  assert.match(service, /const publishDue = options\.force \|\| dailyPublishDue\(state, config\)/);
  assert.match(service, /editorialRadar\.refresh/);
  assert.match(service, /HOT_TREND_EVALUATION_STARTED/);
  assert.match(service, /publishedCountToday/);
});

test('Autopilot runtime starts with the production backend and uses a persisted lease', () => {
  const server = read('src/server.js');
  const service = read('src/services/growthAutopilotService.js');

  assert.match(server, /startGrowthAutopilot/);
  assert.match(server, /stopGrowthAutopilot/);
  assert.match(service, /STATE_KEY = 'growth_autopilot_state_v1'/);
  assert.match(service, /isolationLevel: 'Serializable'/);
  assert.match(service, /leaseUntil/);
});

test('Autopilot repairs weak drafts before changing topic and requires 90+ publication quality', () => {
  const service = read('src/services/growthAutopilotService.js');
  const content = read('src/services/growthContentService.js');

  assert.match(service, /minQualityScore: 90/);
  assert.match(service, /maxDraftAttempts: 3/);
  assert.match(service, /growthContent\.reviseDraft/);
  assert.match(service, /EDITORIAL_REVISION_REQUESTED/);
  assert.match(service, /ARTICLE_REVISED/);
  assert.match(service, /EDITORIAL_NEXT_TOPIC_SELECTED/);
  assert.match(service, /editorialCandidateQueue/);
  assert.match(service, /backendScore >= config\.minQualityScore/);
  assert.match(service, /critic\.score \|\| 0\) >= config\.minQualityScore/);
  assert.match(content, /Target a final backend quality score of at least 90\/100/);
});

test('Growth admin defaults to an autopilot dashboard and hides manual tools under advanced details', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');

  assert.match(html, /data-page="growthIntelligence"><span>◈<\/span>Growth Autopilot/);
  assert.match(html, /Everything is running automatically|Autopilot status/);
  assert.match(html, /Advanced diagnostics &amp; manual controls/);
  assert.match(html, /Normally you do not need to use anything below/);
  assert.match(html, /Autopilot is the default/);
  assert.match(html, /Editorial radar/);
  assert.match(html, /Every 6h/);
  assert.match(js, /loadGrowthAutopilotStatus/);
  assert.match(js, /toggleGrowthAutopilot/);
  assert.match(js, /runGrowthAutopilotNow/);
});

test('Growth Autopilot UI shows the live editorial pipeline and removes separate phase run buttons', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');
  const css = read('public/admin.css');

  assert.match(html, /Sol editorial pipeline/);
  assert.match(html, /id="growthEditorialPipeline"/);
  assert.match(html, /id="growthEditorialCurrent"/);
  assert.match(html, /id="growthEditorialFeedback"/);
  assert.match(html, /id="growthEditorialQueue"/);
  assert.match(html, /90\+ required/);
  assert.doesNotMatch(html, /id="growthSeoRunBtn"/);
  assert.doesNotMatch(html, /id="growthAuthorityRunBtn"/);
  assert.doesNotMatch(html, /id="growthOptimizationRunBtn"/);
  assert.doesNotMatch(js, /growthSeoRunBtn'\)\.addEventListener/);
  assert.doesNotMatch(js, /growthAuthorityRunBtn'\)\.addEventListener/);
  assert.doesNotMatch(js, /growthOptimizationRunBtn'\)\.addEventListener/);
  assert.match(js, /function renderGrowthEditorialBoard/);
  assert.match(js, /EDITORIAL_REVISION_REQUESTED/);
  assert.match(js, /ARTICLE_REVISED/);
  assert.match(js, /EDITORIAL_REVIEW_PASSED/);
  assert.match(css, /\.growth-editorial-board/);
  assert.match(css, /\.growth-editorial-stage\.active/);
});

test('Growth admin actions are CSP-safe and the admin UI uses the readable light theme', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');
  const app = read('src/app.js');
  const light = read('public/admin-light.css');

  assert.match(html, /admin-light\.css\?v=1/);
  assert.match(js, /data-growth-authority-action="approve"/);
  assert.match(js, /data-growth-optimization-action="approve"/);
  assert.match(js, /growthAuthorityQueue'\)\.addEventListener\('click'/);
  assert.match(js, /growthOptimizationQueue'\)\.addEventListener\('click'/);
  assert.doesNotMatch(js, /onclick="growthAuthorityProspectAction/);
  assert.doesNotMatch(js, /onclick="growthOptimizationAction/);
  assert.match(app, /app\.get\('\/admin-light\.css'/);
  assert.match(app, /Cache-Control', 'no-store'/);
  assert.match(light, /color-scheme:light/);
  assert.match(light, /background:#fff!important/);
  assert.match(light, /font-size:14px!important/);
});

test('Autopilot admin mutations stay Super Admin protected', () => {
  const routes = read('src/routes/adminRoutes.js');

  assert.match(routes, /growth-autopilot\/status/);
  assert.match(routes, /growth-autopilot\/config', requireSuperAdmin/);
  assert.match(routes, /growth-autopilot\/run-now', requireSuperAdmin/);
});

test('Reddit is excluded from the automatic growth cycle', () => {
  const intelligence = read('src/services/growthIntelligenceService.js');
  const autopilot = read('src/services/growthAutopilotService.js');

  assert.doesNotMatch(autopilot, /discoverRedditOpportunities/);
  assert.match(intelligence, /Do not draft or post replies/);
  assert.doesNotMatch(autopilot, /reddit\.com\/api\/submit|oauth\.reddit|api\/v1\/me/);
});
