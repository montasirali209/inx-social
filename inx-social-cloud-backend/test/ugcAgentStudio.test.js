const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const studioService = require('../src/services/ugcStudioService');

test('UGC Agent v2 uses the reasoning model and existing campaign engine', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /UGC_AGENT_VERSION = 'ugc-agent-v2'/);
  assert.match(studio, /async function ugcAgentReply/);
  assert.match(studio, /await analyzeBrand\(userId/);
  assert.match(studio, /postStudio\.callChatModel\(postStudio\.REASONING_MODEL/);
  assert.match(studio, /reasoningEffort: 'medium'/);
  assert.match(studio, /await estimateCampaign\(userId, plan\)/);
  assert.doesNotMatch(studio, /ugcAgentReply[\s\S]{0,10000}runware\.generate/i);
});

test('UGC Agent accepts bare product domains as URLs', () => {
  assert.ok(studioService.brandUrlCandidates('example.com/product').length);
});

test('UGC Agent lets the model own discovery instead of repeating the old canned intake question', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /Behave like a capable conversational creative producer/);
  assert.match(studio, /website promotion/);
  assert.match(studio, /Read the WHOLE conversation before replying/);
  assert.doesNotMatch(studio, /reply = 'What are we advertising\? Paste a product or business URL/);
  assert.match(studio, /const modelReady = parsed\?\.readyToGenerate === true/);
});

test('reference-image confirmation is enforced only after the conversational plan is otherwise ready', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /ugcAgentReferenceDecisionKnown/);
  assert.match(studio, /const referencePending = Boolean\(modelReady && hasProductContext/);
  assert.match(studio, /Use the website references/);
  assert.match(studio, /const readyToGenerate = Boolean\(modelReady && hasProductContext && !referencePending\)/);
});

test('UGC Agent endpoint remains authenticated through the existing Studio route stack', () => {
  const controller = read('src/controllers/ugcStudioController.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const api = read('frontend/src/lib/ugc-studio-api.ts');
  assert.match(controller, /service\.ugcAgentReply\(req\.user\.id/);
  assert.match(routes, /router\.post\('\/ugc\/agent', ugcController\.agentReply\)/);
  assert.match(api, /sendUGCAgentMessage/);
});

test('UGC home launcher routes directly into the wizard instead of a chat conversation', () => {
  const hero = read('frontend/src/components/ai-content-studio/UGCAgentHero.tsx');
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  assert.match(hero, /What do you want to create\?/);
  assert.match(hero, /draftFromPrompt/);
  assert.match(hero, /Customize everything manually/);
  assert.match(home, /onStart=\{\(draft\) => onCreate\(undefined, draft\)\}/);
  assert.doesNotMatch(home, /<UGCAgentModal/);
  assert.doesNotMatch(home, /agentOpen/);
  assert.doesNotMatch(home, /featured\.slice\(0, 100\)/);
});

test('creator portraits are deferred to the focused picker instead of the Studio home', () => {
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  assert.doesNotMatch(home, /fetchUGCAvatarImage/);
  assert.match(home, /Open creator selection/);
  assert.match(wizard, /creatorPickerOpen/);
  assert.match(wizard, /Portraits load only while this picker is open/);
  assert.match(wizard, /visibleCreators = showAllCreators \? filteredCreators : filteredCreators\.slice\(0, 12\)/);
});

test('advanced UGC setup remains available as the manual customization route', () => {
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  assert.match(page, /ugcWizardDraft/);
  assert.match(page, /seedDraft=\{ugcWizardDraft\}/);
  assert.match(wizard, /seedDraft\?: Partial<CreateUGCCampaignInput>/);
});

test('Studio opening is lightweight and scrolling is contained inside the modal', () => {
  const css = read('frontend/src/components/ai-content-studio/ugc-studio-home.css');
  assert.match(css, /animation:ugc-home-panel-in-fast \.22s/);
  assert.match(css, /translate3d\(0,8px,0\) scale\(\.994\)/);
  assert.match(css, /\.ugc-home-body\{[^\n]*overscroll-behavior-y:contain/);
  assert.match(css, /-webkit-overflow-scrolling:touch/);
  assert.match(css, /content-visibility:auto/);
});

test('creator capacity remains ready for 100 uploaded featured creators without changing the seeded set', () => {
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  const studio = read('src/services/ugcStudioService.js');
  assert.match(home, />100\+<\/strong>/);
  assert.match(home, /100\+ available/);
  assert.match(studio, /FEATURED_AVATAR_LIMIT = 100/);
  assert.match(studio, /FEATURED_AVATAR_COUNT = 20/);
});


test('UGC provider prompt is always valid for Runware videoInference', () => {
  const adapters = require('../src/services/ugcProviderAdapters');
  assert.equal(adapters.providerPrompt(''), 'Natural creator-led UGC scene.');
  assert.equal(adapters.providerPrompt('x'), 'Natural creator-led UGC scene.');
  assert.equal(adapters.providerPrompt('  valid prompt  '), 'valid prompt');
  assert.equal(adapters.providerPrompt('a'.repeat(2500)).length, 2000);
});
