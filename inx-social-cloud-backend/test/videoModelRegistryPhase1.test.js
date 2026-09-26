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

test('phase one wires catalogue warmup and actual-cost settlement without modifying UGC services', () => {
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
  assert.doesNotMatch(video, /ugcStudio|ugcModelRouter|ugcProviderAdapters/);
});
