const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'growthContentService.js'), 'utf8');
const repair = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'oneOffGrowthImageRepair.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');

test('a published article can receive an atomic OpenAI featured-image replacement', () => {
  const start = service.indexOf('async function generateFeaturedImage');
  const end = service.indexOf('async function imageBuffer', start);
  const generate = service.slice(start, end);
  assert.doesNotMatch(generate, /CONTENT_UNPUBLISH_REQUIRED/);
  assert.match(generate, /imageProvider: 'openai'/);
  assert.match(generate, /const previousStorage/);
  assert.match(generate, /await saveArticle/);
  assert.match(generate, /deleteObject\(previousStorage\.key/);
});

test('the one-off repair is slug-scoped, idempotent and starts without blocking boot', () => {
  assert.match(repair, /ONE_OFF_GROWTH_IMAGE_REPAIR_SLUG/);
  assert.match(repair, /publishedOnly: true/);
  assert.match(repair, /imageProvider === 'openai'/);
  assert.match(repair, /growthContent\.generateFeaturedImage\(article\.id\)/);
  assert.match(server, /runOneOffGrowthImageRepair/);
  assert.match(server, /\}, 7000\)\.unref/);
});
