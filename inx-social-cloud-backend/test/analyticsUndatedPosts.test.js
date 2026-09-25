const test = require('node:test');
const assert = require('node:assert/strict');
const { publishedAtForPost, belongsToXAccount } = require('../src/services/postForMeAnalyticsService');

test('recovers an exact X publishing date from an unrounded status ID', () => {
  const published = Date.UTC(2026, 8, 22, 11, 35);
  const id = String((BigInt(published) - 1288834974657n) << 22n);
  assert.equal(publishedAtForPost('x', { platform_post_id: id }).getTime(), published);
  assert.equal(publishedAtForPost('x', { platform_url: `https://x.com/account/status/${id}` }).getTime(), published);
});

test('X analytics accepts only the connected author and excludes reposts', () => {
  const profile = { username: '@md_ali21993' };
  const id = '2047000000000000000';
  assert.equal(belongsToXAccount(profile, { platform_url: `https://x.com/md_ali21993/status/${id}`, platform_post_id: id, caption: 'My own post' }), true);
  assert.equal(belongsToXAccount(profile, { platform_url: `https://twitter.com/MD_ALI21993/status/${id}`, caption: 'My own post' }), true);
  assert.equal(belongsToXAccount(profile, { platform_url: `https://x.com/another_user/status/${id}`, caption: 'Someone else' }), false);
  assert.equal(belongsToXAccount(profile, { platform_url: `https://x.com/md_ali21993/status/${id}`, caption: 'RT @another_user: borrowed post' }), false);
  assert.equal(belongsToXAccount(profile, { platform_url: `https://x.com/md_ali21993/status/${id}`, platform_post_id: '2047000000000000001' }), false);
  assert.equal(belongsToXAccount(profile, { platform_url: `https://untrusted.example/md_ali21993/status/${id}` }), false);
  assert.equal(belongsToXAccount(profile, { caption: 'Post without ownership evidence' }), false);
  assert.equal(belongsToXAccount({ username: null }, { platform_url: `https://x.com/md_ali21993/status/${id}` }), false);
});

test('X analytics can verify the exact provider account even when the provider URL uses a placeholder handle', () => {
  const id = '2047000000000000000';
  const profile = {
    username: '@md_ali21993',
    metadataJson: JSON.stringify({ providerUserId: '123456789' })
  };
  assert.equal(belongsToXAccount(profile, {
    platform_account_id: '123456789',
    platform_post_id: id,
    platform_url: `https://twitter.com/user/status/${id}`,
    caption: 'My connected account post'
  }), true);
  assert.equal(belongsToXAccount(profile, {
    platform_account_id: '987654321',
    platform_post_id: id,
    platform_url: `https://twitter.com/user/status/${id}`,
    caption: 'Different account'
  }), false);
  assert.equal(belongsToXAccount(profile, {
    platform_account_id: '123456789',
    platform_post_id: id,
    platform_url: `https://twitter.com/user/status/${id}`,
    caption: 'RT @someone_else: their post'
  }), false);
});

test('provider dates take precedence and other platforms cannot infer a date from an ID', () => {
  const published = Date.UTC(2026, 8, 22);
  const id = String((BigInt(published) - 1288834974657n) << 22n);
  assert.equal(publishedAtForPost('x', { platform_post_id: id, posted_at: '2026-09-21T00:00:00.000Z' }).toISOString(), '2026-09-21T00:00:00.000Z');
  assert.equal(publishedAtForPost('facebook', { platform_post_id: id }), null);
  assert.equal(publishedAtForPost('x', { platform_post_id: 'provider-opaque-id' }), null);
  assert.equal(publishedAtForPost('x', { platform_post_id: id, platform_url: 'https://x.com/account/status/123456789012345678' }), null);
});
