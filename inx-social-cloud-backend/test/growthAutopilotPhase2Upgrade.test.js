const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 2 upgrade adds an AI strategist before content execution', () => {
  const strategist = read('src/services/growthStrategyService.js');
  const skills = read('src/services/growthSeoSkillRegistry.js');
  const autopilot = read('src/services/growthAutopilotService.js');

  assert.match(strategist, /CREATE_ARTICLE/);
  assert.match(strategist, /IMPROVE_EXISTING_PAGE/);
  assert.match(strategist, /CREATE_LANDING_PAGE/);
  assert.match(strategist, /MONITOR/);
  assert.match(strategist, /seoSkills\.strategyInstructions/);
  assert.match(skills, /Avoid keyword cannibalisation/);
  assert.match(autopilot, /AI_STRATEGY_DECIDED/);
  assert.match(autopilot, /STRATEGIC_ACTION_QUEUED/);
});

test('Senior editorial review repairs fixable drafts and only switches fundamentally bad topics', () => {
  const strategist = read('src/services/growthStrategyService.js');
  const skills = read('src/services/growthSeoSkillRegistry.js');
  const autopilot = read('src/services/growthAutopilotService.js');

  assert.match(strategist, /seoSkills\.criticInstructions/);
  assert.match(strategist, /model: env\.contentWriter\.model/);
  assert.match(strategist, /env\.contentWriter\.baseUrl/);
  assert.match(skills, /senior editor after the writer/i);
  assert.match(strategist, /APPROVE/);
  assert.match(strategist, /REVISE/);
  assert.match(strategist, /SWITCH_TOPIC/);
  assert.match(strategist, /requiredFixes/);
  assert.match(autopilot, /EDITORIAL_REVISION_REQUESTED/);
  assert.match(autopilot, /EDITORIAL_TOPIC_UNSUITABLE/);
  assert.match(autopilot, /growthContent\.reviseDraft/);
});

test('Content research retries malformed structured output automatically', () => {
  const service = read('src/services/growthContentService.js');

  assert.match(service, /parseStructuredJson/);
  assert.match(service, /for \(let attempt = 1; attempt <= 2; attempt \+= 1\)/);
  assert.match(service, /structured response parse failed/);
  assert.match(service, /CONTENT_RESEARCH_INVALID/);
  assert.match(service, /CONTENT_DRAFT_INVALID/);
});

test('versioned Growth Autopilot migration preserves the UK morning schedule and reopens the daily editorial lane safely', () => {
  const service = read('src/services/growthAutopilotService.js');

  assert.match(service, /configVersion: 8/);
  assert.match(service, /dailyPublishTimeLocal: '07:30'/);
  assert.match(service, /publishTimeZone: 'Europe\/London'/);
  assert.match(service, /needsV5Migration/);
  assert.match(service, /needsV6Migration/);
  assert.match(service, /needsV7Migration/);
  assert.match(service, /needsV8Migration/);
  assert.match(service, /dailyArticleTarget: 1/);
  assert.match(service, /editorialRetryHours: 2/);
  assert.match(service, /minQualityScore: 90/);
  assert.match(service, /maxDraftAttempts: 3/);
  assert.match(service, /editorialRadarEveryHours: 6/);
  assert.match(service, /state\.running = false/);
  assert.match(service, /state\.nextPublishAt = needsV8Migration \? nowIso\(\) : nextDailyPublishIso\(new Date\(\), config\)/);
});

test('Legacy BabyLoveGrowth articles are copied into INXSocial storage instead of remaining a live dependency', () => {
  const service = read('src/services/growthContentService.js');
  const autopilot = read('src/services/growthAutopilotService.js');

  assert.match(service, /BABYLOVE_API_BASE/);
  assert.match(service, /X-API-Key/);
  assert.match(service, /BABYLOVEGROWTH_IMPORTED/);
  assert.match(service, /selfHosted: true/);
  assert.match(autopilot, /importLegacyBabyLoveArticles/);
});

test('Blog images no longer depend on Next Image local query-string validation', () => {
  const article = read('../landing-next/app/blog/[slug]/page.tsx');
  const card = read('../landing-next/app/blog/components/ArticleCard.tsx');
  const service = read('src/services/growthContentService.js');
  const app = read('src/app.js');

  assert.doesNotMatch(article, /from "next\/image"/);
  assert.doesNotMatch(card, /from "next\/image"/);
  assert.match(article, /<img/);
  assert.match(card, /<img/);
  assert.match(service, /versionedContentImageUrl/);
  assert.match(app, /app\.get\('\/content-media\/:id\/:version'/);
});
