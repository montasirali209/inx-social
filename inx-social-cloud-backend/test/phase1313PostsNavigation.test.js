const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 13.1.3 exposes Bulk Scheduler and Posts without a redundant Videos menu', () => {
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const bulkIndex = sidebar.indexOf("label: 'Bulk Scheduler'");
  const calendarIndex = sidebar.indexOf("label: 'Content Calendar'");
  const postsIndex = sidebar.indexOf("label: 'Posts'");
  const mediaIndex = sidebar.indexOf("label: 'Media Library'");

  assert.ok(bulkIndex > -1);
  assert.ok(calendarIndex > bulkIndex);
  assert.ok(postsIndex > calendarIndex);
  assert.ok(mediaIndex > postsIndex);
  assert.match(sidebar, /label: 'Posts'.*reactPath: '\/posts'/);
  assert.doesNotMatch(sidebar, /label: 'Scheduler'/);
  assert.doesNotMatch(sidebar, /label: 'Videos'/);
});
