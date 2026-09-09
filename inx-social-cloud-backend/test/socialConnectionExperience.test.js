const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Connected Accounts exposes real Instagram, LinkedIn, YouTube, and X linking actions', () => {
  const html = read('studio/index.html');
  const app = read('studio/app.js');
  const adapter = read('studio/web-adapter.js');
  for (const platform of ['Instagram', 'LinkedIn', 'YouTube', 'X']) {
    assert.match(html, new RegExp(`id="btnConnect${platform}"`));
    assert.match(app, new RegExp(`connectSocialPlatformV2\\('${platform.toLowerCase()}'\\)`));
  }
  assert.match(adapter, /\/api\/social-connections\/oauth\/\$\{encodeURIComponent\(normalized\)\}\/start/);
  assert.match(adapter, /connectSocialPlatform: socialOAuth/);
  assert.match(html, /Linking does not enable publishing/);
  assert.match(app, /orderedProfiles\.map/);
  assert.match(app, /Channel \$\{index \+ 1\} of \$\{profileCount\}/);
});

test('React connections support both Meta-linked and direct Instagram authorization', () => {
  const api = read('frontend/src/lib/connections-api.ts');
  const connectedAccountsPage = read('frontend/src/components/connections/ConnectedAccountsPage.tsx');
  const adapter = read('studio/web-adapter.js');
  const facebookCallback = read('studio/facebook-callback.js');
  const controller = read('src/controllers/socialConnectionController.js');
  const service = read('src/services/socialConnectionService.js');
  assert.match(api, /connectOAuthPlatform\('instagram'\)/);
  assert.match(api, /instagram_basic/);
  assert.match(api, /instagram_content_publish/);
  assert.match(api, /instagram_manage_insights/);
  assert.doesNotMatch(adapter, /instagram_basic|instagram_manage_insights/);
  assert.doesNotMatch(facebookCallback, /location\.replace\('\/studio\//);
  assert.match(facebookCallback, /Close this window/);
  assert.match(facebookCallback, /\/api\/social-connections\/instagram\/sync/);
  assert.match(controller, /INSTAGRAM_BUSINESS_LOGIN/);
  assert.match(service, /OAUTH_PROVIDER_NOT_CONFIGURED/);
  assert.doesNotMatch(service, /INSTAGRAM_CLIENT_ID \|\| process\.env\.META_APP_ID/);
  assert.doesNotMatch(controller, /INSTAGRAM_CLIENT_ID \|\| process\.env\.META_APP_ID/);
  assert.match(connectedAccountsPage, /Instagram setup is incomplete\./);
  assert.match(connectedAccountsPage, /Instagram setup required/);
  assert.match(connectedAccountsPage, /Connect with Meta/);
  assert.match(connectedAccountsPage, /Connect Instagram directly/);
  assert.match(connectedAccountsPage, /Recommended/);
  assert.match(connectedAccountsPage, />\s*Close\s*<\/Button>/);
  assert.doesNotMatch(connectedAccountsPage, />\s*Back\s*<\/Button>/);
  assert.match(service, /force_authentication/);
  assert.match(service, /enable_fb_login/);
  assert.doesNotMatch(service, /force_reauth/);
  assert.match(api, /inxSocialConnect-instagram-/);
});

test('Connected Accounts menus, scrolling and disconnect confirmation remain usable', () => {
  const page = read('frontend/src/components/connections/ConnectedAccountsPage.tsx');
  assert.match(page, /createPortal/);
  assert.match(page, /overflow-y-auto overscroll-contain/);
  assert.match(page, /Yes, disconnect/);
  assert.doesNotMatch(page, /Type\s*\{?"?\s*DISCONNECT/);
  assert.doesNotMatch(page, /15\+ platforms/);
  assert.match(page, /Available now: Facebook, Instagram, LinkedIn, YouTube and X\./);
});

test('social OAuth callback is public while account management remains authenticated', () => {
  const routes = read('src/routes/socialConnectionRoutes.js');
  const callbackIndex = routes.indexOf("router.get('/oauth/:platform/callback'");
  const authIndex = routes.indexOf('router.use(requireAuth)');
  const listIndex = routes.indexOf("router.get('/', controller.list)");
  assert.ok(callbackIndex >= 0 && callbackIndex < authIndex);
  assert.ok(authIndex < listIndex);
  assert.match(routes, /router\.delete\('\/:id', controller\.disconnect\)/);
});

test('social connection responses never expose encrypted token fields', () => {
  const service = read('src/services/socialConnectionService.js');
  const publicConnection = service.match(/function publicConnection\(connection\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(publicConnection, /encryptedAccessToken|encryptedRefreshToken/);
  assert.match(service, /encryptToken\(token\.access_token\)/);
});

test('privacy policy discloses connected-platform data and Google Limited Use', () => {
  const privacy = read('public/privacy.html');
  for (const platform of ['Meta:', 'LinkedIn:', 'Google and YouTube:', 'X:']) assert.match(privacy, new RegExp(platform));
  assert.match(privacy, /Google API Services User Data Policy/);
  assert.match(privacy, /Limited Use requirements/);
  assert.match(privacy, /does not upload, edit or delete YouTube content/);
  assert.match(privacy, /OAuth 2\.0 with PKCE/);
  assert.match(privacy, /does not publish, edit or delete Posts on X/);
  assert.match(privacy, /do not sell connected-platform data/);
});
