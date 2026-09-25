const test = require('node:test');
const assert = require('node:assert/strict');

const registry = require('../src/services/ugcEngineRegistry');
const {
  QC_CHECKS,
  buildEngineProject,
  validateEngineProject,
  playbackDurations
} = require('../src/services/ugcEngineContract');

function sampleAvatar(overrides = {}) {
  return {
    id: 'avatar-1',
    scope: 'SYSTEM',
    name: 'Maya',
    category: 'Lifestyle',
    presentation: 'Woman',
    ageBand: '25–34',
    locale: 'en-GB',
    voice: 'Pippa',
    referenceVersion: 3,
    environment: 'real apartment',
    ...overrides
  };
}

function standardInput(overrides = {}) {
  return {
    sourceType: 'WEBSITE',
    campaignType: 'AUTO',
    brandProfileId: 'brand-1',
    productUrl: 'https://example.com/',
    productDescription: 'A productivity platform.',
    creatorMode: 'AUTO',
    avatarId: null,
    duration: 20,
    adCount: 1,
    quality: 'STANDARD',
    notes: '',
    ...overrides
  };
}

function standardPlan() {
  return {
    title: 'Example Campaign',
    campaignType: 'AVATAR_EXPLAINER',
    ads: [{
      title: 'Variation 1',
      angle: 'Problem to solution',
      hook: 'Still juggling tools?',
      script: 'Still juggling tools? This brings the workflow together so your team can plan, create and publish with less switching.',
      cta: 'Take a look.',
      caption: 'One workspace for the week.',
      avatarIndex: 0,
      scenes: [
        { duration: 10, kind: 'CREATOR', prompt: 'Explain the opening value.', script: 'Still juggling tools? This brings the workflow together.' },
        { duration: 10, kind: 'CREATOR', prompt: 'Land the value and close.', script: 'Plan, create and publish with less switching.' }
      ]
    }]
  };
}

test('UGC engine registry preserves current customer tiers while hiding provider details from the UI layer', () => {
  assert.equal(registry.ENGINE_VERSION, 'ugc-engine-v1');
  assert.equal(registry.CONTRACT_VERSION, '1.3');
  assert.equal(registry.routeKeyForQuality('STANDARD'), 'H3_MAX_STANDARD_V1');
  assert.equal(registry.routeKeyForQuality('PREMIUM'), 'KLING_PREMIUM_V1');
  assert.equal(registry.legacyDbRoute('STANDARD'), 'H3_MAX');
  assert.equal(registry.legacyDbRoute('PREMIUM'), 'KLING');

  const ids = registry.modelIds();
  assert.ok(ids.standardVideo);
  assert.ok(ids.premiumVideo);
  assert.ok(ids.tts);
  assert.ok(ids.lipSync);
});

test('standard UGC project maps H3 Max native audio into a versioned contract', () => {
  const project = buildEngineProject({
    userId: 'user-1',
    campaignId: 'campaign-1',
    input: standardInput(),
    brand: {
      id: 'brand-1',
      name: 'Example',
      productName: 'Example App',
      websiteUrl: 'https://example.com/',
      summary: 'A productivity platform.'
    },
    productAssetIds: [],
    availableAvatars: [sampleAvatar()],
    plan: standardPlan(),
    resolvedType: 'AVATAR_EXPLAINER',
    perAdCredits: 140,
    totalCredits: 140
  });

  assert.equal(project.engineVersion, 'ugc-engine-v1');
  assert.equal(project.contractVersion, '1.3');
  assert.equal(project.status, 'PLANNED');
  assert.equal(project.brief.targetDuration, 20);
  assert.equal(project.actor.assignedActors[0].actor.id, 'avatar-1');
  assert.deepEqual(project.productionPlan.ads[0].scenes.map(scene => scene.providerDuration), [10, 10]);
  assert.deepEqual(project.productionPlan.ads[0].scenes.map(scene => scene.playbackDuration), [10, 10]);
  assert.equal(project.router.version, 'ugc-router-v1');
  assert.equal(project.routeDecision.policy, 'CAPABILITY_ROUTER_V1');
  assert.equal(project.routeDecision.scenes[0].routeKey, 'H3_MAX_STANDARD_V1');
  assert.equal(project.routeDecision.scenes[0].adapterKey, 'H3_MAX');
  assert.equal(project.routeDecision.scenes[0].narratorModel, null);
  assert.equal(project.routeDecision.scenes[0].lipSyncModel, null);
  assert.equal(project.routeDecision.scenes[0].audioStrategy, 'NATIVE_SYNC_AUDIO');
  assert.equal(project.pricing.retailCreditsPerAd, 140);
  assert.equal(project.pricing.retailCreditsTotal, 140);
  assert.equal(project.renderJobs[0].status, 'PLANNED');
  assert.ok(project.fingerprint.length === 64);
  assert.deepEqual(project.qc.requiredChecks, QC_CHECKS);
  assert.equal(validateEngineProject(project), true);
});

