const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Connected Accounts exposes the nine Post for Me networks', () => {
  const data = read('frontend/src/data/connectedAccountsData.ts');
  const page = read('frontend/src/components/connections/ConnectedAccountsPageV3.tsx');
  const api = read('frontend/src/lib/connections-api.ts');
  for (const platform of ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads', 'bluesky', 'x']) {
    assert.match(data, new RegExp(`'${platform}'`));
  }
  const platformList = data.match(/customerFacingPlatforms = \[([^\]]+)\]/);
  assert.ok(platformList, 'customerFacingPlatforms must remain explicit');
  assert.equal((platformList[1].match(/'/g) || []).length / 2, 9);
  assert.match(page, /Available networks/);
  assert.match(page, /customerFacingPlatforms\.map/);
  assert.match(api, /connectPostForMePlatform/);
  assert.match(api, /\/api\/social-connections\/post-for-me\/\$\{platform\}\/start/);
});

test('React connections use Post for Me as the only active social gateway', () => {
  const api = read('frontend/src/lib/connections-api.ts');
  const connectedAccountsPage = read('frontend/src/components/connections/ConnectedAccountsPageV3.tsx');
  const controller = read('src/controllers/socialConnectionController.js');
  const routes = read('src/routes/socialConnectionRoutes.js');
  const pfm = read('src/services/postForMeService.js');

  assert.match(api, /connectPostForMePlatform/);
  assert.match(api, /post-for-me\/\$\{platform\}\/start/);
  assert.match(pfm, /PROVIDER_ENGINE = 'POST_FOR_ME'/);
  assert.match(pfm, /permissions: \['posts', 'feeds'\]/);
  assert.match(pfm, /external_id: String\(userId\)/);
  assert.match(routes, /post-for-me\/callback/);
  assert.match(routes, /post-for-me\/webhook/);
  assert.doesNotMatch(routes, /facebook\/start|facebook\/complete|linkedin\/start|oauth\/:platform\/start/);
  assert.match(controller, /module\.exports = \{\};/);
  assert.match(connectedAccountsPage, /customerFacingPlatforms\.map/);
  assert.match(connectedAccountsPage, /Bluesky handle/);
  assert.match(connectedAccountsPage, /App password/);
});

test('Connected Accounts menus and disconnect confirmation remain usable', () => {
  const page = read('frontend/src/components/connections/ConnectedAccountsPageV3.tsx');
  assert.match(page, /Connect Account/);
  assert.match(page, /Disconnect account/);
  assert.match(page, /Connected destinations/);
  assert.match(page, /Available networks/);
  assert.doesNotMatch(page, /15\+ platforms/);
});

test('Post for Me callback and webhook are public while account management remains authenticated', () => {
  const routes = read('src/routes/socialConnectionRoutes.js');
  const callbackIndex = routes.indexOf("router.get('/post-for-me/callback'");
  const webhookIndex = routes.indexOf("router.post('/post-for-me/webhook'");
  const authIndex = routes.indexOf('router.use(requireAuth)');
  const listIndex = routes.indexOf("router.get('/', postForMeController.list)");
  const startIndex = routes.indexOf("router.post('/post-for-me/:platform/start'");
  assert.ok(callbackIndex >= 0 && callbackIndex < authIndex);
  assert.ok(webhookIndex >= 0 && webhookIndex < authIndex);
  assert.ok(authIndex < listIndex);
  assert.ok(startIndex > authIndex);
  assert.match(routes, /router\.delete\('\/:id', postForMeController\.disconnect\)/);
});

test('Post for Me connection responses use local mappings without provider credentials', () => {
  const service = read('src/services/postForMeService.js');
  assert.match(service, /encryptedAccessToken: null/);
  assert.match(service, /encryptedRefreshToken: null/);
  assert.match(service, /postForMeAccountId/);
  assert.doesNotMatch(service, /encryptToken\(/);
});

test('privacy policy discloses connected-platform data and Google Limited Use', () => {
  const privacy = read('public/privacy.html');
  for (const platform of ['Meta:', 'LinkedIn:', 'Google and YouTube:', 'X:']) assert.match(privacy, new RegExp(platform));
  assert.match(privacy, /Google API Services User Data Policy/);
  assert.match(privacy, /Limited Use requirements/);
  assert.match(privacy, /do not sell connected-platform data/);
});
