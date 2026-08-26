const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const campaigns = require('../src/services/agentCampaignService');
const publisher = require('../src/services/cloudMetaPublisher');
const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('campaign copy parsing preserves distinct structured post drafts', () => {
  const output = campaigns.extractStructuredPosts(`Result:\n{"posts":[{"title":"First","caption":"A"},{"title":"Second","caption":"B"}]}`);
  assert.equal(output.length, 2);
  assert.equal(output[1].title, 'Second');
});

test('campaign recommendations honour the Page timezone and distinct saved slots', () => {
  const slots = campaigns.recommendedSlots({
    count: 2,
    timezone: 'Europe/London',
    times: ['10:00', '14:00'],
    now: new Date('2026-08-25T07:00:00.000Z')
  });
  assert.deepEqual(slots.map(value => value.toISOString()), ['2026-08-25T09:00:00.000Z', '2026-08-25T13:00:00.000Z']);
});

test('Meta schedule guard rejects unsafe lead time before any external request', () => {
  assert.throws(() => publisher.scheduledPublishFields(new Date(Date.now() + 5 * 60 * 1000)), /at least 10 minutes/);
  const safe = publisher.scheduledPublishFields(new Date(Date.now() + 20 * 60 * 1000));
  assert.equal(safe.published, false);
  assert.ok(safe.scheduled_publish_time > Math.floor(Date.now() / 1000));
});

test('Studio separates customer uploads from generated campaign media and exposes simple review controls', () => {
  const app = read('studio/app.js');
  const html = read('studio/index.html');
  const routes = read('src/routes/agentRoutes.js');
  assert.match(app, /filter\(asset => asset\.source === 'UPLOAD'\)/);
  assert.match(app, /CAMPAIGN REVIEW/);
  assert.match(app, /Approve all &amp; schedule/);
  assert.match(html, /id="agentPostEditor"/);
  assert.match(html, /Review your post/);
  assert.match(html, /Create image/);
  assert.match(html, /id="agentPostImagePrompt"/);
  assert.match(html, /id="agentPostImageOverlay"/);
  assert.match(html, /id="agentPostImageQuality"/);
  assert.match(html, /id="agentPostEditorDate"/);
  assert.match(html, /id="agentPostEditorClock"/);
  assert.match(html, /Advanced details/);
  assert.doesNotMatch(html, /data-image-prompt=/);
  assert.doesNotMatch(html, />New concept</);
  assert.match(app, /editorScheduleIso/);
  assert.match(app, /customerPrompt, overlayText, generationChoice/);
  assert.match(app, /qualityReview\?\.approved !== true/);
  assert.match(read('studio/web-adapter.js'), /JSON\.stringify\(payload\)/);
  assert.match(read('src/services/agentCampaignService.js'), /MEDIA_REVIEW_REQUIRED/);
  assert.match(read('src/services/agentCampaignService.js'), /asset\.qualityScore === null/);
  assert.match(routes, /campaigns\/:campaignId\/posts\/:postId\/regenerate-image/);
  assert.match(routes, /campaigns\/:campaignId\/schedule/);
  assert.match(routes, /plans\/:id\/prepare-review/);
  assert.match(app, /prepareAgentCampaignReview/);
  assert.match(app, /Open Campaign Review/);
  assert.match(app, /activeAgentPlanId = '__none__'/);
  assert.match(app, /cancelled mission has been cleared/);
});

test('cancellation stops waiting tasks and the runtime checks for cancellation between steps', () => {
  const controller = read('src/controllers/agentController.js');
  const runtime = read('src/services/agentRuntimeService.js');
  assert.match(controller, /notIn: \['COMPLETED', 'CANCELLED'\]/);
  assert.match(runtime, /latestState\?\.status === 'CANCELLED'/);
  assert.match(runtime, /no further mission tasks will start/);
});

test('unavailable current-web research is a completed warning, not a customer blocker', () => {
  const runtime = read('src/services/agentRuntimeService.js');
  const app = read('studio/app.js');
  assert.match(runtime, /TASK_COMPLETED_WITH_WARNING/);
  assert.match(runtime, /researchAvailable: false/);
  assert.doesNotMatch(runtime, /catch \(error\) \{\s*actionRequired = true;\s*const message = error\.code === 'WEB_RESEARCH_NOT_CONFIGURED'/);
  assert.match(app, /title: 'Current-web research unavailable'/);
  assert.match(app, /No action is required from you/);
  assert.match(app, /passive: true/);
});

test('Phase 11.5 migration keeps campaign approval and scheduler records linked', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260825000000_add_agent_campaign_review/migration.sql');
  assert.match(schema, /model AgentCampaign \{/);
  assert.match(schema, /model AgentCampaignPost \{/);
  assert.match(schema, /scheduleJobId\s+String\?\s+@unique/);
  assert.match(migration, /AgentCampaignPost_scheduleJobId_fkey/);
});
