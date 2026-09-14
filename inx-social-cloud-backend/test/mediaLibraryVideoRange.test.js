const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Media Library video content supports browser byte-range playback', () => {
  const route = read('src/routes/studioRoutes.js');
  const controller = read('src/controllers/mediaLibraryContentController.js');

  assert.match(route, /mediaLibraryContentController\.mediaLibraryAssetContent/);
  assert.match(controller, /Accept-Ranges/);
  assert.match(controller, /Content-Range/);
  assert.match(controller, /status\(206\)/);
  assert.match(controller, /status\(416\)/);
  assert.match(controller, /data\.subarray\(range\.start, range\.end \+ 1\)/);
});
