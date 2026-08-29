const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 13.1.1 adds a cinematic live-data dashboard without fake operational metrics', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const styles = read('frontend/src/index.css');
  const queue = read('frontend/src/components/dashboard/PublishingQueueTable.tsx');

  assert.match(dashboard, /hero-stage/);
  assert.match(dashboard, /data\.overview\.pages\.length/);
  assert.match(dashboard, /data\.queue\.length/);
  assert.match(styles, /\.interactive-surface/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(queue, /Ready for your next video/);
  assert.doesNotMatch(queue, /84%|2 min remaining|02:45/);
});

test('Phase 13.1.1 upgrades each operational dashboard surface and sidebar navigation', () => {
  const workflow = read('frontend/src/components/dashboard/WorkflowStepper.tsx');
  const connected = read('frontend/src/components/dashboard/ConnectedPagesCard.tsx');
  const upload = read('frontend/src/components/dashboard/UploadProgressCard.tsx');
  const actions = read('frontend/src/components/dashboard/QuickActionsCard.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');

  assert.match(workflow, /size-14/);
  assert.match(connected, /Connected & active/);
  assert.match(upload, /Upload station ready/);
  assert.match(upload, /indeterminate-progress/);
  assert.match(actions, /group-hover:-translate-y/);
  assert.match(sidebar, /interactive-nav/);
});
