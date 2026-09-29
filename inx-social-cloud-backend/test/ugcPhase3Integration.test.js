const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 3 router storage is additive and versioned', () => {
  const migration = read('prisma/migrations/20260924120000_add_ugc_model_router/migration.sql');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "routerVersion"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "routerJson"/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
});

test('new UGC campaigns run skills, then router, then engine persistence before credit reservation', () => {
  const studio = read('src/services/ugcStudioService.js');
  const skillIndex = studio.indexOf('creativePlan = await planCampaign');
  const routeIndex = studio.indexOf('ugcModelRouter.routePlan', skillIndex);
  const engineIndex = studio.indexOf('ugcEngine.createProject', routeIndex);
  const reserveIndex = studio.indexOf('createGenerationRow', engineIndex);
  assert.ok(skillIndex >= 0 && routeIndex > skillIndex && engineIndex > routeIndex && reserveIndex > engineIndex);
});

test('UGC scene rows persist the exact routed scene key', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /scene\.routeDecision\?\.routeKey \|\| route/);
  assert.match(studio, /routeDecision: scene\.routeDecision \|\| null/);
});

test('runtime rendering delegates provider-specific requests to adapters', () => {
  const studio = read('src/services/ugcStudioService.js');
  const adapters = read('src/services/ugcProviderAdapters.js');
  assert.match(studio, /ugcProviderAdapters\.renderScene\(scene\.route/);
  assert.match(studio, /result\.postProcess === 'LIP_SYNC'/);
  assert.match(studio, /result\.postProcess === 'LOCAL_MUX'/);
  assert.match(adapters, /OMNIHUMAN_15/);
  assert.match(adapters, /SEEDANCE_25/);
  assert.match(adapters, /KLING_OMNI_30/);
});

test('existing pre-Phase-3 scene route aliases remain renderable', () => {
  const adapters = require('../src/services/ugcProviderAdapters');
  assert.equal(adapters.normalizeRouteKey('HAILUO'), 'HAILUO_23');
  assert.equal(adapters.normalizeRouteKey('KLING'), 'KLING_LEGACY');
  assert.equal(adapters.normalizeRouteKey('HAILUO_STANDARD_V1'), 'HAILUO_23');
  assert.equal(adapters.normalizeRouteKey('H3_MAX_STANDARD_V1'), 'H3_MAX');
  assert.equal(adapters.normalizeRouteKey('KLING_PREMIUM_V1'), 'KLING_LEGACY');
});

test('UGC commercial hardening keeps Phase 3 routing while raising conservative fallback credit floors', () => {
  const studio = require('../src/services/ugcStudioService');
  assert.deepEqual(studio.STANDARD_CREDITS, { 20: 184, 30: 276, 45: 414, 60: 552 });
  assert.deepEqual(studio.PREMIUM_CREDITS, { 20: 530, 30: 795, 45: 1193, 60: 1590 });
});

test('provider names remain hidden from customer-facing UGC UI', () => {
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  const editor = read('frontend/src/components/ai-content-studio/UGCEditorPage.tsx');
  const ui = [wizard, home, editor].join('\n');
  assert.doesNotMatch(ui, /OmniHuman|Seedance|Hailuo|MiniMax|Kling 3|Runware|Inworld TTS/i);
});

test('engine startup diagnostics include adapter and router snapshots', () => {
  const engine = read('src/services/ugcEngineService.js');
  assert.match(engine, /routerVersion: router\.ROUTER_VERSION/);
  assert.match(engine, /router: router\.routerSnapshot\(\)/);
});

test('adaptive routing can be switched back to compatibility mode without a code rollback', () => {
  const env = read('src/config/env.js');
  const router = read('src/services/ugcModelRouter.js');
  assert.match(env, /UGC_MODEL_ROUTER_MODE/);
  assert.match(router, /compatibility/);
  assert.match(router, /KLING_PREMIUM_V1/);
});
