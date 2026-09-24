const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/services/ugcModelRouter');
const adapters = require('../src/services/ugcProviderAdapters');

function creator(overrides = {}) {
  return { id: 'avatar-1', name: 'Maya', category: 'Lifestyle', presentation: 'Woman', ageBand: '25–34', locale: 'en-GB', voice: 'Pippa', environment: 'real apartment', ...overrides };
}

test('Phase 3 router keeps Standard on Hailuo', () => {
  const route = router.routeForScene({
    quality: 'STANDARD',
    kind: 'CREATOR',
    providerDuration: 10,
    playbackDuration: 10,
    hasActor: true,
    hasProductReference: false,
    hasNarration: true,
    mode: 'adaptive'
  });
  assert.equal(route.routeKey, 'HAILUO_STANDARD_V1');
  assert.equal(route.adapterKey, 'HAILUO_23');
  assert.equal(route.audioStrategy, 'TTS_THEN_LIP_SYNC');
});

test('Premium creator scenes route to OmniHuman 1.5', () => {
  const route = router.routeForScene({
    quality: 'PREMIUM',
    kind: 'CREATOR',
    providerDuration: 15,
    playbackDuration: 15,
    hasActor: true,
    hasProductReference: false,
    hasNarration: true,
    mode: 'adaptive'
  });
  assert.equal(route.routeKey, 'OMNIHUMAN_CREATOR_V1');
  assert.equal(route.adapterKey, 'OMNIHUMAN_15');
  assert.equal(route.audioStrategy, 'AUDIO_DRIVEN_NATIVE');
  assert.equal(route.nativeLipSync, true);
});

test('Premium product scenes route to Seedance 2.5', () => {
  const route = router.routeForScene({
    quality: 'PREMIUM',
    kind: 'PRODUCT',
    providerDuration: 10,
    playbackDuration: 10,
    hasActor: true,
    hasProductReference: true,
    hasNarration: true,
    mode: 'adaptive'
  });
  assert.equal(route.routeKey, 'SEEDANCE_DYNAMIC_V1');
  assert.equal(route.adapterKey, 'SEEDANCE_25');
  assert.equal(route.audioStrategy, 'TTS_THEN_LOCAL_MUX');
});

test('Premium creator without audio input falls back before provider spend', () => {
  const route = router.routeForScene({
    quality: 'PREMIUM',
    kind: 'CREATOR',
    providerDuration: 10,
    playbackDuration: 10,
    hasActor: true,
    hasProductReference: false,
    hasNarration: false,
    mode: 'adaptive'
  });
  assert.equal(route.routeKey, 'KLING_OMNI_DYNAMIC_V1');
  assert.equal(route.adapterKey, 'KLING_OMNI_30');
});

test('Compatibility mode preserves the pre-Phase-3 premium route', () => {
  const route = router.routeForScene({
    quality: 'PREMIUM',
    kind: 'CREATOR',
    providerDuration: 15,
    playbackDuration: 15,
    hasActor: true,
    hasProductReference: false,
    hasNarration: true,
    mode: 'compatibility'
  });
  assert.equal(route.routeKey, 'KLING_PREMIUM_V1');
  assert.equal(route.adapterKey, 'KLING_LEGACY');
});

test('Creator V2 compatibility can redirect a Premium creator to an allowed fallback route', () => {
  const route = router.routeForScene({
    quality: 'PREMIUM',
    kind: 'CREATOR',
    providerDuration: 10,
    playbackDuration: 10,
    hasActor: true,
    hasProductReference: false,
    hasNarration: true,
    allowedRoutes: ['KLING_PREMIUM_V1'],
    mode: 'adaptive'
  });
  assert.equal(route.routeKey, 'KLING_PREMIUM_V1');
  assert.match(route.reason, /CREATOR_COMPATIBILITY_FALLBACK/);
});

test('Creator V2 compatibility blocks a Standard creator with no valid Standard route', () => {
  assert.throws(
    () => router.routeForScene({
      quality: 'STANDARD',
      kind: 'CREATOR',
      providerDuration: 10,
      playbackDuration: 10,
      hasActor: true,
      hasProductReference: false,
      hasNarration: true,
      allowedRoutes: ['OMNIHUMAN_CREATOR_V1'],
      mode: 'adaptive'
    }),
    error => error?.code === 'UGC_ROUTER_CREATOR_INCOMPATIBLE'
  );
});

