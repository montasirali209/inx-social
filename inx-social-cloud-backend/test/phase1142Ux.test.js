const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Phase 11.4.2 presents explicit content outputs, model credits and a custom image picker', () => {
  const html = read('studio/index.html');
  for (const output of ['TEXT', 'IMAGE', 'CAROUSEL', 'VIDEO', 'REEL']) {
    assert.match(html, new RegExp(`value="${output}"`));
  }
  assert.match(html, /class="agent-file-picker"/);
  assert.match(html, /id="agentCreditPreview"/);
  assert.match(html, /Activity history/);
  assert.match(html, /Live work monitor/);
});

test('runtime rendering avoids timeline flicker and removes duplicated blocker cards', () => {
  const app = read('studio/app.js');
  assert.match(app, /signature !== agentTimelineSignature/);
  assert.match(app, /monitorSignature !== agentMonitorSignature/);
  assert.doesNotMatch(app, /<article class="has-blocker">/);
  assert.match(app, /passive:\s*true/);
});

test('final stylesheet hides the native file input and disables timeline re-animation', () => {
  const css = read('studio/styles.css');
  assert.match(css, /\.agent-file-input\s*\{[\s\S]*?opacity:\s*0\s*!important/);
  assert.match(css, /\.timeline-event\s*\{\s*animation:\s*none\s*!important/);
});
