const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const pages = [
  ['ai-social-media-post-generator.html', 'https://www.inxsocial.co.uk/ai-social-media-post-generator.html'],
  ['ai-video-post-generator.html', 'https://www.inxsocial.co.uk/ai-video-post-generator.html'],
  ['ai-carousel-post-generator.html', 'https://www.inxsocial.co.uk/ai-carousel-post-generator.html'],
  ['ai-ugc-ad-generator.html', 'https://www.inxsocial.co.uk/ai-ugc-ad-generator.html'],
  ['generate-and-schedule-social-media-posts.html', 'https://www.inxsocial.co.uk/generate-and-schedule-social-media-posts.html']
];

test('ready-to-publish AI acquisition pages are indexable and canonical', () => {
  for (const [file, canonical] of pages) {
    const html = read(`public/${file}`);
    assert.match(html, /<meta name="robots" content="index,follow/);
    assert.equal(html.includes(`<link rel="canonical" href="${canonical}">`), true, `${file} should have its canonical URL`);
    assert.match(html, /portal\/register\.html\?plan=PRO/);
  }
});

test('AI Content Studio internally links all ready-to-publish acquisition pages', () => {
  const html = read('public/ai-social-media-tools.html');
  for (const [file] of pages) assert.equal(html.includes(`/${file}`), true, `${file} should be internally linked`);
});

test('sitemap and llms documentation include all ready-to-publish acquisition pages', () => {
  const sitemap = read('public/sitemap.xml');
  const llms = read('public/llms.txt');
  for (const [file, canonical] of pages) {
    assert.equal(sitemap.includes(canonical), true, `${file} should be in sitemap`);
    assert.equal(llms.includes(canonical), true, `${file} should be in llms.txt`);
  }
  assert.equal(sitemap.includes('30-day-social-media-content-planner.html'), false);
});
