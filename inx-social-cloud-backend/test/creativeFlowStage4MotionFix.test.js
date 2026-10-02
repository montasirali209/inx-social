const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('restored campaign projects keep focus on Product Intelligence and generated review nodes', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /function focusNodeIds/);
  assert.match(workspace, /'productIntelligence'/);
  assert.match(workspace, /revealedPostIds\.map\(\(id\) => creativeNodeId\(id\)\)/);
  assert.match(workspace, /const lastFocusKeyRef = useRef\(''\)/);
  assert.match(workspace, /flow\.fitView/);
  assert.match(workspace, /duration: 760/);
});

test('running, success and error jobs use expressive shared motion states', () => {
  const motion = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowMotion.tsx');
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(motion, /state === 'working'/);
  assert.match(motion, /state === 'success'/);
  assert.match(motion, /state === 'error'/);
  assert.match(motion, /data-ring-outer/);
  assert.match(motion, /data-ring-inner/);
  assert.match(motion, /data-orbiter/);
  assert.match(motion, /data-scan/);
  assert.match(motion, /CreativeFlowMotionState/);

  assert.match(workspace, /state=\{running \? 'working' : success \? 'success' : failed \? 'error' : 'idle'\}/);
  assert.match(workspace, /Campaign needs another try/);
  assert.match(workspace, /Campaign generation stopped before rendering started/);
});

test('error presentation is local to the failed workflow node and preserves retry controls', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /project\.lastError \|\| 'Something interrupted product analysis/);
  assert.match(workspace, /project\.lastError \|\| 'Campaign generation stopped before rendering started/);
  assert.match(workspace, /Retry analysis/);
  assert.match(workspace, /Generate Campaign/);
});
