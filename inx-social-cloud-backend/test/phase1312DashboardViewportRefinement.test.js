const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 13.1.2 makes Create post the primary dashboard action', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  assert.match(dashboard, /href="\/studio\/\?view=posts"/);
  assert.match(dashboard, /> Create post<\/a>/);
  assert.doesNotMatch(dashboard, /> Upload video<\/a>/);
});

test('Phase 13.1.2 compacts the desktop workspace without browser zoom manipulation', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const shell = read('frontend/src/components/layout/AppShell.tsx');
  const topbar = read('frontend/src/components/layout/Topbar.tsx');
  const actions = read('frontend/src/components/dashboard/QuickActionsCard.tsx');

  assert.match(dashboard, /mt-4 grid items-start gap-4/);
  assert.match(shell, /sm:p-5 xl:p-6/);
  assert.match(topbar, /min-h-16/);
  assert.match(actions, /2xl:grid-cols-4/);
  assert.doesNotMatch(`${dashboard}${shell}`, /zoom\s*:|scale\(0\.|transform:\s*scale/);
});
