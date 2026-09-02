const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Settings and Connected Accounts are first-class authenticated React workspaces', () => {
  const router = read('frontend/src/router.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const settings = read('frontend/src/components/settings/SettingsPage.tsx');
  const settingsApi = read('frontend/src/lib/settings-api.ts');
  const connections = read('frontend/src/components/connections/ConnectedAccountsPage.tsx');
  const routes = read('src/routes/studioRoutes.js');

  assert.match(router, /path: 'settings'/);
  assert.match(router, /path: 'connected-accounts'/);
  assert.match(sidebar, /label: 'Settings'.*reactPath: '\/settings'/);
  assert.match(sidebar, /label: 'Connected Accounts'.*reactPath: '\/connected-accounts'/);
  assert.match(settingsApi, /api\/studio\/preferences/);
  assert.match(settings, /Settings saved successfully\./);
  assert.match(connections, /flattenConnectedIdentities/);
  assert.match(connections, /Every connected YouTube channel/);
  assert.match(routes, /router\.get\('\/preferences', controller\.preferences\)/);
});
