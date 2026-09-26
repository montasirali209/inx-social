const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Analytics OAuth preserves Growth Intelligence as the return destination', () => {
  const service = read('src/services/googleSearchConsoleService.js');
  const controller = read('src/controllers/googleSearchConsoleController.js');
  const client = read('public/admin.js');

  assert.match(service, /returnTo = options\.returnTo === 'growthIntelligence'/);
  assert.match(service, /returnTo,/);
  assert.match(controller, /result\.returnTo === 'growthIntelligence'/);
  assert.match(client, /returnTo:'growthIntelligence'/);
  assert.match(client, /google==='growth-connected'/);
});

test('GA4 can use a manual numeric property ID when Admin API discovery is unavailable', () => {
  const service = read('src/services/googleAnalyticsService.js');
  const controller = read('src/controllers/growthIntelligenceController.js');
  const html = read('public/index.html');

  assert.match(service, /manualPropertyAllowed: true/);
  assert.match(service, /apiEnablementRequired/);
  assert.match(service, /options\.manual/);
  assert.match(service, /Manual property ID/);
  assert.match(controller, /manual: z\.boolean\(\)/);
  assert.match(html, /id="growthGaManualPropertyId"/);
  assert.match(html, /It is not the measurement ID that starts with G-/);
});

test('Opportunity Intelligence combines search, AI, analytics and technical signals without Reddit', () => {
  const service = read('src/services/growthOpportunityService.js');
  const routes = read('src/routes/adminRoutes.js');
  const html = read('public/index.html');
  const client = read('public/admin.js');

  assert.match(service, /searchConsole\.growthPerformance/);
  assert.match(service, /googleAnalytics\.performance/);
  assert.match(service, /OPENAI_SETTING_KEY/);
  assert.match(service, /PERPLEXITY_SETTING_KEY/);
  assert.match(service, /CLAUDE_SETTING_KEY/);
  assert.doesNotMatch(service, /REDDIT_SETTING_KEY/);
  assert.match(service, /TECHNICAL_FIX/);
  assert.match(service, /IMPROVE_EXISTING_PAGE/);
  assert.match(service, /CREATE_COMMERCIAL_PAGE/);
  assert.match(routes, /growth-intelligence\/opportunities\/build', requireSuperAdmin/);
  assert.match(html, /Opportunity Intelligence/);
  assert.match(client, /buildGrowthOpportunities/);
});

test('Opportunity engine keeps direct query-to-page evidence from Search Console', () => {
  const gsc = read('src/services/googleSearchConsoleService.js');
  const service = read('src/services/growthOpportunityService.js');

  assert.match(gsc, /\['query', 'page'\]/);
  assert.match(gsc, /queryPages/);
  assert.match(service, /queryPageFor/);
  assert.match(service, /existingPage/);
});


test('Growth opportunity and optimisation engines cannot consume another product GSC property',()=>{
  const gsc=read('src/services/googleSearchConsoleService.js');
  const opportunity=read('src/services/growthOpportunityService.js');
  const optimisation=read('src/services/growthOptimizationService.js');
  assert.match(gsc,/sc-domain:inxsocial\.co\.uk/);
  assert.match(gsc,/growthPerformance/);
  assert.match(opportunity,/searchConsole\.growthPerformance\(periodDays\)/);
  assert.match(optimisation,/gsc\.growthPerformance\(28\)/);
  assert.doesNotMatch(opportunity,/searchConsole\.performance\(periodDays\)/);
});
