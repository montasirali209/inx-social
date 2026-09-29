const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const registry = require('../src/services/videoModelRegistryService');
const adapters = require('../src/services/videoProviderAdapters');

test('video registry preserves compatibility routes and representative tiers', () => {
  const models = registry.legacyProfiles();
  assert.equal(models.length, 7);
  assert.deepEqual(models.map(model => model.id), ['pvideo', 'h3fast', 'kling30', 'wan30', 'ltx25pro', 'runway45', 'seedance25']);
  const validation = registry.validateRepresentativeModels({
    models,
    source: 'test',
    syncedAt: new Date().toISOString()
  });
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.checks.map(check => check.tier), ['economy', 'standard', 'premium']);
});

test('video registry parses synchronized per-second pricing and converts it to guarded credits', () => {
  const pricing = registry.parsePricing({
    pricingOverview: 'Rates per second',
    pricingExamples: [
      { configuration: '720p · Standard', price: '$0.025/s' },
      { configuration: '720p · Draft', price: '$0.015/s' }
    ]
  });
  const profile = {
    durations: [5, 10],
    resolutions: ['720p'],
    draftSupported: true,
    audioSupported: true,
    pricing
  };
  assert.equal(registry.costFromPricing(profile, { duration: 10, resolution: '720p', draft: false, audio: true }), 0.25);
  assert.equal(registry.costFromPricing(profile, { duration: 10, resolution: '720p', draft: true, audio: true }), 0.15);
  assert.equal(registry.estimateCredits(profile, { duration: 10, resolution: '720p', draft: false, audio: true }), 29);
  assert.equal(registry.creditsFromUsd(0.25), 29);
});

test('video registry derives credits when provider examples do not include the exact selected configuration', () => {
  const pricing = registry.parsePricing({
    pricingOverview: '$0.025 from, per second',
    pricingExamples: [
      { configuration: 'first-frame 768p · 5s', price: '$0.40' },
      { configuration: 'first-last-frame 480p · 15s', price: '$0.75' },
      { configuration: 'text-to-video 1344×768 · 10s', price: '$0.80' }
    ]
  });

  assert.equal(pricing.rules[0].unit, 'per_request');
  assert.equal(registry.parseResolution('text-to-video 1344×768 · 10s'), '768p');

  const profile = {
    durations: [5, 10, 15],
    resolutions: ['480p', '768p'],
    draftSupported: false,
    audioSupported: true,
    pricing
  };

  // No 480p/5s example exists. Use the 480p/15s provider example as an
  // effective $0.05/s conservative reservation, then settle actual cost later.
  assert.equal(registry.costFromPricing(profile, { duration: 5, resolution: '480p', draft: false, audio: true }), 0.25);
  assert.equal(registry.estimateCredits(profile, { duration: 5, resolution: '480p', draft: false, audio: true }), 29);

  // Exact provider example prices remain complete request totals.
  assert.equal(registry.costFromPricing(profile, { duration: 5, resolution: '768p', draft: false, audio: true }), 0.40);
  assert.equal(registry.estimateCredits(profile, { duration: 5, resolution: '768p', draft: false, audio: true }), 46);
});

test('video registry exposes provider promotions and automatically switches to regular pricing after expiry', () => {
  const pricing = registry.parsePricing({
    pricingOverview: '50% OFF until September 30, 2026 · promotional provider pricing',
    pricingExamples: [
      { configuration: '768p · Standard · 5s', price: '$0.20' }
    ]
  });
  assert.equal(pricing.promotion.active, true);
  assert.equal(pricing.promotion.discountPercent, 50);
  assert.match(pricing.promotion.endsAt, /^2026-09-30T23:59:59/);
  assert.equal(pricing.rules[0].currentPrice, 0.20);
  assert.equal(pricing.rules[0].regularPrice, 0.40);

  const profile = {
    durations: [5],
    resolutions: ['768p'],
    draftSupported: false,
    audioSupported: false,
    pricing
  };
  assert.equal(registry.costFromPricing(profile, { duration: 5, resolution: '768p', audio: false }, { at: new Date('2026-09-29T12:00:00Z') }), 0.20);
  assert.equal(registry.costFromPricing(profile, { duration: 5, resolution: '768p', audio: false }, { at: new Date('2026-10-01T00:00:00Z') }), 0.40);
});

