'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('UI Studio Phase 3 persists versioned responsive code generations', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260927224500_add_ui_studio_codegen/migration.sql');
  assert.match(schema, /model UiDesignGeneration/);
  assert.match(schema, /generations\s+UiDesignGeneration\[\]/);
  assert.match(schema, /generationJson\s+String\?/);
  assert.match(schema, /validationJson\s+String\?/);
  assert.match(migration, /CREATE TABLE "UiDesignGeneration"/);
  assert.match(migration, /sourceAnalysisId/);
  assert.match(migration, /ON DELETE CASCADE/);
});

test('UI Studio Phase 3 schema returns implementation files, media slots and responsive strategy', () => {
  const codegen = require('../src/services/uiStudioCodegenService');
  const schema = codegen.generationSchema();
  assert.ok(schema.properties.files);
  assert.ok(schema.properties.entryFile);
  assert.ok(schema.properties.componentTree);
  assert.ok(schema.properties.assetSlots);
  assert.ok(schema.properties.responsiveStrategy);
  assert.equal(schema.properties.files.maxItems, codegen.MAX_FILES);
});

test('UI Studio Phase 3 normalizes unsafe paths and validates raw source bundles', () => {
  const codegen = require('../src/services/uiStudioCodegenService');
  const project = { framework: 'REACT_TYPESCRIPT', styling: 'TAILWIND', outputType: 'SECTION' };
  const normalized = codegen.normalizeGeneration({
    summary: 'Faithful section',
    entryFile: '../unsafe.tsx',
    files: [
      { path: '../unsafe.tsx', language: 'tsx', purpose: 'unsafe', content: 'bad' },
      { path: 'components/Hero.tsx', language: 'tsx', purpose: 'entry', content: 'export default function Hero(){return <section className="grid md:grid-cols-2">Hi</section>}' },
      { path: 'components/Hero.tsx', language: 'tsx', purpose: 'duplicate', content: 'duplicate' }
    ],
    componentTree: ['Hero'],
    assetSlots: [],
    responsiveStrategy: { desktop: [], tablet: [], mobile: [], breakpoints: [] },
    usageNotes: [],
    warnings: []
  }, project);
  assert.equal(normalized.files.length, 1);
  assert.equal(normalized.entryFile, 'components/Hero.tsx');
  assert.equal(normalized.files[0].path, 'components/Hero.tsx');
  const validation = codegen.validateGeneration(normalized);
  assert.ok(validation.passed >= 6);
  assert.equal(validation.checks.find(item => item.key === 'NO_SCREENSHOT_EMBED').ok, true);
});

test('UI Studio Phase 3 code generation uses Phase 2 references but does not persist derived images', () => {
  const service = read('src/services/uiStudioCodegenService.js');
  assert.match(service, /prepareReferenceImages/);
  assert.match(service, /type: 'input_image'/);
  assert.match(service, /type: 'json_schema'/);
  assert.match(service, /sourceAnalysisId/);
  assert.doesNotMatch(service, /persistBuffer\(/);
});

test('UI Studio Phase 3 routes protect generation mutations with Super Admin role', () => {
  const routes = read('src/routes/adminRoutes.js');
  assert.match(routes, /ui-studio\/projects\/:projectId\/generate', requireSuperAdmin, uiStudio\.generate/);
  assert.match(routes, /ui-studio\/generations\/:generationId', uiStudio\.generation/);
});

test('UI Studio keeps internal preview generation but exposes source files only after approval', () => {
  const html = read('public/index.html');
  const js = read('public/ui-studio.js');
  const css = read('public/ui-studio.css');
  assert.match(html, /id="uiStudioFinalizeCodeBtn"/);
  assert.doesNotMatch(html, /id="uiStudioGenerateBtn"/);
  assert.match(html, /id="uiStudioCodegenOutput"/);
  assert.match(js, /async function generateResponsiveUi/);
  assert.match(js, /async function finalizeProductionCode/);
  assert.match(js, /Code stays hidden until approval/);
  assert.match(js, /uiStudioDownloadBundleBtn/);
  assert.match(js, /uiStudioCopyCodeBtn/);
  assert.match(css, /\.ui-studio-codegen-panel/);
  assert.match(css, /\.ui-studio-code-view/);
});

test('UI Studio Phase 3 remains isolated from UGC generation logic and live page deployment', () => {
  const service = read('src/services/uiStudioCodegenService.js');
  const controller = read('src/controllers/uiStudioController.js');
  assert.doesNotMatch(service, /ugcStudioService|ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
  assert.doesNotMatch(controller, /ugcStudioService|ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
  assert.doesNotMatch(service, /create_pull_request|deployment\/railway-postgres|landing-next/);
});
