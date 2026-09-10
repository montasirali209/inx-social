const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('landing loads mobile responsive overrides before first paint', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  const script = fs.readFileSync(path.resolve(__dirname, '../public/landing.js'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../public/landing-mobile.css'), 'utf8');
  assert.match(app, /landing-mobile\.css/);
  assert.doesNotMatch(script, /landing-mobile\.css/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /\.hero-layout,.intelligence-grid\{grid-template-columns:1fr/);
  assert.match(css, /#mainNav\.open\{display:flex\}/);
});
