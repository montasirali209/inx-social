const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const service = require('../src/services/bulkCaptionService');

test('manual campaign AI caption policy keeps five free captions and a one-time five-credit campaign unlock', () => {
  assert.equal(service.FREE_CAPTION_LIMIT, 5);
  assert.equal(service.PAID_BATCH_CREDITS, 5);
  assert.equal(service.MAX_BATCH_IMAGES, 50);
  assert.equal(service.parseCaptionResponse('{"caption":"A useful caption"}'), 'A useful caption');
});

test('platform guidance applies native structure and hashtag rules', () => {
  assert.deepEqual(service.cleanPlatforms(['Instagram', 'X', 'unknown', 'instagram']), ['instagram', 'x']);
  const instagram = service.platformGuidance(['instagram']);
  assert.match(instagram, /3-5 highly relevant/);
  assert.match(instagram, /Optimise specifically/);
  const multi = service.platformGuidance(['instagram', 'x']);
  assert.match(multi, /multiple selected platforms/);
  assert.match(multi, /under about 250 characters/);
  assert.match(multi, /at most 1 hashtag/);
});

test('bulk scheduler routes image caption requests through OpenAI, paces retries, and never overwrites non-empty captions', () => {
  const routes = read('src/routes/socialPublicationRoutes.js');
  const backend = read('src/services/bulkCaptionService.js');
  const page = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const editor = read('frontend/src/components/bulk-scheduler/ManualCampaignEditor.tsx');

  assert.match(routes, /ai-captions\/batches/);
  assert.match(backend, /chat\/completions/);
  assert.match(backend, /env\.bulkCaption/);
  assert.match(backend, /PROVIDER_RETRY_DELAYS_MS/);
  assert.match(backend, /reconcileCampaignCharges/);
  assert.match(backend, /duplicate_retry_charge/);
  assert.match(backend, /platformGuidance/);
  assert.doesNotMatch(backend, /runware/i);
  assert.match(page, /post\.contentType === 'IMAGE'/);
  assert.match(page, /!post\.caption\.trim\(\)/);
  assert.match(page, /item\.id === post\.id && !item\.caption\.trim\(\)/);
  assert.match(page, /selectedDestinations\.map\(\(destination\) => destination\.platform\)/);
  assert.doesNotMatch(page, /Math\.min\(3, targets\.length\)/);
  assert.match(editor, /AI captions · \$\{emptyImagePosts\.length\} empty/);
  assert.match(editor, /5 credits unlock AI captions for the rest of that same campaign/);
});