test('video registry prices extra reference-image surcharges when the provider exposes them', () => {
  const pricing = registry.parsePricing({
    pricingOverview: 'Reference pricing',
    pricingExamples: [
      { configuration: '768p · Standard · 5s', price: '$0.20' },
      { configuration: 'each input image beyond 5', price: '$0.04 per input image' }
    ]
  });
  const profile = {
    durations: [5],
    resolutions: ['768p'],
    draftSupported: false,
    audioSupported: false,
    pricing
  };
  assert.equal(registry.costFromPricing(profile, { duration: 5, resolution: '768p', audio: false, referenceCount: 5 }), 0.20);
  assert.equal(registry.costFromPricing(profile, { duration: 5, resolution: '768p', audio: false, referenceCount: 8 }), 0.32);
});

test('video registry falls back conservatively across provider examples instead of returning unavailable pricing', () => {
  const pricing = registry.parsePricing({
    pricingOverview: '$0.02 from, per second',
    pricingExamples: [
      { configuration: '480p · 10s', price: '$0.20' },
      { configuration: '768p · 10s', price: '$0.75' }
    ]
  });
  const profile = {
    durations: [5, 10],
    resolutions: ['720p'],
    draftSupported: false,
    audioSupported: false,
    pricing
  };

  // 720p has no exact provider example. Reserve against the highest known
  // normalized rate for this model rather than exposing a broken model.
  assert.equal(registry.costFromPricing(profile, { duration: 5, resolution: '720p', draft: false, audio: false }), 0.375);
  assert.equal(registry.estimateCredits(profile, { duration: 5, resolution: '720p', draft: false, audio: false }), 44);
});

test('video studio never displays stale credits while a new model price is unresolved', () => {
  const root = path.resolve(__dirname, '..');
  const modal = fs.readFileSync(path.join(root, 'frontend/src/components/ai-content-studio/VideoStudioModalV3.tsx'), 'utf8');

  assert.match(modal, /estimatedCredits/);
  assert.match(modal, /estimatedCreditsKey/);
  assert.match(modal, /pricingSelectionKey/);
  assert.match(modal, /setEstimatedCredits\(null\)/);
  assert.match(modal, /setPricingError/);
  assert.match(modal, /Calculating credits…/);
  assert.match(modal, /credits === null/);
  assert.match(modal, /Calculating video cost…/);
});

test('generic video adapter validates model capabilities before sending provider work', () => {
  const profile = {
    id: 'dynamic-model',
    air: 'provider:model@1',
    generationReady: true,
    durations: [5, 10],
    resolutions: ['720p'],
    aspects: ['9:16', '16:9'],
    fps: [24],
    supportsDimensions: true,
    supportsResolution: false,
    supportsAudioSetting: true,
    draftSupported: false,
    audioSupported: true,
    imageReferenceSupported: false
  };
  const built = adapters.buildTask(profile, {
    prompt: 'A cinematic product reveal',
    duration: 5,
    resolution: '720p',
    aspectRatio: '9:16',
    fps: 24,
    audio: true
  }, [], '00000000-0000-4000-8000-000000000001');
  assert.equal(built.task.taskType, 'videoInference');
  assert.equal(built.task.model, profile.air);
  assert.equal(built.task.duration, 5);
  assert.equal(built.task.width, 720);
  assert.equal(built.task.height, 1280);
  assert.deepEqual(built.task.settings, { audio: true });
  assert.throws(
    () => adapters.validateSelection(profile, { duration: 30, resolution: '720p', aspectRatio: '9:16' }, []),
    error => error.code === 'AI_VIDEO_DURATION_UNSUPPORTED'
  );
});

test('video pricing hardening wires catalogue warmup and actual-cost settlement', () => {
  const root = path.resolve(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(root, 'src/routes/aiContentStudioRoutes.js'), 'utf8');
  const video = fs.readFileSync(path.join(root, 'src/services/videoStudioService.js'), 'utf8');
  const credits = fs.readFileSync(path.join(root, 'src/services/aiCreditService.js'), 'utf8');
  assert.match(server, /videoModelRegistry\.startRuntime/);
  assert.match(routes, /\/video\/catalog/);
  assert.match(video, /videoModels\.creditsFromUsd\(providerCostUsd\)/);
  assert.match(video, /credits\.settle/);
  assert.match(credits, /GENERATION_SETTLEMENT_REFUND/);
  assert.match(credits, /GENERATION_SETTLEMENT_DEBIT/);
  assert.doesNotMatch(video, /Math\.min\(amount, providerRequiredCredits\)/);
  assert.doesNotMatch(video, /ugcStudio|ugcModelRouter|ugcProviderAdapters/);
});
