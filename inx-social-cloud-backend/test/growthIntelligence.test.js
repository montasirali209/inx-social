const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Growth Intelligence admin routes are protected and exposed', () => {
  const routes = read('src/routes/adminRoutes.js');
  assert.match(routes, /growth-intelligence\/overview/);
  assert.match(routes, /growth-intelligence\/site-audit', requireSuperAdmin/);
  assert.match(routes, /growth-intelligence\/openai-visibility', requireSuperAdmin/);
  assert.match(routes, /growth-intelligence\/provider-visibility', requireSuperAdmin/);
  assert.match(routes, /growth-intelligence\/analytics\/property', requireSuperAdmin/);
  assert.match(routes, /growth-intelligence\/reddit-opportunities', requireSuperAdmin/);
});

test('Growth Intelligence UI exposes audit and AI visibility without Reddit automation', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');
  assert.match(html, /data-page="growthIntelligence"/);
  assert.match(html, /Crawler & indexability audit/);
  assert.match(html, /AI search visibility probes/);
  assert.doesNotMatch(html, /Reddit opportunities/);
  assert.match(js, /\/api\/admin\/growth-intelligence\/site-audit/);
  assert.match(js, /\/api\/admin\/growth-intelligence\/openai-visibility/);
  assert.doesNotMatch(js, /\/api\/admin\/growth-intelligence\/reddit-opportunities/);
  assert.doesNotMatch(js, /reddit\.com\/api\/submit|api\/v1\/me|oauth\.reddit/);
});

test('Growth Intelligence keeps AI visibility claims explicit and conservative', () => {
  const service = read('src/services/growthIntelligenceService.js');
  assert.match(service, /not a guaranteed reproduction of consumer ChatGPT results/i);
  assert.match(service, /OpenAI API web-search probe/i);
  assert.match(service, /manual_engagement_only/);
  assert.match(service, /OAI-SearchBot/);
  assert.match(service, /PerplexityBot/);
});
