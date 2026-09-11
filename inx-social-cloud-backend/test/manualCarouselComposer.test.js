const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Posts carousel choice opens manual composer instead of AI Content Studio', () => {
  const panel = read('frontend/src/components/posts/CreatePostPanel.tsx');
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  assert.match(panel, /manualCarousel:\s*true/);
  assert.doesNotMatch(panel, /chooseCarouselPost[\s\S]*navigate\('\/ai-content-studio'/);
  assert.match(route, /ManualCarouselComposerPage/);
  assert.match(route, /state\?\.manualCarousel/);
});

test('manual carousel supports direct upload, order, schedule and publishing', () => {
  const page = read('frontend/src/components/posts/ManualCarouselComposerPage.tsx');
  assert.match(page, /2–10 images/);
  assert.match(page, /multiple/);
  assert.match(page, /uploadMediaAsset/);
  assert.match(page, /moveSlide/);
  assert.match(page, /removeSlide/);
  assert.match(page, /createCarouselPosts/);
  assert.match(page, /mediaLibraryAssetIds:\s*assets\.map/);
  assert.match(page, /SchedulePanel/);
  assert.match(page, /Manual carousel posting is available without AI Content Studio/);
});

test('AI generated carousel handoff remains separate and unchanged', () => {
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  assert.match(route, /draft\?\.contentType === 'carousel_post'/);
  assert.match(route, /CarouselPostComposerPage draft=\{draft\}/);
});
