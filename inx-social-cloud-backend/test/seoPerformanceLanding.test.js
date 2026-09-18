const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('landing response applies SEO title, description and render-critical styles server-side', () => {
  const app = read('src/app.js');
  const landing = read('public/landing.html');

  assert.match(landing, /landing-redesign\\.css\\?v=20260918f/);
  assert.match(landing, /landing\.js\?v=20260918d/);
  assert.match(landing, /<title>INXSocial \| Create, Schedule, Analyse &amp; Manage Social Media<\/title>/);
  assert.match(landing, /Manage connected social accounts, create content with AI/);
  assert.match(landing, /inx-social-wordmark\.png/);
  assert.match(app, /return injectAnalyticsConsent\(source\)/);
  assert.match(app, /Cache-Control', 'public, max-age=0, must-revalidate/);
});

test('server-rendered landing exposes all current social networks', () => {
  const landing = read('public/landing.html');
  assert.match(landing, /9 supported social platforms/);

  for (const platform of ['Facebook','Instagram','LinkedIn','TikTok','YouTube','Pinterest','Threads','Bluesky','X \/ Twitter']) {
    assert.match(landing, new RegExp(platform));
  }
});

test('responsive stylesheet is present before first paint', () => {
  const landing = read('public/landing.html');
  const landingJs = read('public/landing.js');

  assert.match(landing, /landing-redesign\.css/);
  assert.doesNotMatch(landingJs, /createElement\(['"]link['"]\)/);
  assert.doesNotMatch(landingJs, /landing-mobile\.css/);
});

test('crawl controls consolidate marketing URLs while app surfaces remain noindex', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  const app = read('src/app.js');

  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(app, /\['\/admin', '\/index\.html', '\/api', '\/portal', '\/studio', '\/app', '\/health', '\/oauth-callback\.html'\]/);
  assert.match(app, /X-Robots-Tag', 'noindex, nofollow, noarchive'/);
  assert.equal((sitemap.match(/<url>/g) || []).length, 1);
  assert.doesNotMatch(sitemap, /social-media-scheduler\.html|pricing\.html|free-social-media-tools\.html/);
});

test('landing retains canonical structured data and current AI capabilities', () => {
  const landing = read('public/landing.html');

  assert.match(landing, /rel="canonical" href="https:\/\/www\.inxsocial\.co\.uk\/"/);
  assert.match(landing, /"SoftwareApplication"/);
  assert.match(landing, /"WebApplication"/);
  assert.match(landing, /"WebSite"/);
  assert.match(landing, /max-image-preview:large/);
  assert.match(landing, /Image Post/);
  assert.match(landing, /Carousel Post/);
  assert.match(landing, /Short Video \/ Reel/);
  assert.match(landing, /UGC Ad Post/);
  assert.match(landing, /Stock Video Creator/);
  assert.match(landing, /AI Video Clipping/);
  assert.match(landing, /coming soon/i);
});

test('GEO documentation describes capability without duplicate public microsites', () => {
  const llms = read('public/llms.txt');

  for (const platform of ['Facebook','Instagram','LinkedIn','TikTok','YouTube','Pinterest','Threads','Bluesky']) {
    assert.equal(llms.includes(platform), true, `${platform} missing from llms.txt`);
  }

  assert.match(llms, /X \/ Twitter/);
  assert.match(llms, /Google Business is not currently supplied/);
  assert.match(llms, /Canonical website: https:\/\/www\.inxsocial\.co\.uk\//);
  assert.doesNotMatch(llms, /https:\/\/www\.inxsocial\.co\.uk\/(?:social-media|bulk-social|ai-social|free-social|pricing)/);
});
