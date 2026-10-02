const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Stage 4 keeps strategy internal and does not grow extra strategy or generation boxes', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.doesNotMatch(workspace, /id: 'creativeStrategy'/);
  assert.doesNotMatch(workspace, /id: 'generateCreatives'/);
  assert.match(workspace, /Generate Campaign/);
  assert.match(workspace, /source: 'productIntelligence'/);
  assert.match(workspace, /target: creativeNodeId\(post\.id\)/);
});

test('Stage 4 strategy is a project-owned background job and resumes after restart', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiContentStudioController.js');

  assert.match(routes, /\/creative-flow\/projects\/:projectId\/strategy/);
  assert.match(controller, /startCreativeFlowStrategy/);
  assert.match(runtime, /jobType: 'CAMPAIGN_GENERATION'/);
  assert.match(runtime, /processStrategyPlanning/);
  assert.match(runtime, /creativeFlow\.planCreativeFlow/);
  assert.match(runtime, /saveStrategyPlan/);
  assert.match(runtime, /jobType: 'CREATIVE_RENDER'/);
  assert.match(runtime, /'PRODUCT_ANALYSIS', 'STRATEGY_PLANNING', 'CAMPAIGN_GENERATION', 'CREATIVE_RENDER'/);
});

test('Stage 4 persists concept selection and locks upstream state once generation starts', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');

  assert.match(service, /selectedConceptSequences/);
  assert.match(service, /async function saveStrategySelection/);
  assert.match(service, /CREATIVE_FLOW_UPSTREAM_LOCKED/);
  assert.match(routes, /strategy-selection/);
  assert.match(api, /saveCreativeFlowStrategySelection/);
});

test('Stage 4 preflights credits and launches a persistent project-linked render', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const service = read('src/services/creativeFlowService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(routes, /generation-estimate/);
  assert.match(routes, /\/creative-flow\/projects\/:projectId\/campaign-generate/);
  assert.match(service, /async function estimateCreativeFlowRender/);
  assert.match(service, /projectId: clean\(input\.projectId/);
  assert.match(runtime, /jobType: 'CREATIVE_RENDER'/);
  assert.match(runtime, /creativeFlow\.startCreativeFlowRender/);
  assert.match(runtime, /linkRenderCampaign/);
  assert.match(runtime, /queueRenderMonitor/);
  assert.match(workspace, /Generate Campaign/);
  assert.match(workspace, /credits per completed creative/);
  assert.match(workspace, /getCreativeFlowGenerationEstimate\(project\.id, creativeCount\)/);
});

test('Stage 4 render progress stays project-owned and recovers after server restart', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const service = read('src/services/creativeFlowProjectService.js');

  assert.match(runtime, /recoverLinkedCampaign/);
  assert.match(runtime, /analysisJson: \{ contains:/);
  assert.match(runtime, /monitorRender/);
  assert.match(runtime, /currentStage: 'RENDER_READY'/);
  assert.match(runtime, /currentStage: 'RENDER_PARTIAL'/);
  assert.match(runtime, /renderCampaignId/);
  assert.match(service, /generation: \{/);
  assert.match(service, /plannedCredits/);
  assert.match(service, /creditsPerCreative/);
});

test('Stage 4 motion architecture remains intact while hidden strategy skips straight to creative review', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /Creative Flow · Stage 6/);
  assert.match(workspace, /CreativeFlowMotionSlot/);
  assert.match(workspace, /CreativeAssetNode/);
  assert.match(workspace, /source: 'productIntelligence'/);
  assert.match(workspace, /target: creativeNodeId\(post\.id\)/);
  assert.match(workspace, /defaultEdgeOptions=\{\{ zIndex: 6 \}\}/);
});
