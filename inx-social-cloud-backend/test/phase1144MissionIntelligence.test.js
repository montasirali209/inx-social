const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { buildPlan } = require('../src/services/socialAgentPlanner');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('AI decides the format by default while exact formats remain advanced preferences', () => {
  const html = read('studio/index.html');
  const app = read('studio/app.js');
  assert.match(html, /value="AUTO" checked/);
  assert.match(html, /Advanced: prefer a specific format/);
  assert.match(app, /preflightAgentMission/);
  assert.match(app, /showMissionClarification/);
});

test('every mission includes governed current research before content strategy', () => {
  const plan = buildPlan({ prompt: 'Create a Facebook post for our accounting service', subscriptionPlan: 'PRO' });
  const types = plan.tasks.map(item => item.type);
  assert.ok(types.includes('WEB_RESEARCH'));
  assert.ok(types.indexOf('WEB_RESEARCH') < types.indexOf('CONTENT_STRATEGY'));
  assert.match(read('src/services/webResearchService.js'), /web_search/);
  assert.match(read('.env.example'), /WEB_RESEARCH_ENABLED=false/);
});

test('Action Center and task list are clickable and compact', () => {
  const app = read('studio/app.js');
  const html = read('studio/index.html');
  const css = read('studio/styles.css');
  assert.match(app, /ACTION CENTER/);
  assert.doesNotMatch(app, /ACTION CENTRE/);
  assert.match(app, /data-agent-task-detail/);
  assert.match(app, /data-agent-action-resume/);
  assert.match(css, /\.agent-task-row/);
  assert.match(html, /Mission intelligence/);
});

test('recoverable media dependencies do not create a global mission error', () => {
  const runtime = read('src/services/agentRuntimeService.js');
  const controller = read('src/controllers/agentController.js');
  assert.doesNotMatch(runtime, /WAITING_MEDIA_WORKER[\s\S]{0,400}lastError:\s*error\.message/);
  assert.match(controller, /\['FAILED', 'WAITING_PROVIDER'\]\.includes\(plan\.status\)/);
});

test('research sources are allowed in customer task output without provider names', () => {
  const controller = read('src/controllers/agentController.js');
  assert.match(controller, /'sources'/);
  assert.doesNotMatch(controller, /WEB_RESEARCH_MODEL|gpt-5-mini/);
});
