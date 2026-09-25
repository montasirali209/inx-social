const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const router = require('../src/services/ugcModelRouter');

test('Phase 3.1 rejects H3 Max Standard durations outside the supported range', () => {
  assert.throws(
    () => router.routeForScene({
      quality: 'STANDARD',
      kind: 'CREATOR',
      providerDuration: 4,
      playbackDuration: 4,
      hasActor: true,
      hasProductReference: false,
      hasNarration: true,
      mode: 'adaptive'
    }),
    error => error?.code === 'UGC_ROUTER_NO_DURATION_ROUTE'
  );
});

test('Phase 3.1 preserves supported H3 Max Standard durations', () => {
  for (const duration of [5, 10, 15]) {
    const route = router.routeForScene({
      quality: 'STANDARD',
      kind: 'CREATOR',
      providerDuration: duration,
      playbackDuration: duration,
      hasActor: true,
      hasProductReference: false,
      hasNarration: true,
      mode: 'adaptive'
    });
    assert.equal(route.routeKey, 'H3_MAX_STANDARD_V1');
    assert.equal(route.capability.supportedDurations, 'INTEGER_5_15');
  }
});

test('full-ad regeneration reroutes before any new credit reservation', () => {
  const studio = read('src/services/ugcStudioService.js');
  const start = studio.indexOf('async function regenerateAd');
  const end = studio.indexOf('async function regenerateScene', start);
  const block = studio.slice(start, end);
  assert.ok(block.indexOf('rerouteScenesForRegeneration') >= 0);
  assert.ok(block.indexOf('rerouteScenesForRegeneration') < block.indexOf('createGenerationRow'));
  assert.match(block, /recordReroute/);
  assert.match(block, /routerVersion/);
  assert.match(block, /sceneRoutes/);
});

test('single-scene regeneration reroutes before any new credit reservation', () => {
  const studio = read('src/services/ugcStudioService.js');
  const start = studio.indexOf('async function regenerateScene');
  const end = studio.indexOf('module.exports', start);
  const block = studio.slice(start, end);
  assert.ok(block.indexOf('rerouteScenesForRegeneration') >= 0);
  assert.ok(block.indexOf('rerouteScenesForRegeneration') < block.indexOf('createGenerationRow'));
  assert.match(block, /SCENE_REGENERATION/);
});

test('regeneration reroute persists the scene route and current ad plan provenance', () => {
  const studio = read('src/services/ugcStudioService.js');
  const start = studio.indexOf('async function rerouteScenesForRegeneration');
  const end = studio.indexOf('async function regenerateAd', start);
  const block = studio.slice(start, end);
  assert.match(block, /ugcModelRouter\.routeForScene/);
  assert.match(block, /UPDATE "UGCScene" SET "route"=\$2,"productReferenceJson"=\$3/);
  assert.match(block, /routeDecision: decision/);
  assert.match(block, /routingSummary: ugcModelRouter\.summarizeRoutes/);
  assert.match(block, /UPDATE "UGCAd" SET "planJson"=\$2/);
});

test('engine reroute audit is append-only runtime metadata and does not rewrite the signed planning contract', () => {
  const engine = read('src/services/ugcEngineService.js');
  const start = engine.indexOf('async function recordReroute');
  const end = engine.indexOf('async function recordRenderStatus', start);
  const block = engine.slice(start, end);
  assert.match(block, /renderJobsJson/);
  assert.match(block, /latestReroute/);
  assert.match(block, /reroutes/);
  assert.doesNotMatch(block, /fingerprint|productionPlanJson|routeDecisionJson|routerJson/);
});
