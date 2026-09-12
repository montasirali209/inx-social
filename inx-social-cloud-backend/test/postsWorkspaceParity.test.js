const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('carousel Posts stat cards keep the same interactive library affordance', () => {
  const primitives = read('frontend/src/components/posts/PostPrimitives.tsx');
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  const overlays = read('frontend/src/components/posts/PostsStatOverlayController.tsx');
  assert.match(primitives, /inx-posts-stat-open/);
  assert.match(primitives, /Open \$\{label\}/);
  assert.match(route, /PostsStatOverlayController/);
  assert.match(overlays, /DraftLibraryModal/);
  assert.match(overlays, /PostReuseModal/);
  assert.match(overlays, /Needs Review/);
});

test('long post preview captions scroll instead of stretching the preview card', () => {
  const preview = read('frontend/src/components/posts/PostPreviewPanel.tsx');
  assert.match(preview, /max-h-36/);
  assert.match(preview, /overflow-y-auto/);
  assert.match(preview, /overscroll-contain/);
});

test('Draft Library exposes a clear-all action', () => {
  const modal = read('frontend/src/components/posts/DraftLibraryModal.tsx');
  assert.match(modal, /clearAllDrafts/);
  assert.match(modal, /Clear all drafts/);
  assert.match(modal, /drafts\.forEach\(\(draft\) => onDelete\(draft\.id\)\)/);
});

test('Needs Review can be cleared without removing history from All Posts', () => {
  const modal = read('frontend/src/components/posts/PostReuseModal.tsx');
  const reuse = read('frontend/src/lib/posts-reuse.ts');
  const api = read('frontend/src/lib/posts-api.ts');
  assert.match(modal, /Clear Needs Review/);
  assert.match(modal, /dismissPostJob/);
  assert.match(api, /method: 'DELETE'/);
  assert.doesNotMatch(reuse, /\['FAILED', 'AWAITING_UPLOAD', 'CANCELLED'\]/);
  assert.match(reuse, /\['FAILED', 'AWAITING_UPLOAD'\]/);
});

test('hard browser refresh clears transient standard composer state', () => {
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  assert.match(route, /navigation\?\.type === 'reload'/);
  assert.match(route, /localStorage\.removeItem\(STANDARD_COMPOSER_SESSION_KEY\)/);
  assert.match(route, /clearPostComposerFile/);
});
