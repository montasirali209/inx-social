const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Calendar lazily syncs and merges current Facebook scheduled posts', () => {
  const app = read('studio/app.js');
  const html = read('studio/index.html');

  assert.match(app, /viewName === 'calendar'/);
  assert.match(app, /listMetaScheduled\(\{ silent: true \}\)/);
  assert.match(app, /groupMetaPostsByDate\(metaScheduledPosts\)/);
  assert.match(app, /Scheduled on Facebook/);
  assert.match(app, /formatMetaScheduleDate/);
  assert.match(html, /Facebook schedule syncs automatically/);
  assert.match(html, /Refresh Facebook Schedule/);
});

test('Page picture endpoint falls back to the picture saved during connection', () => {
  const controller = read('src/controllers/studioController.js');

  assert.match(controller, /new Set\(\[livePictureUrl, page\.facebookPagePicture\]/);
  assert.match(controller, /for \(const pictureUrl of candidates\)/);
  assert.doesNotMatch(controller, /picture\.status >= 400 \|\| picture\.data\?\.error\) return res\.status\(404\)/);
});

test('Desktop Studio keeps a stable canvas while browser zoom remains accessible', () => {
  const css = read('studio/styles.css');

  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /min-width: 1180px/);
  assert.match(css, /overflow-x: auto/);
});
