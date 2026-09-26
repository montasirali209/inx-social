const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('admin Control Centre can bulk upload reusable UGC creators with voice-safe presentation metadata', () => {
  const html = read('public/index.html');
  const admin = read('public/admin.js');
  const routes = read('src/routes/adminRoutes.js');
  const controller = read('src/controllers/adminController.js');
  const service = read('src/services/ugcStudioService.js');

  assert.match(html, /Reusable creator avatars/);
  assert.match(html, /ugcAvatarFiles[^>]+multiple/);
  assert.match(html, /Woman \/ female/);
  assert.match(html, /Man \/ male/);
  assert.match(html, /Presentation is stored with the creator so default voice casting stays gender-aligned/);

  assert.match(admin, /\/api\/admin\/ugc-avatars\/upload/);
  assert.match(admin, /Upload up to 25 creator images in one batch/);
  assert.match(admin, /X-Creator-Presentation/);
  assert.match(admin, /UGC creators added to the customer picker/);

  assert.match(routes, /router\.use\(requireAuth, requireAdmin\)/);
  assert.match(routes, /\/ugc-avatars\/upload/);
  assert.match(routes, /express\.raw/);
  assert.match(controller, /ADMIN_UGC_AVATAR_UPLOAD/);

  assert.match(service, /normalizeAdminPresentation/);
  assert.match(service, /ADMIN_CREATOR_FIRST_NAMES/);
  assert.match(service, /ADMIN_CREATOR_SURNAMES/);
  assert.match(service, /shuffledCreatorCandidates/);
  assert.match(service, /repairGenericSystemAvatarNames/);
  assert.match(service, /genericSystemAvatarName/);
  assert.match(service, /Assigned friendly names to/);
  assert.match(service, /narratorVoice\('', \{ presentation \}\)/);
  assert.match(service, /return 'Callum'/);
  assert.match(service, /return 'Pippa'/);
  assert.match(service, /return 'Riley'/);
  assert.match(service, /scope[^\n]+SYSTEM/);
});

test('admin-uploaded system creators flow into the same UGC Browse creators library used by customers', () => {
  const service = read('src/services/ugcStudioService.js');
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');

  assert.match(service, /a\."scope"[^\n]+SYSTEM/);
  assert.match(service, /a\."status"[^\n]+READY/);
  assert.match(service, /avatars: publicAvatars/);
  assert.match(wizard, /const allCreators = overview\.data\?\.avatars \|\| \[\]/);
  assert.match(wizard, /Browse creators/);
});


test('future admin uploads never fall back to numbered Female Creator or Male Creator labels', () => {
  const service = read('src/services/ugcStudioService.js');
  assert.doesNotMatch(service, /Female Creator' : presentation === 'Man' \? 'Male Creator/);
  assert.match(service, /return fallbackFirst \+ ' ' \+ suffix/);
  assert.match(service, /crypto\.randomInt/);
});
