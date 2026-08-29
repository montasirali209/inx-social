const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Create New Post is universally available from the sidebar', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  assert.match(sidebar, /href="\/studio\/\?view=posts"/);
  assert.match(sidebar, /Create New Post/);
  assert.doesNotMatch(dashboard, /Create New Post/);
});

test('Dashboard compacts responsively without browser zoom manipulation', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const shell = read('frontend/src/components/layout/AppShell.tsx');
  const topbar = read('frontend/src/components/layout/Topbar.tsx');

  assert.match(dashboard, /xl:grid-cols-\[minmax/);
  assert.match(dashboard, /overflow-x-auto/);
  assert.match(shell, /sm:p-5 xl:p-6/);
  assert.match(topbar, /min-h-\[78px\]/);
  assert.doesNotMatch(`${dashboard}${shell}`, /zoom\s*:|scale\(0\.|transform:\s*scale/);
});
