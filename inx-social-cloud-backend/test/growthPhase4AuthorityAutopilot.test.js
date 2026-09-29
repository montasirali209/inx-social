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

test('Phase 4 outreach uses an independent Sol review gate and remains rate limited',()=>{
  const service=read('src/services/growthAuthorityService.js');
  const email=read('src/services/emailService.js');
  assert.match(service,/reviewOutreachForAutoSend/);
  assert.match(service,/inx_authority_email_final_review/);
  assert.match(service,/corporateSubscriber==='YES'/);
  assert.match(service,/AI_APPROVED/);
  assert.match(service,/\['APPROVED','AI_APPROVED'\]\.includes\(x\.status\)/);
  assert.match(service,/AUTO_EMAIL_LIMIT = 2/);
  assert.match(email,/sendAuthorityOutreach/);
  assert.match(email,/INXSocial is provided by INAXX LTD/);
  assert.match(email,/reply “no thanks”/);
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


test('Sol auto-approval rejects uncertain or unsafe B2B outreach before sending',()=>{
  const service=read('src/services/growthAuthorityService.js');
  assert.match(service,/sole trader/);
  assert.match(service,/personal consumer/);
  assert.match(service,/When uncertain, REJECT/);
  assert.match(service,/contactPubliclyVerified===true/);
  assert.match(service,/relevantBusinessFit===true/);
  assert.match(service,/factualClaimsSafe===true/);
  assert.match(service,/toneSafe===true/);
  assert.match(service,/identityAndOptOutPresent===true/);
});


test('Authority outreach never schedules a blind automatic follow-up without inbound reply suppression',()=>{
  const service=read('src/services/growthAuthorityService.js');
  assert.match(service,/Follow-ups stay disabled until inbound reply suppression is connected/);
  assert.match(service,/nextFollowUpAt:null/);
  assert.doesNotMatch(service,/new Date\(Date\.now\(\)\+5\*24\*60\*60\*1000\)/);
});

test('Manual approval immediately sends eligible email prospects and persists delivery outcome',()=>{
  const service=read('src/services/growthAuthorityService.js');
  const updateStart=service.indexOf("async function updateProspect");
  const updateEnd=service.indexOf("module.exports",updateStart);
  const update=service.slice(updateStart,updateEnd);
  assert.match(update,/if\(action==='approve'\)/);
  assert.match(update,/!\['QUORA','COMMUNITY'\]\.includes\(x\.type\)/);
  assert.match(update,/await emailService\.sendAuthorityOutreach/);
  assert.match(update,/x\.status='SENT'/);
  assert.match(update,/recipient:x\.contact\.value/);
  assert.match(update,/provider:'RESEND'/);
  assert.match(update,/providerId:providerResult\?\.messageId\|\|null/);
  assert.match(update,/status:'ACCEPTED'/);
  assert.match(update,/sentAt/);
  assert.match(update,/x\.status='APPROVED'/);
  assert.match(update,/Approved outreach send failed/);
  assert.match(update,/nextFollowUpAt=null/);
});

test('Authority UI distinguishes Resend API acceptance from a mailbox Sent folder',()=>{
  const service=read('src/services/growthAuthorityService.js');
  const js=read('public/admin.js');
  assert.match(service,/accepted immediately by Resend for delivery/);
  assert.match(service,/do not appear in the mailbox Sent folder/);
  assert.match(js,/API delivery does not create a copy in your mailbox Sent folder/);
  assert.match(js,/Outreach accepted by Resend/);
  assert.match(js,/item\.delivery\?\.channel==='EMAIL'/);
  assert.match(js,/item\.delivery\.provider\|\|'RESEND'/);
});


test('Legacy Reddit authority prospects are purged from persisted state and UI',()=>{
  const service=read('src/services/growthAuthorityService.js');
  const js=read('public/admin.js');
  assert.match(service,/legacyRedditProspect/);
  assert.match(service,/sanitizeProspects/);
  assert.match(service,/stats:summarize\(prospects\)/);
  assert.match(service,/sanitizeProspects\(state\.prospects\)/);
  assert.match(service,/sanitizeProspects\(oldItems\)/);
  assert.match(js,/growthAuthorityLegacyReddit/);
  assert.match(js,/!growthAuthorityLegacyReddit\(item\)/);
});
