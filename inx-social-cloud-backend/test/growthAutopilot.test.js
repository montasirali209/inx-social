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
  assert.match(service, /dailyArticleTarget: 1/);
  assert.match(service, /maxArticlesPerLocalDay: 2/);
  assert.match(service, /editorialRetryMinutes: 10/);
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

test('Daily editorial lane cannot be consumed by a non-article strategy decision', () => {
  const service = read('src/services/growthAutopilotService.js');
  const strategy = read('src/services/growthStrategyService.js');

  assert.match(service, /growthStrategy\.planDailyArticle/);
  assert.match(service, /minOpportunityScore: 70/);
  assert.match(service, /DAILY_ARTICLE_SELECTION_RETRY/);
  assert.match(service, /config\.editorialRetryMinutes/);
  assert.match(service, /DAILY_ARTICLE_TARGET_ALREADY_MET/);
  assert.match(strategy, /DAILY ARTICLE LANE/);
  assert.match(strategy, /action=CREATE_ARTICLE and publishRecommended=true/);
  assert.match(strategy, /LIVE_TREND_DISCOVERY/);
  assert.match(strategy, /type: 'web_search'/);
  assert.match(strategy, /Do not copy, closely paraphrase, or spin another publisher article/);
});

test('Growth Autopilot defaults to Terra and supports timed cost-control pauses', () => {
  const service = read('src/services/growthAutopilotService.js');
  const controller = read('src/controllers/growthAutopilotController.js');
  const html = read('public/index.html');
  const js = read('public/admin.js');

  assert.match(service, /TERRA: 'gpt-5\.6-terra'/);
  assert.match(service, /SOL: 'gpt-5\.6-sol'/);
  assert.match(service, /aiModel: AUTOPILOT_MODELS\.TERRA/);
  assert.match(service, /pauseUntil: null/);
  assert.match(service, /isTemporarilyPaused/);
  assert.match(service, /isAutopilotActive/);
  assert.match(service, /reason: config\.enabled === false \? 'disabled' : 'temporarily_paused'/);
  assert.match(service, /AUTOPILOT_PAUSED_UNTIL/);
  assert.match(service, /AUTOPILOT_MODEL_CHANGED/);
  assert.match(controller, /gpt-5\.6-terra/);
  assert.match(controller, /gpt-5\.6-sol/);
  assert.match(controller, /pauseUntil/);
  assert.match(html, /id="growthAutopilotModel"/);
  assert.match(html, /id="growthAutopilotPauseDuration"/);
  assert.match(js, /updateGrowthAutopilotModel/);
  assert.match(js, /const pauseUntil=new Date/);
});

