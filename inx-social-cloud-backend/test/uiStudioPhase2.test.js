'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('UI Studio Phase 2 persists versioned design analysis', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260927221500_add_ui_studio_analysis/migration.sql');
  assert.match(schema, /model UiDesignAnalysis/);
  assert.match(schema, /analyses\s+UiDesignAnalysis\[\]/);
  assert.match(schema, /sourceFingerprint\s+String/);
  assert.match(schema, /analysisJson\s+String\?/);
  assert.match(migration, /CREATE TABLE "UiDesignAnalysis"/);
  assert.match(migration, /ON DELETE CASCADE/);
});

test('UI Studio Phase 2 creates in-memory high-resolution analysis derivatives without changing source bytes', async () => {
  const service = require('../src/services/uiStudioAnalysisService');
  const source = await sharp({
    create: { width: 2600, height: 1400, channels: 4, background: { r: 7, g: 33, b: 42, alpha: 1 } }
  }).png().toBuffer();
  const before = crypto.createHash('sha256').update(source).digest('hex');
  const images = await service.prepareReferenceImages({
    id: 'reference-1',
    viewport: 'DESKTOP',
    width: 2600,
    height: 1400
  }, source, 4);
  const after = crypto.createHash('sha256').update(source).digest('hex');

  assert.equal(before, after);
  assert.ok(images.length >= 2);
  assert.equal(images[0].kind, 'FULL');
  assert.match(images[0].imageUrl, /^data:image\/jpeg;base64,/);
  assert.ok(images.some(item => item.kind === 'TILE'));
});

test('UI Studio analysis schema captures design tokens, viewport geometry, components and responsive plan', () => {
  const service = require('../src/services/uiStudioAnalysisService');
  const schema = service.analysisSchema();
  assert.ok(schema.properties.colorTokens);
  assert.ok(schema.properties.typography);
  assert.ok(schema.properties.spacingScalePx);
  assert.ok(schema.properties.viewportAnalyses);
  assert.ok(schema.properties.responsivePlan);
  assert.ok(schema.properties.implementationPlan);
  const viewport = schema.properties.viewportAnalyses.items;
  assert.ok(viewport.properties.sections);
  assert.ok(viewport.properties.components);
  assert.ok(viewport.properties.components.items.properties.boundsPct);
});

test('UI Studio analysis uses multimodal structured Responses API and keeps derivatives out of R2', () => {
  const service = read('src/services/uiStudioAnalysisService.js');
  assert.match(service, /\/responses/);
  assert.match(service, /type: 'input_image'/);
  assert.match(service, /detail: 'high'/);
  assert.match(service, /type: 'json_schema'/);
  assert.match(service, /getBuffer\(/);
  assert.doesNotMatch(service, /persistBuffer\(/);
});

test('UI Studio Phase 2 admin route is Super Admin protected', () => {
  const routes = read('src/routes/adminRoutes.js');
  assert.match(routes, /ui-studio\/projects\/:projectId\/analyse', requireSuperAdmin, uiStudio\.analyse/);
});

test('UI Studio admin exposes analysis controls, result panel and region overlay', () => {
  const html = read('public/index.html');
  const js = read('public/ui-studio.js');
  const css = read('public/ui-studio.css');
  assert.match(html, /id="uiStudioAnalyseBtn"/);
  assert.match(html, /id="uiStudioAnalysisResult"/);
  assert.match(html, /id="uiStudioOverlayBtn"/);
  assert.match(js, /async function analyseProject/);
  assert.match(js, /currentViewportAnalysis/);
  assert.match(js, /ui-studio-region/);
  assert.match(css, /\.ui-studio-region/);
  assert.match(css, /\.ui-studio-analysis-result/);
});

test('UI Studio analysis is isolated from the UGC generation implementation', () => {
  const service = read('src/services/uiStudioAnalysisService.js');
  const controller = read('src/controllers/uiStudioController.js');
  assert.doesNotMatch(service, /ugcStudioService|ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
  assert.doesNotMatch(controller, /ugcStudioService|ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
});
