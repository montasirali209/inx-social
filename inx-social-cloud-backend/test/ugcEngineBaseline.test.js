const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 0 freezes the current UGC pricing and duration surface', () => {
  const service = require('../src/services/ugcStudioService');
  assert.deepEqual(service.STANDARD_CREDITS, { 15: 100, 20: 140, 30: 210 });
  assert.deepEqual(service.PREMIUM_CREDITS, { 15: 180, 20: 260, 30: 390 });
  assert.equal(service.AVATAR_CREDITS, 5);
  assert.deepEqual(service.visualDurations(15, 'STANDARD', 'AVATAR_EXPLAINER'), [10, 6]);
  assert.deepEqual(service.playbackDurations(15, [10, 6]), [10, 5]);
});

test('Phase 0 preserves reserve-complete-refund credit accounting around UGC generation', () => {
  const service = read('src/services/ugcStudioService.js');
  assert.match(service, /await credits\.reserve\(userId, generationId, amount\)/);
  assert.match(service, /await credits\.complete\(ad\.userId, ad\.generationId, generationCredits\)/);
  assert.match(service, /await credits\.refund\(ad\.userId, ad\.generationId/);
  assert.match(service, /ugc_campaign_reservation_failed/);
});

test('Phase 0 preserves Media Library persistence and scheduler handoff', () => {
  const service = read('src/services/ugcStudioService.js');
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  const editor = read('frontend/src/components/ai-content-studio/UGCEditorPage.tsx');

  assert.match(service, /prisma\.agentAsset\.create/);
  assert.match(service, /kind: 'AI_VIDEO'/);
  assert.match(service, /source: 'AI_STUDIO'/);
  assert.match(service, /mediaAssetId/);
  assert.match(home, /navigate\('\/bulk-scheduler'/);
  assert.match(editor, /navigate\('\/bulk-scheduler'/);
});

test('Phase 0 preserves background progress, restart recovery and notifications', () => {
  const service = read('src/services/ugcStudioService.js');
  const notifications = read('frontend/src/components/layout/NotificationCenter.tsx');

  assert.match(service, /updateGenerationProgress/);
  assert.match(service, /recoverStaleUGCRenders/);
  assert.match(service, /UGC_RENDER_STALE_MS/);
  assert.match(service, /startUGCStudioRuntime/);
  assert.match(notifications, /UGC creation is running/);
  assert.match(notifications, /UGC campaign is ready/);
});

test('Phase 1 is additive and does not replace existing operational UGC tables', () => {
  const migration = read('prisma/migrations/20260924090000_add_ugc_engine_phase01/migration.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "UGCEngineProject"/);
  assert.match(migration, /REFERENCES "UGCCampaign"/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
});

test('new campaigns create engine snapshots while the renderer still uses legacy-compatible route values', () => {
  const service = read('src/services/ugcStudioService.js');
  const engine = read('src/services/ugcEngineService.js');
  const registry = read('src/services/ugcEngineRegistry.js');

  assert.match(service, /ugcEngine\.createProject/);
  assert.match(service, /ugcEngine\.linkGeneration/);
  assert.match(service, /ugcEngineRegistry\.legacyDbRoute/);
  assert.match(engine, /UGCEngineProject/);
  assert.match(registry, /HAILUO_STANDARD_V1/);
  assert.match(registry, /KLING_PREMIUM_V1/);
});

test('owned campaign engine snapshots are inspectable without exposing a public unauthenticated route', () => {
  const controller = read('src/controllers/ugcStudioController.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');

  assert.match(controller, /getEngineProject/);
  assert.match(routes, /\/ugc\/campaigns\/:campaignId\/engine/);
  assert.match(routes, /router\.use\(requireAuth\)/);
});
