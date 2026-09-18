const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('landing exposes the interactive product tour and 3D motion system', () => {
  const landing = read('public/landing.html');
  const js = read('public/landing.js');
  const css = read('public/landing-redesign.css');

  for (const area of ['Bulk Scheduler','Content Calendar','Analytics','AI Content Studio','Connected Accounts']) {
    assert.match(landing, new RegExp(area));
  }
  assert.match(js, /activateTour/);
  assert.match(js, /setupTilt/);
  assert.match(js, /data-tour-target/);
  assert.match(css, /\.product-tour\{/);
  assert.match(css, /\.hero-scene\{/);
  assert.match(css, /transform:rotateY\(var\(--ry/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('landing names all nine supported social networks without using private account data', () => {
  const landing = read('public/landing.html');
  for (const platform of ['Facebook','Instagram','LinkedIn','TikTok','YouTube','Pinterest','Threads','Bluesky','X']) {
    assert.equal(landing.includes(platform), true, `${platform} should appear in the landing network section`);
  }
  assert.doesNotMatch(landing, /INX Social Admin|Trails & Tales|Ali The Dad|Taslim/);
});

test('landing product-tour navigation stays on the canonical public page', () => {
  const landing = read('public/landing.html');
  for (const href of ['#product','#workflows','#intelligence']) {
    assert.equal(landing.includes(`href="${href}"`), true, `${href} should be linked from the landing page`);
  }
  assert.doesNotMatch(landing, /href="\/(?:social-media-scheduler|bulk-social-media-scheduler|ai-social-media-tools|social-media-content-calendar|social-media-analytics)\.html"/);
});
