const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Stage 5 expands completed renders into fixed progressive creative child nodes', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /function reviewGraph/);
  assert.match(workspace, /type: 'creativeAsset'/);
  assert.match(workspace, /'productIntelligence'/);
  assert.match(workspace, /revealedIds/);
  assert.match(workspace, /scheduledRevealRef/);
  assert.match(workspace, /index \* 170/);
  assert.match(workspace, /function CreativeAssetNode/);
  assert.match(workspace, /draggable: false/);
});

test('Stage 5 supports multi selection and grows Schedule Campaign from selected creatives', () => {
  const service = read('src/services/creativeFlowProjectService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(service, /selectedPostIds/);
  assert.match(service, /async function saveReviewSelection/);
  assert.match(routes, /review-selection/);
  assert.match(workspace, /type: 'scheduleCampaign'/);
  assert.match(workspace, /creativeNodeId\(post\.id\), 'scheduleCampaign'/);
  assert.match(workspace, /toggleCreativeSelection/);
});

test('Stage 5 adds a real full-image preview before publishing', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /function CreativePreviewModal/);
  assert.match(workspace, /Open image/);
  assert.match(workspace, /Open original/);
  assert.match(workspace, /Select for publish/);
  assert.match(workspace, /full preview/);
  assert.match(workspace, /event\.key === 'Escape'/);
});

test('Stage 5 individual regeneration remains project-owned and restart resumable', () => {
  const runtime = read('src/services/creativeFlowProjectRuntime.js');
  const project = read('src/services/creativeFlowProjectService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');

  assert.match(runtime, /jobType: 'CREATIVE_REGENERATE'/);
  assert.match(runtime, /processCreativeRegeneration/);
  assert.match(runtime, /queueCreativeRegeneration/);
  assert.match(project, /activeJobId: project\.activeJobId \|\| null/);
  assert.match(routes, /posts\/:postId\/regenerate/);
});

test('Stage 5 compact review supports regeneration direction and removal without exposing backend prompts', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  const service = read('src/services/creativeFlowService.js');

  assert.match(workspace, /Regenerate/);
  assert.match(workspace, /Optional direction/);
  assert.match(workspace, /removeCreative\(postId\)/);
  assert.doesNotMatch(workspace, /CreativeAssetEditor/);
  assert.doesNotMatch(workspace, /Backend prompt/);
  assert.match(service, /async function removeCreativeFlowPost/);
});

test('Stage 5 project handoff reuses Bulk Scheduler', () => {
  const controller = read('src/controllers/aiContentStudioController.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(controller, /handoffCreativeFlowCampaign/);
  assert.match(api, /handoffCreativeFlowProject/);
  assert.match(workspace, /navigate\('\/bulk-scheduler', \{ state: \{ aiCampaignId: response\.campaign\.id \} \}\)/);
  assert.match(workspace, /Continue to Bulk Scheduler/);
});

test('Stage 5 keeps final review node positions deterministic', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  assert.match(workspace, /const column = index % 4/);
  assert.match(workspace, /const row = Math\.floor\(index \/ 4\)/);
  assert.match(workspace, /creativePositions: \{\}/);
  assert.match(workspace, /schedulePosition: null/);
  assert.match(workspace, /draggable: false/);
});
