const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 6 Studio controls are served by a versioned backend contract', () => {
  const controls = read('src/services/ugcStudioControls.js');
  const studio = read('src/services/ugcStudioService.js');
  assert.match(controls, /STUDIO_CONTROLS_VERSION = 'ugc-studio-controls-v1'/);
  assert.match(studio, /studioControlsVersion: ugcStudioControls\.STUDIO_CONTROLS_VERSION/);
  assert.match(studio, /studioControls: ugcStudioControls\.snapshot/);
});

test('Phase 6 estimate is server-authoritative and includes live credit affordability', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /async function estimateCampaign\(userId, input\)/);
  assert.match(studio, /const balance = await credits\.getBalance\(userId\)/);
  assert.match(studio, /ugcStudioControls\.quote/);
  assert.match(studio, /balanceRemaining: balance\.remaining/);
});

test('Phase 6 validates the same supported production controls before credit reservation', () => {
  const studio = read('src/services/ugcStudioService.js');
  const validateIndex = studio.indexOf('ugcStudioControls.assertSelection');
  const accessIndex = studio.indexOf('credits.getAccess', validateIndex);
  const reserveIndex = studio.indexOf('createGenerationRow', accessIndex);
  assert.ok(validateIndex >= 0 && accessIndex > validateIndex && reserveIndex > accessIndex);
});

test('Phase 6 adds an explicit Review & credits step before generation starts', () => {
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  assert.match(wizard, /'review'/);
  assert.match(wizard, /Review & credits/);
  assert.match(wizard, /Review before generation/);
  assert.match(wizard, /Confirm & generate/);
  const videoIndex = wizard.indexOf("{currentKey === 'video'");
  const reviewIndex = wizard.indexOf("{currentKey === 'review'");
  const createIndex = wizard.indexOf('create.mutate()', reviewIndex);
  const finishIndex = wizard.indexOf("{currentKey === 'finish'");
  assert.ok(videoIndex >= 0 && reviewIndex > videoIndex && createIndex > reviewIndex && finishIndex > createIndex);
});

test('Phase 6 production step uses backend tier metadata and does not expose provider names', () => {
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  assert.match(wizard, /studioControls\?\.qualityTiers/);
  assert.match(wizard, /selectedTier\.description/);
  assert.match(wizard, /Models stay hidden|provider\/model routing automatic and hidden|Provider\/model routing stays automatic/);
  assert.doesNotMatch(wizard, /Hailuo|OmniHuman|Seedance|Kling Omni|Runware/);
});

test('Phase 6 exposes an affordable alternative without silently changing user choices', () => {
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  assert.match(wizard, /AFFORDABLE OPTION/);
  assert.match(wizard, /Use this setup/);
  assert.match(wizard, /setQuality\(alt\.quality\)/);
  assert.match(wizard, /setDuration\(alt\.duration\)/);
  assert.match(wizard, /setAdCount\(alt\.adCount\)/);
  assert.doesNotMatch(wizard, /useEffect\([^]*setQuality\(.*alternative/);
});

test('Phase 6 preserves Phase 5 format choice in live quote context', () => {
  const api = read('frontend/src/lib/ugc-studio-api.ts');
  const controller = read('src/controllers/ugcStudioController.js');
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  assert.match(api, /'creativeFormat'/);
  assert.match(controller, /const estimateSchema[^]*creativeFormat: z\.enum/);
  assert.match(wizard, /estimateUGCCampaign\(\{ duration, adCount, quality, campaignType, creativeFormat \}\)/);
});

test('Phase 6 does not change fixed UGC pricing, router or Creator V2', () => {
  const studio = read('src/services/ugcStudioService.js');
  const router = read('src/services/ugcModelRouter.js');
  const creators = read('src/services/ugcCreatorEngine.js');
  assert.match(studio, /STANDARD_CREDITS = Object\.freeze\(\{ 15: 100, 20: 140, 30: 210 \}\)/);
  assert.match(studio, /PREMIUM_CREDITS = Object\.freeze\(\{ 15: 180, 20: 260, 30: 390 \}\)/);
  assert.match(router, /ROUTER_VERSION = 'ugc-router-v1'/);
  assert.match(creators, /CREATOR_PROFILE_VERSION = 'ugc-creators-v2'/);
});

test('Phase 6 requires no database migration', () => {
  const controls = read('src/services/ugcStudioControls.js');
  const studio = read('src/services/ugcStudioService.js');
  assert.doesNotMatch(controls, /ALTER TABLE|CREATE TABLE|DROP TABLE/i);
  assert.match(studio, /json\(plan\)/);
});
