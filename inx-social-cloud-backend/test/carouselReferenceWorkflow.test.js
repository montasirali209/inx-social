const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('carousel reference files are staged in the composer and only sent with the user message', () => {
  const modal = read('frontend/src/components/ai-content-studio/CarouselChatModalV2.tsx');
  assert.match(modal, /pendingReferences/);
  assert.match(modal, /type="file" multiple/);
  assert.match(modal, /uploadPostStudioReference/);
  assert.match(modal, /Attached references:/);
  assert.match(modal, /setPendingReferences\(\[\]\)/);
  const uploadBlock = modal.match(/async function uploadReference[\s\S]*?\n  async function generate/)?.[0] || '';
  assert.doesNotMatch(uploadBlock, /await ask\(/);
});

test('saved carousel drafts preserve conversational refinement context', () => {
  const modal = read('frontend/src/components/ai-content-studio/CarouselChatModalV2.tsx');
  assert.match(modal, /studioState\?: CarouselStudioState/);
  assert.match(modal, /asset: \{ \.\.\.asset, studioState \}/);
  assert.match(modal, /restored\?\.messages/);
  assert.match(modal, /restored\?\.brief/);
  assert.match(modal, /restored\?\.sourceAnalysis/);
  assert.match(modal, /restored\?\.references/);
  assert.match(modal, /lastRenderedKey/);
});

test('AI Studio accepts image, PDF and text reference uploads without exposing document references to image rendering', () => {
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const service = read('src/services/aiStudioReferenceService.js');
  const modal = read('frontend/src/components/ai-content-studio/CarouselChatModalV2.tsx');
  assert.match(routes, /\/references/);
  assert.match(routes, /application\/pdf/);
  assert.match(service, /extractPdfText/);
  assert.match(service, /AI_REFERENCE_DOCUMENT/);
  assert.match(service, /documentPreview/);
  assert.match(modal, /references\.filter\(\(item\) => !item\.convertedToPreview\)/);
});

test('source-analysis memory is compacted before it re-enters the validated chat history', () => {
  const api = read('frontend/src/lib/ai-post-studio-api.ts');
  assert.match(api, /validation is capped at 4,000 characters/);
  assert.match(api, /summary: String\(analysis\.summary \|\| ''\)\.slice\(0, 350\)/);
  assert.match(api, /sources: \(analysis\.sources \|\| \[\]\)\.slice\(0, 4\)/);
});
