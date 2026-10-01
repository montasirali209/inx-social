const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Creative Flow keeps the connected visual workflow while Stage 2 adds real planning', () => {
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const modal = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');
  const canvas = read('frontend/src/components/ai-content-studio/CreativeFlowCanvas.tsx');

  assert.match(page, /CreativeFlowLaunchCard/);
  assert.match(page, /CreativeFlowModal/);
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
  assert.match(canvas, /Stage 2 preview/);
  assert.match(modal, /Stage 2 strategy ready/);
  assert.match(modal, /Creative matrix/);
  assert.match(modal, /Continue to generation · Stage 3/);
});

test('Creative Flow Stage 2 uses real authenticated product analysis and strategy endpoints', () => {
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const service = read('src/services/creativeFlowService.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');
  const modal = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');

  assert.match(routes, /\/creative-flow\/analyze/);
  assert.match(routes, /\/creative-flow\/strategy/);
  assert.match(controller, /creativeFlowService\.analyzeCreativeFlow/);
  assert.match(controller, /creativeFlowService\.planCreativeFlow/);
  assert.match(controller, /creativeCount: z\.number\(\)\.int\(\)\.min\(1\)\.max\(50\)/);
  assert.match(service, /postStudio\.fetchUrlContext/);
  assert.match(service, /postStudio\.performSourceAnalysis/);
  assert.match(service, /postStudio\.buildBrandPack/);
  assert.match(service, /postStudio\.callChatModel/);
  assert.match(service, /MAX_CONCEPTS = 50/);
  assert.match(api, /creative-flow\/analyze/);
  assert.match(api, /creative-flow\/strategy/);
  assert.match(modal, /uploadPostStudioReference/);
  assert.match(modal, /analyzeCreativeFlow/);
  assert.match(modal, /planCreativeFlow/);
});

test('Creative Flow Stage 2 grounds claims and plans distinct concepts before rendering', () => {
  const service = read('src/services/creativeFlowService.js');
  const modal = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');

  assert.match(service, /Never invent features, prices, statistics, testimonials/);
  assert.match(service, /verified_source\|user_brief\|brand_safe_generic/);
  assert.match(service, /Concepts must be materially different/);
  assert.match(service, /Do not repeat angles or hooks already used/);
  assert.match(service, /strongestAngles/);
  assert.match(service, /claimGuardrails/);

  assert.match(modal, /Verified claims/);
  assert.match(modal, /Guardrails/);
  assert.match(modal, /Extracted palette/);
  assert.match(modal, /brand\.lockLogo/);
  assert.match(modal, /Every card has a different strategic angle/);
});

test('Stage 2 does not render media, charge credits, publish or write to Media Library', () => {
  const service = read('src/services/creativeFlowService.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const modal = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');
  const combined = service + modal;

  assert.doesNotMatch(service, /aiCreditService|credits\.reserve|credits\.complete|credits\.refund/);
  assert.doesNotMatch(service, /runware/i);
  assert.doesNotMatch(service, /generateImagePost|generateConversationalImagePost|images\/generations/);
  assert.doesNotMatch(service, /mediaLibrary|publish|BulkScheduler/);
  assert.doesNotMatch(controller, /creativeFlowService\.(?:generate|publish)/);
  assert.doesNotMatch(combined, /sendDraftToPosts|publishBulk|createAIPostCampaign/);
  assert.match(modal, /Image generation and campaign handoff remain disabled until Stage 3|Rendering stays disabled until Stage 3/);
});
