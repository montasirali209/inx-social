const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Posts carousel choice opens an inline manual composer instead of AI Content Studio', () => {
  const panel = read('frontend/src/components/posts/CreatePostPanel.tsx');
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  assert.match(panel, /manualCarousel:\s*true/);
  assert.doesNotMatch(panel, /chooseCarouselPost[\s\S]*navigate\('\/ai-content-studio'/);
  assert.match(route, /InlineManualCarouselPage/);
});

test('manual carousel changes only the Create Your Post content while retaining Posts layout surfaces', () => {
  const page = read('frontend/src/components/posts/InlineManualCarouselPage.tsx');
  assert.match(page, /PostsStats/);
  assert.match(page, /DestinationSelector/);
  assert.match(page, /SchedulePanel/);
  assert.match(page, /PostPreviewCard/);
  assert.match(page, /Create Your Post/);
  assert.match(page, /Carousel slides/);
});

test('manual carousel supports direct upload, order, schedule and publishing', () => {
  const page = read('frontend/src/components/posts/InlineManualCarouselPage.tsx');
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

test('standard preview card supports carousel slides without replacing its shell', () => {
  const preview = read('frontend/src/components/posts/PostPreviewCard.tsx');
  assert.match(preview, /carouselAssets/);
  assert.match(preview, /carouselIndex/);
  assert.match(preview, /Facebook carousel/);
});

test('AI generated carousel handoff uses the same complete carousel editor', () => {
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  assert.match(route, /draft\?\.contentType === 'carousel_post'/);
  assert.match(route, /InlineManualCarouselPage/);
  assert.match(route, /initialDraft=\{carouselDraft\}/);
  assert.match(route, /initialAssets=\{selectedAssets\}/);
});

test('carousel work survives in-app navigation but clears on a hard browser refresh', () => {
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  const page = read('frontend/src/components/posts/InlineManualCarouselPage.tsx');
  const session = read('frontend/src/lib/carousel-composer-session.ts');
  assert.match(route, /hasCarouselSession\(\)/);
  assert.match(route, /getActivePostComposer/);
  assert.match(page, /saveCarouselSession/);
  assert.match(page, /useEffect/);
  assert.match(session, /let carouselSession:/);
  assert.match(session, /carouselSession = \{ \.\.\.session/);
  assert.doesNotMatch(session, /localStorage\.setItem\(CAROUSEL_SESSION_KEY/);
  assert.match(session, /localStorage\.removeItem\(CAROUSEL_SESSION_KEY/);
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
  assert.match(page, /Grab anywhere/);
  assert.match(page, /moveSlideTo/);
  assert.match(page, /Move slide \$\{index \+ 1\} left/);
  assert.match(page, /Move slide \$\{index \+ 1\} right/);
});
