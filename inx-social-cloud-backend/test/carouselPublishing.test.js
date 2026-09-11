const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Posts offers a standard post choice and a manual carousel choice', () => {
  const panel = read('frontend/src/components/posts/CreatePostPanel.tsx');
  const data = read('frontend/src/data/postsData.ts');
  assert.match(data, /Text \/ Media Post/);
  assert.match(data, /Carousel Post/);
  assert.match(panel, /Upload and arrange 2–10 images manually/);
  assert.match(panel, /manualCarousel:\s*true/);
  assert.doesNotMatch(data, /Video \/ Reel/);
  assert.doesNotMatch(data, /available:\s*false/);
});

test('AI carousel handoff preserves every slide in the Posts scheduling workspace', () => {
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  const composer = read('frontend/src/components/posts/InlineManualCarouselPage.tsx');
  const modal = read('frontend/src/components/ai-content-studio/CarouselChatModal.tsx');
  assert.match(route, /contentType === 'carousel_post'/);
  assert.match(route, /initialDraft=\{carouselDraft\}/);
  assert.match(composer, /initialDraft\.mediaLibraryAssets/);
  assert.match(composer, /mediaLibraryAssetIds:\s*assets\.map/);
  assert.match(composer, /Link for carousel slide/);
  assert.match(composer, /moveSlideTo/);
  assert.match(modal, /Post \/ Schedule/);
});

test('carousel publishing uses all stored images in one governed Meta multi-photo post', () => {
  const routes = read('src/routes/studioRoutes.js');
  const controller = read('src/controllers/carouselPostController.js');
  const publisher = read('src/services/cloudMetaPublisher.js');
  assert.match(routes, /carousel-posts/);
  assert.match(controller, /contentType:\s*'CAROUSEL'/);
  assert.match(controller, /mediaLibraryAssetIds/);
  assert.match(controller, /slideLinks/);
  assert.match(controller, /every slide must have a destination link/);
  assert.match(controller, /slides\.map\(\(slide, index\) => \(\{ data: slide\.data/);
  assert.match(publisher, /async function publishCarouselPost/);
  assert.match(publisher, /attached_media/);
  assert.match(publisher, /child_attachments/);
  assert.match(publisher, /link: asset\.linkUrl/);
  assert.match(publisher, /media_fbid/);
  assert.match(publisher, /published', 'false'/);
});
