const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 2 upgrade adds an AI strategist before content execution', () => {
  const strategist = read('src/services/growthStrategyService.js');
  const autopilot = read('src/services/growthAutopilotService.js');

  assert.match(strategist, /CREATE_ARTICLE/);
  assert.match(strategist, /IMPROVE_EXISTING_PAGE/);
  assert.match(strategist, /CREATE_LANDING_PAGE/);
  assert.match(strategist, /MONITOR/);
  assert.match(strategist, /Avoid keyword cannibalisation/);
  assert.match(autopilot, /AI_STRATEGY_DECIDED/);
  assert.match(autopilot, /STRATEGIC_ACTION_QUEUED/);
});

test('Independent AI critic must approve the draft before publishing', () => {
  const strategist = read('src/services/growthStrategyService.js');
  const autopilot = read('src/services/growthAutopilotService.js');

  assert.match(strategist, /independent editorial critic/i);
  assert.match(strategist, /factualRisk/);
  assert.match(strategist, /duplicationRisk/);
  assert.match(autopilot, /AI_CRITIC_REVIEWED/);
  assert.match(autopilot, /critic\.factualRisk === 'high'/);
  assert.match(autopilot, /critic\.duplicationRisk === 'high'/);
});

test('Content research retries malformed structured output automatically', () => {
  const service = read('src/services/growthContentService.js');

  assert.match(service, /parseStructuredJson/);
  assert.match(service, /for \(let attempt = 1; attempt <= 2; attempt \+= 1\)/);
  assert.match(service, /structured response parse failed/);
  assert.match(service, /CONTENT_RESEARCH_INVALID/);
  assert.match(service, /CONTENT_DRAFT_INVALID/);
});

test('versioned Growth Autopilot migration preserves the 24-hour publishing schedule and clears the old lease', () => {
  const service = read('src/services/growthAutopilotService.js');

  assert.match(service, /configVersion: 4/);
  assert.match(service, /publishEveryHours: 24/);
  assert.match(service, /needsV4Migration/);
  assert.match(service, /state\.running = false/);
  assert.match(service, /state\.nextPublishAt = nowIso\(\)/);
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
