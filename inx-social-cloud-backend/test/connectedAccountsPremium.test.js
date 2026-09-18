const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Connected Accounts routes to the premium responsive V4 workspace', () => {
  const preload = read('frontend/src/route-preload.ts');
  const page = read('frontend/src/components/connections/ConnectedAccountsPageV4.tsx');

  assert.match(preload, /ConnectedAccountsPageV4/);
  assert.match(page, /Manage all your connected social destinations in one place\./);
  assert.match(page, /All Connected Platforms/);
  assert.match(page, /Connection Activity/);
  assert.match(page, /Connect a new account/);
  assert.match(page, /Grid2X2/);
  assert.match(page, /PlatformFilter/);
  assert.match(page, /StatusFilter/);
  assert.match(page, /AccountDetailsDrawer/);
  assert.match(page, /DisconnectAccountModal/);
  assert.match(page, /ConnectAccountModal/);
  assert.match(page, /DestinationSelector/);
});

test('Connected Accounts interactions keep production connection actions wired', () => {
  const page = read('frontend/src/components/connections/ConnectedAccountsPageV4.tsx');
  const service = read('frontend/src/lib/connected-accounts-service.ts');

  assert.match(page, /syncPostForMeConnections/);
  assert.match(page, /disconnectSocialConnection/);
  assert.match(page, /connectPostForMePlatform/);
  assert.match(page, /Account refreshed successfully\./);
  assert.match(page, /Unable to refresh this connection\./);
  assert.match(page, /Account connected successfully\./);
  assert.match(page, /Disconnecting this account will stop future publishing, scheduling and analytics sync for this connection\./);

  for (const method of [
    'getConnectedAccounts',
    'getConnectionStats',
    'searchConnectedAccounts',
    'refreshConnection',
    'reconnectAccount',
    'disconnectAccount',
    'getConnectionActivity',
    'getSupportedPlatforms',
    'beginOAuthConnection',
    'getAvailableDestinations',
    'saveConnectedDestinations',
  ]) assert.match(service, new RegExp(`function ${method}\\b`));
});

test('Connected Accounts keeps the platform treatments and universal topbar controls', () => {
  const icons = read('frontend/src/components/ui/SocialPlatformIcon.tsx');
  const topbar = read('frontend/src/components/layout/Topbar.tsx');
  const plan = read('frontend/src/components/dashboard/PlanCard.tsx');

  assert.match(icons, /whatsapp: 'WhatsApp'/);
  assert.match(icons, /mastodon: 'Mastodon'/);
  assert.match(icons, /#25d366/);
  assert.match(icons, /#6364ff/);
  assert.match(topbar, /Search anything\.\.\./);
  assert.match(topbar, /Timezone · Europe\/London/);
  assert.match(topbar, /Theme · Midnight/);
  assert.match(plan, /AI content generation/);
  assert.match(plan, /Advanced analytics/);
  assert.match(plan, /More connected accounts/);
});

test('Connected Accounts removes unsupported WhatsApp and Mastodon connection surfaces', () => {
  const page = read('frontend/src/components/connections/ConnectedAccountsPageV4.tsx');
  assert.doesNotMatch(page, /WhatsApp|Mastodon|'whatsapp'|'mastodon'/);
  assert.match(page, /const allUiPlatforms: UiPlatform\[\] = \[\.\.\.customerFacingPlatforms\]/);
  assert.match(page, /const connectTiles: UiPlatform\[\] = \[\.\.\.customerFacingPlatforms\]/);
});

test('Connected Accounts KPI visuals use live activity instead of decorative growth', () => {
  const page = read('frontend/src/components/connections/ConnectedAccountsPageV4.tsx');
  assert.match(page, /job\.status === 'PUBLISHED'/);
  assert.match(page, /No posts published this week/);
  assert.match(page, /connectionSeries/);
  assert.match(page, /platformSeries/);
  assert.match(page, /postsSeries/);
  assert.doesNotMatch(page, /\+\$\{postsTrend\}% from last week/);
});

test('Connect a new account is rendered before the connected platform workspace', () => {
  const page = read('frontend/src/components/connections/ConnectedAccountsPageV4.tsx');
  const connectIndex = page.indexOf('<ConnectNewAccountSection');
  const platformsIndex = page.indexOf('<ConnectedPlatformsSection');
  assert.ok(connectIndex > -1);
  assert.ok(platformsIndex > -1);
  assert.ok(connectIndex < platformsIndex);
});
