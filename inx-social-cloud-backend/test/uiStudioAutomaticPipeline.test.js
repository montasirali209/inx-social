'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('single design selection automatically uploads, analyses and prepares responsive preview', () => {
  const html = read('public/index.html');
  const js = read('public/ui-studio.js');

  assert.match(html, /Choose design/);
  assert.match(html, /Select once · upload and analysis start automatically/);
  assert.match(html, /id="uiStudioUploadBtn"[^>]*hidden/);
  assert.match(html, /id="uiStudioPreviewBtn"[^>]*hidden/);
  assert.match(js, /await uploadReference\(\{ autoPipeline: true \}\)/);
  assert.match(js, /async function runAutomaticPipeline/);
  assert.match(js, /await analyseProject\(\{ quiet: true, followExisting: true \}\)/);
  assert.match(js, /await generateResponsiveUi\(true, \{ quiet: true, followExisting: true \}\)/);
  assert.match(js, /Design analysed and responsive preview ready/);
});

test('Analyse is user-facing and no Continue to Understand action remains', () => {
  const html = read('public/index.html');
  const js = read('public/ui-studio.js');

  assert.match(html, /data-ui-stage="UNDERSTAND"><span>2<\/span><b>Analyse<\/b>/);
  assert.doesNotMatch(html, />Understand<\/b>/);
  assert.doesNotMatch(js, /Continue to Understand/);
  assert.match(js, /UNDERSTAND: \['Analyse'/);
});

test('responsive preview uses one generated implementation at desktop tablet and mobile sizes', () => {
  const service = read('src/services/uiStudioResponsivePreviewService.js');
  const routes = read('src/routes/adminRoutes.js');
  const controller = read('src/controllers/uiStudioController.js');
  const js = read('public/ui-studio.js');

  assert.match(service, /DESKTOP:\s*\{ width: 1440, height: 900 \}/);
  assert.match(service, /TABLET:\s*\{ width: 834, height: 1112 \}/);
  assert.match(service, /MOBILE:\s*\{ width: 390, height: 844 \}/);
  assert.match(service, /buildPreviewHtml/);
  assert.doesNotMatch(service, /reference\.viewport\s*===\s*viewport/);
  assert.match(routes, /responsive-preview\/:viewport/);
  assert.match(controller, /async function responsivePreview/);
  assert.match(js, /RESPONSIVE_PREVIEW_SIZES/);
  assert.match(js, /uiStudioResponsivePreviewFrame/);
  assert.match(js, /No separate Desktop, Tablet or Mobile uploads are required/);
});

test('viewport tabs are preview modes rather than required upload targets', () => {
  const js = read('public/ui-studio.js');

  assert.match(js, /const showResponsiveTabs = stage === 'PREVIEW'/);
  assert.match(js, /toggleAttribute\('hidden', !showResponsiveTabs\)/);
  assert.match(js, /if \(\(state\.workflowStage \|\| derivedWorkflowStage\(\)\) === 'PREVIEW'\)/);
  assert.match(js, /state\.viewport = button\.dataset\.uiViewport/);
});

test('analysis and preview generation follow existing running jobs instead of throwing duplicate-job errors', () => {
  const analysis = read('src/services/uiStudioAnalysisService.js');
  const codegen = read('src/services/uiStudioCodegenService.js');
  const controller = read('src/controllers/uiStudioController.js');

  assert.match(analysis, /alreadyRunning:\s*true/);
  assert.match(codegen, /alreadyRunning:\s*true/);
  assert.doesNotMatch(analysis, /A design analysis is already running for this project/);
  assert.doesNotMatch(codegen, /Responsive code generation is already running for this project/);
  assert.match(controller, /result\.alreadyRunning \? 202 : 201/);
});

test('Match and Refine makes exact viewport references optional', () => {
  const html = read('public/index.html');
  const js = read('public/ui-studio.js');

  assert.match(html, /Compare & improve/);
  assert.match(html, /Extra tablet or mobile source designs are optional/);
  assert.match(js, /review canvas/);
  assert.match(js, /uiStudioCanvasStage/);
});

test('automatic responsive preview styles are present and cache is refreshed', () => {
  const css = read('public/ui-studio.css');
  const html = read('public/index.html');

  assert.match(css, /Automatic single-design responsive preview/);
  assert.match(css, /\.ui-studio-canvas-stage/);
  assert.match(css, /\.ui-studio-responsive-loader/);
  assert.match(html, /ui-studio\.css\?v=11/);
  assert.match(html, /ui-studio\.js\?v=11/);
});
