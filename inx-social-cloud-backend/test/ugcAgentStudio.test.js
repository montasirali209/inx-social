const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const studioService = require('../src/services/ugcStudioService');

test('UGC Agent is versioned and reuses the existing planning, quote and campaign engine', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /UGC_AGENT_VERSION = 'ugc-agent-v1'/);
  assert.match(studio, /async function ugcAgentReply/);
  assert.match(studio, /await analyzeBrand\(userId/);
  assert.match(studio, /postStudio\.callChatModel\(postStudio\.REASONING_MODEL/);
  assert.match(studio, /await estimateCampaign\(userId, plan\)/);
  assert.doesNotMatch(studio, /ugcAgentReply[\s\S]{0,10000}runware\.generate/i);
});

test('UGC Agent accepts bare product domains as URLs', () => {
  assert.ok(studioService.brandUrlCandidates('example.com/product').length);
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /(?:\[a-z0-9-\]\+\\\.\)\+\[a-z\]\{2,\}/i);
});

test('UGC Agent always resolves reference-image intent before generation', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /ugcAgentReferenceDecisionKnown/);
  assert.match(studio, /Do you also have a product or reference image you want me to use/);
  assert.match(studio, /Use the website references/);
  assert.match(studio, /referencePending/);
  assert.match(studio, /readyToGenerate = Boolean\(hasProductContext && !referencePending/);
});

test('UGC Agent endpoint is authenticated through the existing AI Content Studio route stack', () => {
  const controller = read('src/controllers/ugcStudioController.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const api = read('frontend/src/lib/ugc-studio-api.ts');
  assert.match(controller, /service\.ugcAgentReply\(req\.user\.id/);
  assert.match(routes, /router\.post\('\/ugc\/agent', ugcController\.agentReply\)/);
  assert.match(api, /sendUGCAgentMessage/);
  assert.match(api, /\/api\/ai-content-studio\/ugc\/agent/);
});

test('UGC Studio hero uses the Agent while Generate still calls createUGCCampaign', () => {
  const hero = read('frontend/src/components/ai-content-studio/UGCAgentHero.tsx');
  assert.match(hero, /Describe your product, paste a URL/);
  assert.match(hero, /sendUGCAgentMessage/);
  assert.match(hero, /uploadUGCProductAsset/);
  assert.match(hero, /createUGCCampaign/);
  assert.match(hero, /result\.estimate\.credits/);
  assert.match(hero, /Adjust details/);
  assert.match(hero, /startedCampaignId/);
});

test('advanced UGC setup can receive the Agent plan without becoming a second Studio', () => {
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  assert.match(page, /ugcWizardDraft/);
  assert.match(page, /seedDraft=\{ugcWizardDraft\}/);
  assert.match(wizard, /seedDraft\?: Partial<CreateUGCCampaignInput>/);
  assert.match(wizard, /seedDraft\?\.duration/);
  assert.match(wizard, /seedDraft\?\.avatarId/);
});

test('UGC Studio opening animation avoids expensive animated blur and staggered section entrance', () => {
  const css = read('frontend/src/components/ai-content-studio/ugc-studio-home.css');
  assert.match(css, /animation:ugc-home-panel-in \.18s/);
  assert.match(css, /@keyframes ugc-home-panel-in\{from\{opacity:0;transform:/);
  assert.doesNotMatch(css, /@keyframes ugc-home-panel-in[^\n]*filter:blur/);
  assert.doesNotMatch(css, /@keyframes ugc-home-backdrop-in[^\n]*backdrop-filter/);
  assert.doesNotMatch(css, /ugc-home-body>section:nth-child\(5\).*animation-delay/);
  assert.match(css, /@media\(max-width:760px\)\{\.ugc-home-backdrop\{backdrop-filter:none\}/);
});

test('featured creator cards are real actions and Studio is ready for 100 uploaded creators', () => {
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  const studio = read('src/services/ugcStudioService.js');
  assert.match(home, /featured\.slice\(0, 100\)/);
  assert.match(home, />100\+<\/strong>/);
  assert.match(home, /100\+ featured/);
  assert.match(home, /setCreatorChoice\(avatar\)/);
  assert.match(home, /Create an ad with \{creatorChoice\.name\}/);
  assert.match(home, /setAgentCreator\(creatorChoice\)/);
  assert.match(studio, /FEATURED_AVATAR_LIMIT = 100/);
  assert.match(studio, /FEATURED_AVATAR_COUNT = 20/);
});

test('creator selection feeds the same UGC Agent rather than starting provider generation', () => {
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  const hero = read('frontend/src/components/ai-content-studio/UGCAgentHero.tsx');
  assert.match(home, /selectedCreator=\{agentCreator\}/);
  assert.match(hero, /selectedAvatarId/);
  assert.match(hero, /creatorMode: selectedAvatarId \? 'SELECTED' : 'AUTO'/);
  assert.doesNotMatch(home, /runware|videoInference|audioInference/);
});
