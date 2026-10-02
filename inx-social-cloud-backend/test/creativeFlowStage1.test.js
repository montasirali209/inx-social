const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Legacy Creative Flow engine remains available underneath the Project Hub rebuild', () => {
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const modal = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');
  const canvas = read('frontend/src/components/ai-content-studio/CreativeFlowCanvas.tsx');

  assert.match(page, /CreativeFlowProjectLaunchCard/);
  assert.match(page, /CreativeFlowProjectHubModal/);
  assert.match(modal, /CreativeFlowCanvas/);
  assert.match(canvas, /Product source/);
  assert.match(canvas, /Campaign brief/);
  assert.match(canvas, /Platforms/);
  assert.match(canvas, /Creative strategy/);
  assert.match(canvas, /Generate creatives/);
  assert.match(canvas, /Review campaign/);
  assert.match(canvas, /strokeDasharray/);
  assert.match(canvas, /Drag nodes/);
  assert.match(canvas, /Advanced options/);
  assert.match(canvas, /Run Creative Flow/);
  assert.match(canvas, /Stage 4 preview/);
  assert.match(modal, /Stage 4 preview/);
  assert.match(modal, /Creative matrix/);
  assert.match(modal, /Send .* approved to Bulk Scheduler/);
});

test('Creative Flow planning remains source-grounded before paid rendering', () => {
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const service = read('src/services/creativeFlowService.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');

  assert.match(routes, /\/creative-flow\/analyze/);
  assert.match(routes, /\/creative-flow\/strategy/);
  assert.match(controller, /creativeFlowService\.analyzeCreativeFlow/);
  assert.match(controller, /creativeFlowService\.planCreativeFlow/);
  assert.match(service, /postStudio\.fetchUrlContext/);
  assert.match(service, /postStudio\.performSourceAnalysis/);
  assert.match(service, /postStudio\.buildBrandPack/);
  assert.match(service, /Never invent features, prices, statistics, testimonials/);
  assert.match(service, /Concepts must be materially different/);
  assert.match(service, /Do not repeat angles or hooks already used/);
  assert.match(service, /valid json object/);
  assert.match(api, /creative-flow\/analyze/);
  assert.match(api, /creative-flow\/strategy/);
});

test('Creative Flow Stage 3 still creates persistent background image campaigns with credit preflight', () => {
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const service = read('src/services/creativeFlowService.js');
  const campaign = read('src/services/aiPostCampaignService.js');
  const modal = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');

  assert.match(routes, /\/creative-flow\/render/);
  assert.match(routes, /\/creative-flow\/render\/:campaignId\/retry/);
  assert.match(routes, /\/creative-flow\/render\/:campaignId\/posts\/:postId\/regenerate/);
  assert.match(controller, /creativeFlowService\.startCreativeFlowRender/);
  assert.match(controller, /creativeFlowService\.retryCreativeFlowRender/);
  assert.match(controller, /creativeFlowService\.regenerateCreativeFlowPost/);

  assert.match(service, /requiredCredits = concepts\.length \* postStudio\.IMAGE_CREDITS/);
  assert.match(service, /CREATIVE_FLOW_CREDITS_INSUFFICIENT/);
  assert.match(service, /status: 'GENERATING_IMAGES'/);
  assert.match(service, /campaignService\.queueCampaignRender/);
  assert.match(service, /creativeFlow:\s*\{/);
  assert.match(service, /referenceAssetIds/);

  assert.match(campaign, /creativeFlowReferenceIds/);
  assert.match(campaign, /referenceAssetIds: creativeFlowReferenceIds/);
  assert.match(campaign, /isCreativeFlow \? 2 : 3/);
  assert.match(campaign, /setTimeout\(resolve, 450\)/);

  assert.match(modal, /Generate .* credits/);
  assert.match(modal, /saved directly to Media Library/);
  assert.match(modal, /background queue/);
});

test('Stage 3 review still supports preview, retry and paid per-creative regeneration', () => {
  const service = read('src/services/creativeFlowService.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const modal = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');

  assert.match(service, /regenerateCreativeFlowPost/);
  assert.match(service, /retryCreativeFlowRender/);
  assert.match(service, /publicCreativeFlowCampaign/);
  assert.match(api, /regenerateCreativeFlowPost/);
  assert.match(api, /retryCreativeFlowRender/);
  assert.match(modal, /RenderWorkspace/);
  assert.match(modal, /Retry \{missing\} missing/);
  assert.match(modal, /Regenerate · \{campaign\.creativeFlow\.creditsPerCreative\}/);
  assert.match(modal, /Open creative/);
  assert.match(modal, /max-h-\[92dvh\]/);
});

test('Stage 4 converts only approved completed creatives into a standard campaign', () => {
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const service = read('src/services/creativeFlowService.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const modal = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');

  assert.match(routes, /\/creative-flow\/render\/:campaignId\/handoff/);
  assert.match(controller, /handoffCreativeFlowCampaign/);
  assert.match(service, /approvedPostIds/);
  assert.match(service, /Only completed image creatives can be sent to Bulk Scheduler/);
  assert.match(service, /handoffSource/);
  assert.match(service, /sourceCampaignId/);
  assert.match(service, /contentMode: 'IMAGE'/);
  assert.match(service, /status: 'READY'/);
  assert.match(service, /lastHandoff/);
  assert.match(api, /handoffCreativeFlowCampaign/);
  assert.match(modal, /Approve all/);
  assert.match(modal, /approvedPostIds/);
  assert.match(modal, /Send .* approved to Bulk Scheduler/);
  assert.match(modal, /navigate\('\/bulk-scheduler'/);
});

test('Stage 4 hands off but does not auto-publish or own scheduler controls', () => {
  const service = read('src/services/creativeFlowService.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const modal = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');
  const combined = service + controller + modal;

  assert.doesNotMatch(service, /publishBulk|sendDraftToPosts|ScheduleJob|socialPublication/);
  assert.doesNotMatch(controller, /creativeFlowService\.(?:publish|schedule)/);
  assert.match(modal, /Bulk Scheduler keeps control of accounts, dates, times, ordering, scheduling and cancellations/);
  assert.match(modal, /Creative Flow does not auto-publish/);
});
