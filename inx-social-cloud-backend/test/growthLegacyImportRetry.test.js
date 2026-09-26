const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('legacy blog migration respects API rate limits and retries transient failures', () => {
  const content = read('src/services/growthContentService.js');

  assert.match(content, /async function babyLoveGet/);
  assert.match(content, /status === 429/);
  assert.match(content, /retry-after/);
  assert.match(content, /attempt <= 4/);
  assert.match(content, /await wait\(1200\)/);
  assert.match(content, /BabyLoveGrowth import request will retry/);
});

test('legacy blog migration is retried hourly until a successful sync is stored', () => {
  const autopilot = read('src/services/growthAutopilotService.js');

  assert.match(autopilot, /legacyImportTimer/);
  assert.match(autopilot, /syncLegacyBlog\('startup'\)/);
  assert.match(autopilot, /syncLegacyBlog\('hourly-retry'\)/);
  assert.match(autopilot, /60 \* 60 \* 1000/);
  assert.match(autopilot, /clearInterval\(legacyImportTimer\)/);
});
