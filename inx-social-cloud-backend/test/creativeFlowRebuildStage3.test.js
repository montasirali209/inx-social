const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Stage 3 grows Campaign Setup only after Product Intelligence exists', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /analysis\) \{[\s\S]*id: 'productIntelligence'/);
  assert.match(workspace, /id: 'campaignSetup'/);
  assert.match(workspace, /source: 'productIntelligence'/);
  assert.match(workspace, /target: 'campaignSetup'/);
  assert.match(workspace, /Campaign Setup/);
  assert.match(workspace, /Ready for strategy/);
  assert.match(workspace, /Stage 3 stops here/);
  assert.doesNotMatch(workspace, /Creative Strategy/);
  assert.doesNotMatch(workspace, /Generate creatives/);
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

test('Stage 3 persists Campaign Setup node position with the same project canvas', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(service, /campaignSetup: \{ x: 1280, y: 215 \}/);
  assert.match(service, /campaignSetup: cleanPosition/);
  assert.match(controller, /campaignSetup: creativeFlowPositionSchema\.optional\(\)/);
  assert.match(api, /campaignSetup: \{ x: number; y: number \}/);
  assert.match(workspace, /campaignSetup: byId\.get\('campaignSetup'\)/);
});

test('Stage 3 continues to use the motion system rather than introducing a separate page', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /Creative Flow · Stage 3/);
  assert.match(workspace, /CreativeFlowMotionSlot/);
  assert.match(workspace, /gsap\.fromTo/);
  assert.match(workspace, /MotionEdge/);
  assert.match(workspace, /active: !campaignReady/);
});
