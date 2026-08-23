const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('live refresh preserves open task output and mission scroll position', () => {
  const app = read('studio/app.js');
  assert.match(app, /captureAgentWorkspaceUi/);
  assert.match(app, /restoreAgentWorkspaceUi/);
  assert.match(app, /details\[data-agent-task-id\]/);
  assert.match(app, /taskList\.scrollTop = snapshot\.taskScrollTop/);
  assert.match(app, /view\.scrollTop = snapshot\.viewScrollTop/);
  assert.match(app, /nativeMenuOpen/);
});

test('blocked tasks show explicit action guidance and professional progress', () => {
  const app = read('studio/app.js');
  const css = read('studio/styles.css');
  assert.match(app, /Complete the Facebook Page setup/);
  assert.match(app, /Connect the private INX Agent/);
  assert.match(app, /Choose or connect a visual-content worker/);
  assert.match(app, /agent-action-centre/);
  assert.match(app, /agent-progress-track/);
  assert.match(css, /\.agent-action-centre/);
  assert.match(css, /\.agent-task-board/);
  assert.match(css, /@keyframes agentTaskSweep/);
});

test('agent dropdowns use the active theme and explain visual generation', () => {
  const html = read('studio/index.html');
  const css = read('studio/styles.css');
  assert.match(html, /Visual content method/);
  assert.match(html, /Text-only missions skip media creation/);
  assert.match(css, /#agentPlanSelect option/);
  assert.match(css, /#agentExecutionMode option/);
  assert.match(css, /color-scheme:dark/);
});
