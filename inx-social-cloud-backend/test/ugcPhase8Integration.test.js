const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 8 production audit is exposed through engine health', () => {
  const engine = read('src/services/ugcEngineService.js');
  const audit = read('src/services/ugcProductionAuditService.js');
  assert.match(audit, /PRODUCTION_AUDIT_VERSION = 'ugc-production-audit-v1'/);
  assert.match(engine, /productionAuditVersion: productionAudit\.PRODUCTION_AUDIT_VERSION/);
  assert.match(engine, /productionAudit: productionAudit\.snapshot\(\)/);
});

test('Phase 8 persists the full audit when a UGC campaign becomes terminal', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /ugcProductionAudit\.auditCampaign\(campaign\.userId, campaignId, \{ persist: true \}\)/);
  assert.match(studio, /\['READY','PARTIAL','FAILED'\]\.includes\(status\)/);
  assert.match(studio, /\[UGC PHASE 8 AUDIT\]/);
});

test('Owner can inspect exact campaign audit without exposing another user campaign', () => {
  const service = read('src/services/ugcStudioService.js');
  const controller = read('src/controllers/ugcStudioController.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  assert.match(service, /async function getProductionAudit\(userId, campaignId\)/);
  assert.match(service, /await ownedCampaign\(userId, campaignId\)/);
  assert.match(controller, /service\.getProductionAudit\(req\.user\.id, req\.params\.campaignId\)/);
  assert.match(routes, /\/ugc\/campaigns\/:campaignId\/audit/);
});

test('Phase 8 admin operations use the same production audit service', () => {
  const controller = read('src/controllers/adminController.js');
  const routes = read('src/routes/adminRoutes.js');
  const html = read('public/index.html');
  const js = read('public/admin.js');
  assert.match(controller, /ugcProductionAudit\.operationsSummary/);
  assert.match(routes, /\/ugc-operations/);
  assert.match(html, /Phase 8 production audit/);
  assert.match(html, /id="ugcOpsStatus"/);
  assert.match(js, /renderUgcOperations/);
  assert.match(js, /\/api\/admin\/ugc-operations\?limit=20/);
});

test('Phase 8 reconciles engine, ads, scenes, generations, credits and Media Library', () => {
  const audit = read('src/services/ugcProductionAuditService.js');
  for (const marker of [
    'ENGINE_PROJECT_PRESENT',
    'ENGINE_STATUS_SYNC',
    'ENGINE_RENDER_JOB_COUNT',
    'GENERATION_LINK',
    'COMPLETED_CREDIT_FINALIZATION',
    'FAILED_CREDIT_REFUND',
    'ZERO_CREDIT_REASSEMBLY',
    'READY_QC',
    'MEDIA_LIBRARY_LINK',
    'MEDIA_ASSET_VIDEO',
    'TERMINAL_AD_STATES',
  ]) assert.match(audit, new RegExp(marker));
  assert.match(audit, /FROM "AiCreditTransaction"/);
  assert.match(audit, /FROM "AgentAsset"/);
});

test('Phase 8 tracks reassembly as a real recovery operation', () => {
  const analytics = read('src/services/ugcStudioAnalyticsService.js');
  const studio = read('src/services/ugcStudioService.js');
  assert.match(analytics, /'REASSEMBLY_STARTED'/);
  assert.match(analytics, /'sceneCount'/);
  assert.match(analytics, /'renderQualityVersion'/);
  assert.match(studio, /event: 'REASSEMBLY_STARTED'/);
});

test('Phase 8 preserves all prior UGC architecture versions and pricing', () => {
  const studio = read('src/services/ugcStudioService.js');
  const router = read('src/services/ugcModelRouter.js');
  const creators = read('src/services/ugcCreatorEngine.js');
  const formats = read('src/services/ugcCreativeFormats.js');
  const controls = read('src/services/ugcStudioControls.js');
  const quality = read('src/services/ugcRenderQuality.js');
  assert.match(studio, /STANDARD_CREDITS = Object\.freeze\(\{ 20: 140, 30: 210, 45: 315, 60: 420 \}\)/);
  assert.match(studio, /PREMIUM_CREDITS = Object\.freeze\(\{ 20: 260, 30: 390, 45: 585, 60: 780 \}\)/);
  assert.match(router, /ROUTER_VERSION = 'ugc-router-v1'/);
  assert.match(creators, /CREATOR_PROFILE_VERSION = 'ugc-creators-v2'/);
  assert.match(formats, /CREATIVE_FORMAT_VERSION = 'ugc-formats-v1'/);
  assert.match(controls, /STUDIO_CONTROLS_VERSION = 'ugc-studio-controls-v1'/);
  assert.match(quality, /RENDER_QUALITY_VERSION = 'ugc-render-qc-v1'/);
});

test('Phase 8 centralizes queue timing and concurrency without increasing production load', () => {
  const runtime = read('src/services/ugcRuntimePolicy.js');
  const studio = read('src/services/ugcStudioService.js');
  const audit = read('src/services/ugcProductionAuditService.js');
  assert.match(runtime, /UGC_RUNTIME_POLICY_VERSION = 'ugc-runtime-policy-v1'/);
  assert.match(runtime, /AD_WORKERS_PER_PROCESS = 1/);
  assert.match(runtime, /SCENE_CONCURRENCY = 2/);
  assert.match(runtime, /QUEUE_POLL_MS = 5_000/);
  assert.match(runtime, /STALE_RENDER_MS = 5 \* 60 \* 1000/);
  assert.match(runtime, /POSTGRES_FOR_UPDATE_SKIP_LOCKED/);
  assert.match(studio, /ugcRuntimePolicy\.SCENE_CONCURRENCY/);
  assert.match(studio, /ugcRuntimePolicy\.QUEUE_POLL_MS/);
  assert.match(audit, /runtime: runtimePolicy\.snapshot\(\)/);
});

test('Phase 8 remains additive and needs no database migration', () => {
  const audit = read('src/services/ugcProductionAuditService.js');
  assert.doesNotMatch(audit, /ALTER TABLE|CREATE TABLE|DROP TABLE/i);
});
