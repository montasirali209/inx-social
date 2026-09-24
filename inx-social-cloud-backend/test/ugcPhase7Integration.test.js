const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 7 render QC is versioned and exposed through UGC health/overview', () => {
  const qc = read('src/services/ugcRenderQuality.js');
  const studio = read('src/services/ugcStudioService.js');
  const engine = read('src/services/ugcEngineService.js');
  assert.match(qc, /RENDER_QUALITY_VERSION = 'ugc-render-qc-v1'/);
  assert.match(studio, /renderQualityVersion: ugcRenderQuality\.RENDER_QUALITY_VERSION/);
  assert.match(engine, /renderQualityVersion: renderQuality\.RENDER_QUALITY_VERSION/);
});

test('Phase 7 isolates an exact failed scene instead of leaving it rendering', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /UPDATE "UGCScene" SET "status"=\'FAILED\'/);
  assert.match(studio, /sceneError\.sceneId = scene\.id/);
  assert.match(studio, /failedSceneIds: failureQC\.recovery\.sceneIds/);
});

test('Phase 7 gates assembly on ready stored scenes and validates final MP4 output', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /ugcRenderQuality\.assertAssemblyReady\(ad, readyScenes\)/);
  assert.match(studio, /ugcRenderQuality\.validateFinalBuffer\(finalVideo\)/);
  assert.match(studio, /qualityControlVersion: ugcRenderQuality\.RENDER_QUALITY_VERSION/);
});

test('Phase 7 supports zero-credit reassembly without touching paid generation credits', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /async function createAssemblyGenerationRow/);
  assert.match(studio, /reservedCredits","createdAt"/);
  assert.match(studio, /async function reassembleAd/);
  assert.match(studio, /reassembly: true/);
  assert.match(studio, /if \(generationCredits > 0\) await credits\.complete/);
  assert.match(studio, /if \(generationCredits > 0\) await credits\.refund/);
  assert.match(studio, /reservedCredits != null \? Number/);
});

test('Phase 7 exposes the reassembly API through controller, route and client', () => {
  const controller = read('src/controllers/ugcStudioController.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const api = read('frontend/src/lib/ugc-studio-api.ts');
  assert.match(controller, /service\.reassembleAd/);
  assert.match(routes, /\/ugc\/ads\/:adId\/reassemble/);
  assert.match(api, /reassembleUGCAd/);
});

test('Phase 7 editor is QC-driven and keeps paid regeneration separate from free assembly', () => {
  const editor = read('frontend/src/components/ai-content-studio/UGCEditorPage.tsx');
  assert.match(editor, /qualityControl = ad\?\.qualityControl/);
  assert.match(editor, /needsReassembly/);
  assert.match(editor, /Reassemble final video · 0 credits/);
  assert.match(editor, /NEEDS RETRY/);
  assert.match(editor, /qualityControl\?\.publishable/);
  assert.match(editor, /Regenerate full ad/);
});

test('Phase 7 marks voice/creator changes as scene-impacting before selective regeneration', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /input\.voice !== undefined \|\| input\.voicePrompt !== undefined/);
  assert.match(studio, /"kind" IN \(\'CREATOR\',\'CTA\'\).*\'EDITED\'/);
});

test('Phase 7 publishing handoff identifies UGC assets as video and requires publishability', () => {
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  const editor = read('frontend/src/components/ai-content-studio/UGCEditorPage.tsx');
  const types = read('frontend/src/types/ugc-studio.ts');
  assert.match(wizard, /contentType: 'VIDEO'/);
  assert.match(editor, /contentType: 'VIDEO'/);
  assert.match(types, /contentType: 'VIDEO'/);
  assert.match(wizard, /qualityControl\?\.publishable/);
  assert.match(editor, /qualityControl\?\.publishable/);
});

test('Phase 7 preserves pricing, router, Creator V2, Phase 5 grammar and Phase 6 controls', () => {
  const studio = read('src/services/ugcStudioService.js');
  const router = read('src/services/ugcModelRouter.js');
  const creators = read('src/services/ugcCreatorEngine.js');
  const formats = read('src/services/ugcCreativeFormats.js');
  const controls = read('src/services/ugcStudioControls.js');
  assert.match(studio, /STANDARD_CREDITS = Object\.freeze\(\{ 15: 100, 20: 140, 30: 210 \}\)/);
  assert.match(studio, /PREMIUM_CREDITS = Object\.freeze\(\{ 15: 180, 20: 260, 30: 390 \}\)/);
  assert.match(router, /ROUTER_VERSION = 'ugc-router-v1'/);
  assert.match(creators, /CREATOR_PROFILE_VERSION = 'ugc-creators-v2'/);
  assert.match(formats, /CREATIVE_FORMAT_VERSION = 'ugc-formats-v1'/);
  assert.match(controls, /STUDIO_CONTROLS_VERSION = 'ugc-studio-controls-v1'/);
});

test('Phase 7 requires no database migration', () => {
  const qc = read('src/services/ugcRenderQuality.js');
  assert.doesNotMatch(qc, /ALTER TABLE|CREATE TABLE|DROP TABLE/i);
});
