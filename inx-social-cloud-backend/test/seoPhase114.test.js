const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('public landing exposes consistent canonical search and social metadata', () => {
  const html = read('public/landing.html');
  assert.match(html, /<title>All-in-One Social Media Management &amp; AI Content \| INXSocial<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.inxsocial\.co\.uk\/">/);
  assert.match(html, /hreflang="x-default"/);
  assert.match(html, /twitter:image:alt/);
  assert.match(html, /All-in-one social media management \+ AI creation/i);
  assert.match(html, /AI Content Studio/);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const schema = JSON.parse(scripts[0][1]);
  assert.ok(schema['@graph'].some(node => node['@type'] === 'WebPage'));
  assert.ok(schema['@graph'].some(node => Array.isArray(node['@type']) && node['@type'].includes('WebApplication')));
  assert.ok(schema['@graph'].some(node => node['@type'] === 'FAQPage'));
  assert.doesNotMatch(html, /aggregateRating|reviewCount/);
});

test('crawl controls publish the canonical sitemap and let legacy utility URLs expose noindex', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  const app = read('src/app.js');
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /Disallow: \/studio\//);
  assert.doesNotMatch(robots, /Disallow: \/portal\//);
  assert.doesNotMatch(robots, /Disallow: \/app\//);
  assert.match(robots, /Sitemap: https:\/\/www\.inxsocial\.co\.uk\/sitemap\.xml/);
  assert.match(sitemap, /<lastmod>2026-09-18<\/lastmod>/);
  assert.doesNotMatch(sitemap, /\/studio\//);
  assert.doesNotMatch(sitemap, /\/portal\//);
  assert.doesNotMatch(sitemap, /\/app\//);
  assert.match(app, /X-Robots-Tag', 'noindex, nofollow, noarchive/);
  assert.match(app, /stale-while-revalidate=86400/);
  const llms = read('public/llms.txt');
  assert.match(llms, /Canonical website: https:\/\/www\.inxsocial\.co\.uk\//);
  assert.match(llms, /all-in-one browser-based social media management platform/i);
  assert.match(llms, /AI Video Clipping is an upcoming feature/i);
});