const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('React Bulk Scheduler is a first-class route with session-local destinations', () => {
  const router = read('frontend/src/router.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  assert.match(router, /path: 'bulk-scheduler'/);
  assert.match(sidebar, /label: 'Bulk Scheduler'.*reactPath: '\/bulk-scheduler'/);
  assert.match(page, /useState<Set<string>>\(new Set\(\)\)/);
  assert.doesNotMatch(page, /activePage|isSelected/);
});

test('Bulk Scheduler exposes honest platform capability filters and real browser uploads', () => {
  const panel = read('frontend/src/components/bulk-scheduler/PublishingDestinationsPanel.tsx');
  const filters = read('frontend/src/components/bulk-scheduler/PlatformFilterTabs.tsx');
  const api = read('frontend/src/lib/bulk-scheduler-api.ts');
  assert.match(filters, /facebook.*instagram.*linkedin.*tiktok.*youtube.*x/s);
  assert.match(panel, /availability === 'PLANNED'/);
  assert.match(api, /XMLHttpRequest/);
  assert.match(api, /\/api\/studio\/jobs/);
  assert.match(api, /request\.upload\.addEventListener\('progress'/);
});
