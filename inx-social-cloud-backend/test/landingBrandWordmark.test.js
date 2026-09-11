const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('landing page keeps the full INXSocial wordmark visible and large enough at desktop and mobile sizes', () => {
  const app = read('src/app.js');
  const brand = read('public/landing-brand.css');
  const performance = read('public/landing-performance.css');

  assert.match(app, /landing-brand\.css\?v=20260911b/);
  assert.match(app, /landing-performance\.css\?v=20260911b/);
  assert.match(brand, /\.site-header \.brand\{[\s\S]*width:202px[\s\S]*overflow:hidden/);
  assert.match(brand, /\.site-header \.brand>img\{[\s\S]*width:178px[\s\S]*transform:scale\(1\.9\)/);
  assert.match(brand, /object-fit:contain/);
  assert.match(brand, /\.footer-brand \.brand>img\{[\s\S]*transform:scale\(1\.95\)/);
  assert.match(brand, /@media \(max-width:900px\)[\s\S]*transform:scale\(1\.78\)/);
  assert.doesNotMatch(performance, /\.brand>img\{width:42px;height:42px/);
  assert.doesNotMatch(performance, /flex-basis:40px|flex-basis:36px/);
});