test('Standard product scenes use the same H3 Max native-audio route', () => {
  const route = registry.describeSceneRoute({
    quality: 'STANDARD',
    kind: 'PRODUCT',
    providerDuration: 10,
    playbackDuration: 10
  });
  assert.equal(route.routeKey, 'H3_MAX_STANDARD_V1');
  assert.equal(route.audioStrategy, 'NATIVE_SYNC_AUDIO');
  assert.equal(route.lipSync, null);
  assert.equal(route.narrator.strategy, 'NATIVE_SYNC_AUDIO');
  assert.equal(route.resolution, '768p');
  assert.equal(route.aspectRatio, '9:16');
});

test('premium creator route maps to the existing Kling premium path', () => {
  const route = registry.describeSceneRoute({
    quality: 'PREMIUM',
    kind: 'CREATOR',
    providerDuration: 15,
    playbackDuration: 15
  });
  assert.equal(route.routeKey, 'KLING_PREMIUM_V1');
  assert.equal(route.legacyDbRoute, 'KLING');
  assert.ok(route.videoModel);
  assert.ok(route.lipSync?.model);
});

test('contract validation rejects duration and pricing drift before a campaign can enter the new engine', () => {
  const project = buildEngineProject({
    userId: 'user-1',
    campaignId: 'campaign-1',
    input: standardInput(),
    brand: null,
    productAssetIds: [],
    availableAvatars: [sampleAvatar()],
    plan: standardPlan(),
    resolvedType: 'AVATAR_EXPLAINER',
    perAdCredits: 140,
    totalCredits: 140
  });

  const brokenDuration = JSON.parse(JSON.stringify(project));
  brokenDuration.productionPlan.ads[0].scenes[1].playbackDuration = 6;
  assert.throws(() => validateEngineProject(brokenDuration), /playback_duration_1/);

  const brokenPricing = JSON.parse(JSON.stringify(project));
  brokenPricing.pricing.retailCreditsTotal = 139;
  assert.throws(() => validateEngineProject(brokenPricing), /pricing_total/);
});

test('contract fingerprints are deterministic for the same production plan', () => {
  const args = {
    userId: 'user-1',
    campaignId: 'campaign-1',
    input: standardInput(),
    brand: null,
    productAssetIds: [],
    availableAvatars: [sampleAvatar()],
    plan: standardPlan(),
    resolvedType: 'AVATAR_EXPLAINER',
    perAdCredits: 140,
    totalCredits: 140
  };
  assert.equal(buildEngineProject(args).fingerprint, buildEngineProject(args).fingerprint);
});

test('playback duration helper never exceeds provider footage or requested final duration', () => {
  assert.deepEqual(playbackDurations(20, [10, 10]), [10, 10]);
  assert.deepEqual(playbackDurations(60, [15, 15, 15, 15]), [15, 15, 15, 15]);
});
