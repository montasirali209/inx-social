const assert = require('node:assert/strict');
const test = require('node:test');
const branding = require('../src/services/agentBrandingService');

test('connected Page profile retrieval accepts only trusted Facebook image hosts', async () => {
  assert.ok(branding.trustedFacebookImageUrl('https://scontent-lhr8-1.xx.fbcdn.net/avatar.jpg'));
  assert.ok(branding.trustedFacebookImageUrl('https://graph.facebook.com/123/picture?type=large'));
  assert.equal(branding.trustedFacebookImageUrl('https://example.com/fake-logo.png'), '');
  assert.equal(branding.trustedFacebookImageUrl('http://graph.facebook.com/123/picture'), '');
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const plan = { strategyJson: JSON.stringify({ pageTargets: [{ id: 'page-1', name: 'Brand', picture: 'https://graph.facebook.com/123/picture?type=large' }] }) };
  const result = await branding.connectedPageProfile(plan, { http: { get: async () => ({ data: bytes, headers: { 'content-type': 'image/jpeg' } }) } });
  assert.equal(result.source, 'CONNECTED_PAGE_PROFILE');
  assert.deepEqual(result.data, bytes);
});
