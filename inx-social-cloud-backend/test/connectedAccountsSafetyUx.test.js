const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Post for Me connection popup cancellation settles promptly', () => {
  const api = read('frontend/src/lib/connections-api.ts');
  assert.match(api, /\/api\/social-connections\/post-for-me\/\$\{platform\}\/start/);
  assert.match(api, /Connection cancelled\./);
  assert.match(api, /if \(popup\.closed\) finish\(\{ ok: false, error: 'Connection cancelled\.' \}\)/);
  assert.match(api, /if \(providerNavigationStarted\) finish\(\{ ok: false, error: 'Connection cancelled\.' \}\)/);
  assert.doesNotMatch(api, /force_authentication/);
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