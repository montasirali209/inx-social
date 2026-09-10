const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Facebook analytics replaces unsupported demographics UI with Audience Pulse', () => {
  const cards = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/analytics/AudienceCards.tsx'), 'utf8');
  const page = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/analytics/AnalyticsPage.tsx'), 'utf8');
  assert.match(cards, /title="Audience Pulse"/);
  assert.match(cards, /Interactions \/ 1K/);
  assert.match(cards, /Verified audience change/);
  assert.doesNotMatch(page, /AudienceDemographicsCard/);
});
