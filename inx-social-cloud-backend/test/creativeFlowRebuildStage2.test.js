const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Stage 2 uses React Flow with built-in high-contrast connectors and shared motion graphics', () => {
  const pkg = read('frontend/package.json');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  const motion = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowMotion.tsx');

  assert.match(pkg, /"@xyflow\/react": "12\.12\.0"/);
  assert.match(pkg, /"gsap": "3\.15\.0"/);
  assert.match(workspace, /ReactFlowProvider/);
  assert.match(workspace, /type: 'smoothstep'/);
  assert.match(workspace, /animated: active/);
  assert.match(workspace, /zIndex: 8/);
  assert.match(workspace, /strokeWidth: active \? 3\.2 : 2\.6/);
  assert.doesNotMatch(workspace, /MotionEdge/);
  assert.match(motion, /CreativeFlowMotionState/);
  assert.match(motion, /ExpressiveMotion/);
});

test('Stage 2 begins with product URL images and analyse controls then grows process nodes', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /id: 'productUrl'/);
  assert.match(workspace, /id: 'productImages'/);
  assert.match(workspace, /id: 'analyzeProduct'/);
  assert.match(workspace, /id: 'analysisSources'/);
  assert.match(workspace, /id: 'analysisEvidence'/);
  assert.match(workspace, /id: 'analysisMeaning'/);
  assert.match(workspace, /id: 'analysisBrand'/);
  assert.match(workspace, /type: 'analysisStep'/);
  assert.match(workspace, /id: 'productIntelligence'/);
  assert.doesNotMatch(workspace, /id: 'creativeStrategy'/);
  assert.doesNotMatch(workspace, /id: 'generateCreatives'/);
});

test('Stage 2 always wires both source nodes into Analyse Product', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /makeEdge\('url-analyze', 'productUrl', 'analyzeProduct'/);
  assert.match(workspace, /makeEdge\('images-analyze', 'productImages', 'analyzeProduct'/);
  assert.match(workspace, /defaultEdgeOptions=\{\{ type: 'smoothstep', zIndex: 8/);
  assert.match(workspace, /edges=\{edges\}/);
});

test('Stage 2 source nodes persist URL and uploaded product references', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const projectService = read('src/services/creativeFlowProjectService.js');

  assert.match(workspace, /example\.com is enough/);
  assert.match(workspace, /uploadPostStudioReference/);
  assert.match(workspace, /saved immediately/);
  assert.match(workspace, /saveCreativeFlowProjectSource/);
  assert.match(routes, /\/creative-flow\/projects\/:projectId\/source/);
  assert.match(controller, /saveCreativeFlowProjectSource/);
  assert.match(projectService, /async function saveProductSource/);
  assert.match(projectService, /workflow\.analysis = null/);
});

test('Stage 2 analysis is project-owned background-safe and restart-resumable', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const server = read('src/server.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');

  assert.match(routes, /\/creative-flow\/projects\/:projectId\/analyze/);
  assert.match(runtime, /claimActiveJob/);
  assert.match(runtime, /jobType: 'PRODUCT_ANALYSIS'/);
  assert.match(runtime, /queueProductAnalysis/);
  assert.match(runtime, /saveProductAnalysis/);
  assert.match(runtime, /PRODUCT_ANALYSIS_FAILED/);
  assert.match(server, /startCreativeFlowProjectRuntime/);
});

test('Stage 2 analysis nodes reveal progressively and converge into Product Intelligence', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const service = read('src/services/creativeFlowService.js');

  assert.match(workspace, /ANALYSIS_STEPS\.slice\(0, analysisStepCount\(project\)\)/);
  assert.match(workspace, /makeEdge\(`\$\{step\.id\}-intelligence`, step\.id, 'productIntelligence'/);
  assert.match(runtime, /progressTotal: 5/);
  assert.match(service, /reportAnalysisProgress/);
  assert.match(service, /Product sources collected and validated/);
  assert.match(service, /Understanding positioning, audience and product meaning/);
  assert.match(service, /Mapping brand, logo, colours and visual identity/);
});
