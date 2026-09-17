const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Media Library video content supports browser byte-range playback', () => {
  const route = read('src/routes/studioRoutes.js');
  const controller = read('src/controllers/mediaLibraryContentController.js');
  const service = read('src/services/mediaLibraryService.js');

  assert.match(route, /mediaLibraryContentController\.mediaLibraryAssetContent/);
  assert.match(controller, /Accept-Ranges/);
  assert.match(controller, /Content-Range/);
  assert.match(controller, /status\(206\)/);
  assert.match(controller, /status\(416\)/);
  assert.match(controller, /MAX_VIDEO_CHUNK_BYTES = 2 \* 1024 \* 1024/);
  assert.match(controller, /findContentMetadata/);
  assert.match(controller, /findContentRange/);
  assert.match(service, /substring\("data" FROM CAST\(\$3 AS integer\) FOR CAST\(\$4 AS integer\)\)/);
  assert.doesNotMatch(service, /substring\("data" FROM \$3 FOR \$4\)/);
  assert.doesNotMatch(controller, /data\.subarray/);
});
