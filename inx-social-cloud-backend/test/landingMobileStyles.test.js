const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = relative => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

test('redesigned landing ships responsive rules in the render-critical stylesheet', () => {
  const landing = read('public/landing.html');
  const script = read('public/landing.js');
  const css = read('public/landing-redesign.css');

  assert.match(landing, /landing-redesign\.css\?v=20260918a/);
  assert.doesNotMatch(script, /createElement\(['"]link['"]\)/);
  assert.match(css, /@media\(max-width:1080px\)/);
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /@media\(max-width:640px\)/);
  assert.match(css, /#mainNav\.open\{display:flex\}/);
  assert.match(css, /scroll-snap-type:x mandatory/);
});

test('mobile landing stacks complex grids and preserves accessible navigation', () => {
  const css = read('public/landing-redesign.css');
  const landing = read('public/landing.html');

  assert.match(css, /\.hero-layout\{grid-template-columns:1fr\}/);
  assert.match(css, /\.tour-panel\{grid-template-columns:1fr\}/);
  assert.match(css, /\.final-cta-card\{grid-template-columns:1fr\}/);
  assert.match(landing, /aria-label="Open navigation"/);
  assert.match(landing, /class="skip-link"/);
});
