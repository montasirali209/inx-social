'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Match and Refine exposes one compare action before a best match exists', () => {
  const html = read('public/index.html');
  const js = read('public/ui-studio.js');

  assert.match(html, /id="uiStudioPhase5RunBtn"[^>]*>◎ Compare & improve<\/button>/);
  assert.doesNotMatch(js, /Compare uploaded reference/);
  assert.match(js, /const hasBestMatch = Boolean\(state\.project\.bestGenerationId\)/);
  assert.match(js, /next\.hidden = !hasBestMatch/);
  assert.match(js, /next\.textContent = 'Review best match →'/);
});

test('canvas edits default to all responsive sizes', () => {
  const js = read('public/ui-studio.js');

  assert.match(js, /canvasEditScope: 'ALL'/);
  assert.match(js, /All responsive sizes \(default\)/);
  assert.match(js, /function globalCanvasEdit/);
  assert.match(js, /function canvasEditsForViewport/);
  assert.match(js, /const globals = pendingCanvasEdits\(\)\.filter\(edit => edit\.styleScope === 'ALL'\)/);
  assert.match(js, /state\.canvasEditScope = .*\|\| 'ALL'/);
});

test('global edits replay into desktop tablet and mobile previews with local overrides after them', () => {
  const js = read('public/ui-studio.js');

  assert.match(js, /const edits = canvasEditsForViewport\(\)\.map/);
  assert.match(js, /const locals = Object\.values\(canvasViewportEdits\(viewport\)\)\.filter\(edit => edit\.styleScope !== 'ALL'\)/);
  assert.match(js, /return \[\.\.\.globals, \.\.\.locals\]/);
  assert.match(js, /styleScope: scope/);
  assert.match(js, /scope === 'ALL'/);
  assert.match(js, /scope === 'VIEWPORT'/);
});

test('viewport-only remains available as an explicit override', () => {
  const js = read('public/ui-studio.js');

  assert.match(js, /This viewport only/);
  assert.match(js, /event\.target\.value === 'VIEWPORT' \? 'VIEWPORT' : 'ALL'/);
});

test('UI Studio assets are cache-bumped after responsive edit sync', () => {
  const html = read('public/index.html');
  assert.match(html, /ui-studio\.css\?v=11/);
  assert.match(html, /ui-studio\.js\?v=11/);
});
