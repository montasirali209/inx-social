const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('landing response applies SEO title, description and redesigned render-critical styles server-side', () => {
  const app = read('src/app.js');
  const landing = read('public/landing.html');
  assert.match(landing, /landing-redesign\.css\?v=20260918a/);
  assert.match(landing, /landing\.js\?v=20260918b/);
  assert.match(landing, /<title>All-in-One Social Media Management &amp; AI Content \| INXSocial<\/title>/);
  assert.match(landing, /Manage connected social accounts, create posts and media with AI/);
  assert.match(landing, /inx-social-wordmark\.png/);
  assert.match(app, /return injectAnalyticsConsent\(source\)/);
  assert.match(app, /Cache-Control', 'public, max-age=0, must-revalidate/);
});

test('server-rendered landing exposes all current social networks', () => {
  const landing = read('public/landing.html');
  assert.match(landing, /9 supported networks/);
  for (const platform of ['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Pinterest', 'Threads', 'Bluesky']) {
    assert.equal(landing.includes(platform), true, `${platform} should appear in the server-rendered landing`);
  }
  assert.match(landing, />X<\/span>/);
});

test('responsive stylesheet is not injected after first paint', () => {
  const landing = read('public/landing.html');
  const landingJs = read('public/landing.js');
  assert.match(landing, /landing-redesign\.css/);
  assert.doesNotMatch(landingJs, /createElement\(['"]link['"]\)/);
  assert.doesNotMatch(landingJs, /landing-mobile\.css/);
});

test('crawl controls consolidate the marketing site while preserving noindex app surfaces', () => {
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

test('landing retains canonical and software application structured data', () => {
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

test('GEO documentation describes product capability without publishing duplicate marketing URLs', () => {
  const llms = read('public/llms.txt');
  for (const platform of ['Facebook','Instagram','LinkedIn','TikTok','YouTube','Pinterest','Threads','Bluesky']) {
    assert.equal(llms.includes(platform), true, `${platform} missing from llms.txt`);
  }
  assert.match(llms, /X \/ Twitter/);
  assert.match(llms, /Google Business is not currently supplied/);
  assert.match(llms, /Canonical website: https:\/\/www\.inxsocial\.co\.uk\//);
  assert.doesNotMatch(llms, /https:\/\/www\.inxsocial\.co\.uk\/(?:social-media|bulk-social|ai-social|free-social|pricing)/);
});
