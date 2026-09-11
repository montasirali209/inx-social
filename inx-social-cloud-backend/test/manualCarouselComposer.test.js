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

test('AI generated carousel handoff uses the same complete carousel editor', () => {
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  assert.match(route, /draft\?\.contentType === 'carousel_post'/);
  assert.match(route, /InlineManualCarouselPage/);
  assert.match(route, /initialDraft=\{carouselDraft\}/);
  assert.match(route, /initialAssets=\{selectedAssets\}/);
});

test('carousel work automatically survives navigation and reloads in Posts', () => {
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  const page = read('frontend/src/components/posts/InlineManualCarouselPage.tsx');
  const session = read('frontend/src/lib/carousel-composer-session.ts');
  assert.match(route, /hasCarouselSession\(\)/);
  assert.match(page, /saveCarouselSession/);
  assert.match(page, /useEffect/);
  assert.match(session, /localStorage\.setItem\(CAROUSEL_SESSION_KEY/);
  assert.match(session, /assets:\s*parsed\.assets/);
});

test('standard post work also restores after navigating away from Posts', () => {
  const page = read('frontend/src/components/posts/PostsPage.tsx');
  assert.match(page, /inx-social-post-composer-session-v1/);
  assert.match(page, /readComposerSession/);
  assert.match(page, /localStorage\.setItem\(composerSessionKey/);
  assert.match(page, /Your unfinished post and reusable media were restored/);
});

test('carousel slides support grab ordering alongside arrow controls', () => {
  const page = read('frontend/src/components/posts/InlineManualCarouselPage.tsx');
  assert.match(page, /draggable/);
  assert.match(page, /Drag slide/);
  assert.match(page, /moveSlideTo/);
  assert.match(page, /Move slide \$\{index \+ 1\} left/);
  assert.match(page, /Move slide \$\{index \+ 1\} right/);
});
