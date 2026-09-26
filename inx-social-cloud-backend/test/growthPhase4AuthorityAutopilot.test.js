const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 4 persists the agreed authority opportunity classes',()=>{
  const service=read('src/services/growthAuthorityService.js');
  assert.match(service,/growth_authority_autopilot_state_v1/);
  assert.match(service,/QUORA/); assert.match(service,/COMMUNITY/); assert.match(service,/UNLINKED_MENTION/);
  assert.match(service,/COMPETITOR_BACKLINK/); assert.match(service,/BROKEN_LINK/); assert.match(service,/JOURNALIST_REQUEST/); assert.match(service,/AI_CITATION_SOURCE/);
  assert.match(service,/Never invent URLs, contact details, community rules, mentions, or backlink claims/);
});

test('Phase 4 validates and drafts transparent non-spam engagement',()=>{
  const service=read('src/services/growthAuthorityService.js');
  assert.match(service,/validateProspect/); assert.match(service,/duplicateEngagement/);
  assert.match(service,/transparently disclose the affiliation/); assert.match(service,/Do not imply an existing relationship/);
  assert.match(service,/env\.contentWriter\.model/);
});

test('Phase 4 outreach is approval gated and rate limited',()=>{
  const service=read('src/services/growthAuthorityService.js');
  const email=read('src/services/emailService.js');
  assert.match(service,/x\.status==='APPROVED'/); assert.match(service,/AUTO_EMAIL_LIMIT = 2/);
  assert.match(service,/5\*24\*60\*60\*1000/); assert.match(service,/status:'FOLLOWED_UP'/);
  assert.match(email,/sendAuthorityOutreach/);
  assert.doesNotMatch(service,/oauth\.reddit|reddit\.com\/api\/submit|api\/v1\/me/);
});

test('Growth Autopilot schedules Phase 4 every six hours',()=>{
  const service=read('src/services/growthAutopilotService.js');
  assert.match(service,/growthAuthorityService/); assert.match(service,/authorityEveryHours: 6/);
  assert.match(service,/nextAuthorityAt/); assert.match(service,/authorityDue/);
  assert.match(service,/authority\.run/); assert.match(service,/lastAuthorityAt/); assert.match(service,/authority: authorityStatus/);
});

test('Phase 4 admin API and dashboard expose authority controls',()=>{
  const routes=read('src/routes/adminRoutes.js'),html=read('public/index.html'),js=read('public/admin.js');
  assert.match(routes,/growth-authority\/status/); assert.match(routes,/growth-authority\/run-now/); assert.match(routes,/growth-authority\/prospects\/:id\/action/);
  assert.match(html,/Authority \+ Community Autopilot/); assert.match(html,/Runs every 6 hours/);
  assert.match(js,/renderGrowthAuthority/); assert.match(js,/runGrowthAuthorityNow/); assert.match(js,/growthAuthorityProspectAction/);
});

test('Phase 4 tracks acquired authority outcomes and engagement metrics',()=>{
  const service=read('src/services/growthAuthorityService.js');
  assert.match(service,/LINK_ACQUIRED/); assert.match(service,/MENTION_ACQUIRED/); assert.match(service,/AI_CITED/);
  assert.match(service,/votes/); assert.match(service,/replies/); assert.match(service,/clicks/); assert.match(service,/communityPosting:false/);
});


test('Reddit is excluded from automatic Growth Autopilot decisions',()=>{
  const autopilot=read('src/services/growthAutopilotService.js');
  const opportunities=read('src/services/growthOpportunityService.js');
  const authority=read('src/services/growthAuthorityService.js');
  const strategy=read('src/services/growthStrategyService.js');
  const html=read('public/index.html');
  const js=read('public/admin.js');

  assert.doesNotMatch(autopilot,/discoverRedditOpportunities/);
  assert.doesNotMatch(autopilot,/Reddit discovery/);
  assert.doesNotMatch(opportunities,/REDDIT_SETTING_KEY/);
  assert.doesNotMatch(opportunities,/redditEvidence\(/);
  assert.match(authority,/Exclude reddit\.com entirely/);
  assert.match(authority,/excluded\(url\)/);
  assert.doesNotMatch(authority,/const TYPES = \['REDDIT'/);
  assert.doesNotMatch(strategy,/Reddit evidence/);
  assert.doesNotMatch(html,/id="discoverRedditBtn"/);
  assert.doesNotMatch(js,/discoverGrowthReddit/);
});
