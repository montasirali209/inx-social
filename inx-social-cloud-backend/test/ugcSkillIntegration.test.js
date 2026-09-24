const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 2 skills still run before Phase 3 routing and before any provider generation', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /const ugcSkills = require\('\.\/ugcSkillEngine'\)/);
  assert.match(studio, /return ugcSkills\.planCampaign/);
  assert.match(studio, /const creativePlan = await planCampaign/);
  assert.match(studio, /ugcModelRouter\.routePlan/);
  const skillIndex = studio.indexOf('const creativePlan = await planCampaign');
  const routeIndex = studio.indexOf('ugcModelRouter.routePlan', skillIndex);
  const campaignInsertIndex = studio.indexOf('INSERT INTO "UGCCampaign"', routeIndex);
  assert.ok(skillIndex >= 0 && routeIndex > skillIndex && campaignInsertIndex > routeIndex);
});

test('Phase 2 skill storage is additive to the Phase 1 engine table', () => {
  const migration = read('prisma/migrations/20260924103000_add_ugc_engine_skills/migration.sql');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "skillsVersion"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "skillsJson"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "preflightJson"/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
});

test('engine snapshots persist skills, preflight and keep them inside the immutable fingerprint', () => {
  const contract = read('src/services/ugcEngineContract.js');
  const engine = read('src/services/ugcEngineService.js');
  assert.match(contract, /skills: \{/);
  assert.match(contract, /skills: project\.skills/);
  assert.match(contract, /skills_preflight/);
  assert.match(engine, /skillsVersion/);
  assert.match(engine, /skillsJson/);
  assert.match(engine, /preflightJson/);
});

test('Phase 2 does not change the customer credit tables or production route registry', () => {
  const studio = require('../src/services/ugcStudioService');
  const registry = require('../src/services/ugcEngineRegistry');
  assert.deepEqual(studio.STANDARD_CREDITS, { 15: 100, 20: 140, 30: 210 });
  assert.deepEqual(studio.PREMIUM_CREDITS, { 15: 180, 20: 260, 30: 390 });
  assert.equal(registry.routeKeyForQuality('STANDARD'), 'HAILUO_STANDARD_V1');
  assert.equal(registry.routeKeyForQuality('PREMIUM'), 'KLING_PREMIUM_V1');
});

test('the structured skills cover the complete Phase 2 responsibility set', () => {
  const skills = read('src/services/ugcSkillEngine.js');
  for (const name of [
    'BRAND_UNDERSTANDING',
    'CREATIVE_DIRECTOR',
    'CREATOR_CASTING',
    'SCRIPT_TIMING',
    'SCENE_PLANNING',
    'CREATOR_CONSISTENCY',
    'VOICE_CONSISTENCY',
    'PRODUCT_FIDELITY',
    'NATURAL_MOTION',
    'CAMERA_STYLE',
    'AD_FINISHING',
    'QUALITY_CONTROL_PREFLIGHT'
  ]) {
    assert.match(skills, new RegExp(name));
  }
});

test('provider/model names remain internal to routing and are not added to customer-facing UGC UI', () => {
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  const editor = read('frontend/src/components/ai-content-studio/UGCEditorPage.tsx');
  const ui = [wizard, home, editor].join('\n');
  assert.doesNotMatch(ui, /OmniHuman|Seedance|Hailuo|MiniMax|Kling 3|Inworld TTS/i);
});
