const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Post for Me connection popup waits for the verified OAuth result before reporting cancellation', () => {
  const api = read('frontend/src/lib/connections-api.ts');
  const controller = read('src/controllers/postForMeController.js');
  assert.match(api, /\/api\/social-connections\/post-for-me\/\$\{platform\}\/start/);
  assert.match(api, /sameInxSocialOrigin/);
  assert.match(api, /hostname/);
  assert.match(api, /sameInxSocialOrigin\(event\.origin\)/);
  assert.match(api, /confirmClosed/);
  assert.match(api, /2500/);
  assert.match(api, /if \(popup\.closed\) confirmClosed\(\)/);
  assert.doesNotMatch(api, /providerNavigationStarted/);
  assert.match(controller, /postMessage\(payload,'\*'\)/);
  assert.match(controller, /isSuccess/);
  assert.doesNotMatch(api, /force_authentication/);
});

test('Analytics refresh sync records successful OAuth without changing publishing access', () => {
  const api = read('frontend/src/lib/connections-api.ts');
  const controller = read('src/controllers/postForMeController.js');
  const service = read('src/services/postForMeService.js');
  assert.match(api, /syncPostForMeConnections\(oauthPlatform\?: SocialPlatform\)/);
  assert.match(api, /JSON\.stringify\(oauthPlatform \? \{ oauthPlatform \} : \{\}\)/);
  assert.match(controller, /oauthPlatform/);
  assert.match(controller, /oauthCompletedAt/);
  assert.match(service, /lastOAuthSuccessAt/);
  assert.match(service, /connectionMetadata\(account, parseJson\(existingConnection\?\.metadataJson, \{\}\), options\)/);
  assert.match(service, /performConnectionSync\(userId, options\)/);
});

test('Connected Accounts keeps provider diagnostics out of the customer UI', () => {
  const page = read('frontend/src/components/connections/ConnectedAccountsPageV4.tsx');
  assert.match(page, /Connected destinations/);
  assert.match(page, /All Connected Platforms/);
  assert.match(page, /Connect a new account/);
  assert.doesNotMatch(page, /Token Expiry Alerts/);
  assert.doesNotMatch(page, /Webhook status/);
  assert.doesNotMatch(page, /API health check/);
  assert.doesNotMatch(page, /POST_FOR_ME_API_KEY/);
});

test('Connected Accounts disconnects provider-backed connections through one gateway', () => {
  const page = read('frontend/src/components/connections/ConnectedAccountsPageV4.tsx');
  const api = read('frontend/src/lib/connections-api.ts');
  assert.match(page, /disconnectSocialConnection\(account\.connectionId\)/);
  assert.match(page, /Disconnect account/);
  assert.match(api, /\/api\/social-connections\/\$\{encodeURIComponent\(connectionId\)\}/);
  assert.match(api, /syncPostForMeConnections/);
});

test('Connected Accounts route loads the premium Post for Me workspace', () => {
  const preload = read('frontend/src/route-preload.ts');
  assert.match(preload, /ConnectedAccountsPageV4/);
});