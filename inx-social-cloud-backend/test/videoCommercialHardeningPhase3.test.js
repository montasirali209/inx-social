const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const env = require('../src/config/env');
const guard = require('../src/services/videoCommercialGuardService');
const videoRegistry = require('../src/services/videoModelRegistryService');
const stripe = require('../src/services/stripeService');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 3 publishes the 300 / 900 / 2000 / 4000 paid-plan credit floor', () => {
  assert.equal(env.aiCredits.monthlyByPlan.CREATOR, 300);
  assert.equal(env.aiCredits.monthlyByPlan.PRO, 900);
  assert.equal(env.aiCredits.monthlyByPlan.BUSINESS, 2000);
  assert.equal(env.aiCredits.monthlyByPlan.AGENCY, 4000);
  assert.equal(stripe.planDefinition('CREATOR').aiCredits, 300);
  assert.equal(stripe.planDefinition('PRO').aiCredits, 900);
  assert.equal(stripe.planDefinition('BUSINESS').aiCredits, 2000);
  assert.equal(stripe.planDefinition('AGENCY').aiCredits, 4000);
});

test('paid-plan environment overrides cannot silently reduce published allowances', () => {
  const source = read('src/config/env.js');
  assert.match(source, /CREATOR: Math\.max\(300,/);
  assert.match(source, /PRO: Math\.max\(900,/);
  assert.match(source, /BUSINESS: Math\.max\(2000,/);
  assert.match(source, /AGENCY: Math\.max\(4000,/);
});

test('video commercial policy enforces minimum margin buffer and maximum render exposure', () => {
  const policy = guard.policy();
  assert.ok(policy.creditCostBuffer >= 1.15);
  assert.equal(policy.maxGenerationCredits, 4000);
  assert.equal(guard.assertEstimate(4000), 4000);
  assert.throws(
    () => guard.assertEstimate(4001),
    error => error.code === 'AI_VIDEO_COMMERCIAL_LIMIT' && error.status === 422
  );
});

test('video pricing freshness blocks stale paid-generation estimates', () => {
  const fresh = { source: 'runware-live', syncedAt: new Date().toISOString() };
  const stale = { source: 'runware-live', syncedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() };
  const fallback = { source: 'compatibility-fallback', syncedAt: new Date().toISOString() };
  assert.equal(guard.isFresh(fresh), true);
  assert.equal(guard.isFresh(stale), false);
  assert.equal(guard.isFresh(fallback), false);
  assert.throws(() => guard.assertFreshSnapshot(stale), error => error.code === 'AI_VIDEO_PRICING_STALE');
});


test('provider promotions expose discounted and regular credit pricing with automatic expiry metadata', () => {
  const parsed = videoRegistry.parsePricing({
    pricingOverview: '50% off until September 30, 2026',
    pricingExamples: [{ configuration: '768p 10s', price: '$0.40 per run' }]
  });
  assert.equal(parsed.promotion.active, true);
  assert.equal(parsed.promotion.discountPercent, 50);
  assert.match(parsed.promotion.endsAt, /^2026-09-30T23:59:59/);
  assert.equal(parsed.rules[0].price, 0.4);
  assert.equal(parsed.rules[0].regularPrice, 0.8);

  const profile = {
    durations: [10],
    resolutions: ['768p'],
    audioSupported: true,
    draftSupported: false,
    pricing: parsed
  };
  const quote = videoRegistry.pricingQuote(profile, { duration: 10, resolution: '768p', audio: true }, Date.parse('2026-09-29T12:00:00Z'));
  assert.ok(quote.regularCredits > quote.credits);
  assert.equal(quote.promotion.discountPercent, 50);

  const expired = videoRegistry.pricingQuote(profile, { duration: 10, resolution: '768p', audio: true }, Date.parse('2026-10-01T00:00:00Z'));
  assert.equal(expired.promotion, null);
  assert.equal(expired.credits, expired.regularCredits);
});

test('Phase 3 wires persistent provider-cost drift protection and commercial health monitoring', () => {
  const registry = read('src/services/videoModelRegistryService.js');
  const commercial = read('src/services/videoCommercialGuardService.js');
  const video = read('src/services/videoStudioService.js');
  const controller = read('src/controllers/aiStudioNextController.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');

  assert.match(registry, /resolveModelForGeneration/);
  assert.match(registry, /reconcileAfterRefresh/);
  assert.match(registry, /commercialHealth/);
  assert.match(commercial, /ai_video_commercial_guard_v1/);
  assert.match(commercial, /PROVIDER_COST_DRIFT/);
  assert.match(video, /recordActualCost/);
  assert.match(video, /providerRequiredCredits/);
  assert.match(controller, /async function videoHealth/);
  assert.match(routes, /\/video\/health/);
});

test('provider reconciliation can debit beyond the reservation instead of silently capping actual cost', () => {
  const credits = read('src/services/aiCreditService.js');
  const video = read('src/services/videoStudioService.js');

  assert.match(credits, /GENERATION_SETTLEMENT_DEBIT/);
  assert.match(credits, /const extraRequested = Math\.max\(0, requested - reserved\)/);
  assert.match(credits, /const charged = fromReservation \+ extraCharged/);
  assert.match(credits, /GENERATION_SETTLEMENT_SHORTFALL/);
  assert.match(video, /credits\.settle\(userId, generationId, providerRequiredCredits/);
  assert.doesNotMatch(video, /Math\.min\(reservationCredits, providerRequiredCredits\)/);
});

test('current-period allowance changes preserve already-consumed credits instead of regranting a full wallet', () => {
  const credits = read('src/services/aiCreditService.js');
  assert.match(credits, /const consumed = Math\.max\(0, previousLimit - previousBalance\)/);
  assert.match(credits, /const nextBalance = Math\.max\(0, limit - consumed\)/);
  assert.match(credits, /PLAN_CREDIT_ADJUSTMENT/);
});

test('Phase 3 commercial hardening does not route through or alter the UGC engine', () => {
  const registry = read('src/services/videoModelRegistryService.js');
  const commercial = read('src/services/videoCommercialGuardService.js');
  const video = read('src/services/videoStudioService.js');
  assert.doesNotMatch(registry, /ugcStudio|ugcModelRouter|ugcProviderAdapters|ugcEngine/i);
  assert.doesNotMatch(commercial, /ugcStudio|ugcModelRouter|ugcProviderAdapters|ugcEngine/i);
  assert.doesNotMatch(video, /ugcStudio|ugcModelRouter|ugcProviderAdapters|ugcEngine/i);
});
