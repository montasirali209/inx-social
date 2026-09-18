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

  assert.match(landing, /inxsocial-dashboard-user-preview\\.webp/);
  assert.match(landing, /Everything you need to run your social media, in one place/);
  assert.match(landing, /From idea to results, in five clear steps/);
  assert.match(js, /setupDashboardMotion/);
  assert.match(js, /setupRevealAnimations/);
  assert.match(css, /\.capability-grid\{/);
  assert.match(css, /\.workflow-line\{/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.plan-card:hover/);
  assert.match(css, /\.plan-featured::before/);
  assert.doesNotMatch(landing, /data-tour-target|data-tour-panel/);
});

test('landing names all nine supported social networks and renders their brand logos', () => {
  const landing = read('public/landing.html');

  for (const platform of ['Facebook','Instagram','LinkedIn','TikTok','YouTube','Pinterest','Threads','Bluesky','X / Twitter']) {
    assert.equal(landing.includes(platform), true, `${platform} should appear in the supported platform section`);
  }

  for (const logoClass of ['facebook-logo','instagram-logo','linkedin-logo','tiktok-logo','youtube-logo','pinterest-logo','threads-logo','bluesky-logo','x-logo']) {
    assert.equal(landing.includes(logoClass), true, `${logoClass} should render as a local inline platform logo`);
  }
  assert.doesNotMatch(landing, /api\.iconify\.design/);
  assert.match(landing, /dashboard-logo-mask/);

  assert.doesNotMatch(landing, /INX Social Admin|Trails & Tales|Ali The Dad|Taslim/);
});

test('landing navigation remains one canonical public experience', () => {
  const landing = read('public/landing.html');

  for (const href of ['#capabilities','#workflow','#platforms','#ai','#pricing']) {
    assert.equal(landing.includes(`href="${href}"`), true, `${href} should be linked from the canonical landing page`);
  }

  assert.match(landing, /href="#platforms"[\s\S]*href="#capabilities"[\s\S]*href="#workflow"[\s\S]*href="#ai"[\s\S]*href="#pricing"/);
  assert.doesNotMatch(landing, /href="\/(?:social-media-scheduler|bulk-social-media-scheduler|ai-social-media-tools|social-media-content-calendar|social-media-analytics|pricing|free-social-media-tools)\.html"/);
});
