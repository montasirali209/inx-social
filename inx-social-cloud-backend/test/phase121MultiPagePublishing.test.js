const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Posts is an independent direct publishing workspace', () => {
  const html = read('studio/index.html');
  const app = read('studio/app.js');
  const adapter = read('studio/web-adapter.js');
  assert.match(html, /id="postComposer"/);
  assert.match(html, /name="directPostType" value="TEXT"/);
  assert.match(html, /name="directPostType" value="IMAGE"/);
  assert.match(html, /name="directPostType" value="VIDEO"/);
  assert.match(html, /id="directPostPageGrid"/);
  assert.match(html, /name="directPublishMode" value="NOW"/);
  assert.match(html, /name="directPublishMode" value="SCHEDULED"/);
  assert.match(app, /function openNewPostWorkspace\(\)[\s\S]*switchView\('posts'\)/);
  assert.match(adapter, /async function publishDirectPost/);
});

test('Bulk Scheduler uses workflow-local multi-Page destinations', () => {
  const html = read('studio/index.html');
  const app = read('studio/app.js');
  const adapter = read('studio/web-adapter.js');
  assert.match(html, /<span>Bulk Scheduler<\/span>/);
  assert.match(html, /id="reelsPageTargetGrid"/);
  assert.match(app, /reelsSelectedPageIds = new Set/);
  assert.match(app, /connectedPageIds:\s*\[\.\.\.reelsSelectedPageIds\]/);
  assert.match(adapter, /for \(const pageInspection of inspection\.pageInspections\)/);
});

test('universal Active Page control is absent and API accepts explicit destinations', () => {
  const html = read('studio/index.html');
  const routes = read('src/routes/studioRoutes.js');
  const controller = read('src/controllers/studioController.js');
  assert.doesNotMatch(html, /id="activeWorkspaceControl"/);
  assert.doesNotMatch(html, /Disconnect active Page/);
  assert.match(routes, /post\('\/direct-posts', controller\.createDirectPosts\)/);
  assert.match(routes, /put\('\/direct-posts\/:id\/media', controller\.uploadDirectPostMedia\)/);
  assert.match(controller, /connectedPageIds:\s*z\.array/);
  assert.match(controller, /for \(const page of pages\)/);
});
