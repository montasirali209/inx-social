const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('public landing has canonical metadata, social previews and structured software data', () => {
  const landing = read('public/landing.html');
  assert.match(landing, /<link rel="canonical" href="https:\/\/social\.inaxx\.co\.uk\/">/);
  assert.match(landing, /property="og:title"/);
  assert.match(landing, /name="twitter:card" content="summary_large_image"/);
  assert.match(landing, /"@type": "SoftwareApplication"/);
  assert.match(landing, /"priceCurrency": "GBP"/);
});

test('robots and sitemap expose public documents but exclude private product areas', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  assert.match(robots, /Disallow: \/studio\//);
  assert.match(robots, /Disallow: \/portal\//);
  assert.match(robots, /Sitemap: https:\/\/social\.inaxx\.co\.uk\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/social\.inaxx\.co\.uk\/privacy\.html/);
  assert.doesNotMatch(sitemap, /\/studio\//);
});
