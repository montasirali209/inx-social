const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('admin AI page uses current commercial plan ladder and separates Studio from Social Agent', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');
  const routes = read('src/routes/adminRoutes.js');

  assert.match(html, /AI &amp; Automation Administration/);
  assert.match(html, /AI Content Studio policy/);
  assert.match(html, /Social Agent policy/);
  assert.match(html, /Creator missions/);
  assert.match(html, /Business missions/);
  assert.match(html, /Agency missions/);
  assert.doesNotMatch(html, /Plus monthly missions|Legacy lifetime missions|Save AI access policy/);
  assert.doesNotMatch(html, /Local First, then OpenAI|Ollama is unavailable/);
  assert.match(js, /\/api\/admin\/ai-studio-policy/);
  assert.match(js, /agentLimitCreator/);
  assert.match(js, /agentLimitBusiness/);
  assert.match(js, /agentLimitAgency/);
  assert.match(routes, /requireSuperAdmin, updateAiStudioPolicy/);
});

test('admin AI page exposes plan credits and production provider configuration without secrets', () => {
  const controller = read('src/controllers/adminController.js');
  const html = read('public/index.html');

  assert.match(controller, /AI_TRIAL_CREDITS|creditLimitForPlan\('trial'\)/);
  assert.match(controller, /Runware/);
  assert.match(controller, /Stock Video Creator/);
  assert.match(controller, /OpenAI support routes/);
  assert.match(html, /aiCreditPlanGrid/);
  assert.match(html, /aiProviderGrid/);
  assert.match(html, /Low-level model routing/);
  assert.doesNotMatch(html, /API key|secret key/i);
});
