const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('landing is capability-first instead of exposing a separate page for every internal menu', () => {
  const landing = read('public/landing.html');
  const css = read('public/landing-redesign.css');
  const js = read('public/landing.js');

  for (const area of ['Post Creation','Bulk Scheduler','Content Calendar','Analytics','AI Content Studio','Connected Accounts']) {
    assert.match(landing, new RegExp(area));
  }

  assert.match(landing, /inxsocial-dashboard-preview\.webp/);
  assert.match(landing, /Everything you need to run your social media, in one place/);
  assert.match(landing, /From idea to results, in five clear steps/);
  assert.match(js, /setupDashboardMotion/);
  assert.match(js, /setupRevealAnimations/);
  assert.match(css, /\.capability-grid\{/);
  assert.match(css, /\.workflow-line\{/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(landing, /data-tour-target|data-tour-panel/);
});

test('landing names all nine supported social networks and renders their brand logos', () => {
  const landing = read('public/landing.html');

  for (const platform of ['Facebook','Instagram','LinkedIn','TikTok','YouTube','Pinterest','Threads','Bluesky','X / Twitter']) {
    assert.equal(landing.includes(platform), true, `${platform} should appear in the supported platform section`);
  }

  for (const logo of ['logos:facebook.svg','logos:instagram-icon.svg','logos:linkedin-icon.svg','logos:tiktok-icon.svg','logos:youtube-icon.svg','logos:pinterest.svg','logos:threads.svg','logos:bluesky.svg','logos:x.svg']) {
    assert.equal(landing.includes(logo), true, `${logo} should be used as a recognisable platform logo`);
  }

  assert.doesNotMatch(landing, /INX Social Admin|Trails & Tales|Ali The Dad|Taslim/);
});

test('landing navigation remains one canonical public experience', () => {
  const landing = read('public/landing.html');

  for (const href of ['#capabilities','#workflow','#platforms','#ai','#pricing']) {
    assert.equal(landing.includes(`href="${href}"`), true, `${href} should be linked from the canonical landing page`);
  }

  assert.doesNotMatch(landing, /href="\/(?:social-media-scheduler|bulk-social-media-scheduler|ai-social-media-tools|social-media-content-calendar|social-media-analytics|pricing|free-social-media-tools)\.html"/);
});
