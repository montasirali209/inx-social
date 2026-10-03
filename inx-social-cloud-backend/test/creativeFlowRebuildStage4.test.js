const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Stage 4 keeps strategy internal and does not grow extra decision boxes', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.doesNotMatch(workspace, /id: 'creativeStrategy'/);
  assert.doesNotMatch(workspace, /id: 'generateCreatives'/);
  assert.match(workspace, /Generate Campaign/);
  assert.match(workspace, /'productIntelligence'/);
  assert.match(workspace, /creativeNodeId\(post\.id\)/);
});

test('Stage 4 strategy remains a project-owned background job and auto-chains into render', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');

  assert.match(routes, /campaign-generate/);
  assert.match(controller, /generateCreativeFlowCampaign/);
  assert.match(runtime, /jobType: 'CAMPAIGN_GENERATION'/);
  assert.match(runtime, /processStrategyPlanning/);
  assert.match(runtime, /creativeFlow\.planCreativeFlow/);
  assert.match(runtime, /saveStrategyPlan/);
  assert.match(runtime, /jobType: 'CREATIVE_RENDER'/);
  assert.match(runtime, /queueRenderStart/);
});

test('Stage 4 preflights credits and launches a persistent project-linked render', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const service = read('src/services/creativeFlowService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(routes, /generation-estimate/);
  assert.match(service, /async function estimateCreativeFlowRender/);
  assert.match(service, /projectId: clean\(input\.projectId/);
  assert.match(runtime, /creativeFlow\.startCreativeFlowRender/);
  assert.match(runtime, /linkRenderCampaign/);
  assert.match(runtime, /queueRenderMonitor/);
  assert.match(workspace, /Generate Campaign/);
  assert.match(workspace, /generationEstimate\.creditsPerCreative/);
  assert.match(workspace, /getCreativeFlowGenerationEstimate\(project\.id, creativeCount\)/);
});

test('Stage 4 render progress stays project-owned and recovers after restart', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const service = read('src/services/creativeFlowProjectService.js');

  assert.match(runtime, /recoverLinkedCampaign/);
  assert.match(runtime, /monitorRender/);
  assert.match(runtime, /RENDER_READY/);
  assert.match(runtime, /RENDER_PARTIAL/);
  assert.match(runtime, /renderCampaignId/);
  assert.match(service, /plannedCredits/);
  assert.match(service, /creditsPerCreative/);
});

test('Stage 4 renders generated creative edges directly from Product Intelligence', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /function reviewGraph/);
  assert.match(workspace, /`product-\$\{post\.id\}`/);
  assert.match(workspace, /'productIntelligence'/);
  assert.match(workspace, /creativeNodeId\(post\.id\)/);
  assert.match(workspace, /type: 'flow'/);
  assert.match(workspace, /function FlowingEdge/);
});
