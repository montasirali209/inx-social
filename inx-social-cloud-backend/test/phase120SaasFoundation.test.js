const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('professional navigation exposes focused SaaS workspaces without Inbox or Team Members', () => {
  const html = read('studio/index.html');
  const order = ['dashboard', 'reels', 'calendar', 'posts', 'media', 'agent', 'analytics', 'settings', 'pages']
    .map(view => html.indexOf(`data-view="${view}"`));
  assert.ok(order.every(index => index >= 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(html, /id="btnCreateNewPost"/);
  assert.match(html, />Billing &amp; Plans</);
  assert.doesNotMatch(html, />Inbox</);
  assert.doesNotMatch(html, />Team Members</);
});

test('Dashboard remains isolated and does not contain Social Agent controls', () => {
  const html = read('studio/index.html');
  const css = read('studio/styles.css');
  const dashboard = html.match(/<section id="dashboard"[\s\S]*?<section id="agent"/)?.[0] || '';
  assert.doesNotMatch(dashboard, /agentPlanForm|agentPrompt|Mission Control|Command console/);
  assert.match(css, /\.view\.dashboard-v3\{[^}]*display:none/);
  assert.match(css, /\.view\.dashboard-v3\.active\{display:grid/);
});

test('Posts workspace renders real publication states and professional filters', () => {
  const html = read('studio/index.html');
  const app = read('studio/app.js');
  for (const filter of ['all', 'draft', 'awaiting', 'scheduled', 'published', 'failed']) {
    assert.match(html, new RegExp(`data-post-filter="${filter}"`));
  }
  assert.match(app, /function postsWorkspaceItems\(\)/);
  assert.match(app, /state\?\.jobs/);
  assert.match(app, /metaScheduledPosts/);
  assert.match(app, /agentOverview\?\.plans/);
  assert.match(app, /function renderPostsWorkspace\(\)/);
});

test('connected accounts page shows honest connector availability', () => {
  const html = read('studio/index.html');
  for (const platform of ['Facebook', 'Instagram', 'Threads', 'LinkedIn', 'TikTok', 'YouTube', 'Pinterest', 'X']) {
    assert.match(html, new RegExp(`<strong>${platform}</strong>`));
  }
  assert.match(html, /<strong>Facebook<\/strong><small>Publishing live<\/small>/);
  for (const connectorId of ['btnConnectInstagram', 'btnConnectLinkedIn', 'btnConnectYouTube', 'btnConnectX']) {
    assert.match(html, new RegExp(`id="${connectorId}"`));
  }
  assert.equal((html.match(/Connector planned/g) || []).length, 3);
});

test('HTML IDs stay unique across isolated workspaces', () => {
  const html = read('studio/index.html');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicates, []);
});

test('Prisma schema and migration establish the platform-neutral core', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260827070000_add_multiplatform_saas_foundation/migration.sql');
  for (const model of ['SocialConnection', 'SocialProfile', 'SocialContent', 'SocialPublication']) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  assert.match(schema, /idempotencyKey\s+String\?/);
  assert.match(schema, /encryptedAccessToken\s+String\?/);
});
