const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Stage 5 expands completed renders into individual progressive creative child nodes', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /function buildReviewGraph/);
  assert.match(workspace, /type: 'creativeAsset'/);
  assert.match(workspace, /source: 'generateCreatives'/);
  assert.match(workspace, /revealedPostIds/);
  assert.match(workspace, /revealScheduledRef/);
  assert.match(workspace, /index \* 190/);
  assert.match(workspace, /CreativeAssetNode/);
  assert.match(workspace, /Creative \{String\(post\.sequence\)\.padStart/);
});

test('Stage 5 supports single or multi selection and grows Schedule Campaign from selected creatives', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(service, /review: \{/);
  assert.match(service, /selectedPostIds/);
  assert.match(service, /async function saveReviewSelection/);
  assert.match(routes, /review-selection/);
  assert.match(workspace, /type: 'scheduleCampaign'/);
  assert.match(workspace, /source: creativeNodeId\(post\.id\)/);
  assert.match(workspace, /target: 'scheduleCampaign'/);
  assert.match(workspace, /toggleCreativeSelection/);
});

test('Stage 5 individual regeneration is project-owned and restart resumable', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const project = read('src/services/creativeFlowProjectService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');

  assert.match(runtime, /jobType: 'CREATIVE_REGENERATE'/);
  assert.match(runtime, /jobId: String\(postId\)/);
  assert.match(runtime, /processCreativeRegeneration/);
  assert.match(runtime, /queueCreativeRegeneration/);
  assert.match(runtime, /'CREATIVE_REGENERATE'\]/);
  assert.match(project, /activeJobId: project\.activeJobId \|\| null/);
  assert.match(routes, /posts\/:postId\/regenerate/);
});

test('Stage 5 keeps the previous image safe while edited regeneration runs', () => {
  const service = read('src/services/creativeFlowService.js');
  const runtime = read('src/services/creativeFlowProjectRuntime.js');

  assert.match(service, /async function editCreativeFlowPost/);
  assert.match(service, /data: \{ \.\.\.data, updatedAt: new Date\(\) \}/);
  assert.doesNotMatch(service.match(/async function editCreativeFlowPost[\s\S]*?async function removeCreativeFlowPost/)?.[0] || '', /mediaAssetId: null/);
  assert.match(runtime, /editCreativeFlowPost/);
  assert.match(runtime, /regenerateCreativeFlowPost/);
});

test('Stage 5 pins failures to the exact creative node with expressive retry state', () => {
  const project = read('src/services/creativeFlowProjectService.js');
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(project, /failedPostId/);
  assert.match(project, /failedPostError/);
  assert.match(project, /async function markReviewFailure/);
  assert.match(runtime, /markReviewFailure/);
  assert.match(runtime, /clearReviewFailure/);
  assert.match(workspace, /regenerationFailed/);
  assert.match(workspace, /state=\{motionState\}/);
  assert.match(workspace, /Retry creative/);
});

test('Stage 5 creative review retains regeneration removal and project-owned controls under the Stage 6 compact UI', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  const service = read('src/services/creativeFlowService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');

  assert.match(workspace, /Regenerate/);
  assert.match(workspace, /Optional direction for the next version/);
  assert.match(workspace, /removeCreative\(postId\)/);
  assert.doesNotMatch(workspace, /CreativeAssetEditor/);
  assert.match(service, /async function removeCreativeFlowPost/);
  assert.match(routes, /delete\('\/creative-flow\/projects\/:projectId\/posts\/:postId'/);
});

test('Stage 5 project handoff reuses the existing Bulk Scheduler campaign path', () => {
  const controller = read('src/controllers/aiContentStudioController.js');
  const project = read('src/services/creativeFlowProjectService.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(controller, /handoffCreativeFlowCampaign/);
  assert.match(controller, /linkHandoffCampaign/);
  assert.match(project, /currentStage: 'HANDOFF_READY'/);
  assert.match(api, /handoffCreativeFlowProject/);
  assert.match(workspace, /navigate\('\/bulk-scheduler', \{ state: \{ aiCampaignId: response\.campaign\.id \} \}\)/);
  assert.match(workspace, /Continue to Bulk Scheduler/);
});

test('Stage 5 does not add another database model for review state', () => {
  const schema = read('prisma/schema.prisma');
  const project = read('src/services/creativeFlowProjectService.js');

  assert.doesNotMatch(schema, /model CreativeFlowReview/);
  assert.match(project, /workflowJson/);
  assert.match(project, /review: \{/);
});


test('Stage 5 review state remains compatible while Stage 6 owns fixed final-node positioning', () => {
  const project = read('src/services/creativeFlowProjectService.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(project, /creativePositions: \{\}/);
  assert.match(project, /schedulePosition: null/);
  assert.match(controller, /creativePositions: z\.record\(creativeFlowPositionSchema\)/);
  assert.match(api, /creativePositions: Record<string, \{ x: number; y: number \}>/);
  assert.match(workspace, /creativePositions: \{\}/);
  assert.match(workspace, /schedulePosition: null/);
  assert.match(workspace, /draggable: false/);
});
