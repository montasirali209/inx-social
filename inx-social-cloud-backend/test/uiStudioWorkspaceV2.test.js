'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Workspace v2 persists multi-target projects, production finalization and AI Agent history', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260928152000_add_ui_studio_workspace_v2/migration.sql');

  assert.match(schema, /frameworkTargetsJson\s+String\s+@default\("\[\]"\)/);
  assert.match(schema, /stylingTargetsJson\s+String\s+@default\("\[\]"\)/);
  assert.match(schema, /productionGenerationId\s+String\?/);
  assert.match(schema, /productionGeneratedAt\s+DateTime\?/);
  assert.match(schema, /model UiDesignAgentMessage/);
  assert.match(schema, /agentMessages\s+UiDesignAgentMessage\[\]/);
  assert.match(migration, /ADD COLUMN "frameworkTargetsJson"/);
  assert.match(migration, /CREATE TABLE "UiDesignAgentMessage"/);
});

test('Create Project supports broad primary and multi-target framework/style choices without a visible output selector', () => {
  const html = read('public/index.html');

  for (const framework of [
    'REACT_TYPESCRIPT','NEXTJS','HTML_CSS','VUE_TYPESCRIPT','NUXT','SVELTE','SVELTEKIT','ANGULAR','ASTRO','SOLIDJS','REMIX'
  ]) assert.match(html, new RegExp('value="' + framework + '"'));

  for (const styling of [
    'TAILWIND','CSS_MODULES','PLAIN_CSS','SCSS','STYLED_COMPONENTS','EMOTION','BOOTSTRAP','MATERIAL_UI','CHAKRA_UI','UNO_CSS','VANILLA_EXTRACT'
  ]) assert.match(html, new RegExp('value="' + styling + '"'));

  assert.match(html, /id="uiStudioFrameworkTargets"/);
  assert.match(html, /id="uiStudioStylingTargets"/);
  assert.match(html, /id="uiStudioOutputType" type="hidden" value="SECTION"/);
  assert.doesNotMatch(html, /<label[^>]*>Output\s*<select id="uiStudioOutputType"/);
});

test('Workspace presents the product flow rather than implementation phases', () => {
  const html = read('public/index.html');
  const start = html.indexOf('<section class="page hidden ui-studio-page" id="uiStudioPage">');
  const end = html.indexOf('</aside>', start);
  const workspace = html.slice(start, end);

  for (const step of ['Design','Understand','Preview','Match &amp; Refine','Approve','Generate','Deliver']) {
    assert.match(workspace, new RegExp(step.replace(/[&]/g, '&')));
  }
  assert.match(workspace, /id="uiStudioWorkflow"/);
  assert.match(workspace, /id="uiStudioNextActionBtn"/);
  assert.match(workspace, /id="uiStudioApprovePanel"/);
  assert.match(workspace, /id="uiStudioFinalizeCodeBtn"/);
  assert.doesNotMatch(workspace, />Phase [23456]</);
});

test('Preview build stays internal while production code requires explicit approval', () => {
  const production = read('src/services/uiStudioProductionService.js');
  const convergence = read('src/services/uiStudioConvergenceService.js');
  const js = read('public/ui-studio.js');

  assert.match(production, /Approve the best visual match before generating production code/);
  assert.match(production, /compileVerified/);
  assert.match(production, /productionGenerationId/);
  assert.match(convergence, /productionGenerationId: null/);
  assert.match(js, /Internal preview build created\. Production code remains hidden until approval/);
  assert.match(js, /Code stays hidden until approval/);
  assert.match(js, /async function finalizeProductionCode/);
});

test('Deliver requires finalized production code and exports portable project metadata', () => {
  const delivery = read('src/services/uiStudioDeliveryService.js');

  assert.match(delivery, /UI_STUDIO_PHASE6_PRODUCTION_CODE_REQUIRED/);
  assert.match(delivery, /frameworkTargets/);
  assert.match(delivery, /stylingTargets/);
  assert.match(delivery, /productionGeneratedAt/);
  assert.match(delivery, /UI_STUDIO_DELIVERY\.json/);
  assert.match(delivery, /README\.md/);
  assert.match(delivery, /Design -> Understand -> Preview -> Match & Refine -> Approve -> Generate -> Deliver/);
});

test('UI Studio Agent is project-aware, persistent, optional and action-gated', () => {
  const agent = read('src/services/uiStudioAgentService.js');
  const routes = read('src/routes/adminRoutes.js');
  const html = read('public/index.html');
  const js = read('public/ui-studio.js');

  assert.match(agent, /UiDesignAgentMessage|uiDesignAgentMessage/);
  assert.match(agent, /currentStage/);
  assert.match(agent, /GENERATE_CODE/);
  assert.match(agent, /EXPORT_BUNDLE/);
  assert.match(agent, /Recommend at most one action/);
  assert.match(agent, /Do not execute it/);
  assert.match(routes, /agent\/messages/);
  assert.match(html, /id="uiStudioAgentPane"/);
  assert.match(html, /id="uiStudioAgentForm"/);
  assert.match(js, /async function askAgent/);
  assert.match(js, /async function performAgentAction/);
});

test('Workspace v2 is styled as one responsive application and keeps advanced match controls secondary', () => {
  const html = read('public/index.html');
  const css = read('public/ui-studio.css');

  assert.match(html, /Advanced comparison settings/);
  assert.doesNotMatch(html, /Advanced comparison settings<\/summary>[\s\S]{0,20}open/);
  assert.match(css, /UI Studio Workspace v2/);
  assert.match(css, /\.ui-studio-page\.workspace-open \.ui-studio-workspace/);
  assert.match(css, /\.ui-studio-workflow/);
  assert.match(css, /\.ui-studio-stage-bar/);
  assert.match(css, /\.ui-studio-agent-pane/);
  assert.match(css, /\.ui-studio-preview-stage/);
});

test('Workspace v2 changes remain isolated from UGC runtime implementation', () => {
  for (const file of [
    'src/services/uiStudioService.js',
    'src/services/uiStudioProductionService.js',
    'src/services/uiStudioAgentService.js',
    'src/services/uiStudioDeliveryService.js'
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /ugcStudioService|ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
  }
});


test('Create Project modal resets global checkbox sizing and cannot overflow horizontally', () => {
  const css = read('public/ui-studio.css');
  assert.match(css, /#uiStudioCreateDialog\{[\s\S]*width:min\(900px,calc\(100vw - 32px\)\)/);
  assert.match(css, /overflow:hidden/);
  assert.match(css, /input\[type="checkbox"\][\s\S]*width:17px!important/);
  assert.match(css, /input\[type="checkbox"\][\s\S]*min-height:17px!important/);
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test('Workspace polish adds native-feeling stage, dock and empty-canvas motion', () => {
  const css = read('public/ui-studio.css');
  const js = read('public/ui-studio.js');
  const html = read('public/index.html');
  assert.match(css, /UI Studio polish pass/);
  assert.match(css, /\.ui-studio-empty-artboard/);
  assert.match(css, /\.ui-studio-workflow/);
  assert.match(js, /function animateUiStudioElement/);
  assert.match(js, /function animateStageSurface/);
  assert.match(js, /ui-studio-empty-orb/);
  assert.match(html, /ui-studio\.css\?v=8/);
  assert.match(html, /ui-studio\.js\?v=8/);
});
