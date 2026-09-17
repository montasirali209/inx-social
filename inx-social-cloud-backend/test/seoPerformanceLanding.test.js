const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('landing response applies SEO title, description and render-critical styles server-side', () => {
  const app = read('src/app.js');
  const landing = read('public/landing.html');
  assert.match(app, /landing-mobile\.css\?v=20260910c/);
  assert.match(app, /landing-performance\.css\?v=20260911b/);
  assert.match(app, /landing-brand\.css\?v=20260911b/);
  assert.match(app, /landing\.js\?v=20260917a/);
  assert.match(landing, /<title>All-in-One Social Media Management &amp; AI Content \| INXSocial<\/title>/);
  assert.match(landing, /Manage connected social accounts, create posts and media with AI/);
  assert.match(landing, /landing-ai-studio\.css\?v=20260915a/);
  assert.match(landing, /inx-social-wordmark\.png/);
  assert.doesNotMatch(app, /brand-text/);
  assert.match(app, /Cache-Control', 'public, max-age=0, must-revalidate/);
});

test('server-rendered landing fallback exposes all current social networks', () => {
  const app = read('src/app.js');
  assert.match(app, /9 supported networks/);
  for (const platform of ['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Pinterest', 'Threads', 'Bluesky']) {
    assert.equal(app.includes(platform), true, `${platform} should appear in the server-rendered platform rail replacement`);
  }
  assert.match(app, /<div class="platform-pill more">X<\/div>/);
});

test('responsive stylesheet is not injected after first paint', () => {
  const landingJs = read('public/landing.js');
  assert.doesNotMatch(landingJs, /createElement\(['"]link['"]\)/);
  assert.doesNotMatch(landingJs, /landing-mobile\.css/);
});

test('legacy utility routes can expose noindex while public SEO pages stay discoverable', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  const app = read('src/app.js');
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /Disallow: \/app\//);
  assert.doesNotMatch(robots, /Disallow: \/portal\//);
  assert.doesNotMatch(robots, /Disallow: \/studio\//);
  assert.match(app, /\['\/admin', '\/index\.html', '\/api', '\/portal', '\/studio', '\/app', '\/health', '\/oauth-callback\.html'\]/);
  assert.match(app, /X-Robots-Tag', 'noindex, nofollow, noarchive'/);
  assert.match(robots, /Sitemap: https:\/\/www\.inxsocial\.co\.uk\/sitemap\.xml/);
  assert.match(sitemap, /social-media-scheduler\.html/);
  assert.match(sitemap, /bulk-social-media-scheduler\.html/);
  assert.match(sitemap, /social-media-content-calendar\.html/);
  assert.match(sitemap, /social-media-analytics\.html/);
  assert.match(sitemap, /ai-social-media-tools\.html/);
  assert.match(sitemap, /pricing\.html/);
  assert.doesNotMatch(sitemap, /\/app\//);
  assert.doesNotMatch(sitemap, /\/portal\//);
  assert.doesNotMatch(sitemap, /\/studio\//);
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
  assert.match(landing, /Coming soon/i);
});

test('SEO product pages have unique titles, canonicals and indexable copy', () => {
  const pages = [
    ['public/social-media-scheduler.html', 'Social Media Scheduler for Multiple Platforms', 'social-media-scheduler.html'],
    ['public/bulk-social-media-scheduler.html', 'Bulk Social Media Scheduler for Multiple Accounts', 'bulk-social-media-scheduler.html'],
    ['public/social-media-content-calendar.html', 'Social Media Content Calendar & Publishing Planner', 'social-media-content-calendar.html'],
    ['public/social-media-analytics.html', 'Social Media Analytics Dashboard', 'social-media-analytics.html'],
    ['public/ai-social-media-tools.html', 'AI Social Media Content Studio', 'ai-social-media-tools.html'],
    ['public/pricing.html', 'INXSocial Pricing', 'pricing.html']
  ];

  for (const [file, title, canonical] of pages) {
    const html = read(file);
    assert.match(html, new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(html, /<meta name="description" content="[^"]{60,}/);
    assert.match(html, /<meta name="robots" content="index,follow/);
    assert.match(html, new RegExp(`rel="canonical" href="https:\\/\\/www\\.inxsocial\\.co\\.uk\\/${canonical.replace('.', '\\.')}`));
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /href="\/social-media-scheduler\.html"/);
  }
});

test('scheduler and GEO documentation expose the nine-network publishing scope', () => {
  const scheduler = read('public/social-media-scheduler.html');
  const bulk = read('public/bulk-social-media-scheduler.html');
  const createAndSchedule = read('public/generate-and-schedule-social-media-posts.html');
  const llms = read('public/llms.txt');
  const platforms = ['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Pinterest', 'Threads', 'Bluesky'];

  for (const platform of platforms) {
    assert.equal(scheduler.includes(platform), true, `${platform} missing from scheduler SEO page`);
    assert.equal(llms.includes(platform), true, `${platform} missing from llms.txt`);
  }
  assert.match(scheduler, /Bluesky and X/);
  assert.match(bulk, /Bluesky and X/);
  assert.match(createAndSchedule, /Bluesky and X/);
  assert.match(llms, /X \/ Twitter/);
  assert.match(llms, /Google Business is not currently supplied/);
});
