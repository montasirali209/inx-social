const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('redesigned landing keeps the full INXSocial wordmark visible in header and footer', () => {
  const landing = read('public/landing.html');
  const css = read('public/landing-redesign.css');

  assert.match(landing, /class="brand"[\s\S]*?<img src="\/assets\/inx-social-wordmark-small\.webp"/);
  assert.match(landing, /footer-brand[\s\S]*inx-social-wordmark-small\.webp/);
  assert.ok(fs.statSync(path.join(root, 'public/assets/inx-social-wordmark-small.webp')).size < 50_000);
  assert.match(css, /\.brand img\{width:168px;height:56px;object-fit:cover;object-position:center/);
  assert.match(css, /@media\(max-width:860px\)[\s\S]*\.brand img\{width:150px;height:52px\}/);
  assert.doesNotMatch(css, /brand-text/);
});
