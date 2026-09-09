const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('workspace mobile CSS prevents viewport-wide tool overflow', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../frontend/src/mobile-responsive.css'), 'utf8');
  assert.match(css, /#main-content \{ width: 100%; padding: 12px; overflow-x: clip; \}/);
  assert.match(css, /\.route-stage \{ width: 100%; overflow-x: clip; \}/);
  assert.match(css, /\.route-stage table/);
  assert.match(css, /\.analytics-fluid-canvas/);
});
