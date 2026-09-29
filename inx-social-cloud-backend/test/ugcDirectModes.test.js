const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const studio = require('../src/services/ugcStudioService');
const adapters = require('../src/services/ugcProviderAdapters');

test('direct UGC aspect ratios use H3 Max supported 768p dimensions', () => {
  assert.deepEqual(studio.aspectRatioDimensions('9:16'), { aspectRatio: '9:16', width: 768, height: 1344 });
  assert.deepEqual(studio.aspectRatioDimensions('1:1'), { aspectRatio: '1:1', width: 768, height: 768 });
  assert.deepEqual(studio.aspectRatioDimensions('16:9'), { aspectRatio: '16:9', width: 1344, height: 768 });

  const cap = adapters.getAdapter('H3_MAX_STANDARD_V1');
  const task = adapters.buildTask(cap, {
    prompt: 'A realistic podcast guest speaking naturally.',
    providerDuration: 10,
    references: ['data:image/jpeg;base64,abc'],
    aspectRatio: '16:9',
    promptExpansion: 'disabled'
  });
  assert.equal(task.width, 1344);
  assert.equal(task.height, 768);
  assert.equal(task.settings.promptExpansion, 'disabled');
});

test('Production direct mode can use H3 Max without a visual reference', () => {
  const cap = adapters.getAdapter('H3_MAX_STANDARD_V1');
  assert.doesNotThrow(() => adapters.validateContext(cap, {
    kind: 'CREATOR',
    providerDuration: 10,
    prompt: 'Direct production prompt',
    references: []
  }));
  const task = adapters.buildTask(cap, {
    prompt: 'Direct production prompt',
    providerDuration: 10,
    references: [],
    aspectRatio: '9:16',
    promptExpansion: 'disabled'
  });
  assert.equal(task.inputs, undefined);
  assert.equal(task.width, 768);
  assert.equal(task.height, 1344);
});

test('podcast mode stays avatar-explainer even without creator-library selection', () => {
  assert.equal(
    studio.resolveCampaignType({ sourceType: 'BRIEF', customMode: 'PODCAST', creatorMode: 'NONE', campaignType: 'AUTO' }, null, []),
    'AVATAR_EXPLAINER'
  );
});

test('direct prompt captions can extract explicit spoken dialogue without rewriting it', () => {
  const script = studio.extractDirectDialogue('Podcast setup.\nDialogue: “This is the exact line I want spoken.”');
  assert.equal(script, 'This is the exact line I want spoken.');
});

test('Production and Podcast have deliberately different customer controls', () => {
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  assert.match(wizard, /customMode === 'PRODUCTION' && <div className="mt-5">/);
  assert.match(wizard, /PRODUCTION PROMPT GENERATOR — OPTIONAL/);
  assert.match(wizard, /generateUGCProductionPrompt/);
  assert.match(wizard, /customMode === 'PODCAST' && <div className="mt-5">/);
  assert.match(wizard, /PODCAST CHARACTERS/);
  assert.match(wizard, /directMode \? 4 : steps\.length/);
  assert.match(wizard, /\['brand','avatar'\]\.includes\(step\.key\)/);
  assert.match(wizard, /uploadPodcastCharacters/);
  assert.match(wizard, /multiple character|one or more guest/i);
  assert.match(wizard, /CAPTIONS/);
  assert.match(wizard, /ASPECT RATIO/);
});

test('Podcast uploaded characters satisfy the backend requirement directly', () => {
  const controller = read('src/controllers/ugcStudioController.js');
  const service = read('src/services/ugcStudioService.js');
  assert.match(controller, /characterAssetIds/);
  assert.match(controller, /!value\.characterAssetIds\.length/);
  assert.doesNotMatch(controller, /customMode === 'PODCAST' && value\.creatorMode === 'NONE'/);
  assert.match(service, /podcastDirect \? characterAssetIds : productAssetIds/);
  assert.match(service, /creatorMode: 'NONE'/);
  assert.match(service, /PODCAST_CHARACTERS/);
});

test('direct modes bypass Creative Director while assisted UGC keeps it', () => {
  const service = read('src/services/ugcStudioService.js');
  assert.match(service, /mode === 'PRODUCTION'[\s\S]{0,160}return productionPromptPlan/);
  assert.match(service, /mode === 'PODCAST'[\s\S]{0,160}return podcastPromptPlan/);
  assert.match(service, /function productionPromptPlan/);
  assert.match(service, /function podcastPromptPlan/);
  assert.match(service, /return ugcSkills\.planCampaign/);
  assert.match(service, /creativeDirectorBypassed: true/);
});

test('caption choice is persisted instead of being hard-coded on', () => {
  const service = read('src/services/ugcStudioService.js');
  assert.match(service, /Boolean\(input\.captionsEnabled\)/);
  assert.match(service, /captionsEnabled: input\.captionsEnabled !== false/);
  assert.match(service, /if \(ad\.captionsEnabled\)/);
});
