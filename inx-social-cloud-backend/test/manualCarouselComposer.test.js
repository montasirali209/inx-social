const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Posts carousel choice opens an inline manual composer instead of AI Content Studio', () => {
  const panel = read('frontend/src/components/posts/CreatePostPanel.tsx');
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  assert.match(panel, /manualCarousel:\s*true/);
  assert.doesNotMatch(panel, /chooseCarouselPost[\s\S]*navigate\('\/ai-content-studio'/);
  assert.match(route, /InlineManualCarouselPage/);
  assert.match(route, /state\?\.manualCarousel/);
});

test('manual carousel changes only the Create Your Post content while retaining Posts layout surfaces', () => {
  const page = read('frontend/src/components/posts/InlineManualCarouselPage.tsx');
  const panel = read('frontend/src/components/posts/CreatePostPanel.tsx');
  assert.match(page, /PostsStatCard/);
  assert.match(page, /DestinationSelector/);
  assert.match(page, /CreatePostPanel/);
  assert.match(page, /SchedulePanel/);
  assert.match(page, /PostPreviewPanel/);
  assert.match(page, /grid-cols-\[minmax\(0,1\.35fr\)_minmax\(290px,\.72fr\)_minmax\(320px,\.82fr\)\]/);
  assert.match(panel, /carouselUploader/);
  assert.match(panel, /AI Content Enhancement/);
  assert.match(panel, /Live Content Score/);
  assert.match(panel, /Best Time To Post/);
});

test('manual carousel supports direct upload, order, schedule and publishing', () => {
  const page = read('frontend/src/components/posts/InlineManualCarouselPage.tsx');
  assert.match(page, /2–10 images/);
  assert.match(page, /multiple/);
  assert.match(page, /uploadMediaAsset/);
  assert.match(page, /moveSlide/);
  assert.match(page, /createCarouselPosts/);
  assert.match(page, /mediaLibraryAssetIds:\s*assets\.map/);
  assert.match(page, /slideLinks:\s*orderedLinks/);
  assert.match(page, /Link for carousel slide/);
  assert.match(page, /up to 5 linked slides/);
  assert.match(page, /SchedulePanel/);
});

test('standard preview card supports carousel slides without replacing its shell', () => {
  const preview = read('frontend/src/components/posts/PostPreviewPanel.tsx');
  assert.match(preview, /carouselAssets/);
  assert.match(preview, /Carousel preview slide/);
  assert.match(preview, /PanelHeading step=\{4\}/);
  assert.match(preview, /platforms\.map/);
});

test('AI generated carousel handoff remains separate and unchanged', () => {
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  assert.match(route, /draft\?\.contentType === 'carousel_post'/);
  assert.match(route, /CarouselPostComposerPage draft=\{draft\}/);
});
