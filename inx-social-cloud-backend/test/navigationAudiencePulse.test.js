const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('workspace preloads lazy routes and Analytics uses live content insight cards', () => {
  const shell = read('frontend/src/components/layout/AppShell.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const router = read('frontend/src/router.tsx');
  const page = read('frontend/src/components/analytics/AnalyticsPage.tsx');
  const cards = read('frontend/src/components/analytics/ContentInsightsCards.tsx');

  assert.match(shell, /preloadAllAppRoutes/);
  assert.match(sidebar, /preloadAppRoute/);
  assert.match(router, /loadAnalytics/);
  assert.match(page, /ContentEfficiencyCard/);
  assert.match(page, /PublishingRhythmCard/);
  assert.doesNotMatch(page, /AudiencePulseCard|AudienceGrowthCard/);
  assert.match(cards, /title="Content Efficiency"/);
  assert.match(cards, /title="Publishing Rhythm"/);
  assert.match(cards, /Avg interactions \/ post/);
  assert.match(cards, /Posts \/ week/);
});
