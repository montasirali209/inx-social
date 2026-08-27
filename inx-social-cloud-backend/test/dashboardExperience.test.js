const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Dashboard navigation uses the simplified product information architecture', () => {
  const html = read('studio/index.html');
  const dashboard = html.indexOf('data-view="dashboard">Dashboard</button>');
  const scheduler = html.indexOf('data-view="reels">Scheduler</button>');
  const settings = html.indexOf('data-view="settings">Settings</button>');
  const pages = html.indexOf('data-view="pages">Connected Pages</button>');
  assert.ok(dashboard >= 0 && scheduler > dashboard);
  assert.ok(settings > scheduler && pages > settings);
  assert.doesNotMatch(html, />Overview<|Auto Scheduler/);
});

test('Dashboard is a compact operational workspace backed by live application state', () => {
  const html = read('studio/index.html');
  const app = read('studio/app.js');
  const css = read('studio/styles.css');
  for (const id of ['dashboardContentQueue', 'dashboardCalendarMini', 'dashboardPageAvatar', 'dashboardPageName', 'dashboardProgressRing']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /Plan, schedule, and publish content from one studio/);
  assert.match(app, /function renderDashboardQueue\(\)/);
  assert.match(app, /function renderDashboardCalendar\(\)/);
  assert.match(app, /function renderDashboardPage\(active\)/);
  assert.match(app, /state\?\.jobs/);
  assert.match(app, /metaScheduledPosts/);
  assert.match(css, /\.dashboard-ops-grid\{display:grid;grid-template-columns:repeat\(4/);
  assert.match(css, /\.dashboard-work-grid\{display:grid/);
});
