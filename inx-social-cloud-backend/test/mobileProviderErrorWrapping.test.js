const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('analytics mobile rules wrap long provider error text', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../frontend/src/mobile-responsive.css'), 'utf8');
  assert.match(css, /overflow-wrap: anywhere/);
});
