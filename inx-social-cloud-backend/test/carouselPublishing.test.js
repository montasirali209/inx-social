const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Posts offers only a standard post choice and an AI carousel choice', () => {
  const panel = read('frontend/src/components/posts/CreatePostPanel.tsx');
  const data = read('frontend/src/data/postsData.ts');
  assert.match(panel, /Text \/ Media Post/);
  assert.match(panel, /Carousel Post/);
  assert.match(panel, /Create with AI Content Studio/);
  assert.doesNotMatch(data, /Video \/ Reel/);
  assert.doesNotMatch(data, /available:\s*false/);
});

test('AI carousel handoff preserves every slide in the Posts scheduling workspace', () => {
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  const composer = read('frontend/src/components/posts/CarouselPostComposerPage.tsx');
  const modal = read('frontend/src/components/ai-content-studio/CarouselChatModal.tsx');
  assert.match(route, /contentType === 'carousel_post'/);
  assert.match(composer, /draft\.mediaLibraryAssets/);
  assert.match(composer, /mediaLibraryAssetIds:\s*assets\.map/);
  assert.match(composer, /All slides stay in this order and publish together as one carousel/);
  assert.match(modal, /Post \/ Schedule/);
});

test('carousel publishing uses all stored images in one governed Meta multi-photo post', () => {
  const routes = read('src/routes/studioRoutes.js');
  const controller = read('src/controllers/carouselPostController.js');
  const publisher = read('src/services/cloudMetaPublisher.js');
  assert.match(routes, /carousel-posts/);
  assert.match(controller, /contentType:\s*'CAROUSEL'/);
  assert.match(controller, /mediaLibraryAssetIds/);
  assert.match(controller, /slides\.map\(slide => \(\{ data: slide\.data/);
  assert.match(publisher, /async function publishCarouselPost/);
  assert.match(publisher, /attached_media/);
  assert.match(publisher, /media_fbid/);
  assert.match(publisher, /published', 'false'/);
});
