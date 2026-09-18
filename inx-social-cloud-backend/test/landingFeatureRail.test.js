const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('landing is capability-first and uses the verified dashboard preview', () => {
  const landing = read('public/landing.html');
  const css = read('public/landing-redesign.css');
  const js = read('public/landing.js');

  for (const area of ['Post Creation','Bulk Scheduler','Content Calendar','Analytics','AI Content Studio','Connected Accounts']) {
    assert.equal(landing.includes(area), true, `${area} should remain on the landing page`);
  }

  assert.equal((landing.match(/\/assets\/inx-social-dashboard\.jpg/g) || []).length, 2);
  assert.doesNotMatch(landing, /data:image\/webp;base64,/);
  assert.equal(landing.includes('inxsocial-dashboard-user-preview.webp'), false);
  assert.equal(landing.includes('dashboard-logo-mask'), false);
  assert.equal(landing.includes('Everything you need to run your social media, in one place'), true);
  assert.equal(landing.includes('From idea to results, in five clear steps'), true);
  assert.match(js, /setupDashboardMotion/);
  assert.match(js, /setupRevealAnimations/);
  assert.match(css, /\.capability-grid\{/);
  assert.match(css, /\.workflow-line\{/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.plan-card:hover/);
  assert.match(css, /\.plan-featured::before/);
});

test('AI Content Studio is a premium static five-feature marketing section', () => {
  const landing = read('public/landing.html');
  const css = read('public/landing-redesign.css');

  assert.equal((landing.match(/class="ai-feature-card/g) || []).length, 5);
  for (const feature of ['Image Post','Carousel Post','Short Video / Reel','UGC Ad Post','Video Clipping']) {
    assert.equal(landing.includes(feature), true, `${feature} should appear in AI Content Studio`);
  }
  assert.equal(landing.includes('Stock Video Creator'), true);
  assert.equal(landing.includes('AI Video Clipping'), true);
  assert.match(landing, /coming soon/i);
  assert.match(css, /\.ai-feature-grid/);
  assert.match(css, /\.ai-feature-wide/);
  assert.match(css, /\.image-post-art/);
  assert.match(css, /\.carousel-post-art/);
  assert.match(css, /\.video-post-art/);
  assert.match(css, /\.ugc-post-art/);
  assert.match(css, /\.clipping-post-art/);
});

test('landing names all nine supported social networks and uses local inline logos', () => {
  const landing = read('public/landing.html');

  for (const platform of ['Facebook','Instagram','LinkedIn','TikTok','YouTube','Pinterest','Threads','Bluesky','X / Twitter']) {
    assert.equal(landing.includes(platform), true, `${platform} should appear in the supported platform section`);
  }

  for (const logoClass of ['facebook-logo','instagram-logo','linkedin-logo','tiktok-logo','youtube-logo','pinterest-logo','threads-logo','bluesky-logo','x-logo']) {
    assert.equal(landing.includes(logoClass), true, `${logoClass} should render locally`);
  }

  assert.doesNotMatch(landing, /api\.iconify\.design/);
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
