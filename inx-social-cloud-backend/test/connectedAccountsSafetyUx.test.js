const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Instagram normal connect does not force reauthentication and cancellation settles promptly', () => {
  const api = read('frontend/src/lib/connections-api.ts');
  assert.match(api, /url\.searchParams\.delete\('force_authentication'\)/);
  assert.match(api, /Connection cancelled\./);
  assert.match(api, /if \(popup\.closed\) finish\(\{ ok: false, error: 'Connection cancelled\.' \}\)/);
  assert.match(api, /if \(providerNavigationStarted\)[\s\S]*Connection cancelled\./);
});

test('Advanced connected accounts removes token webhook and API diagnostics from user UI', () => {
  const page = read('frontend/src/components/connections/ConnectedAccountsPageV2.tsx');
  assert.match(page, /Connection management/);
  assert.match(page, /Connected destinations/);
  assert.match(page, /Accounts needing attention/);
  assert.match(page, /Export connection activity/);
  assert.doesNotMatch(page, /Token Expiry Alerts/);
  assert.doesNotMatch(page, /Webhook status/);
  assert.doesNotMatch(page, /API health check/);
});

test('Danger Zone disconnects all workspace connections instead of an arbitrary first Page', () => {
  const page = read('frontend/src/components/connections/ConnectedAccountsPageV2.tsx');
  const api = read('frontend/src/lib/connections-api.ts');
  assert.match(page, /Disconnect all connected accounts/);
  assert.match(page, /disconnectAllConnections\(workspace\.data\)/);
  assert.doesNotMatch(page, /identities\[0\]/);
  assert.match(api, /Promise\.allSettled\(tasks\)/);
  assert.match(api, /workspace\.overview\.pages\.filter/);
  assert.match(api, /workspace\.connections\.map/);
});

test('Connected Accounts route loads the redesigned workspace', () => {
  const preload = read('frontend/src/route-preload.ts');
  assert.match(preload, /ConnectedAccountsPageV2/);
});
