const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('React dashboard uses the live publishing analytics workspace', () => {
  const router = read('frontend/src/router.tsx');
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const data = read('frontend/src/lib/dashboard-api.ts');
  assert.match(router, /DashboardPage/);
  assert.doesNotMatch(router, /FoundationPage/);
  assert.match(dashboard, /PublishingActivityChart/);
  assert.match(dashboard, /PlatformDonutChart/);
  assert.match(dashboard, /RecentPostsCard/);
  assert.match(data, /\/api\/studio\/overview/);
  assert.match(data, /\/api\/studio\/jobs\?limit=250/);
  assert.doesNotMatch(dashboard, /Foundation ready|Railway integrated|React \+ TypeScript/);
});

test('React dashboard is responsive, accessible and uses working navigation', () => {
  const shell = read('frontend/src/components/layout/AppShell.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const studio = read('studio/app.js');
  assert.match(shell, /md:pl-\[88px\].*xl:pl-\[264px\]/);
  assert.match(sidebar, /Create New Post/);
  assert.match(sidebar, /AI Content Studio/);
  assert.match(sidebar, /\/studio\/\?view=/);
  assert.match(dashboard, /overflow-x-auto/);
  assert.match(dashboard, /xl:grid-cols-\[/);
  assert.match(studio, /URLSearchParams\(window\.location\.search\)\.get\('view'\)/);
});
