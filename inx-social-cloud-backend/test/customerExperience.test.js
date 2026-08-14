const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('customer navigation removes duplicate tools and decorative menu marks', () => {
  const html = read('studio/index.html');
  const css = read('studio/styles.css');
  assert.doesNotMatch(html, /data-view="manual"/);
  assert.doesNotMatch(html, /data-view="health"/);
  assert.doesNotMatch(html, /data-view="dashboard"><span>/);
  assert.doesNotMatch(html, /data-view="pages"><span>/);
  assert.match(html, /portal-nav-link[^>]*><span>↗<\/span> Account &amp; Billing/);
  assert.match(css, /\.nav::before\s*\{\s*display:\s*none;/);
});

test('customer Activity Logs exclude administrator system details', () => {
  const html = read('studio/index.html');
  const controller = read('src/controllers/studioController.js');
  assert.match(html, /Complete upload &amp; schedule history/);
  assert.doesNotMatch(html, /System event details/);
  assert.match(controller, /logs:\s*\[\]/);
});

test('Facebook analytics are platform-ready without inventing unavailable insights', () => {
  const html = read('studio/index.html');
  const app = read('studio/app.js');
  assert.match(html, /id="analyticsPlatformSelect"/);
  assert.match(html, /YouTube — coming soon/);
  assert.match(html, /TikTok — coming soon/);
  assert.match(html, /read_insights/);
  assert.match(app, /function renderAnalyticsTrend/);
  assert.match(app, /analyticsRecentContent/);
});

test('Page pictures use an authenticated Graph image fallback', () => {
  const controller = read('src/controllers/studioController.js');
  assert.match(controller, /facebookPageId\)\}\/picture/);
  assert.match(controller, /params:\s*\{ type: 'large', access_token: pageAccessToken \}/);
  assert.match(controller, /responseType:\s*'arraybuffer'/);
});
