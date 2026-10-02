const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Stage 6 persists the exact progressively revealed review graph', () => {
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
  assert.match(workspace, /revealedPostIdsRef/);
  assert.match(workspace, /saveCreativeFlowReviewReveal/);
});

test('Stage 6 reconciles render review and handoff state when a project reopens', () => {
  const service = read('src/services/creativeFlowProjectService.js');

  assert.match(service, /async function reconcileProjectState/);
  assert.match(service, /renderCampaignId/);
  assert.match(service, /handoffCampaignId/);
  assert.match(service, /workflow\.review\.selectedPostIds\.filter/);
  assert.match(service, /workflow\.review\.revealedPostIds\.filter/);
  assert.match(service, /workflow\.canvas\.creativePositions/);
  assert.match(service, /activeJobType = 'CREATIVE_RENDER'/);
  assert.match(service, /currentStage = 'RENDER_READY'/);
  assert.match(service, /currentStage = 'RENDER_PARTIAL'/);
  assert.match(service, /return reconcileProjectState\(userId, projectId/);
});

test('Stage 6 can safely retry only missing generated creatives under the project job lock', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');

  assert.match(runtime, /async function retryMissingGeneration/);
  assert.match(runtime, /creativeFlow\.retryCreativeFlowRender/);
  assert.match(runtime, /jobType: 'CREATIVE_RENDER'/);
  assert.match(runtime, /queueRenderMonitor/);
  assert.match(controller, /retryCreativeFlowMissing/);
  assert.match(routes, /retry-missing/);
  assert.match(api, /retryCreativeFlowMissing/);
});

test('Stage 6 review offers select-all clear and missing-render recovery without creating another page', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /Creative Flow · Stage 6/);
  assert.match(workspace, /Select all ready/);
  assert.match(workspace, /Clear selection/);
  assert.match(workspace, /Retry \{missingPosts\.length\} missing creative/);
  assert.match(workspace, /selectAllReadyCreatives/);
  assert.match(workspace, /clearCreativeSelection/);
  assert.match(workspace, /retryMissingCreatives/);
  assert.match(workspace, /scheduleCampaign/);
});

test('Stage 6 restores review focus to the latest creative and schedule branch', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /project\.workflow\.review\.revealedPostIds\.length/);
  assert.match(workspace, /lastRevealed/);
  assert.match(workspace, /creativeNodeId\(lastRevealed\)/);
  assert.match(workspace, /project\.workflow\.review\.selectedPostIds\.length \? \['scheduleCampaign'\]/);
});

test('Stage 6 keeps recovery state inside the existing project model', () => {
  const schema = read('prisma/schema.prisma');

  assert.doesNotMatch(schema, /model CreativeFlowRecovery/);
  assert.doesNotMatch(schema, /model CreativeFlowReview/);
});
