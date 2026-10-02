const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Stage 2 uses the agreed motion architecture inside the project workspace', () => {
  const pkg = read('frontend/package.json');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  const motion = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowMotion.tsx');

  assert.match(pkg, /"@xyflow\/react": "12\.12\.0"/);
  assert.match(pkg, /"gsap": "3\.15\.0"/);
  assert.match(pkg, /"@rive-app\/react-canvas": "4\.36\.0"/);

  assert.match(workspace, /ReactFlowProvider/);
  assert.match(workspace, /panOnDrag/);
  assert.match(workspace, /Controls/);
  assert.match(workspace, /Background/);
  assert.match(workspace, /MotionEdge/);
  assert.match(workspace, /animateMotion/);
  assert.match(workspace, /gsap\.timeline|gsap\.fromTo/);

  assert.match(motion, /useRive/);
  assert.match(motion, /useStateMachineInput/);
  assert.match(motion, /CreativeFlowMotionState/);
  assert.match(motion, /working.*success.*error/s);
  assert.match(motion, /GSAP fallback|FallbackMotion/);
});

test('Stage 2 begins with only product URL, product images and analyse controls', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /id: 'productUrl'/);
  assert.match(workspace, /id: 'productImages'/);
  assert.match(workspace, /id: 'analyzeProduct'/);
  assert.match(workspace, /running && !analysis/);
  assert.match(workspace, /id: 'analysisProcess'/);
  assert.match(workspace, /id: 'productIntelligence'/);
  assert.doesNotMatch(workspace, /Campaign Setup/);
  assert.doesNotMatch(workspace, /Creative Strategy/);
  assert.doesNotMatch(workspace, /Generate 20/);
});

test('Stage 2 source nodes are direct controls with friendly URL normalisation and immediate image persistence', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const projectService = read('src/services/creativeFlowProjectService.js');

  assert.match(workspace, /example\.com is enough/);
  assert.match(workspace, /No need to type https:\/\//);
  assert.match(workspace, /uploadPostStudioReference/);
  assert.match(workspace, /saved immediately/);
  assert.match(workspace, /saveCreativeFlowProjectSource/);

  assert.match(routes, /\/creative-flow\/projects\/:projectId\/source/);
  assert.match(controller, /saveCreativeFlowProjectSource/);
  assert.match(projectService, /async function saveProductSource/);
  assert.match(projectService, /workflow\.analysis = null/);
});

test('Stage 2 analysis is project-owned, background-safe and restart-resumable', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const server = read('src/server.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');

  assert.match(routes, /\/creative-flow\/projects\/:projectId\/analyze/);
  assert.match(runtime, /claimActiveJob/);
  assert.match(runtime, /jobType: 'PRODUCT_ANALYSIS'/);
  assert.match(runtime, /queueProductAnalysis/);
  assert.match(runtime, /setImmediate/);
  assert.match(runtime, /saveProductAnalysis/);
  assert.match(runtime, /currentStage: 'PRODUCT_READY'/);
  assert.match(runtime, /PRODUCT_ANALYSIS_FAILED/);
  assert.match(runtime, /activeJobType: 'PRODUCT_ANALYSIS'/);
  assert.match(server, /startCreativeFlowProjectRuntime/);
});

test('Stage 2 restores workflow nodes and canvas position from persisted project state', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  const hub = read('frontend/src/components/ai-content-studio/CreativeFlowProjectHubModal.tsx');

  assert.match(service, /defaultCanvas/);
  assert.match(service, /saveCanvasState/);
  assert.match(service, /workflowJson/);
  assert.match(api, /getCreativeFlowProject/);
  assert.match(api, /saveCreativeFlowProjectCanvas/);
  assert.match(workspace, /defaultViewport=\{project\.workflow\.canvas\.viewport\}/);
  assert.match(workspace, /onNodeDragStop/);
  assert.match(workspace, /onMoveEnd/);
  assert.match(hub, /max-w-\[calc\(100vw-1rem\)\]/);
});
