const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Posts opens the complete publishing composer without a second click', () => {
  const html = read('studio/index.html');
  const app = read('studio/app.js');
  assert.match(html, /id="posts" class="view posts-workspace posts-workspace-v2"/);
  assert.match(html, /id="postComposer" class="panel post-composer"/);
  assert.doesNotMatch(html, /id="postComposer"[^>]*\bhidden\b/);
  assert.doesNotMatch(html, /id="btnPostsCreate"/);
  assert.doesNotMatch(html, /id="btnPostComposerClose"/);
  assert.match(app, /if \(viewName === 'posts'\) \{[\s\S]*renderDirectPostComposer\(\)/);
  assert.doesNotMatch(app, /postComposer'\)\?\.classList\.add\('hidden'\)/);
});

test('professional composer exposes only real publishing capabilities', () => {
  const html = read('studio/index.html');
  const app = read('studio/app.js');
  const adapter = read('studio/web-adapter.js');
  for (const type of ['TEXT', 'IMAGE', 'VIDEO']) assert.match(html, new RegExp(`name="directPostType" value="${type}"`));
  assert.match(html, /Carousel <small>Coming soon<\/small>/);
  assert.match(html, /id="directPostPageGrid"/);
  assert.match(html, /id="directPostMediaBox"[^>]*role="button"/);
  assert.match(html, /id="btnDirectPostBestTime"/);
  assert.match(html, /id="btnDirectPostScore"/);
  assert.match(html, /id="btnDirectPostPreview"/);
  assert.match(app, /prepareDroppedDirectPostMedia/);
  assert.match(app, /applyDirectPostRecommendedTime/);
  assert.match(app, /directPostContentScore/);
  assert.match(adapter, /prepareDirectPostMedia/);
});

test('Posts uses real status summaries and a responsive reference-matched layout', () => {
  const html = read('studio/index.html');
  const css = read('studio/styles.css');
  const app = read('studio/app.js');
  for (const id of ['postsCountAll', 'postsCountAwaiting', 'postsCountScheduled', 'postsCountPublished', 'postsCountFailed']) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /vs last 7 days|[↑↓]\s*\d+%/i);
  assert.match(css, /Phase 12\.2 — permanent professional Posts workspace/);
  assert.match(css, /\.posts-workspace-v2 \.post-composer-grid\{grid-template-columns:/);
  assert.match(css, /@media\(max-width:1080px\)/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(app, /<span>Campaign<\/span><span>Status<\/span><span>Scheduled time<\/span><span>Updated<\/span><span>Actions<\/span>/);
});
