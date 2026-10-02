const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Stage 3 keeps Campaign Setup inside Product Intelligence instead of growing another node', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /function ProductIntelligenceNode/);
  assert.match(workspace, /Campaign Setup/);
  assert.match(workspace, /Set up this campaign/);
  assert.match(workspace, /campaign-setup-inline/);
  assert.match(workspace, /Campaign setup saved/);
  assert.match(workspace, /Creative Strategy can now grow from this same Product Intelligence node/);
  assert.doesNotMatch(workspace, /id: 'campaignSetup'/);
  assert.doesNotMatch(workspace, /function CampaignSetupNode/);
});

test('Stage 3 campaign controls live inside the node instead of a sidebar', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /Campaign goal/);
  assert.match(workspace, /Platforms/);
  assert.match(workspace, /How many creatives/);
  assert.match(workspace, /Advanced options/);
  assert.match(workspace, /Creative style/);
  assert.match(workspace, /Audience direction/);
  assert.match(workspace, /\[5, 10, 20, 50\]/);
  assert.match(workspace, /Custom creative count/);
  assert.match(workspace, /saveCreativeFlowCampaignSetup/);
  assert.match(workspace, /There is no settings sidebar/);
});

test('Stage 3 campaign setup is project-persisted and validates product analysis first', () => {
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const service = read('src/services/creativeFlowProjectService.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');

  assert.match(routes, /\/creative-flow\/projects\/:projectId\/campaign-setup/);
  assert.match(controller, /creativeFlowCampaignSetupSchema/);
  assert.match(controller, /saveCreativeFlowCampaignSetup/);
  assert.match(service, /async function saveCampaignSetup/);
  assert.match(service, /CREATIVE_FLOW_PRODUCT_ANALYSIS_REQUIRED/);
  assert.match(service, /currentStage: 'CAMPAIGN_READY'/);
  assert.match(service, /creativeCount: Math\.max\(1, Math\.min\(50/);
  assert.match(api, /saveCreativeFlowCampaignSetup/);
});

test('Changing product inputs invalidates downstream Product Intelligence before a new campaign can proceed', () => {
  const service = read('src/services/creativeFlowProjectService.js');

  assert.match(service, /workflow\.analysis = null/);
  assert.match(service, /status: 'DRAFT'/);
  assert.match(service, /currentStage: 'PROJECT_CREATED'/);
});

test('Stage 3 preserves legacy canvas schema while no longer persisting a separate Campaign Setup node', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(service, /campaignSetup: \{ x: 1280, y: 215 \}/);
  assert.match(service, /campaignSetup: cleanPosition/);
  assert.match(controller, /campaignSetup: creativeFlowPositionSchema\.optional\(\)/);
  assert.match(api, /campaignSetup: \{ x: number; y: number \}/);
  assert.doesNotMatch(workspace, /campaignSetup: byId\.get\('campaignSetup'\)/);
});

test('Stage 3 continues to use the motion system rather than introducing a separate page', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /Creative Flow · Stage 6/);
  assert.match(workspace, /CreativeFlowMotionSlot/);
  assert.match(workspace, /gsap\.fromTo/);
  assert.match(workspace, /MotionEdge/);
  assert.match(workspace, /source: 'productIntelligence'[\s\S]*target: 'creativeStrategy'/);
});
