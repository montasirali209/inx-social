const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('landing response applies SEO title, description and render-critical styles server-side', () => {
  const app = read('src/app.js');
  const landing = read('public/landing.html');
  assert.match(app, /Social Media Scheduler &amp; Publishing Tool \| INXSocial/);
  assert.match(app, /Schedule and publish social media content from one workspace/);
  assert.match(app, /landing-mobile\.css\?v=20260910c/);
  assert.match(app, /landing-performance\.css\?v=20260911b/);
  assert.match(app, /landing-brand\.css\?v=20260911a/);
  assert.match(landing, /inx-social-wordmark\.png/);
  assert.doesNotMatch(app, /brand-text/);
  assert.match(app, /Cache-Control', 'public, max-age=0, must-revalidate/);
});

test('responsive stylesheet is not injected after first paint', () => {
  const landingJs = read('public/landing.js');
  assert.doesNotMatch(landingJs, /createElement\(['"]link['"]\)/);
  assert.doesNotMatch(landingJs, /landing-mobile\.css/);
});

test('private application routes are excluded while public SEO pages are discoverable', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/app\//);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/social\.inaxx\.co\.uk\/sitemap\.xml/);
  assert.match(sitemap, /social-media-scheduler\.html/);
  assert.match(sitemap, /social-media-analytics\.html/);
  assert.match(sitemap, /ai-social-media-tools\.html/);
  assert.match(sitemap, /pricing\.html/);
  assert.doesNotMatch(sitemap, /\/app\//);
});

test('landing retains canonical and software application structured data', () => {
  const landing = read('public/landing.html');
  assert.match(landing, /rel="canonical" href="https:\/\/social\.inaxx\.co\.uk\/"/);
  assert.match(landing, /"SoftwareApplication"/);
  assert.match(landing, /"WebApplication"/);
  assert.match(landing, /"WebSite"/);
  assert.match(landing, /max-image-preview:large/);
});

test('SEO product pages have unique titles, canonicals and indexable copy', () => {
  const pages = [
    ['public/social-media-scheduler.html', 'Social Media Scheduler for Multiple Platforms', 'social-media-scheduler.html'],
    ['public/social-media-analytics.html', 'Social Media Analytics Dashboard', 'social-media-analytics.html'],
    ['public/ai-social-media-tools.html', 'AI Social Media Tools for Captions, Images & Video', 'ai-social-media-tools.html'],
    ['public/pricing.html', 'INXSocial Pricing', 'pricing.html']
  ];

  for (const [file, title, canonical] of pages) {
    const html = read(file);
    assert.match(html, new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(html, /<meta name="description" content="[^"]{60,}/);
    assert.match(html, /<meta name="robots" content="index,follow/);
    assert.match(html, new RegExp(`rel="canonical" href="https:\\/\\/social\\.inaxx\\.co\\.uk\\/${canonical.replace('.', '\\.')}`));
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /href="\/social-media-scheduler\.html"/);
    assert.match(html, /href="\/pricing\.html"/);
  }
});