const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 13.6 makes Posts a first-class responsive React workspace', () => {
  const router = read('frontend/src/router.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const topbar = read('frontend/src/components/layout/Topbar.tsx');
  const page = read('frontend/src/components/posts/PostsPage.tsx');

  assert.match(router, /posts.*PostsPage/);
  assert.match(sidebar, /label: 'Posts'.*reactPath: '\/posts'/);
  assert.match(sidebar, /to="\/posts"/);
  assert.match(topbar, /title: 'Posts'/);
  for (const component of ['CreatePostPanel', 'DestinationSelector', 'SchedulePanel', 'PostPreviewPanel']) {
    assert.match(page, new RegExp(component));
  }
  assert.match(page, /xl:grid-cols/);
  assert.doesNotMatch(page, /RecentPostsTable/);
  assert.doesNotMatch(page, /studio\/\?view=posts/);
});

test('Phase 13.6 publishes multi-Page posts through the governed direct post endpoints', () => {
  const api = read('frontend/src/lib/posts-api.ts');
  const page = read('frontend/src/components/posts/PostsPage.tsx');
  const destinations = read('frontend/src/components/posts/DestinationSelector.tsx');

  assert.match(api, /\/api\/studio\/direct-posts/);
  assert.match(api, /direct-posts\/\$\{encodeURIComponent\(jobId\)\}\/media/);
  assert.match(page, /connectedPageIds: selectedIds/);
  assert.match(page, /publishMode: mode === 'now' \? 'NOW' : 'SCHEDULED'/);
  assert.match(page, /for \(const job of response\.jobs\)/);
  assert.match(destinations, /Select All Visible/);
  assert.match(destinations, /createPortal/);
  assert.match(destinations, /Choose publishing destinations/);
  assert.match(destinations, /Reconnect required/);
  assert.match(destinations, /connector is planned/);
  assert.doesNotMatch(`${page}${destinations}`, /INX Social Shop|@inx\.lifestyle|INX Social Careers/);
});

test('Phase 13.6 keeps draft, preview and enhancement controls honest and accessible', () => {
  const create = read('frontend/src/components/posts/CreatePostPanel.tsx');
  const schedule = read('frontend/src/components/posts/SchedulePanel.tsx');
  const preview = read('frontend/src/components/posts/PostPreviewPanel.tsx');
  const data = read('frontend/src/data/postsData.ts');
  const modal = read('frontend/src/components/posts/CaptionEnhancementModal.tsx');
  const api = read('frontend/src/lib/posts-api.ts');

  assert.match(create, /type="file"/);
  assert.match(create, /Rewrite/);
  assert.match(create, /Add Hashtags/);
  assert.match(create, /Content Score/);
  assert.match(create, /CaptionEnhancementModal/);
  assert.match(modal, /Apply to caption/);
  assert.match(api, /\/api\/studio\/post-enhancements/);
  assert.match(schedule, /Publish Now/);
  assert.match(schedule, /Schedule Post/);
  assert.match(schedule, /Save as Draft/);
  assert.match(preview, /Preview may vary slightly/);
  assert.match(data, /carousel.*available: false/);
});
