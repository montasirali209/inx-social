const assert = require('node:assert/strict');
const test = require('node:test');
const { campaignArtifactIssues } = require('../src/services/agentRuntimeService');

test('a content mission cannot complete without its requested customer-facing image', () => {
  const campaign = { posts: [{ caption: 'Ready caption', connectedPage: { id: 'page-1' }, scheduledAt: new Date(), format: 'IMAGE', asset: null }] };
  assert.match(campaignArtifactIssues(campaign, { assetCount: 1 }).join(' '), /no image/i);
});

test('a complete reviewed image campaign passes the artifact audit', () => {
  const campaign = { posts: [{ caption: 'Ready caption', connectedPage: { id: 'page-1' }, scheduledAt: new Date(), format: 'IMAGE', asset: { status: 'READY', qualityScore: 91 } }] };
  assert.deepEqual(campaignArtifactIssues(campaign, { assetCount: 1 }), []);
});
