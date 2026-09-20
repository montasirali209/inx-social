const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Search Console uses Google official read-only OAuth and API endpoints', () => {
  const service = read('src/services/googleSearchConsoleService.js');

  assert.match(service, /https:\/\/www\.googleapis\.com\/auth\/webmasters\.readonly/);
  assert.match(service, /https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(service, /https:\/\/oauth2\.googleapis\.com\/token/);
  assert.match(service, /https:\/\/www\.googleapis\.com\/webmasters\/v3/);
  assert.match(service, /access_type', 'offline'/);
  assert.match(service, /include_granted_scopes', 'true'/);
  assert.match(service, /prompt', 'consent'/);
});

test('Search Console tokens are encrypted and refresh tokens never reach admin JSON', () => {
  const service = read('src/services/googleSearchConsoleService.js');
  const controller = read('src/controllers/googleSearchConsoleController.js');

  assert.match(service, /encryptToken\(token\.access_token\)/);
  assert.match(service, /encryptToken\(token\.refresh_token\)/);
  assert.match(service, /decryptToken\(connection\?\.encryptedRefreshToken\)/);
  assert.doesNotMatch(controller, /encryptedAccessToken/);
  assert.doesNotMatch(controller, /encryptedRefreshToken/);
});

test('Search Console callback is state signed and connection mutations require Super Admin', () => {
  const service = read('src/services/googleSearchConsoleService.js');
  const routes = read('src/routes/adminRoutes.js');

  assert.match(service, /jwt\.sign/);
  assert.match(service, /jwt\.verify/);
  assert.match(service, /purpose: 'google-search-console-admin-oauth'/);
  assert.match(routes, /router\.get\('\/search-console\/oauth\/callback', googleSearchConsole\.oauthCallback\)/);
  assert.match(routes, /router\.post\('\/search-console\/oauth\/start', requireSuperAdmin/);
  assert.match(routes, /router\.post\('\/search-console\/site', requireSuperAdmin/);
  assert.match(routes, /router\.delete\('\/search-console', requireSuperAdmin/);
});

test('Search Console dashboard exposes performance data without browser-side Google secrets', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');

  assert.match(html, /data-page="searchConsole"/);
  assert.match(html, /id="searchConsolePage"/);
  assert.match(html, /id="gscMetrics"/);
  assert.match(html, /id="gscQueriesTable"/);
  assert.match(html, /id="gscPagesTable"/);
  assert.match(html, /id="gscOpportunities"/);

  assert.match(js, /\/api\/admin\/search-console\/performance/);
  assert.match(js, /\/api\/admin\/search-console\/oauth\/start/);
  assert.match(js, /\/api\/admin\/search-console\/site/);
  assert.doesNotMatch(js, /GOOGLE_CLIENT_SECRET|GSC_GOOGLE_CLIENT_SECRET/);
});

test('Search Console persistence model stores only encrypted OAuth token fields', () => {
  const schema = read('prisma/schema.prisma');

  assert.match(schema, /model SearchConsoleConnection/);
  assert.match(schema, /encryptedAccessToken\s+String\?/);
  assert.match(schema, /encryptedRefreshToken\s+String\?/);
  assert.match(schema, /selectedSiteUrl\s+String\?/);
  assert.doesNotMatch(schema, /\n\s+accessToken\s+String/);
  assert.doesNotMatch(schema, /\n\s+refreshToken\s+String/);
});

test('Search Console reporting includes period comparison and SEO opportunity extraction', () => {
  const service = read('src/services/googleSearchConsoleService.js');

  assert.match(service, /\[7, 28, 90\]/);
  assert.match(service, /clicksPercent/);
  assert.match(service, /impressionsPercent/);
  assert.match(service, /ctrPoints/);
  assert.match(service, /positionChange/);
  assert.match(service, /row\.position >= 4 && row\.position <= 30/);
  assert.match(service, /row\.ctr < 0\.08/);
});
