const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const canonicalPages = [
  ['ai-social-media-post-generator.html', 'https://www.inxsocial.co.uk/ai-social-media-post-generator.html'],
  ['generate-and-schedule-social-media-posts.html', 'https://www.inxsocial.co.uk/generate-and-schedule-social-media-posts.html']
];
const consolidatedPages = [
  'ai-video-post-generator.html',
  'ai-carousel-post-generator.html',
  'ai-ugc-ad-generator.html'
];

test('canonical AI acquisition pages are indexable and self-canonical', () => {
  for (const [file, canonical] of canonicalPages) {
    const html = read(`public/${file}`);
    assert.match(html, /<meta name="robots" content="index,follow/);
    assert.equal(html.includes(`<link rel="canonical" href="${canonical}">`), true, `${file} should have its canonical URL`);
    assert.match(html, /portal\/register\.html\?plan=PRO/);
  }
});

test('AI Content Studio links the canonical acquisition journeys only', () => {
  const html = read('public/ai-social-media-tools.html');
  for (const [file] of canonicalPages) assert.equal(html.includes(`/${file}`), true, `${file} should be internally linked`);
  for (const file of consolidatedPages) assert.equal(html.includes(`/${file}`), false, `${file} should not remain internally linked`);
});

test('sitemap and llms documentation exclude consolidated AI format URLs', () => {
  const sitemap = read('public/sitemap.xml');
  const llms = read('public/llms.txt');
  for (const [file, canonical] of canonicalPages) {
    assert.equal(sitemap.includes(canonical), true, `${file} should be in sitemap`);
    assert.equal(llms.includes(canonical), true, `${file} should be in llms.txt`);
  }
  for (const file of consolidatedPages) {
    assert.equal(sitemap.includes(file), false, `${file} should not be in sitemap`);
    assert.equal(llms.includes(`https://www.inxsocial.co.uk/${file}`), false, `${file} should not be a public reference page`);
  }
  assert.equal(sitemap.includes('30-day-social-media-content-planner.html'), false);
});

test('retired AI format URLs permanently redirect to AI Content Studio', () => {
  const app = read('src/app.js');
  for (const file of consolidatedPages) assert.equal(app.includes(`/${file}`), true, `${file} should have a redirect route`);
  assert.match(app, /res\.redirect\(308, '\/ai-social-media-tools\.html'\)/);
});
