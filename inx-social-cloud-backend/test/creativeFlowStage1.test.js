const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Creative Flow stage 1 is a connected visual workflow with simple node editing', () => {
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const modal = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');
  const canvas = read('frontend/src/components/ai-content-studio/CreativeFlowCanvas.tsx');

  assert.match(page, /CreativeFlowLaunchCard/);
  assert.match(page, /CreativeFlowModal/);
  assert.match(modal, /CreativeFlowCanvas/);
  assert.match(canvas, /Product source/);
  assert.match(canvas, /Campaign brief/);
  assert.match(canvas, /Platforms/);
  assert.match(canvas, /Creative strategy/);
  assert.match(canvas, /Generate creatives/);
  assert.match(canvas, /Review campaign/);
  assert.match(canvas, /strokeDasharray/);
  assert.match(canvas, /Drag nodes/);
  assert.match(canvas, /Advanced options/);
  assert.match(canvas, /Run Creative Flow/);
  assert.match(modal, /Campaign ready/);
});

test('Creative Flow stage 1 remains UI-only with no provider or backend dependency', () => {
  const modal = read('frontend/src/components/ai-content-studio/CreativeFlowModal.tsx');
  const canvas = read('frontend/src/components/ai-content-studio/CreativeFlowCanvas.tsx');
  const combined = modal + canvas;

  assert.doesNotMatch(combined, /ai-content-studio-api/);
  assert.doesNotMatch(combined, /apiRequest/);
  assert.doesNotMatch(combined, /fetch\(/);
  assert.doesNotMatch(combined, /axios/);
  assert.doesNotMatch(combined, /runware/i);
  assert.doesNotMatch(combined, /openai/i);
});
