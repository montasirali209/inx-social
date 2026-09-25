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
  assert.match(topbar, /data-mobile-menu-trigger="true"/);
  assert.match(topbar, /border-brand-cyan\/45 bg-panel-soft\/90 text-text-main/);
  assert.match(topbar, /<Menu aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth=\{2\.4\}/);
});

test('settings and billing keep local search controls until desktop topbar search is available', () => {
  const topbar = read('components/layout/Topbar.tsx');
  const settings = read('components/settings/SettingsPage.tsx');
  const billing = read('components/billing/BillingPlansPage.tsx');

  assert.match(topbar, /relative hidden lg:block/);
  assert.match(settings, /relative block lg:hidden/);
  assert.match(billing, /grid gap-2 lg:hidden/);
});


test('all major workspace surfaces and portalled popups have narrow-screen containment', () => {
  const mobile = read('mobile-responsive.css');
  const campaign = read('components/ai-content-studio/AiPostCampaignModal.tsx');
  const carousel = read('components/ai-content-studio/CarouselChatModalV2.tsx');
  const ugc = read('components/ai-content-studio/UGCWizardModal.tsx');
  const media = read('components/media-library/MediaLibraryPage.tsx');
  const connections = read('components/connections/ConnectedAccountsPageV4.tsx');

  assert.match(mobile, /Universal phone\/tablet hardening v2/);
  assert.match(mobile, /\.posts-modal-panel,/);
  assert.match(mobile, /\.ai-studio-modal-enter/);
  assert.match(mobile, /max-width: 100vw !important/);
  assert.match(mobile, /env\(safe-area-inset-bottom\)/);
  assert.match(campaign, /grid-cols-2 gap-2 sm:grid-cols-4/);
  assert.match(campaign, /grid w-full min-w-0 grid-cols-1 gap-2 sm:w-auto sm:min-w-\[260px\] sm:grid-cols-3/);
  assert.match(carousel, /grid-cols-3 gap-2 sm:grid-cols-5/);
  assert.match(ugc, /grid-cols-3 gap-2 sm:grid-cols-5/);
  assert.match(media, /fixed left-3 right-3 top-20/);
  assert.match(connections, /fixed bottom-3 left-3 right-3/);
});
