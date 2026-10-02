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

test('Stage 6 restores review focus to the complete fixed creative graph and schedule branch', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /project\.workflow\.review\.revealedPostIds\.length/);
  assert.match(workspace, /revealedPostIds\.map\(\(id\) => creativeNodeId\(id\)\)/);
  assert.match(workspace, /project\.workflow\.review\.selectedPostIds\.length \? \['scheduleCampaign'\]/);
  assert.match(workspace, /const column = index % 4/);
  assert.match(workspace, /const row = Math\.floor\(index \/ 4\)/);
  assert.match(workspace, /draggable: false/);
});

test('Stage 6 keeps recovery state inside the existing project model', () => {
  const schema = read('prisma/schema.prisma');

  assert.doesNotMatch(schema, /model CreativeFlowRecovery/);
  assert.doesNotMatch(schema, /model CreativeFlowReview/);
});


test('Stage 6 completed campaigns backfill every review node so requested creatives cannot disappear', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(service, /const persistedReveal = workflow\.review\.revealedPostIds/);
  assert.match(service, /campaign\.status === 'GENERATING_IMAGES'/);
  assert.match(service, /imagePosts\.map\(post => post\.id\)/);
  assert.match(workspace, /finished \|\| revealed\.has\(post\.id\)/);
  assert.match(workspace, /projectQuery\.data\?\.workflow\.review\.revealedPostIds/);
});

test('Stage 6 final creative cards stay compact and selection creates the scheduler branch', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.doesNotMatch(workspace, /CreativeAssetEditor/);
  assert.match(workspace, /Optional direction for the next version/);
  assert.match(workspace, /toggleCreativeSelection\(postId\)/);
  assert.match(workspace, /selectedVisible\.length/);
  assert.match(workspace, /type: 'scheduleCampaign'/);
  assert.match(workspace, /sendSelectedToScheduler/);
});

test('Stage 6 Creative Flow image rendering is OpenAI-only and uses high-quality final renders', () => {
  const campaign = read('src/services/aiPostCampaignService.js');
  const studio = read('src/services/aiPostStudioServiceV2.js');

  assert.match(campaign, /quality: isCreativeFlow \? 'high' : 'medium'/);
  assert.match(campaign, /postStudio\.generateImagePost/);
  assert.doesNotMatch(campaign, /runware/i);
  assert.match(studio, /provider: 'openai'/);
  assert.match(studio, /async function openAIImage/);
  assert.doesNotMatch(studio, /runware/i);
  assert.match(studio, /protected composition zone/);
  assert.match(studio, /safeHeader/);
});

test('Stage 6 archived projects are recoverable instead of disappearing from the project hub', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const hub = read('frontend/src/components/ai-content-studio/CreativeFlowProjectHubModal.tsx');

  assert.match(service, /archivedProjects/);
  assert.match(service, /async function restoreProject/);
  assert.match(controller, /restoreCreativeFlowProject/);
  assert.match(routes, /projects\/:projectId\/restore/);
  assert.match(api, /restoreCreativeFlowProject/);
  assert.match(hub, /Archived projects/);
  assert.match(hub, /Restore/);
  assert.match(hub, /window\.confirm/);
});
