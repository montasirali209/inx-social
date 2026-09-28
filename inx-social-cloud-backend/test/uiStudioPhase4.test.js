'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('UI Studio Phase 4 persists visual renders and repair history', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260928034500_add_ui_studio_visual/migration.sql');
  assert.match(schema, /model UiDesignRender/);
  assert.match(schema, /model UiDesignRepairAttempt/);
  assert.match(schema, /renders\s+UiDesignRender\[\]/);
  assert.match(schema, /repairAttempts\s+UiDesignRepairAttempt\[\]/);
  assert.match(migration, /CREATE TABLE "UiDesignRender"/);
  assert.match(migration, /CREATE TABLE "UiDesignRepairAttempt"/);
  assert.match(migration, /UiDesignRender_generationId_fkey/);
  assert.match(migration, /UiDesignRender_referenceId_fkey/);
});

test('Phase 4 renderer blocks network and Node execution from generated source', () => {
  const visual = require('../src/services/uiStudioVisualService');
  assert.throws(() => visual.validateGeneratedSources({
    files: [{ path: 'Bad.tsx', content: 'fetch("https://example.com")' }]
  }), /Network calls are not allowed/);
  assert.throws(() => visual.validateGeneratedSources({
    files: [{ path: 'Bad.tsx', content: 'import fs from "node:fs"; export default 1' }]
  }), /Node built-in imports are not allowed/);
});

test('Phase 4 direct HTML preview injects isolated browser capture runtime', () => {
  const visual = require('../src/services/uiStudioVisualService');
  const html = visual.buildPreviewHtml({
    entryFile: 'index.html',
    files: [
      { path: 'index.html', language: 'html', purpose: 'preview', content: '<!doctype html><html><head></head><body><main>Hello</main></body></html>' },
      { path: 'styles.css', language: 'css', purpose: 'styles', content: 'main{display:grid;gap:12px}' }
    ]
  }, { framework: 'HTML_CSS', styling: 'PLAIN_CSS' }, 800, 600);
  assert.match(html, /ui-studio-capture/);
  assert.match(html, /XMLSerializer/);
  assert.match(html, /width:800px/);
  assert.match(html, /main\{display:grid;gap:12px\}/);
});

test('Phase 4 pixel metrics are deterministic and reward exact matches', () => {
  const visual = require('../src/services/uiStudioVisualService');
  const exactA = Buffer.from([10,20,30,255, 40,50,60,255, 70,80,90,255, 100,110,120,255]);
  const exactB = Buffer.from(exactA);
  const measured = visual.imageMetrics(exactA, exactB, 2, 2);
  assert.equal(measured.metrics.pixelScore, 100);
  assert.equal(measured.metrics.colorScore, 100);
  assert.equal(measured.metrics.mismatchPercent, 0);
  assert.equal(measured.diff.length, 16);

  const different = Buffer.from([255,255,255,255, 255,255,255,255, 255,255,255,255, 255,255,255,255]);
  const worse = visual.imageMetrics(exactA, different, 2, 2);
  assert.ok(worse.metrics.pixelScore < 100);
  assert.ok(worse.metrics.mismatchPercent > 0);
});

test('Phase 4 routes are protected and preview/capture/repair endpoints are present', () => {
  const routes = read('src/routes/adminRoutes.js');
  assert.match(routes, /ui-studio\/projects\/:projectId\/render', requireSuperAdmin, uiStudio\.prepareRender/);
  assert.match(routes, /ui-studio\/renders\/:renderId\/preview', uiStudio\.renderPreview/);
  assert.match(routes, /ui-studio\/renders\/:renderId\/capture'[\s\S]*?requireSuperAdmin/);
  assert.match(routes, /ui-studio\/renders\/:renderId\/repair', requireSuperAdmin, uiStudio\.repairRender/);
  assert.match(routes, /limit: '30mb'/);
});

test('Phase 4 preview response uses a network-denying CSP', () => {
  const controller = read('src/controllers/uiStudioController.js');
  assert.match(controller, /connect-src 'none'/);
  assert.match(controller, /object-src 'none'/);
  assert.match(controller, /frame-src 'none'/);
  assert.match(controller, /Cache-Control', 'private, no-store/);
});

test('Phase 4 admin provides side-by-side visual comparison and automatic repair controls', () => {
  const html = read('public/index.html');
  const js = read('public/ui-studio.js');
  const css = read('public/ui-studio.css');
  assert.match(html, /id="uiStudioRenderBtn"/);
  assert.match(html, /id="uiStudioAutoRepair"/);
  assert.match(html, /id="uiStudioVisualOutput"/);
  assert.match(js, /async function startVisualCompare/);
  assert.match(js, /async function uploadVisualCapture/);
  assert.match(js, /async function repairAndRepeat/);
  assert.match(js, /window\.addEventListener\('message', handlePreviewMessage\)/);
  assert.match(css, /\.ui-studio-compare-grid/);
  assert.match(css, /\.ui-studio-match-score/);
});

test('Phase 4 keeps generated code isolated from UGC and production deployment', () => {
  const visual = read('src/services/uiStudioVisualService.js');
  assert.doesNotMatch(visual, /ugcStudioService|ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
  assert.doesNotMatch(visual, /create_pull_request|deployment\/railway-postgres|railway up|landing-next\//);
  assert.match(visual, /spawnSync/);
  assert.match(visual, /sandboxed|visual previews|Preview/);
});
