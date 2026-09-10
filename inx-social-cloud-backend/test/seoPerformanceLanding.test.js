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
  assert.match(app, /landing-performance\.css\?v=20260910a/);
  assert.match(landing, /inx-social-wordmark\.png/);
  assert.doesNotMatch(app, /brand-text/);
  assert.match(app, /Cache-Control', 'public, max-age=0, must-revalidate/);
});

test('responsive stylesheet is not injected after first paint', () => {
  const landingJs = read('public/landing.js');
  assert.doesNotMatch(landingJs, /createElement\(['"]link['"]\)/);
  assert.doesNotMatch(landingJs, /landing-mobile\.css/);
});

test('private application routes are excluded from crawling and sitemap is current', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  assert.match(robots, /Disallow: \/app\//);
  assert.match(robots, /Sitemap: https:\/\/social\.inaxx\.co\.uk\/sitemap\.xml/);
  assert.match(sitemap, /<lastmod>2026-09-10<\/lastmod>/);
  assert.doesNotMatch(sitemap, /\/app\//);
});

test('landing retains canonical and software application structured data', () => {
  const landing = read('public/landing.html');
  assert.match(landing, /rel="canonical" href="https:\/\/social\.inaxx\.co\.uk\/"/);
  assert.match(landing, /"SoftwareApplication"/);
  assert.match(landing, /"WebApplication"/);
  assert.match(landing, /max-image-preview:large/);
});
