const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const analytics = fs.readFileSync(path.join(__dirname, '../src/services/socialAnalyticsService.js'), 'utf8');
const audience = fs.readFileSync(path.join(__dirname, '../frontend/src/components/analytics/AudienceCards.tsx'), 'utf8');

test('YouTube demographics use verified Analytics API data and honest empty states', () => {
  assert.match(analytics, /youtubeanalytics\.googleapis\.com\/v2\/reports/);
  assert.match(analytics, /viewerPercentage/);
  assert.match(analytics, /dimensions: 'ageGroup,gender'/);
  assert.match(audience, /YouTube live/);
  assert.match(audience, /Audience demographics unavailable for/);
});
