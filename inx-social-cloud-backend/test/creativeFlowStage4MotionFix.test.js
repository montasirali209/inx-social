const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('restored Stage 3 projects auto-focus the Stage 4 strategy node on open', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /function focusNodeIds/);
  assert.match(workspace, /\['CAMPAIGN_READY', 'STRATEGY_PLANNING', 'STRATEGY_FAILED'\]/);
  assert.match(workspace, /return \['productIntelligence', 'creativeStrategy'\]/);
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
  assert.match(motion, /data-thought/);
  assert.match(motion, /data-alert/);
  assert.match(motion, /CreativeFlowMotionState/);

  assert.match(workspace, /state=\{running \? 'working' : success \? 'success' : failed \? 'error' : 'idle'\}/);
  assert.match(workspace, /Strategy needs another try/);
  assert.match(workspace, /Creative generation stopped unexpectedly/);
});

test('error presentation is local to the failed workflow node and preserves retry controls', () => {
  const workspace = read('frontend/src/components/ai-content-studio/creative-flow/CreativeFlowWorkspace.tsx');

  assert.match(workspace, /project\.lastError \|\| 'Something interrupted product analysis/);
  assert.match(workspace, /project\.lastError \|\| 'Creative strategy stopped unexpectedly/);
  assert.match(workspace, /project\.lastError \|\| 'Creative generation stopped unexpectedly/);
  assert.match(workspace, /Retry analysis/);
  assert.match(workspace, /Retry strategy/);
  assert.match(workspace, /Retry generation start/);
});
