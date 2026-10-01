const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Creative Flow stage 1 is a simple UI-only campaign builder', () => {
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const flow = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');

  assert.match(page, /CreativeFlowLaunchCard/);
  assert.match(page, /CreativeFlowModal/);
  assert.match(flow, /Add your product/);
  assert.match(flow, /What do you want to create\?/);
  assert.match(flow, /Number of creatives/);
  assert.match(flow, /Advanced options/);
  assert.match(flow, /Stage 1 UI preview/);
  assert.match(flow, /No provider requests, credits, database writes or publishing actions/);
  assert.match(flow, /Generating creatives/);
  assert.match(flow, /Campaign ready/);
  assert.match(flow, /Add to campaign/);
});

test('Creative Flow stage 1 has no backend or provider dependency', () => {
  const flow = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');

  assert.doesNotMatch(flow, /ai-content-studio-api/);
  assert.doesNotMatch(flow, /apiRequest/);
  assert.doesNotMatch(flow, /fetch\(/);
  assert.doesNotMatch(flow, /axios/);
  assert.doesNotMatch(flow, /runware/i);
  assert.doesNotMatch(flow, /openai/i);
});
