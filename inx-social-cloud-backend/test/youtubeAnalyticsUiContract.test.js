const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const analytics = fs.readFileSync(path.join(__dirname, '../src/services/socialAnalyticsService.js'), 'utf8');
const audience = fs.readFileSync(path.join(__dirname, '../frontend/src/components/analytics/AudienceCards.tsx'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '../frontend/src/components/analytics/AnalyticsPage.tsx'), 'utf8');

test('YouTube keeps verified Analytics API demographics capability without exposing a dead demographics card', () => {
  assert.match(analytics, /youtubeanalytics\.googleapis\.com\/v2\/reports/);
  assert.match(analytics, /viewerPercentage/);
  assert.match(analytics, /dimensions: 'ageGroup,gender'/);
  assert.match(audience, /title="Audience Pulse"/);
  assert.doesNotMatch(page, /AudienceDemographicsCard/);
});
