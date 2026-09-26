const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Google OAuth requests Search Console and Analytics read-only scopes together', () => {
  const service = read('src/services/googleSearchConsoleService.js');
  assert.match(service, /webmasters\.readonly/);
  assert.match(service, /analytics\.readonly/);
  assert.match(service, /GOOGLE_OAUTH_SCOPES\.join\(' '\)/);
});

test('GA4 Growth Intelligence uses official Admin and Data API surfaces', () => {
  const service = read('src/services/googleAnalyticsService.js');
  assert.match(service, /analyticsadmin\.googleapis\.com\/v1beta/);
  assert.match(service, /analyticsdata\.googleapis\.com\/v1beta/);
  assert.match(service, /runRealtimeReport/);
  assert.match(service, /runReport/);
  assert.match(service, /activeUsers/);
  assert.match(service, /landingPagePlusQueryString/);
  assert.match(service, /sessionDefaultChannelGroup/);
  assert.match(service, /sign_up/);
  assert.match(service, /begin_checkout/);
  assert.match(service, /purchase/);
});

test('External visibility probes use direct provider APIs and keep secrets server-side', () => {
  const service = read('src/services/externalVisibilityService.js');
  const client = read('public/admin.js');
  assert.match(service, /api\.perplexity\.ai/);
  assert.match(service, /chat\/completions/);
  assert.match(service, /api\.anthropic\.com/);
  assert.match(service, /web_search_20250305/);
  assert.match(service, /x-api-key/);
  assert.doesNotMatch(client, /PERPLEXITY_API_KEY|ANTHROPIC_API_KEY/);
});

test('Growth UI includes GA4 realtime and provider-selectable visibility', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');
  assert.match(html, /Google Analytics 4/);
  assert.match(html, /Realtime · last 30 minutes/);
  assert.match(html, /id="growthVisibilityProvider"/);
  assert.match(js, /growth-intelligence\/analytics\/realtime/);
  assert.match(js, /growth-intelligence\/analytics\/performance/);
  assert.match(js, /growth-intelligence\/provider-visibility/);
  assert.match(js, /setInterval\(\(\)=>\{/);
});
