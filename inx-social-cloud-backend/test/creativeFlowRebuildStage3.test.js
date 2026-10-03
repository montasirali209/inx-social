const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Stage 3 keeps the entire campaign decision inside Product Intelligence', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /function ProductIntelligenceNode/);
  assert.match(workspace, />Campaign</);
  assert.match(workspace, /Generate Campaign/);
  assert.match(workspace, /Calculating campaign credits/);
  assert.doesNotMatch(workspace, /id: 'campaignSetup'/);
  assert.doesNotMatch(workspace, /function CampaignSetupNode/);
  assert.doesNotMatch(workspace, /id: 'creativeStrategy'/);
  assert.doesNotMatch(workspace, /id: 'generateCreatives'/);
});

test('Stage 3 campaign controls and live credit plan live inside the same card', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /Campaign goal/);
  assert.match(workspace, /Platforms/);
  assert.match(workspace, /How many creatives/);
  assert.match(workspace, /Advanced options/);
  assert.match(workspace, /Creative style/);
  assert.match(workspace, /Audience direction/);
  assert.match(workspace, /\[5, 10, 20, 50\]/);
  assert.match(workspace, /getCreativeFlowGenerationEstimate\(project\.id, creativeCount\)/);
  assert.match(workspace, /generationEstimate\.requiredCredits/);
  assert.match(workspace, /generateCreativeFlowCampaign/);
});

test('Stage 3 one-click campaign generation remains project-persisted and validated', () => {
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const service = read('src/services/creativeFlowProjectService.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');

  assert.match(routes, /campaign-generate/);
  assert.match(controller, /generateCreativeFlowCampaign/);
  assert.match(controller, /creativeFlowCampaignSetupSchema/);
  assert.match(service, /async function saveCampaignSetup/);
  assert.match(service, /CREATIVE_FLOW_PRODUCT_ANALYSIS_REQUIRED/);
  assert.match(api, /generateCreativeFlowCampaign/);
});

test('Changing product inputs invalidates downstream Product Intelligence', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  assert.match(service, /workflow\.analysis = null/);
  assert.match(service, /status: 'DRAFT'/);
  assert.match(service, /currentStage: 'PROJECT_CREATED'/);
});

test('Stage 3 uses built-in visible React Flow edges rather than a custom hidden edge layer', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  assert.match(workspace, /type: 'smoothstep'/);
  assert.match(workspace, /defaultEdgeOptions=\{\{ type: 'smoothstep', zIndex: 8/);
  assert.match(workspace, /makeEdge/);
  assert.doesNotMatch(workspace, /MotionEdge/);
});
