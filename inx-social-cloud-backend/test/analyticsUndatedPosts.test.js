const test = require('node:test');
const assert = require('node:assert/strict');
const { publishedAtForPost } = require('../src/services/postForMeAnalyticsService');

test('recovers an exact X publishing date from an unrounded status ID', () => {
  const published = Date.UTC(2026, 8, 22, 11, 35);
  const id = String((BigInt(published) - 1288834974657n) << 22n);
  assert.equal(publishedAtForPost('x', { platform_post_id: id }).getTime(), published);
  assert.equal(publishedAtForPost('x', { platform_url: `https://x.com/account/status/${id}` }).getTime(), published);
});

test('provider dates take precedence and other platforms cannot infer a date from an ID', () => {
  const published = Date.UTC(2026, 8, 22);
  const id = String((BigInt(published) - 1288834974657n) << 22n);
  assert.equal(publishedAtForPost('x', { platform_post_id: id, posted_at: '2026-09-21T00:00:00.000Z' }).toISOString(), '2026-09-21T00:00:00.000Z');
  assert.equal(publishedAtForPost('facebook', { platform_post_id: id }), null);
  assert.equal(publishedAtForPost('x', { platform_post_id: 'provider-opaque-id' }), null);
  assert.equal(publishedAtForPost('x', { platform_post_id: id, platform_url: 'https://x.com/account/status/123456789012345678' }), null);
});