test('Selected Autopilot model is routed through editorial, authority and optimisation AI work', () => {
  const autopilot = read('src/services/growthAutopilotService.js');
  const strategy = read('src/services/growthStrategyService.js');
  const content = read('src/services/growthContentService.js');
  const authority = read('src/services/growthAuthorityService.js');
  const optimization = read('src/services/growthOptimizationService.js');

  assert.match(autopilot, /model: config\.aiModel/);
  assert.match(autopilot, /writerModel: ai\.model/);
  assert.match(autopilot, /aiModel: config\.aiModel/);
  assert.match(strategy, /model = env\.contentWriter\.model/);
  assert.match(strategy, /reasoningEffort = env\.contentWriter\.reasoningEffort/);
  assert.match(content, /writerModel = String\(options\.writerModel/);
  assert.match(authority, /options\.model\|\|env\.contentWriter\.model/);
  assert.match(optimization, /options\.aiModel \|\| env\.contentWriter\.model/);
});

test('Autopilot runtime starts with the production backend and uses a persisted lease', () => {
  const server = read('src/server.js');
  const service = read('src/services/growthAutopilotService.js');

  assert.match(server, /startGrowthAutopilot/);
  assert.match(server, /stopGrowthAutopilot/);
  assert.match(service, /STATE_KEY = 'growth_autopilot_state_v1'/);
  assert.match(service, /isolationLevel: 'Serializable'/);
  assert.match(service, /leaseUntil/);
  assert.match(service, /PROCESS_LEASE_OWNER = randomUUID\(\)/);
  assert.match(service, /state\.leaseOwner = PROCESS_LEASE_OWNER/);
  assert.match(service, /state\.leaseOwner !== PROCESS_LEASE_OWNER/);
  assert.match(server, /await stopGrowthAutopilot\(\)/);
  assert.match(service, /released owned lease during shutdown/);
});

test('Due daily publishing is prioritized ahead of authority and optimisation work and emits auditable events', () => {
  const service = read('src/services/growthAutopilotService.js');

  assert.match(service, /if \(authorityDue && !publishDue\)/);
  assert.match(service, /if \(optimizationDue && !publishDue\)/);
  assert.match(service, /\[growth-autopilot:event\]/);
  assert.match(service, /type: event\.type/);
  assert.match(service, /metadata: event\.metadata/);
});


test('Daily publishing stays on the critical path and quality repairs retry immediately', () => {
  const service = read('src/services/growthAutopilotService.js');
  const content = read('src/services/growthContentService.js');

  assert.match(service, /if \(!opportunityMap \|\| \(intelligenceDue && !publishDue\)\)/);
  assert.match(service, /if \(radarDue && !publishDue\)/);
  assert.match(service, /reviewDraftWithImmediateRetry/);
  assert.match(service, /EDITORIAL_REPAIR_STARTED/);
  assert.match(service, /EDITORIAL_REPAIR_RETRY/);
  assert.match(service, /suppressFreshResearch: true/);
  assert.match(service, /editorialCandidateQueue\([\s\S]*?5\s*\)/);
  assert.match(service, /addMinutes\(nowIso\(\), config\.editorialRetryMinutes\)/);
  assert.match(content, /maxEvidenceAttempts/);
  assert.match(content, /existing verified source pack/);
  assert.match(content, /researchFallbackUsed/);
  assert.match(content, /options\.suppressFreshResearch === true/);
});

test('Interrupted Autopilot drafts resume before a new daily topic is created', () => {
  const service = read('src/services/growthAutopilotService.js');

  assert.match(service, /EDITORIAL_DRAFT_RECOVERY_SELECTED/);
  assert.match(service, /EDITORIAL_DRAFT_RESUMED/);
  assert.match(service, /RESUMING_DRAFT/);
  assert.match(service, /produceAndPublish\(opportunity, config, strategy, decisionMode, recoverableDraft\)/);
  assert.match(service, /configVersion: 11/);
  assert.match(service, /needsV10Migration/);
  assert.match(service, /editorialRetryMinutes: 10/);
});

test('Growth Dashboard exposes published SEO content and live article previews', () => {
  const service = read('src/services/growthDashboardService.js');
  const html = read('public/index.html');
  const js = read('public/admin.js');
  const css = read('public/admin.css');

  assert.match(service, /averageQuality/);
  assert.match(service, /featuredImageUrl/);
  assert.match(service, /url: '\/blog\/' \+ article\.slug/);
  assert.match(html, /id="growthDashboardContentLatest"/);
  assert.match(html, /id="growthDashboardContent"/);
  assert.match(html, /id="growthArticlePreviewDialog"/);
  assert.match(js, /openGrowthArticlePreview/);
  assert.match(js, /data-growth-preview/);
  assert.match(js, /editorialRuntime/);
  assert.match(css, /\.growth-command-content-panel/);
  assert.match(css, /\.growth-article-preview-dialog/);
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

  assert.match(html, /AI editorial pipeline/);
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

  assert.match(html, /admin-light\.css\?v=4/);
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

test('Growth Dashboard normalizes GA4 referrers into branded acquisition channels', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');
  const light = read('public/admin-light.css');

  assert.match(html, /growthDashboardReferrerNote/);
  assert.match(html, /GA4 session source \/ medium/);
  assert.match(js, /GROWTH_REFERRER_BRAND_ICONS/);
  assert.match(js, /assets\/referrers\/x\.svg/);
  assert.match(js, /checkout\.stripe\.com/);
  assert.match(js, /\.up\.railway\.app/);
  assert.match(js, /AI Referral/);
  assert.match(js, /Organic Search/);
  assert.match(js, /growthDashboardAggregateReferrers/);
  assert.match(light, /growth-analytics-referrer-icon img/);
});

test('Growth diagnostics explain recommendations and Phase 5 execution semantics', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');
  const light = read('public/admin-light.css');

  assert.match(html, /admin-light\.css\?v=4/);
  assert.match(html, /admin\.js\?v=31/);
  assert.match(js, /Suggested action ·/);
  assert.match(js, /Approve plan/);
  assert.match(js, /Approve change/);
  assert.match(js, /Run safe fix/);
  assert.match(js, /Approval records your decision only; it does not change the live site/);
  assert.match(js, /nothing changes live until Apply change is pressed/);
  assert.match(light, /growth-optimization-action-hint/);
  assert.match(light, /\.brand img,\.login-brand img\{filter:none!important/);
  assert.doesNotMatch(light, /\.brand img,\.login-brand img\{filter:brightness\(0\)/);
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
