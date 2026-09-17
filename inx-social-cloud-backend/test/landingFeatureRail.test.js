const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('landing upgrades the legacy channel strip into the all-in-one workspace rail', () => {
  const js = read('public/landing.js');
  const css = read('public/landing-feature-rail.css');
  const studioCss = read('public/landing-ai-studio.css');

  assert.match(js, /All-in-one<em>workspace<\/em>/);
  assert.match(js, /Plan\. Create\. Publish\. Grow\./);
  assert.match(js, /Connect Accounts/);
  assert.match(js, /Schedule &amp; Publish/);
  assert.match(js, /Bulk Scheduler/);
  assert.match(js, /AI Content Studio/);
  assert.match(js, /Content Calendar/);
  assert.match(js, /Analytics/);
  assert.match(js, /Video Clipping/);
  assert.match(js, /workspace-soon">Soon/);
  assert.match(js, /\/assets\/inx-social-logo\.png/);
  assert.doesNotMatch(js, /createElement\(['"]link['"]\)/);
  assert.match(studioCss, /@import url\("\/landing-feature-rail\.css\?v=20260916a"\)/);
  assert.match(css, /\.workspace-rail\{/);
  assert.match(css, /\.workspace-platform\.facebook/);
  assert.match(css, /\.workspace-platform\.instagram/);
  assert.match(css, /\.workspace-platform\.linkedin/);
  assert.match(css, /\.workspace-platform\.youtube/);
});

test('landing connection rail names every currently supported customer network', () => {
  const js = read('public/landing.js');
  assert.match(js, /9 networks:/);
  for (const platform of ['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Pinterest', 'Threads', 'Bluesky']) {
    assert.equal(js.includes(platform), true, `${platform} should appear in the landing connection rail`);
  }
  assert.match(js, /Bluesky &amp; X/);
});

test('landing rail links important capabilities to crawlable public product pages', () => {
  const js = read('public/landing.js');
  for (const href of [
    '/social-media-scheduler.html',
    '/bulk-social-media-scheduler.html',
    '/ai-social-media-tools.html',
    '/social-media-content-calendar.html',
    '/social-media-analytics.html'
  ]) assert.equal(js.includes(`href=\"${href}\"`), true, `${href} should be linked from the workspace rail`);
});
