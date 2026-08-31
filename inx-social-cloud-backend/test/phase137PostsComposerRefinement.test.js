const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Posts keeps destinations compact and moves the full selector into an animated dialog', () => {
  const page = read('frontend/src/components/posts/PostsPage.tsx');
  const selector = read('frontend/src/components/posts/DestinationSelector.tsx');
  const css = read('frontend/src/index.css');
  assert.match(page, /xl:grid-cols-\[minmax\(0,1\.35fr\)_minmax\(290px,\.72fr\)_minmax\(320px,\.82fr\)\]/);
  assert.doesNotMatch(page, /<div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-1">/);
  assert.doesNotMatch(page, /RecentPostsTable/);
  assert.match(selector, /aria-modal="true"/);
  assert.match(selector, /Selection saved for this post only/);
  assert.match(selector, /document\.body/);
  assert.match(css, /posts-modal-panel-in/);
});

test('Posts caption enhancement is explicit, governed and applies only after review', () => {
  const routes = read('src/routes/studioRoutes.js');
  const controller = read('src/controllers/studioController.js');
  const service = read('src/services/postEnhancementService.js');
  const modal = read('frontend/src/components/posts/CaptionEnhancementModal.tsx');
  assert.match(routes, /post-enhancements/);
  assert.match(controller, /requireStudioLicense\(req\.user\.id\)/);
  assert.match(service, /\/chat\/completions/);
  assert.match(service, /Never add commentary/);
  assert.match(modal, /Keep original/);
  assert.match(modal, /Apply to caption/);
  assert.match(service, /temporarily unavailable/);
});

test('Posts keeps the attachment compact and card hover text crisp', () => {
  const createPanel = read('frontend/src/components/posts/CreatePostPanel.tsx');
  const styles = read('frontend/src/index.css');
  assert.match(createPanel, /Replace/);
  assert.match(createPanel, /Ready/);
  assert.doesNotMatch(createPanel, /alt="Selected post media"/);
  assert.doesNotMatch(styles, /perspective\(1100px\).*rotateX/);
});

test('best-time guidance is derived from selected Page analytics', () => {
  const page = read('frontend/src/components/posts/PostsPage.tsx');
  const analytics = read('frontend/src/lib/posts-analytics.ts');
  const schedule = read('frontend/src/components/posts/SchedulePanel.tsx');
  assert.match(page, /fetchFacebookDashboardAnalytics\(selectedPage!\.id, 90\)/);
  assert.match(analytics, /totalInteractions/);
  assert.match(analytics, /live engagement from/);
  assert.match(schedule, /Use time/);
});

test('Drafts stat opens an animated browser-persisted draft manager', () => {
  const page = read('frontend/src/components/posts/PostsPage.tsx');
  const modal = read('frontend/src/components/posts/DraftLibraryModal.tsx');
  const primitives = read('frontend/src/components/posts/PostPrimitives.tsx');
  assert.match(page, /inx-social-post-drafts-v1/);
  assert.match(page, /setDraftLibraryOpen\(true\)/);
  assert.match(page, /function loadDraft/);
  assert.match(page, /function deleteDraft/);
  assert.match(page, /drafts\.filter\(\(item\) => item\.id !== draft\.id\)/);
  assert.match(modal, /posts-modal-panel/);
  assert.match(modal, /Continue editing/);
  assert.match(modal, /This browser/);
  assert.match(primitives, /aria-label={`Open \${label}`}/);
});
