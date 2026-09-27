const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const radar = require('../src/services/growthEditorialRadarService');

test('editorial radar rewards demand, audience fit, freshness and information gain while penalising topical risk', () => {
  const relevant = radar.weightedScore({
    demandEvidence: 85,
    audienceOverlap: 90,
    bridgeStrength: 75,
    freshness: 92,
    rankingFeasibility: 70,
    informationGain: 80,
    geoCitationPotential: 78,
    authorityRisk: 12
  });
  const forced = radar.weightedScore({
    demandEvidence: 95,
    audienceOverlap: 20,
    bridgeStrength: 10,
    freshness: 95,
    rankingFeasibility: 80,
    informationGain: 30,
    geoCitationPotential: 40,
    authorityRisk: 90
  });
  assert.ok(relevant >= 70, relevant);
  assert.ok(relevant > forced, { relevant, forced });
});

test('only strongly evidenced fresh opportunities qualify for the hot-topic fast path', () => {
  const site = { id: 'site-test' };
  const sources = ['https://example.com/story?utm_source=test'];
  const strong = radar.normalizeCandidate(site, {
    topic: 'New AI video model changes creator workflows',
    headlineAngle: 'What creators should know',
    category: 'TREND_BRIDGE',
    intent: 'informational',
    whyNow: 'A new model launched today.',
    audienceConnection: 'Creators and marketers use AI video.',
    businessBridge: 'The site serves AI content workflows.',
    demandEvidence: 90,
    freshness: 95,
    audienceOverlap: 85,
    bridgeStrength: 70,
    rankingFeasibility: 72,
    informationGain: 88,
    geoCitationPotential: 82,
    authorityRisk: 10,
    keywords: ['AI video', 'creator workflow'],
    sourceUrls: ['https://example.com/story']
  }, sources);
  assert.equal(strong.hot, true);
  assert.equal(strong.sourceUrls.length, 1);

  const weak = radar.normalizeCandidate(site, {
    topic: 'Unrelated celebrity gossip',
    headlineAngle: 'Trending celebrity story',
    category: 'TREND_BRIDGE',
    intent: 'informational',
    whyNow: 'It is trending.',
    audienceConnection: 'Weak.',
    businessBridge: 'Forced.',
    demandEvidence: 95,
    freshness: 95,
    audienceOverlap: 20,
    bridgeStrength: 10,
    rankingFeasibility: 75,
    informationGain: 25,
    geoCitationPotential: 35,
    authorityRisk: 95,
    keywords: ['celebrity'],
    sourceUrls: ['https://example.com/story']
  }, sources);
  assert.equal(weak.hot, false);
  assert.ok(weak.score < strong.score);
});

test('SEO skill registry explicitly supports proactive adjacent and trend-bridge editorial discovery', () => {
  const skills = read('src/services/growthSeoSkillRegistry.js');
  assert.match(skills, /Do not wait passively for Search Console/);
  assert.match(skills, /audience-interest and timely trend-bridge content/);
  assert.match(skills, /Do not force a promotional bridge to an unrelated trend/);
  assert.match(skills, /actively maintain enough researched opportunities/);
});

test('editorial radar feeds the shared Growth opportunity map', () => {
  const opportunities = read('src/services/growthOpportunityService.js');
  assert.match(opportunities, /growthEditorialRadarService/);
  assert.match(opportunities, /type: 'editorial_radar'/);
  assert.match(opportunities, /hotEditorial/);
  assert.match(opportunities, /Publish timely authority content/);
});

test('Autopilot scans editorial opportunities every six hours and can fast-track a different hot topic after the morning decision', () => {
  const autopilot = read('src/services/growthAutopilotService.js');
  assert.match(autopilot, /editorialRadarEveryHours: 6/);
  assert.match(autopilot, /nextEditorialRadarAt/);
  assert.match(autopilot, /HOT_TREND_EVALUATION_STARTED/);
  assert.match(autopilot, /morningDecisionMade/);
  assert.match(autopilot, /hotCandidate\.id !== decisionState\.lastHotTrendOpportunityId/);
  assert.match(autopilot, /publishedToday < config\.maxArticlesPerLocalDay/);
  assert.match(autopilot, /decisionMode !== 'hot'/);
});

test('Autopilot no longer invents a generic buyer-question article when evidence-backed opportunities are absent', () => {
  const autopilot = read('src/services/growthAutopilotService.js');
  assert.doesNotMatch(autopilot, /Autopilot fallback buyer-intent topic/);
  assert.doesNotMatch(autopilot, /const fallbackPrompts = await growthIntelligence\.dynamicPrompts/);
  assert.match(autopilot, /return null;/);
});

test('editorial radar controls are available through the protected Autopilot config API', () => {
  const controller = read('src/controllers/growthAutopilotController.js');
  assert.match(controller, /editorialRadarEveryHours/);
  assert.match(controller, /hotTrendAutoEvaluate/);
  assert.match(controller, /maxArticlesPerLocalDay/);
});
