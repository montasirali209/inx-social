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
  const settingsData = read('frontend/src/data/settingsData.ts');
  const settingsApi = read('frontend/src/lib/settings-api.ts');
  const posts = read('frontend/src/components/posts/PostsPage.tsx');
  const bulkScheduler = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const timingMode = read('frontend/src/components/bulk-scheduler/TimingModeSelect.tsx');
  const connections = read('frontend/src/components/connections/ConnectedAccountsPage.tsx');
  const routes = read('src/routes/studioRoutes.js');

  assert.match(router, /path: 'settings'/);
  assert.match(router, /path: 'connected-accounts'/);
  assert.match(sidebar, /label: 'Settings'.*reactPath: '\/settings'/);
  assert.match(sidebar, /label: 'Connected Accounts'.*reactPath: '\/connected-accounts'/);
  assert.match(settingsApi, /api\/studio\/preferences/);
  assert.match(settings, /Settings saved successfully\./);
  assert.match(settings, /window\.location\.assign\('\/portal\/#overview'\)/);
  assert.match(settingsData, /title: 'Account & Region'/);
  assert.match(settingsData, /label: 'Confirm Before Publishing'/);
  assert.match(settingsData, /label: 'Default Posting Times'/);
  assert.match(settingsData, /email verification, password security, billing, subscription and access changes/i);
  assert.doesNotMatch(settingsData, /actionLabel: 'Manage workspace'/);
  assert.doesNotMatch(settingsData, /actionLabel: 'Manage publishing'/);
  assert.match(posts, /settings\.defaultPublishMode/);
  assert.match(posts, /settings\.approvalRequired/);
  assert.match(bulkScheduler, /settings\.defaultScheduleTimes/);
  assert.match(bulkScheduler, /settings\.timezone/);
  assert.match(timingMode, /Publish immediately/);
  assert.match(timingMode, /Choose custom date & times/);
  assert.match(timingMode, /Use saved posting times/);
  assert.match(connections, /flattenConnectedIdentities/);
  assert.match(connections, /Every connected YouTube channel/);
  assert.match(routes, /router\.get\('\/preferences', controller\.preferences\)/);
});
