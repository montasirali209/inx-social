const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Stage 6 persists progressive review reveal state', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(service, /revealedPostIds/);
  assert.match(service, /async function saveReviewReveal/);
  assert.match(controller, /saveCreativeFlowReviewReveal/);
  assert.match(routes, /review-reveal/);
  assert.match(api, /saveCreativeFlowReviewReveal/);
  assert.match(workspace, /initialProject\.workflow\.review\.revealedPostIds/);
  assert.match(workspace, /saveCreativeFlowReviewReveal/);
});

test('Stage 6 reconciles render review and handoff state after reopen', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  assert.match(service, /async function reconcileProjectState/);
  assert.match(service, /renderCampaignId/);
  assert.match(service, /handoffCampaignId/);
  assert.match(service, /workflow\.review\.selectedPostIds\.filter/);
  assert.match(service, /workflow\.review\.revealedPostIds\.filter/);
  assert.match(service, /RENDER_READY/);
  assert.match(service, /RENDER_PARTIAL/);
});

test('Stage 6 retries only missing creatives under the project lock', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');

  assert.match(runtime, /async function retryMissingGeneration/);
  assert.match(runtime, /creativeFlow\.retryCreativeFlowRender/);
  assert.match(runtime, /jobType: 'CREATIVE_RENDER'/);
  assert.match(routes, /retry-missing/);
  assert.match(api, /retryCreativeFlowMissing/);
});

test('Stage 6 review offers selection recovery and a full creative preview', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /Select all/);
  assert.match(workspace, /Clear selection/);
  assert.match(workspace, /retryMissingCreatives/);
  assert.match(workspace, /function CreativePreviewModal/);
  assert.match(workspace, /Open image/);
  assert.match(workspace, /scheduleCampaign/);
});

test('Stage 6 keeps every final creative fixed in a four-column review graph', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  assert.match(workspace, /project\.workflow\.review\.revealedPostIds\.length/);
  assert.match(workspace, /const column = index % 4/);
  assert.match(workspace, /const row = Math\.floor\(index \/ 4\)/);
  assert.match(workspace, /draggable: false/);
});

test('Stage 6 Creative Flow image rendering stays OpenAI-only high quality', () => {
  const campaign = read('src/services/aiPostCampaignService.js');
  const studio = read('src/services/aiPostStudioServiceV2.js');
  const wrapper = read('src/services/aiPostStudioService.js');

  assert.match(campaign, /quality: isCreativeFlow \? 'high' : 'medium'/);
  assert.match(campaign, /postStudio\.generateImagePost/);
  assert.doesNotMatch(campaign, /runware/i);
  assert.match(studio, /provider: 'openai'/);
  assert.match(studio, /async function openAIImage/);
  assert.doesNotMatch(studio, /runware/i);
  assert.match(wrapper, /creative-flow-production-v3/);
  assert.match(wrapper, /buildCreativeFlowProductionBrief/);
});

test('Stage 6 disables pasted logo headers and pasted dashboard cards for Creative Flow', () => {
  const wrapper = read('src/services/aiPostStudioService.js');

  assert.match(wrapper, /lockLogo: false/);
  assert.match(wrapper, /useExactProductVisual: false/);
  assert.match(wrapper, /standalone logo (?:strip|band)/i);
  assert.match(wrapper, /pasted logo header/i);
  assert.match(wrapper, /duplicate product UI/i);
});

test('Stage 6 archived projects remain recoverable', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const hub = read('frontend/src/components/ai-content-studio/CreativeFlowProjectHubModal.tsx');

  assert.match(service, /archivedProjects/);
  assert.match(service, /async function restoreProject/);
  assert.match(routes, /projects\/:projectId\/restore/);
  assert.match(api, /restoreCreativeFlowProject/);
  assert.match(hub, /Archived projects/);
  assert.match(hub, /Restore/);
});
