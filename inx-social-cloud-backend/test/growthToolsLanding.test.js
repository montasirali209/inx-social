const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('retired free-tool acquisition URLs are consolidated into the canonical website', () => {
  const app = read('src/app.js');
  const sitemap = read('public/sitemap.xml');
  const llms = read('public/llms.txt');

  for (const route of ['/free-social-media-tools.html','/social-media-caption-generator.html']) {
    assert.equal(app.includes(`'${route}'`), true, `${route} should retain a permanent redirect`);
    assert.equal(sitemap.includes(route), false, `${route} should not remain in the sitemap`);
    assert.equal(llms.includes(route), false, `${route} should not remain in llms.txt`);
  }
  assert.match(app, /res\.redirect\(301, LEGACY_MARKETING_REDIRECTS\[req\.path\]/);
});

test('GA4 remains optional and consent-aware on the canonical customer-facing website', () => {
  const analytics = read('public/analytics-consent.js');
  const app = read('src/app.js');
  assert.match(analytics, /G-XXLQ35FQ6L/);
  assert.match(analytics, /analytics_storage: 'denied'/);
  assert.match(analytics, /Accept analytics/);
  assert.match(analytics, /Reject optional analytics/);
  assert.match(app, /analytics-consent\.js/);
  assert.match(app, /portal\/register\.html/);
  assert.match(app, /reactAppIndex/);
});
