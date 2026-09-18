const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('redesigned landing keeps the full INXSocial wordmark visible in header and footer', () => {
  const landing = read('public/landing.html');
  const css = read('public/landing-redesign.css');

  assert.match(landing, /class="brand"[^>]*><img src="\/assets\/inx-social-wordmark\.png"/);
  assert.match(landing, /footer-brand[\s\S]*inx-social-wordmark\.png/);
  assert.match(css, /\.brand img\{width:176px;height:60px;object-fit:cover;object-position:center/);
  assert.match(css, /@media\(max-width:900px\)[\s\S]*\.brand img\{width:154px;height:54px\}/);
  assert.doesNotMatch(css, /brand-text/);
});
