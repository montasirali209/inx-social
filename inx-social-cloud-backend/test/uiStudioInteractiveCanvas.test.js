'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('responsive preview is a real pan zoom and scrollable review canvas', () => {
  const js = read('public/ui-studio.js');
  const css = read('public/ui-studio.css');
  const html = read('public/index.html');

  assert.match(html, /Responsive review canvas/);
  assert.match(js, /data-ui-canvas-mode="PAN"/);
  assert.match(js, /data-ui-canvas-mode="SELECT"/);
  assert.match(js, /data-ui-canvas-mode="INTERACT"/);
  assert.match(js, /id="uiStudioCanvasZoomOut"/);
  assert.match(js, /id="uiStudioCanvasZoomIn"/);
  assert.match(js, /id="uiStudioCanvasFit"/);
  assert.match(js, /id="uiStudioCanvasActual"/);
  assert.match(js, /id="uiStudioCanvasCentre"/);
  assert.match(js, /function fitCanvas/);
  assert.match(js, /stage\.scrollLeft/);
  assert.match(js, /stage\.scrollTop/);
  assert.match(css, /\.ui-studio-canvas-stage\{[\s\S]*overflow:auto/);
  assert.match(css, /\.ui-studio-canvas-pan-shield/);
  assert.match(css, /height:clamp\(560px,68vh,820px\)/);
});

test('sandbox preview bridge supports selection live edits and internal page scrolling', () => {
  const service = read('src/services/uiStudioResponsivePreviewService.js');

  assert.match(service, /function editorBridgeMarkup/);
  assert.match(service, /ui-studio-editor-selected/);
  assert.match(service, /ui-studio-editor-inline-edit/);
  assert.match(service, /ui-studio-editor-update/);
  assert.match(service, /ui-studio-editor-batch/);
  assert.match(service, /ui-studio-editor-reset/);
  assert.match(service, /MODE==="SELECT"/);
  assert.match(service, /INTERACT/);
  assert.match(service, /overflow:auto!important/);
  assert.match(service, /contenteditable/);
  assert.match(service, /parent\.postMessage/);
});

test('canvas properties can edit text links and common visual styles live', () => {
  const js = read('public/ui-studio.js');

  assert.match(js, /id="uiStudioCanvasText"/);
  assert.match(js, /id="uiStudioCanvasHref"/);
  assert.match(js, /data-ui-canvas-style/);
  for (const style of [
    'fontSize','fontWeight','color','backgroundColor','borderRadius','padding','lineHeight','textAlign'
  ]) assert.match(js, new RegExp("canvasStyleField\\('" + style + "'"));
  assert.match(js, /This viewport only/);
  assert.match(js, /All responsive sizes/);
  assert.match(js, /function recordCanvasEdit/);
  assert.match(js, /postCanvasMessage/);
});

test('pending canvas edits survive viewport switching until apply or discard', () => {
  const js = read('public/ui-studio.js');

  assert.match(js, /canvasEdits: \{ DESKTOP: \{\}, TABLET: \{\}, MOBILE: \{\} \}/);
  assert.match(js, /function pendingCanvasEdits/);
  assert.match(js, /state\.canvasSelected = null/);
  assert.match(js, /state\.canvasFitPending = true/);
  assert.match(js, /function discardCanvasEdits/);
  assert.match(js, /ui-studio-editor-batch/);
});

test('Apply changes commits canvas edits into a validated new generation', () => {
  const js = read('public/ui-studio.js');
  const routes = read('src/routes/adminRoutes.js');
  const controller = read('src/controllers/uiStudioController.js');
  const codegen = read('src/services/uiStudioCodegenService.js');

  assert.match(js, /async function applyCanvasEditsToCode/);
  assert.match(js, /\/canvas-edits/);
  assert.match(routes, /projects\/:projectId\/canvas-edits/);
  assert.match(controller, /async function applyCanvasEdits/);
  assert.match(codegen, /async function applyCanvasEdits/);
  assert.match(codegen, /MANUAL_CANVAS_EDIT/);
  assert.match(codegen, /validateGenerationBuild\(edited, project\)/);
  assert.match(codegen, /parentGenerationId: inputGeneration\.id/);
});

test('committing canvas edits invalidates previous match approval and production code', () => {
  const codegen = read('src/services/uiStudioCodegenService.js');

  assert.match(codegen, /status: 'CANVAS_EDITED'/);
  assert.match(codegen, /bestGenerationId: null/);
  assert.match(codegen, /acceptedGenerationId: null/);
  assert.match(codegen, /productionGenerationId: null/);
  assert.match(codegen, /bestAggregateScore: null/);
  assert.match(codegen, /acceptedAt: null/);
  assert.match(codegen, /productionGeneratedAt: null/);
});

test('interactive canvas remains isolated from UGC generation implementation', () => {
  for (const file of [
    'public/ui-studio.js',
    'src/services/uiStudioResponsivePreviewService.js',
    'src/services/uiStudioCodegenService.js'
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /ugcStudioService|ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
  }
});

test('responsive preview iframe survives ordinary workspace rerenders', () => {
  const js = read('public/ui-studio.js');

  assert.match(js, /function responsivePreviewKey/);
  assert.match(js, /function preserveResponsivePreviewCanvas/);
  assert.match(js, /shell\.dataset\.previewKey !== previewKey/);
  assert.match(js, /if \(preserveResponsivePreviewCanvas\(output, previewKey\)\) return/);
  assert.match(js, /frame\.dataset\.previewKey === previewKey && frame\.getAttribute\('src'\)/);
  assert.match(js, /setTimeout\(retryIfUnready, 5000\)/);
  assert.match(js, /frame\.dataset\.retryCount = '1'/);
});

test('interactive canvas asset cache is bumped', () => {
  const html = read('public/index.html');
  assert.match(html, /ui-studio\.css\?v=11/);
  assert.match(html, /ui-studio\.js\?v=11/);
});
