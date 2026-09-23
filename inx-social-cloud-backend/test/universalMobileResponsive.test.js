const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.join(__dirname, '..', 'frontend', 'src');
const read = relative => fs.readFileSync(path.join(frontendRoot, relative), 'utf8');

test('all application routes inherit the universal mobile-safe workspace container', () => {
  const shell = read('components/layout/AppShell.tsx');
  const css = read('index.css');

  assert.equal((shell.match(/mobile-route-safe/g) || []).length >= 2, true);
  assert.match(shell, /workspace-frame min-w-0 overflow-x-hidden/);
  assert.match(css, /Universal route-level mobile containment/);
  assert.match(css, /@media \(max-width: 1023px\)/);
  assert.match(css, /\.mobile-route-safe :where\(\.grid, \.flex\) > \*/);
  assert.match(css, /-webkit-overflow-scrolling: touch/);
});

test('phones and tablets keep the navigation drawer instead of overlapping route content', () => {
  const shell = read('components/layout/AppShell.tsx');
  const sidebar = read('components/layout/Sidebar.tsx');
  const topbar = read('components/layout/Topbar.tsx');

  assert.match(shell, /lg:pl-\[88px\]/);
  assert.doesNotMatch(shell, /md:pl-\[88px\]/);
  assert.match(sidebar, /lg:w-\[88px\]/);
  assert.match(sidebar, /lg:translate-x-0/);
  assert.match(sidebar, /lg:hidden/);
  assert.match(topbar, /lg:hidden/);
});

test('settings and billing keep local search controls until desktop topbar search is available', () => {
  const topbar = read('components/layout/Topbar.tsx');
  const settings = read('components/settings/SettingsPage.tsx');
  const billing = read('components/billing/BillingPlansPage.tsx');

  assert.match(topbar, /relative hidden lg:block/);
  assert.match(settings, /relative block lg:hidden/);
  assert.match(billing, /grid gap-2 lg:hidden/);
});
