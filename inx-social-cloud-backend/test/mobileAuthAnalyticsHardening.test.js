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
  assert.match(gate, /apiRequest<MeResponse>\('\/api\/auth\/me'\)/);
  assert.match(gate, /subscribeToAuthSession/);
  assert.match(gate, /window\.location\.replace\(loginUrl\(\)\)/);
  assert.match(gate, /loginUrl/);
});

test('YouTube analytics uses Post for Me feed metrics without local OAuth token handling', () => {
  const controller = read('src/controllers/analyticsController.js');
  const service = read('src/services/postForMeAnalyticsService.js');
  assert.match(controller, /getPostForMeAnalytics/);
  assert.match(service, /platform === 'youtube'/);
  assert.match(service, /subscribersGained/);
  assert.match(service, /subscribersLost/);
  assert.match(service, /social-account-feeds/);
  assert.match(service, /params\.append\('expand', 'metrics'\)/);
  assert.doesNotMatch(controller, /ensureFreshYouTubeToken|forceRefreshYouTubeToken/);
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
  const landing = read('public/landing.html');
  const landingResponsive = read('public/landing-redesign.css');

  assert.match(main, /mobile-responsive\.css/);
  assert.match(appMobile, /@media \(max-width: 767px\)/);
  assert.match(landing, /landing-redesign\.css/);
  assert.match(landingResponsive, /@media\(max-width:860px\)/);
  assert.match(landingResponsive, /#mainNav\.open\{display:flex\}/);
});
