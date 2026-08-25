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

test('Studio separates customer uploads from generated campaign media and exposes full review controls', () => {
  const app = read('studio/app.js');
  const html = read('studio/index.html');
  const routes = read('src/routes/agentRoutes.js');
  assert.match(app, /filter\(asset => asset\.source === 'UPLOAD'\)/);
  assert.match(app, /CAMPAIGN REVIEW/);
  assert.match(app, /Approve all &amp; schedule/);
  assert.match(html, /id="agentPostEditor"/);
  assert.match(html, /Generate a different image/);
  assert.match(routes, /campaigns\/:campaignId\/posts\/:postId\/regenerate-image/);
  assert.match(routes, /campaigns\/:campaignId\/schedule/);
});

test('Phase 11.5 migration keeps campaign approval and scheduler records linked', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260825000000_add_agent_campaign_review/migration.sql');
  assert.match(schema, /model AgentCampaign \{/);
  assert.match(schema, /model AgentCampaignPost \{/);
  assert.match(schema, /scheduleJobId\s+String\?\s+@unique/);
  assert.match(migration, /AgentCampaignPost_scheduleJobId_fkey/);
});
