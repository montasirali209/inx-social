const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 13.1 replaces the foundation preview with the live video scheduler dashboard', () => {
  const router = read('frontend/src/router.tsx');
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const data = read('frontend/src/lib/dashboard-api.ts');
  assert.match(router, /DashboardPage/);
  assert.doesNotMatch(router, /FoundationPage/);
  assert.match(dashboard, /Your video scheduling workspace/);
  assert.match(data, /\/api\/studio\/overview/);
  assert.match(data, /\/api\/studio\/jobs\?limit=250/);
  assert.doesNotMatch(dashboard, /Foundation ready|Railway integrated|React \+ TypeScript/);
});

test('Phase 13.1 dashboard is responsive, accessible and uses working navigation', () => {
  const shell = read('frontend/src/components/layout/AppShell.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const queue = read('frontend/src/components/dashboard/PublishingQueueTable.tsx');
  const studio = read('studio/app.js');
  assert.match(shell, /md:pl-\[88px\].*xl:pl-\[264px\]/);
  assert.match(sidebar, /Publishing Queue/);
  assert.match(sidebar, /\/studio\/\?view=/);
  assert.match(queue, /<table/);
  assert.match(queue, /lg:hidden/);
  assert.match(studio, /URLSearchParams\(window\.location\.search\)\.get\('view'\)/);
});
