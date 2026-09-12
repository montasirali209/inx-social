const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('carousel Meta feed uses form-encoded JSON attachment arrays', () => {
  const publisher = read('src/services/carouselMetaPublisherFix.js');
  const routes = read('src/routes/studioRoutes.js');
  assert.match(publisher, /new URLSearchParams\(\)/);
  assert.match(publisher, /JSON\.stringify\(assets\.map/);
  assert.match(publisher, /JSON\.stringify\(photoIds\.map/);
  assert.match(publisher, /application\/x-www-form-urlencoded/);
  assert.match(routes, /carouselMetaPublisherFix/);
});

test('carousel client surfaces the exact destination failure instead of only a count', () => {
  const api = read('frontend/src/lib/posts-api.ts');
  assert.match(api, /response\.failures\.length/);
  assert.match(api, /failure\.pageName/);
  assert.match(api, /failure\.error/);
  assert.match(api, /throw new Error\(details\)/);
});

test('unsaved carousel composer survives SPA navigation but not browser refresh', () => {
  const session = read('frontend/src/lib/carousel-composer-session.ts');
  const route = read('frontend/src/components/posts/PostsRoute.tsx');
  assert.match(session, /let carouselSession:/);
  assert.match(session, /let activePostComposer:/);
  assert.match(session, /carouselSession = \{ \.\.\.session/);
  assert.doesNotMatch(session, /localStorage\.setItem\(CAROUSEL_SESSION_KEY/);
  assert.match(route, /getActivePostComposer/);
  assert.match(route, /setActivePostComposer/);
  assert.doesNotMatch(route, /localStorage\.setItem\(ACTIVE_COMPOSER_KEY/);
});
