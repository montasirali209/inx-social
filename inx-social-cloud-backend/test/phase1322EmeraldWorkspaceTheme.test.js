const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('shared React shell uses the approved emerald workspace palette', () => {
  const css = read('frontend/src/index.css');
  assert.match(css, /--color-brand-blue: #14b8a6;/);
  assert.match(css, /--color-brand-cyan: #2dd4bf;/);
  assert.match(css, /--color-sidebar: #03111e;/);
  assert.match(css, /rgba\(20, 184, 166, 0\.18\)/);
});

test('sidebar exposes one universal Create New Post action above navigation', () => {
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const actionIndex = sidebar.indexOf('Create New Post');
  const navigationIndex = sidebar.indexOf('<nav aria-label="Main navigation"');
  assert.ok(actionIndex > -1, 'Create New Post action is missing');
  assert.ok(navigationIndex > actionIndex, 'Create New Post must appear above navigation');
  assert.match(sidebar, /to="\/posts"/);
  assert.match(sidebar, /<FilePlus2/);
});
