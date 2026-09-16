const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('content creator landing describes the real ready-to-publish workflow', () => {
  const page = read('public/for-content-creators.html');
  assert.match(page, /Create the post, not just the asset\./);
  assert.match(page, /caption \+ hashtags/i);
  assert.match(page, /schedule or publish/i);
  assert.match(page, /content creators/i);
  assert.match(page, /\/ai-social-media-post-generator\.html/);
});

test('content creator landing is discoverable in sitemap and llms.txt', () => {
  const sitemap = read('public/sitemap.xml');
  const llms = read('public/llms.txt');
  assert.match(sitemap, /https:\/\/www\.inxsocial\.co\.uk\/for-content-creators\.html/);
  assert.match(llms, /For content creators: https:\/\/www\.inxsocial\.co\.uk\/for-content-creators\.html/);
});
