const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const read = name => fs.readFileSync(path.join(publicDir, name), 'utf8');

test('free social post tools are indexable canonical acquisition pages', () => {
  const hub = read('free-social-media-tools.html');
  const captions = read('social-media-caption-generator.html');
  for (const source of [hub, captions]) {
    assert.match(source, /name="robots" content="index,follow/);
    assert.match(source, /rel="canonical" href="https:\/\/www\.inxsocial\.co\.uk\//);
    assert.match(source, /portal\/register\.html/);
  }
  assert.match(captions, /id="captionForm"/);
  assert.match(hub, /caption and hashtags|captions and hashtags/i);
  assert.match(hub, /ready[- ]to[- ]publish|ready to send into your publishing workflow/i);
});

test('retired 30-day planner does not claim a live product capability', () => {
  const retiredPlanner = read('30-day-social-media-content-planner.html');
  assert.match(retiredPlanner, /name="robots" content="noindex,follow"/);
  assert.match(retiredPlanner, /rel="canonical" href="https:\/\/www\.inxsocial\.co\.uk\/ai-social-media-tools\.html"/);
  assert.match(retiredPlanner, /url=\/ai-social-media-tools\.html/);
  assert.doesNotMatch(retiredPlanner, /id="plannerForm"/);
});

test('growth tools stay zero-provider-cost and expose useful share/copy actions', () => {
  const script = read('growth-tools.js');
  assert.doesNotMatch(script, /fetch\s*\(/);
  assert.doesNotMatch(script, /\/api\//);
  assert.match(script, /navigator\.share/);
  assert.match(script, /navigator\.clipboard/);
});

test('canonical sitemap and llms describe the real free post acquisition tools', () => {
  const sitemap = read('sitemap.xml');
  const llms = read('llms.txt');
  for (const slug of ['free-social-media-tools.html','social-media-caption-generator.html']) {
    assert.match(sitemap, new RegExp(slug.replace('.', '\\.')));
    assert.match(llms, new RegExp(slug.replace('.', '\\.')));
  }
  assert.doesNotMatch(sitemap, /30-day-social-media-content-planner\.html/);
  assert.doesNotMatch(llms, /30-day-social-media-content-planner\.html/);
  assert.match(llms, /caption/i);
  assert.match(llms, /hashtag/i);
  assert.match(llms, /publish|schedule/i);
});

test('GA4 remains optional and consent-aware across customer-facing surfaces', () => {
  const analytics = read('analytics-consent.js');
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.match(analytics, /G-XXLQ35FQ6L/);
  assert.match(analytics, /analytics_storage: 'denied'/);
  assert.match(analytics, /Accept analytics/);
  assert.match(analytics, /Reject optional analytics/);
  assert.match(app, /analytics-consent\.js/);
  assert.match(app, /social-media-scheduler\.html/);
  assert.match(app, /portal\/register\.html/);
  assert.match(app, /reactAppIndex/);
});
