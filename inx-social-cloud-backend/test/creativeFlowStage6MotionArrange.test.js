const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('Creative Flow connectors use solid paths with travelling flow pulses', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /BaseEdge/);
  assert.match(workspace, /getSmoothStepPath/);
  assert.match(workspace, /function FlowingEdge/);
  assert.match(workspace, /<animateMotion/);
  assert.match(workspace, /type: 'flow'/);
  assert.match(workspace, /edgeTypes=\{edgeTypes\}/);
  assert.doesNotMatch(workspace, /strokeDasharray/);
});

test('Creative Flow exposes one-click canonical auto arrange and persists it', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /CANONICAL_CANVAS_POSITIONS/);
  assert.match(workspace, /const autoArrange = useCallback/);
  assert.match(workspace, /Auto arrange workflow/);
  assert.match(workspace, /Put every node back into the recommended layout/);
  assert.match(workspace, /saveCreativeFlowProjectCanvas/);
  assert.match(workspace, /flow\.fitView/);
  assert.match(workspace, /<LayoutGrid/);
});
