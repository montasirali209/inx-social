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

test('UGC home is a launcher and does not embed the conversation anymore', () => {
  const hero = read('frontend/src/components/ai-content-studio/UGCAgentHero.tsx');
  assert.match(hero, /onOpenAgent/);
  assert.match(hero, /What do you want to create\?/);
  assert.match(hero, /Customize everything manually/);
  assert.doesNotMatch(hero, /sendUGCAgentMessage/);
  assert.doesNotMatch(hero, /createUGCCampaign/);
  assert.doesNotMatch(hero, /ugc-agent-thread/);
});

test('dedicated UGC Agent modal owns chat, references, creator selection and Generate', () => {
  const modal = read('frontend/src/components/ai-content-studio/UGCAgentModal.tsx');
  assert.match(modal, /Message the UGC Agent/);
  assert.match(modal, /sendUGCAgentMessage/);
  assert.match(modal, /uploadUGCProductAsset/);
  assert.match(modal, /creatorPickerOpen/);
  assert.match(modal, /Customize manually/);
  assert.match(modal, /createUGCCampaign/);
  assert.match(modal, /result\.estimate\.credits/);
});

test('home input and creator cards both open the same UGC Agent modal', () => {
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  assert.match(home, /const \[agentOpen, setAgentOpen\]/);
  assert.match(home, /function openAgent/);
  assert.match(home, /<UGCAgentModal/);
  assert.match(home, /onOpenAgent=\{\(prompt\) => openAgent/);
  assert.match(home, /I want to create a UGC ad using/);
  assert.match(home, /featured\.slice\(0, 100\)/);
});

test('advanced UGC setup remains available as the manual customization route', () => {
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  assert.match(page, /ugcWizardDraft/);
  assert.match(page, /seedDraft=\{ugcWizardDraft\}/);
  assert.match(wizard, /seedDraft\?: Partial<CreateUGCCampaignInput>/);
});

test('Studio opening is visibly animated without animated blur and main scrolling avoids nested capture', () => {
  const css = read('frontend/src/components/ai-content-studio/ugc-studio-home.css');
  assert.match(css, /animation:ugc-home-panel-in \.28s/);
  assert.match(css, /translate3d\(0,16px,0\) scale\(\.985\)/);
  assert.doesNotMatch(css, /@keyframes ugc-home-panel-in[^\n]*filter:blur/);
  assert.doesNotMatch(css, /@keyframes ugc-home-backdrop-in[^\n]*backdrop-filter/);
  assert.match(css, /\.ugc-home-body\{[^\n]*overscroll-behavior-y:auto/);
  assert.match(css, /-webkit-overflow-scrolling:touch/);
});

test('creator capacity remains ready for 100 uploaded featured creators without changing the seeded set', () => {
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  const studio = read('src/services/ugcStudioService.js');
  assert.match(home, />100\+<\/strong>/);
  assert.match(home, /100\+ featured/);
  assert.match(studio, /FEATURED_AVATAR_LIMIT = 100/);
  assert.match(studio, /FEATURED_AVATAR_COUNT = 20/);
});
