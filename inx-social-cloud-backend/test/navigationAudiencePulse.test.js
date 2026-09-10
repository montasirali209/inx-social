const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('workspace preloads lazy routes and Analytics uses Audience Pulse', () => {
  const shell = read('frontend/src/components/layout/AppShell.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const router = read('frontend/src/router.tsx');
  const page = read('frontend/src/components/analytics/AnalyticsPage.tsx');
  const cards = read('frontend/src/components/analytics/AudienceCards.tsx');

  assert.match(shell, /preloadAllAppRoutes/);
  assert.match(sidebar, /preloadAppRoute/);
  assert.match(router, /loadAnalytics/);
  assert.match(page, /AudiencePulseCard/);
  assert.doesNotMatch(page, /AudienceDemographicsCard/);
  assert.match(cards, /title="Audience Pulse"/);
  assert.match(cards, /Interactions \/ 1K/);
});
