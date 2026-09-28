'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('UI Studio Phase 5 persists best/accepted generations, render queue, assets and masks', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260928052000_add_ui_studio_phase5/migration.sql');
  assert.match(schema, /bestGenerationId\s+String\?/);
  assert.match(schema, /acceptedGenerationId\s+String\?/);
  assert.match(schema, /aggregateScore\s+Float\?/);
  assert.match(schema, /viewportScoresJson\s+String\?/);
  assert.match(schema, /batchId\s+String\?/);
  assert.match(schema, /leaseExpiresAt\s+DateTime\?/);
  assert.match(schema, /model UiDesignAssetBinding/);
  assert.match(schema, /model UiDesignIgnoreMask/);
  assert.match(migration, /CREATE TABLE "UiDesignAssetBinding"/);
  assert.match(migration, /CREATE TABLE "UiDesignIgnoreMask"/);
  assert.match(migration, /ADD COLUMN "bestGenerationId"/);
});

test('Phase 3 compile validation is real and markdown-fence validator typo is fixed', () => {
  const codegen = read('src/services/uiStudioCodegenService.js');
  assert.match(codegen, /validateGenerationBuild/);
  assert.match(codegen, /previewBuild\.compileGeneration/);
  assert.match(codegen, /BUILD_COMPILE/);
  assert.match(codegen, /NO_MARKDOWN_FENCES/);
  assert.doesNotMatch(codegen, /\^s\*/);
});

test('Phase 5 preview build uses non-blocking child processes and does not use spawnSync', () => {
  const preview = read('src/services/uiStudioPreviewBuildService.js');
  assert.match(preview, /const \{ spawn \} = require\('node:child_process'\)/);
  assert.match(preview, /new Promise/);
  assert.match(preview, /child\.once\('close'/);
  assert.doesNotMatch(preview, /spawnSync/);
});

test('Phase 5 uses a dedicated deterministic Chromium renderer with network interception', () => {
  const service = read('src/services/uiStudioConvergenceService.js');
  assert.match(service, /\/chromium\/function\?token=/);
  assert.match(service, /page\.setViewport/);
  assert.match(service, /page\.setRequestInterception\(true\)/);
  assert.match(service, /page\.screenshot/);
  assert.match(service, /renderer: 'browserless-chromium'/);
  assert.match(service, /deterministic: true/);
});

test('Phase 5 convergence evaluates every viewport and rejects responsive regressions', () => {
  const service = read('src/services/uiStudioConvergenceService.js');
  assert.match(service, /VIEWPORT_ORDER = \['DESKTOP','TABLET','MOBILE'\]/);
  assert.match(service, /viewportRegression/);
  assert.match(service, /REJECTED_REGRESSION/);
  assert.match(service, /aggregateScore/);
  assert.match(service, /minimumViewportScore/);
  assert.match(service, /bestGenerationId/);
  assert.match(service, /scoreAfter: aggregateScore/);
  assert.match(service, /Repair all supplied viewports together/);
});

test('Phase 5 render queue has worker leases, retry recovery and background processing', () => {
  const service = read('src/services/uiStudioConvergenceService.js');
  const worker = read('src/workers/uiStudioRendererWorker.js');
  assert.match(service, /recoverStaleJobs/);
  assert.match(service, /leaseExpiresAt/);
  assert.match(service, /attempts: \{ increment: 1 \}/);
  assert.match(service, /status: 'QUEUED'/);
  assert.match(worker, /processNextQueuedRender/);
  assert.match(worker, /INXSocial UI Studio Renderer Worker/);
  assert.match(worker, /\/health/);
});

test('Phase 5 asset binding and ignore masks are wired through protected admin routes', () => {
  const routes = read('src/routes/adminRoutes.js');
  const controller = read('src/controllers/uiStudioController.js');
  assert.match(routes, /phase5\/assets'[\s\S]*?requireSuperAdmin/);
  assert.match(routes, /phase5\/masks', requireSuperAdmin/);
  assert.match(routes, /phase5\/accept\/:generationId', requireSuperAdmin/);
  assert.match(routes, /phase5\/run', requireSuperAdmin/);
  assert.match(controller, /uploadAssetBinding/);
  assert.match(controller, /createIgnoreMask/);
  assert.match(controller, /acceptGeneration/);
});

test('Phase 5 comparison masks remove masked pixels from similarity scoring', () => {
  const convergence = require('../src/services/uiStudioConvergenceService');
  const a = Buffer.from([
    0,0,0,255, 0,0,0,255,
    0,0,0,255, 0,0,0,255
  ]);
  const b = Buffer.from([
    255,255,255,255, 0,0,0,255,
    0,0,0,255, 0,0,0,255
  ]);
  const withoutMask = convergence.imageMetrics(a, b, 2, 2, []);
  const withMask = convergence.imageMetrics(a, b, 2, 2, [{
    enabled: true, xPct: 0, yPct: 0, widthPct: 50, heightPct: 50
  }]);
  assert.ok(withMask.metrics.pixelScore > withoutMask.metrics.pixelScore);
  assert.ok(withMask.metrics.ignoredPercent > 0);
});

test('Phase 5 admin exposes all-viewport convergence, best acceptance, assets and masks', () => {
  const html = read('public/index.html');
  const js = read('public/ui-studio.js');
  const css = read('public/ui-studio.css');
  assert.match(html, /id="uiStudioPhase5RunBtn"/);
  assert.match(html, /id="uiStudioPhase5AcceptBtn"/);
  assert.match(html, /id="uiStudioPhase5Assets"/);
  assert.match(html, /id="uiStudioPhase5MaskForm"/);
  assert.match(js, /async function startPhase5/);
  assert.match(js, /async function pollPhase5Batch/);
  assert.match(js, /async function acceptPhase5Best/);
  assert.match(css, /\.ui-studio-phase5-viewport-grid/);
});

test('Phase 5 remains isolated from UGC generation and live landing deployment', () => {
  const service = read('src/services/uiStudioConvergenceService.js');
  const preview = read('src/services/uiStudioPreviewBuildService.js');
  assert.doesNotMatch(service, /ugcStudioService|ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
  assert.doesNotMatch(preview, /ugcStudioService|ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
  assert.doesNotMatch(service, /create_pull_request|deployment\/railway-postgres|railway up|landing-next\//);
});

test('Phase 5 real Chromium E2E renders exact viewport dimensions', {
  skip: !process.env.UI_STUDIO_RENDERER_URL || !process.env.UI_STUDIO_RENDERER_TOKEN
}, async () => {
  const convergence = require('../src/services/uiStudioConvergenceService');
  const png = await convergence.renderWithChromium(
    '<!doctype html><html><body style="margin:0;background:#123"><main style="width:100vw;height:100vh"></main></body></html>',
    640,
    360
  );
  const meta = await sharp(png).metadata();
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 640);
  assert.equal(meta.height, 360);
});
