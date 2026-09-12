const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('both post composers expose caption writing and working caption tools', () => {
  const panel = read('frontend/src/components/posts/CreatePostPanel.tsx');
  assert.match(panel, /AI Caption Writer/);
  assert.match(panel, /setEnhancement\('write'\)/);
  assert.match(panel, /insertCaptionText/);
  assert.match(panel, /promptForLink/);
  assert.match(panel, /promptForLocation/);
  assert.match(panel, /captionTool === 'emoji'/);
  assert.match(panel, /captionTool === 'format'/);
});

test('every carousel source uses the full-card animated 3D reorder interaction', () => {
  const carousel = read('frontend/src/components/posts/InlineManualCarouselPage.tsx');
  assert.match(carousel, /Drag anywhere on the card to reorder/);
  assert.match(carousel, /Grab anywhere/);
  assert.match(carousel, /draggingAssetId/);
  assert.match(carousel, /dragOverAssetId/);
  assert.match(carousel, /transform-style:preserve-3d/);
  assert.match(carousel, /translate3d\(0,-10px,32px\)_rotateX/);
  assert.match(carousel, /data-no-card-drag/);
});

test('standard and carousel drafts remain independent while switching composer type', () => {
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  const standard = read('frontend/src/components/posts/PostsPage.tsx');
  const carousel = read('frontend/src/lib/carousel-composer-session.ts');
  const fileStore = read('frontend/src/lib/post-composer-file-session.ts');
  assert.match(route, /inx-social-active-post-composer-v1/);
  assert.doesNotMatch(route, /clearCarouselSession/);
  assert.match(standard, /captionIdea/);
  assert.match(carousel, /captionIdea/);
  assert.match(fileStore, /indexedDB/);
});

test('Media Library multi-selection offers carousel and separate bulk-post handoffs', () => {
  const library = read('frontend/src/components/media-library/MediaLibraryPage.tsx');
  const bulk = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  assert.match(library, /Use as Carousel/);
  assert.match(library, /Use as Bulk Posts/);
  assert.match(library, /mediaLibraryAssets: selectedAssets/);
  assert.match(bulk, /Loading \$\{selectedAssets\.length\} Media Library assets for separate bulk posts/);
  assert.match(bulk, /libraryAssetId: asset\.id/);
});
