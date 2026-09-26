const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Growth Autopilot is enabled by default with daily intelligence and 24-hour publishing', () => {
  const service = read('src/services/growthAutopilotService.js');

  assert.match(service, /enabled: true/);
  assert.match(service, /intelligenceEveryHours: 24/);
  assert.match(service, /publishEveryHours: 24/);
  assert.match(service, /minQualityScore: 75/);
  assert.match(service, /autoGenerateImage: true/);
  assert.match(service, /autoPublish: true/);
});

test('Growth Autopilot automatically chains intelligence, opportunity selection, research, quality gate and publishing', () => {
  const service = read('src/services/growthAutopilotService.js');

  assert.match(service, /runSiteAudit/);
  assert.match(service, /runOpenAIVisibilityScan/);
  assert.match(service, /discoverRedditOpportunities/);
  assert.match(service, /growthOpportunities\.build/);
  assert.match(service, /growthContent\.createDraft/);
  assert.match(service, /config\.minQualityScore/);
  assert.match(service, /growthContent\.generateFeaturedImage/);
  assert.match(service, /growthContent\.approveArticle/);
  assert.match(service, /growthContent\.publishArticle/);
  assert.match(service, /growthStrategy\.plan/);
  assert.match(service, /growthStrategy\.reviewDraft/);
  assert.match(service, /nextPublishAt = addHours\(publishedAt, config\.publishEveryHours\)/);
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

test('Autopilot rejects low-quality drafts instead of publishing them', () => {
  const service = read('src/services/growthAutopilotService.js');

  assert.match(service, /if \(score < config\.minQualityScore\)/);
  assert.match(service, /archiveLowQuality/);
  assert.match(service, /DRAFT_REJECTED/);
  assert.match(service, /maxDraftAttempts/);
});

test('Growth admin defaults to an autopilot dashboard and hides manual tools under advanced details', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');

  assert.match(html, /data-page="growthIntelligence"><span>◈<\/span>Growth Autopilot/);
  assert.match(html, /Everything is running automatically|Autopilot status/);
  assert.match(html, /Advanced diagnostics &amp; manual controls/);
  assert.match(html, /Normally you do not need to use anything below/);
  assert.match(html, /Autopilot is the default/);
  assert.match(js, /loadGrowthAutopilotStatus/);
  assert.match(js, /toggleGrowthAutopilot/);
  assert.match(js, /runGrowthAutopilotNow/);
});

test('Autopilot admin mutations stay Super Admin protected', () => {
  const routes = read('src/routes/adminRoutes.js');

  assert.match(routes, /growth-autopilot\/status/);
  assert.match(routes, /growth-autopilot\/config', requireSuperAdmin/);
  assert.match(routes, /growth-autopilot\/run-now', requireSuperAdmin/);
});

test('Reddit remains discovery-only while the rest of the growth cycle is automatic', () => {
  const intelligence = read('src/services/growthIntelligenceService.js');
  const autopilot = read('src/services/growthAutopilotService.js');

  assert.match(autopilot, /discoverRedditOpportunities/);
  assert.match(intelligence, /Do not draft or post replies/);
  assert.doesNotMatch(autopilot, /reddit\.com\/api\/submit|oauth\.reddit|api\/v1\/me/);
});
