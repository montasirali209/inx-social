const test = require('node:test');
const assert = require('node:assert/strict');

const service = require('../src/services/socialConnectionService');

test('YouTube OAuth requests both channel and Analytics read access', () => {
  process.env.APP_URL = 'https://social.example.test';
  process.env.GOOGLE_CLIENT_ID = 'google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'google-secret';

  const authorization = new URL(service.authorization('youtube', 'user-1').authorizationUrl);
  const scopes = new Set(String(authorization.searchParams.get('scope') || '').split(' '));

  assert.ok(scopes.has('https://www.googleapis.com/auth/youtube.readonly'));
  assert.ok(scopes.has('https://www.googleapis.com/auth/yt-analytics.readonly'));
  assert.equal(authorization.searchParams.get('access_type'), 'offline');
  assert.equal(authorization.searchParams.get('include_granted_scopes'), 'true');
  assert.equal(authorization.searchParams.get('prompt'), 'consent select_account');
  assert.ok(service.YOUTUBE_SCOPES.includes('https://www.googleapis.com/auth/yt-analytics.readonly'));
});
