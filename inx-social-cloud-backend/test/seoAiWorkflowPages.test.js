const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const retiredAiRoutes = [
  '/ai-social-media-tools.html',
  '/ai-social-media-post-generator.html',
  '/generate-and-schedule-social-media-posts.html',
  '/ai-video-post-generator.html',
  '/ai-carousel-post-generator.html',
  '/ai-ugc-ad-generator.html'
];

test('legacy AI acquisition URLs permanently redirect into canonical clean feature pages', () => {
  const app = read('src/app.js');
  for (const route of retiredAiRoutes) {
    assert.equal(app.includes(`'${route}'`), true, `${route} should keep a redirect for existing links and search results`);
  }
  assert.match(app, /'\/ai-social-media-tools\.html': '\/#intelligence'/);
  assert.match(app, /'\/generate-and-schedule-social-media-posts\.html': '\/#workflows'/);
  assert.match(app, /res\.redirect\(301,/);
});

test('canonical sitemap and llms documentation advertise clean AI URLs, not retired html URLs', () => {
  const sitemap = read('public/sitemap.xml');
  const llms = read('public/llms.txt');
  for (const route of retiredAiRoutes) {
    assert.equal(sitemap.includes(route), false, `${route} should not be in sitemap.xml`);
    assert.equal(llms.includes(route), false, `${route} should not be in llms.txt`);
  }
  assert.match(llms, /AI Content Studio/);
  assert.match(llms, /Short Video \/ Reel/);
});
