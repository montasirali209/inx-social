const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('UGC mobile video lightbox renders above the Studio modal and stops playback on unmount', () => {
  const player = read('frontend/src/components/ai-content-studio/UGCVideoPlayer.tsx');
  const homeCss = read('frontend/src/components/ai-content-studio/ugc-studio-home.css');
  assert.match(homeCss, /ugc-home-backdrop[^}]*z-index:211/);
  assert.match(player, /z-\[360\]/);
  assert.match(player, /video\.pause\(\)/);
  assert.match(player, /video\.currentTime = 0/);
  assert.match(player, /h-\[100dvh\]/);
  assert.match(player, /env\(safe-area-inset-top\)/);
  assert.match(player, /webkitEnterFullscreen/);
});

test('UGC Home mobile layout respects iPhone safe areas and wraps actions', () => {
  const css = read('frontend/src/components/ai-content-studio/ugc-studio-home.css');
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /ugc-home-actions\{flex-wrap:wrap/);
  assert.match(css, /@media\(max-width:430px\)/);
});

test('Every UGC scheduler handoff is video and requires a publishable QC asset', () => {
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  const legacy = read('frontend/src/components/ai-content-studio/UGCStudioPage.tsx');
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  const editor = read('frontend/src/components/ai-content-studio/UGCEditorPage.tsx');

  for (const source of [home, legacy, wizard, editor]) {
    assert.match(source, /contentType: 'VIDEO'/);
    assert.match(source, /qualityControl\?\.publishable/);
  }
  assert.doesNotMatch(home, /contentType: 'IMAGE'/);
  assert.doesNotMatch(legacy, /contentType: 'IMAGE'/);
});

test('UGC local finishing recovery is bounded and never launches another provider scene', () => {
  const runtime = require('../src/services/ugcRuntimePolicy');
  const studio = read('src/services/ugcStudioService.js');
  assert.equal(runtime.LOCAL_FINISH_RETRY_LIMIT, 2);
  assert.match(studio, /failureQC\.recovery\.action === 'REASSEMBLE'/);
  assert.match(studio, /localFinishRecoveryAttempts < ugcRuntimePolicy\.LOCAL_FINISH_RETRY_LIMIT/);
  assert.match(studio, /providerRetry: false/);
  assert.match(studio, /automaticRecovery: 'LOCAL_FINISH'/);
  assert.match(studio, /UPDATE "UGCAd" SET "status"=\\'QUEUED\\'/);
});

test('UGC paid provider costs are persisted before downstream local finishing can fail', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /async function addGenerationProviderCost/);
  assert.match(studio, /providerCostUsd"=COALESCE\("providerCostUsd",0\)\+\$2/);
  assert.match(studio, /await addGenerationProviderCost\(ad\.generationId, narrationCost\)/);
  assert.match(studio, /await addGenerationProviderCost\(ad\.generationId, videoProviderCost\)/);
  assert.match(studio, /await addGenerationProviderCost\(ad\.generationId, lipSyncCost\)/);
  assert.match(studio, /SELECT "reservedCredits","requestJson","providerCostUsd"/);
});

test('Runware transient transport retries reuse the same task objects and polling uses the same task UUID', () => {
  const runware = read('src/services/runwareService.js');
  assert.match(runware, /const attempts = 2/);
  assert.match(runware, /axios\.post\(env\.runware\.baseUrl, tasks/);
  assert.match(runware, /getResponse', taskUUID/);
  assert.match(runware, /pollTask\(taskUUID/);
});

test('OpenAI application defaults remain Luna for chat and Terra for reasoning/search with no Sol hard-code', () => {
  const studio = read('src/services/aiPostStudioServiceV2.js');
  const env = read('src/config/env.js');
  assert.match(studio, /OPENAI_CHAT_MODEL \|\| 'gpt-5\.6-luna'/);
  assert.match(studio, /OPENAI_REASONING_MODEL \|\| process\.env\.OPENAI_MODEL \|\| 'gpt-5\.6-terra'/);
  assert.match(env, /OPENAI_WEB_SEARCH_MODEL \|\| process\.env\.OPENAI_MODEL \|\| 'gpt-5\.6-terra'/);
  assert.doesNotMatch(studio + env, /gpt-5\.6-sol/i);
});
