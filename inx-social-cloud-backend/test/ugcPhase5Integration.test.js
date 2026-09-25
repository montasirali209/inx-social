const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 5 creative format engine is versioned and independent from production type', () => {
  const formats = read('src/services/ugcCreativeFormats.js');
  assert.match(formats, /CREATIVE_FORMAT_VERSION = 'ugc-formats-v1'/);
  for (const key of ['PROBLEM_SOLUTION','PRODUCT_DEMO','TESTIMONIAL','UNBOXING','REACTION','BEFORE_AFTER','STORYTIME','SPOKESPERSON','PRODUCT_FOCUSED']) {
    assert.match(formats, new RegExp(key));
  }
  assert.doesNotMatch(formats, /minimax:|klingai:|seedance@|bytedance:5@2|runware/i);
});

test('Phase 5 validates creative format before the Creative Director and before provider routing', () => {
  const skills = read('src/services/ugcSkillEngine.js');
  const formatIndex = skills.indexOf('const formatPlan = creativeFormats.planCreativeFormats');
  const directorIndex = skills.indexOf('const director = await creativeDirectorSkill', formatIndex);
  assert.ok(formatIndex >= 0 && directorIndex > formatIndex);

  const studio = read('src/services/ugcStudioService.js');
  const planIndex = studio.indexOf('creativePlan = await planCampaign');
  const routeIndex = studio.indexOf('ugcModelRouter.routePlan', planIndex);
  const reserveIndex = studio.indexOf('createGenerationRow', routeIndex);
  assert.ok(planIndex >= 0 && routeIndex > planIndex && reserveIndex > routeIndex);
});

test('Phase 5 format grammar shapes the script while visual direction stays model-native', () => {
  const skills = read('src/services/ugcSkillEngine.js');
  assert.match(skills, /creativeFormat: formatDecision\?\.formatKey/);
  assert.match(skills, /beats: beatGroups\[index\]/);
  assert.match(skills, /Let the video model choose framing, actions and transitions/);
  assert.doesNotMatch(skills, /Story beats in this scene/);
  assert.doesNotMatch(skills, /Format rules:/);
});

test('Phase 5 protects testimonial and before-after formats from fabricated evidence', () => {
  const formats = read('src/services/ugcCreativeFormats.js');
  assert.match(formats, /NO_FAKE_TESTIMONIAL/);
  assert.match(formats, /NO_FALSE_FIRST_PERSON_USE/);
  assert.match(formats, /VERIFIED_TRANSFORMATION_REQUIRED/);
  assert.match(formats, /requiresVerifiedTransformation: true/);
  assert.match(formats, /UGC_CREATIVE_FORMAT_INCOMPATIBLE/);
});

test('Phase 5 format decisions are fingerprinted in engine contract 1.3', () => {
  const registry = read('src/services/ugcEngineRegistry.js');
  const contract = read('src/services/ugcEngineContract.js');
  assert.match(registry, /CONTRACT_VERSION = '1\.3'/);
  assert.match(contract, /requestedCreativeFormat/);
  assert.match(contract, /resolvedCreativeFormats/);
  assert.match(contract, /creativeFormatVersion/);
  assert.match(contract, /beats:/);
  assert.match(contract, /productionPlan: project\.productionPlan/);
});

test('Phase 5 Studio exposes creative structure separately from production type', () => {
  const types = read('frontend/src/types/ugc-studio.ts');
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  const controller = read('src/controllers/ugcStudioController.js');
  assert.match(types, /UGCCreativeFormat/);
  assert.match(wizard, /const \[creativeFormat, setCreativeFormat\]/);
  assert.match(wizard, /Creative structure/);
  assert.match(wizard, /creativeFormatOptions/);
  assert.match(controller, /creativeFormat: z\.enum/);
});

test('Phase 5 Auto can mix formats while explicit format stays locked', () => {
  const formats = require('../src/services/ugcCreativeFormats');
  const auto = formats.planCreativeFormats({
    requestedFormat: 'AUTO',
    resolvedType: 'PRODUCT_SHOWCASE',
    variationCount: 6,
    sceneCount: 2,
    hasProductReference: true,
    verifiedClaims: ['Provides a reusable storage container']
  });
  assert.equal(auto.mode, 'AUTO_MIX');
  assert.ok(auto.formats.length > 1);

  const locked = formats.planCreativeFormats({
    requestedFormat: 'PRODUCT_DEMO',
    resolvedType: 'PRODUCT_SHOWCASE',
    variationCount: 4,
    sceneCount: 2,
    hasProductReference: true,
    verifiedClaims: []
  });
  assert.equal(locked.mode, 'LOCKED');
  assert.deepEqual(locked.formats, ['PRODUCT_DEMO']);
  assert.ok(locked.ads.every(ad => ad.formatKey === 'PRODUCT_DEMO'));
});

test('Phase 5 does not change pricing, router version or Creator V2', () => {
  const studio = read('src/services/ugcStudioService.js');
  const router = read('src/services/ugcModelRouter.js');
  const creators = read('src/services/ugcCreatorEngine.js');
  assert.match(studio, /STANDARD_CREDITS = Object\.freeze\(\{ 20: 140, 30: 210, 45: 315, 60: 420 \}\)/);
  assert.match(studio, /PREMIUM_CREDITS = Object\.freeze\(\{ 20: 260, 30: 390, 45: 585, 60: 780 \}\)/);
  assert.match(router, /ROUTER_VERSION = 'ugc-router-v1'/);
  assert.match(creators, /CREATOR_PROFILE_VERSION = 'ugc-creators-v2'/);
});

test('Phase 5 requires no database migration and persists through existing plan/engine JSON contracts', () => {
  const studio = read('src/services/ugcStudioService.js');
  const engine = read('src/services/ugcEngineService.js');
  assert.match(studio, /json\(plan\)/);
  assert.match(engine, /json\(project\.skills\?\.decisions/);
  assert.match(engine, /json\(project\.productionPlan\)/);
});
