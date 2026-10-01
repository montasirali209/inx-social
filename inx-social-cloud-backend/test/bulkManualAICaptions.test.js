const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const service = require('../src/services/bulkCaptionService');

test('manual campaign AI caption policy keeps five free captions and a flat five-credit paid batch', () => {
  assert.equal(service.FREE_CAPTION_LIMIT, 5);
  assert.equal(service.PAID_BATCH_CREDITS, 5);
  assert.equal(service.MAX_BATCH_IMAGES, 50);
  assert.equal(service.parseCaptionResponse('{"caption":"A useful caption"}'), 'A useful caption');
});

test('bulk scheduler routes image caption requests through OpenAI and never overwrites non-empty captions', () => {
  const routes = read('src/routes/socialPublicationRoutes.js');
  const backend = read('src/services/bulkCaptionService.js');
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const editor = read('frontend/src/components/bulk-scheduler/ManualCampaignEditor.tsx');

  assert.match(routes, /ai-captions\/batches/);
  assert.match(backend, /chat\/completions/);
  assert.match(backend, /env\.bulkCaption/);
  assert.doesNotMatch(backend, /runware/i);
  assert.match(page, /post\.contentType === 'IMAGE'/);
  assert.match(page, /!post\.caption\.trim\(\)/);
  assert.match(page, /item\.id === post\.id && !item\.caption\.trim\(\)/);
  assert.match(editor, /AI captions · \$\{emptyImagePosts\.length\} empty/);
  assert.match(editor, /First 5 AI image captions in a manual campaign are free/);
});
