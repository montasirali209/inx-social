const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('customer app shell is gated by validated authentication before tools render', () => {
  const shell = read('frontend/src/components/layout/AppShell.tsx');
  const gate = read('frontend/src/components/auth/RequireAuth.tsx');
  assert.match(shell, /<RequireAuth>/);
  assert.match(gate, /apiRequest<\{ user: unknown \}>\('\/api\/auth\/me'\)/);
  assert.match(gate, /window\.location\.replace\(loginUrl\(\)\)/);
  assert.match(gate, /portal\/login\.html\?return=/);
});

test('YouTube analytics can refresh expired and provider-invalidated OAuth access tokens', () => {
  const controller = read('src/controllers/analyticsController.js');
  const tokenService = read('src/services/youtubeTokenService.js');
  assert.match(controller, /ensureFreshYouTubeToken/);
  assert.match(controller, /forceRefreshYouTubeToken/);
  assert.match(controller, /invalid authentication credentials/);
  assert.match(tokenService, /https:\/\/oauth2\.googleapis\.com\/token/);
  assert.match(tokenService, /grant_type: 'refresh_token'/);
  assert.match(tokenService, /encryptedAccessToken: encryptToken\(token\.access_token\)/);
  assert.match(tokenService, /tokenExpiresAt:/);
});

test('Analytics replaces unsupported demographic presentation with cross-platform Audience Pulse', () => {
  const audience = read('frontend/src/components/analytics/AudienceCards.tsx');
  const page = read('frontend/src/components/analytics/AnalyticsPage.tsx');
  assert.match(audience, /title="Audience Pulse"/);
  assert.match(audience, /Interactions \/ 1K/);
  assert.match(audience, /Verified audience change/);
  assert.doesNotMatch(page, /AudienceDemographicsCard/);
});

test('landing and workspace load dedicated mobile responsive guardrails', () => {
  const main = read('frontend/src/main.tsx');
  const appMobile = read('frontend/src/mobile-responsive.css');
  const app = read('src/app.js');
  const landingMobile = read('public/landing-mobile.css');
  assert.match(main, /mobile-responsive\.css/);
  assert.match(appMobile, /@media \(max-width: 767px\)/);
  assert.match(app, /landing-mobile\.css/);
  assert.match(landingMobile, /@media \(max-width: 900px\)/);
  assert.match(landingMobile, /#mainNav\.open/);
});