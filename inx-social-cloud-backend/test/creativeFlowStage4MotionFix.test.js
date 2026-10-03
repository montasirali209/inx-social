const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('restored projects focus Product Intelligence and generated review nodes', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /function focusIds/);
  assert.match(workspace, /'productIntelligence'/);
  assert.match(workspace, /revealedPostIds\.map|revealedPostIds\.length|revealedPostIds/);
  assert.match(workspace, /lastFocusRef/);
  assert.match(workspace, /flow\.fitView/);
  assert.match(workspace, /duration: 650/);
});

test('running success error and selected states use abstract signal-core motion', () => {
  const motion = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowMotion.tsx');

  assert.match(motion, /state === 'working'/);
  assert.match(motion, /state === 'success'/);
  assert.match(motion, /state === 'error'/);
  assert.match(motion, /data-ring-outer/);
  assert.match(motion, /data-ring-inner/);
  assert.match(motion, /data-orbiter/);
  assert.match(motion, /data-scan/);
  assert.match(motion, /CreativeFlowMotionState/);
});

test('connector layer uses reliable smooth-step paths with travelling flow pulses', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /function FlowingEdge/);
  assert.match(workspace, /getSmoothStepPath/);
  assert.match(workspace, /type: 'flow'/);
  assert.match(workspace, /<animateMotion/);
  assert.match(workspace, /edgeTypes=\{edgeTypes\}/);
  assert.match(workspace, /defaultEdgeOptions=\{\{ type: 'flow', zIndex: 8 \}\}/);
  assert.match(workspace, /makeEdge\('url-analyze'/);
  assert.match(workspace, /makeEdge\('images-analyze'/);
  assert.doesNotMatch(workspace, /strokeDasharray/);
});

test('creative flow runtime guards keep custom connectors solid and arrange controls visible', () => {
  const shell = read('frontend/index.html');

  assert.match(shell, /\.react-flow__edge-flow path/);
  assert.match(shell, /stroke-dasharray: none !important/);
  assert.match(shell, /stroke-dashoffset: 0 !important/);
  assert.match(shell, /Auto arrange workflow/);
  assert.match(shell, /Fit Creative Flow to screen/);
  assert.match(shell, /z-index: 1000 !important/);
});

test('product analysis and campaign generation preserve actionable controls', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');
  assert.match(workspace, /Retry analysis/);
  assert.match(workspace, /Generate Campaign/);
  assert.match(workspace, /Open image/);
});
