const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 4 migration upgrades creators without replacing the existing master reference contract', () => {
  const migration = read('prisma/migrations/20260924133000_add_ugc_creator_system_v2/migration.sql');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "creatorVersion"/);
  assert.match(migration, /"languagesJson"/);
  assert.match(migration, /"nichesJson"/);
  assert.match(migration, /"wardrobeJson"/);
  assert.match(migration, /"gestureJson"/);
  assert.match(migration, /"routeCompatibilityJson"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "UGCAvatarReference"/);
  assert.doesNotMatch(migration, /DROP COLUMN|DROP TABLE/);
});

test('Phase 4 upgrades all 52 existing identities in place and auto casting uses the full library', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /const SYSTEM_AVATAR_COUNT = 52/);
  assert.match(studio, /ugcCreators\.buildProfile/);
  assert.match(studio, /creatorVersion/);
  assert.match(studio, /let available = allAvatars/);
  assert.doesNotMatch(studio, /let available = featuredAvatars\.length \? featuredAvatars : allAvatars/);
});

test('Phase 4 custom creators use the same Creator V2 storage schema and persistent reference quality state', () => {
  const studio = read('src/services/ugcStudioService.js');
  const generated = studio.slice(studio.indexOf('async function generateCustomAvatar'), studio.indexOf('async function uploadCustomAvatar'));
  const uploaded = studio.slice(studio.indexOf('async function uploadCustomAvatar'), studio.indexOf('function publicAvatarReference'));
  assert.match(generated, /ugcCreators\.buildProfile/);
  assert.match(generated, /"creatorVersion"/);
  assert.match(generated, /"referenceQualityStatus"/);
  assert.match(uploaded, /ugcCreators\.buildProfile/);
  assert.match(uploaded, /"presentation"/);
  assert.match(uploaded, /"ageBand"/);
  assert.match(uploaded, /"routeCompatibilityJson"/);
  const controller = read('src/controllers/ugcStudioController.js');
  assert.match(controller, /x-creator-presentation/);
  assert.match(controller, /x-creator-age-band/);
});

test('Phase 4 master references are reused and weak references follow repair-once behavior', () => {
  const studio = read('src/services/ugcStudioService.js');
  const start = studio.indexOf('async function ensureAvatarReference');
  const end = studio.indexOf('async function analyzeBrand', start);
  const block = studio.slice(start, end);
  assert.match(block, /referenceStorageKey && qualityStatus !== 'WEAK'/);
  assert.match(block, /referenceStorageKey && qualityStatus === 'WEAK'/);
  assert.match(block, /referenceQualityStatus"=\'READY\'/);
  assert.match(block, /referenceReviewedAt/);
});

test('Phase 4 alternate references have owned upload/read/delete lifecycle', () => {
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /async function listAvatarReferences/);
  assert.match(studio, /async function uploadAvatarReference/);
  assert.match(studio, /async function getAvatarReferenceContent/);
  assert.match(studio, /async function deleteAvatarReference/);
  const routes = read('src/routes/aiContentStudioRoutes.js');
  assert.match(routes, /avatars\/:avatarId\/references\/upload/);
  assert.match(routes, /avatars\/:avatarId\/references\/:referenceId\/content/);
});

test('Phase 4 deterministic casting uses Creator V2 profile scoring and production-tier route compatibility', () => {
  const skills = read('src/services/ugcSkillEngine.js');
  assert.match(skills, /const creators = require\('\.\/ugcCreatorEngine'\)/);
  assert.match(skills, /creators\.scoreCreator/);
  assert.match(skills, /quality: input\.quality/);
  assert.match(skills, /routeCompatible/);
  assert.match(skills, /CREATOR_ROUTE_COMPATIBILITY/);
  assert.match(skills, /creatorVersion: creators\.CREATOR_PROFILE_VERSION/);
  const router = read('src/services/ugcModelRouter.js');
  assert.match(router, /allowedRoutes/);
  assert.match(router, /UGC_ROUTER_CREATOR_INCOMPATIBLE/);
  const studio = read('src/services/ugcStudioService.js');
  assert.match(studio, /allowedRoutes: actor \? ugcCreators\.profileFromRow\(actor\)\.routeCompatibility : null/);
});

test('Phase 4 engine contract fingerprints Creator V2 actor snapshots under contract 1.2', () => {
  const registry = read('src/services/ugcEngineRegistry.js');
  const contract = read('src/services/ugcEngineContract.js');
  assert.match(registry, /CONTRACT_VERSION = '1\.2'/);
  assert.match(contract, /creators\.actorSnapshot/);
  assert.match(contract, /version: creators\.CREATOR_PROFILE_VERSION/);
});

test('Phase 4 Studio can search and filter the actual full creator library', () => {
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  assert.match(wizard, /const allCreators = overview\.data\?\.avatars \|\| \[\]/);
  assert.match(wizard, /creatorSearch/);
  assert.match(wizard, /creatorCategory/);
  assert.match(wizard, /creatorPresentation/);
  assert.match(wizard, /creatorAgeBand/);
  assert.match(wizard, /creatorLocale/);
  assert.match(wizard, /View all \$\{allCreators\.length\} available creators/);
});

test('Phase 4 keeps provider/model routing capabilities internal to the creator engine', () => {
  const studio = read('src/services/ugcStudioService.js');
  const creatorEngine = read('src/services/ugcCreatorEngine.js');
  const publicStart = studio.indexOf('function publicAvatar(row)');
  const publicEnd = studio.indexOf('function publicBrand', publicStart);
  const publicBlock = studio.slice(publicStart, publicEnd);
  assert.doesNotMatch(publicBlock, /routeCompatibility:/);
  const publicProfileStart = creatorEngine.indexOf('function publicProfile');
  const publicProfileEnd = creatorEngine.indexOf('function actorSnapshot', publicProfileStart);
  assert.doesNotMatch(creatorEngine.slice(publicProfileStart, publicProfileEnd), /routeCompatibility:/);
  assert.match(creatorEngine, /routeCompatibility: profile\.routeCompatibility/);
});

test('Phase 4 does not change UGC fixed retail credit tables or Phase 3 router policy', () => {
  const studio = read('src/services/ugcStudioService.js');
  const router = read('src/services/ugcModelRouter.js');
  assert.match(studio, /STANDARD_CREDITS = Object\.freeze\(\{ 15: 100, 20: 140, 30: 210 \}\)/);
  assert.match(studio, /PREMIUM_CREDITS = Object\.freeze\(\{ 15: 180, 20: 260, 30: 390 \}\)/);
  assert.match(router, /const ROUTER_VERSION = 'ugc-router-v1'/);
  assert.match(router, /PROFESSIONAL_CREATOR: 'OMNIHUMAN_CREATOR_V1'/);
});
