const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('public landing exposes consistent canonical search and social metadata', () => {
  const html = read('public/landing.html');
  assert.match(html, /<title>Facebook Reels Scheduler for Pages \| INX Social<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/social\.inaxx\.co\.uk\/">/);
  assert.match(html, /hreflang="x-default"/);
  assert.match(html, /twitter:image:alt/);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const schema = JSON.parse(scripts[0][1]);
  assert.ok(schema['@graph'].some(node => node['@type'] === 'WebPage'));
  assert.ok(schema['@graph'].some(node => Array.isArray(node['@type']) && node['@type'].includes('WebApplication')));
  assert.doesNotMatch(html, /aggregateRating|reviewCount/);
});

test('crawl controls publish the canonical sitemap and exclude private workspaces', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  const app = read('src/app.js');
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/studio\//);
  assert.match(robots, /Sitemap: https:\/\/social\.inaxx\.co\.uk\/sitemap\.xml/);
  assert.match(sitemap, /<lastmod>2026-08-23<\/lastmod>/);
  assert.match(app, /X-Robots-Tag', 'noindex, nofollow, noarchive/);
  assert.match(app, /stale-while-revalidate=86400/);
  assert.match(read('public/llms.txt'), /Canonical website: https:\/\/social\.inaxx\.co\.uk\//);
});