test('Creator V2 route restrictions affect creator scenes without constraining product routing', () => {
  const plan = router.routePlan({
    input: { quality: 'PREMIUM' },
    hasProductReference: true,
    availableAvatars: [creator({ routeCompatibilityJson: JSON.stringify(['KLING_PREMIUM_V1']) })],
    mode: 'adaptive',
    plan: {
      title: 'Compatibility-aware UGC',
      ads: [{
        avatarIndex: 0,
        scenes: [
          { kind: 'CREATOR', duration: 10, playbackDuration: 10, script: 'A creator line.' },
          { kind: 'PRODUCT', duration: 10, playbackDuration: 10, script: 'A product line.' }
        ]
      }]
    }
  });
  assert.equal(plan.ads[0].scenes[0].routeDecision.routeKey, 'KLING_PREMIUM_V1');
  assert.equal(plan.ads[0].scenes[1].routeDecision.routeKey, 'SEEDANCE_DYNAMIC_V1');
});

test('Route plan selects models per scene rather than per whole ad', () => {
  const plan = router.routePlan({
    input: { quality: 'PREMIUM' },
    hasProductReference: true,
    availableAvatars: [creator()],
    mode: 'adaptive',
    plan: {
      title: 'Mixed UGC',
      ads: [{
        avatarIndex: 0,
        scenes: [
          { kind: 'CREATOR', duration: 8, playbackDuration: 8, script: 'I started using this because it made the routine easier.' },
          { kind: 'PRODUCT', duration: 7, playbackDuration: 7, script: 'Here is the product in use.' }
        ]
      }]
    }
  });
  assert.equal(plan.routerVersion, 'ugc-router-v1');
  assert.equal(plan.ads[0].scenes[0].routeDecision.routeKey, 'OMNIHUMAN_CREATOR_V1');
  assert.equal(plan.ads[0].scenes[1].routeDecision.routeKey, 'SEEDANCE_DYNAMIC_V1');
  assert.deepEqual(plan.routingSummary, { OMNIHUMAN_CREATOR_V1: 1, SEEDANCE_DYNAMIC_V1: 1 });
});

test('OmniHuman adapter uses portrait plus narration audio and skips extra lip sync', () => {
  const cap = adapters.getAdapter('OMNIHUMAN_CREATOR_V1');
  const task = adapters.buildTask(cap, {
    kind: 'CREATOR',
    providerDuration: 15,
    prompt: 'Natural creator talking.',
    reference: 'data:image/png;base64,abc',
    narration: { audioURL: 'https://example.com/voice.mp3' }
  });
  assert.equal(task.model, 'bytedance:5@2');
  assert.equal(task.inputs.image, 'data:image/png;base64,abc');
  assert.equal(task.inputs.audio, 'https://example.com/voice.mp3');
  assert.equal(task.duration, undefined);
  assert.equal(adapters.postProcessFor(cap, { kind: 'CREATOR', narration: { audioURL: 'x' } }), 'NONE');
});

test('Seedance adapter uses reference-guided 720p vertical generation', () => {
  const cap = adapters.getAdapter('SEEDANCE_DYNAMIC_V1');
  const task = adapters.buildTask(cap, {
    kind: 'PRODUCT',
    providerDuration: 10,
    prompt: 'Show the exact product naturally.',
    reference: 'data:image/png;base64,product',
    narration: { audioURL: 'https://example.com/voice.mp3' }
  });
  assert.equal(task.model, 'bytedance:seedance@2.5');
  assert.deepEqual(task.inputs.referenceImages, ['data:image/png;base64,product']);
  assert.equal(task.width, 720);
  assert.equal(task.height, 1280);
  assert.equal(task.duration, 10);
  assert.deepEqual(task.settings, { audio: false });
  assert.equal(adapters.postProcessFor(cap, { kind: 'PRODUCT', narration: { audioURL: 'x' } }), 'LOCAL_MUX');
});

test('Hailuo adapter keeps provider-safe first-frame generation', () => {
  const cap = adapters.getAdapter('HAILUO_STANDARD_V1');
  const task = adapters.buildTask(cap, {
    kind: 'CREATOR',
    providerDuration: 10,
    prompt: 'Creator speaks naturally.',
    reference: 'data:image/png;base64,actor',
    narration: { audioURL: 'https://example.com/voice.mp3' }
  });
  assert.equal(task.model, 'minimax:4@1');
  assert.deepEqual(task.inputs.frameImages, [{ image: 'data:image/png;base64,actor', frame: 'first' }]);
  assert.deepEqual(task.providerSettings, { minimax: { promptOptimizer: true } });
  assert.equal(adapters.postProcessFor(cap, { kind: 'CREATOR', narration: { audioURL: 'x' } }), 'LIP_SYNC');
});
