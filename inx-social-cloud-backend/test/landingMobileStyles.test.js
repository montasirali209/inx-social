const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('landing loads mobile responsive overrides before first paint', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  const script = fs.readFileSync(path.resolve(__dirname, '../public/landing.js'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../public/landing-mobile.css'), 'utf8');
  const landing = fs.readFileSync(path.resolve(__dirname, '../public/landing.html'), 'utf8');
  assert.match(app, /landing-mobile\.css\?v=20260910c/);
  assert.doesNotMatch(script, /landing-mobile\.css/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /\.hero-layout,.intelligence-grid\{grid-template-columns:1fr/);
  assert.match(css, /#mainNav\.open\{display:flex\}/);
  assert.match(landing, /class="brand"[^>]*><img src="\/assets\/inx-social-wordmark\.png"/);
});

test('mobile landing keeps the full wordmark visible and workflow links out of content rows', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../public/landing-mobile.css'), 'utf8');
  assert.doesNotMatch(app, /<img src="\/assets\/inx-social-logo\.png" width="42" height="42"/);
  assert.match(css, /\.site-header \.brand img\{width:154px;height:54px;object-fit:cover;object-position:center;margin:0\}/);
  assert.match(css, /\.footer-brand \.brand img\{width:176px;height:62px;object-fit:cover;object-position:center;margin:0\}/);
  assert.match(css, /\.capability-card \.card-link\{position:static;/);
  assert.doesNotMatch(css, /\.card-link\{left:24px;bottom:22px\}/);
});
