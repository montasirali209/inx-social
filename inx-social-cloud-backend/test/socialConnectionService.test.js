const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const prismaPath = require.resolve('../src/db/prisma');
let connectionRow = null;
let profileRows = [];
const prisma = {
  connectedPage: {
    findMany: async () => [{
      id: 'page-row-1',
      facebookPageId: 'fb-page-1',
      facebookPageName: 'INX Page',
      encryptedAccessToken: 'page-token'
    }]
  },
  socialConnection: {
    findUnique: async () => connectionRow ? { ...connectionRow, profiles: [...profileRows] } : null,
    upsert: async ({ create, update }) => {
      connectionRow = connectionRow
        ? { ...connectionRow, ...update }
        : { id: 'connection-1', connectedAt: new Date(), ...create };
      return connectionRow;
    },
    findMany: async () => connectionRow ? [{ ...connectionRow, profiles: [...profileRows] }] : [],
    findFirst: async () => connectionRow,
    update: async ({ data }) => {
      connectionRow = { ...connectionRow, ...data };
      return connectionRow;
    }
  },
  socialProfile: {
    upsert: async ({ create, update }) => {
      const index = profileRows.findIndex(row => row.externalProfileId === create.externalProfileId);
      if (index >= 0) profileRows[index] = { ...profileRows[index], ...update };
      else profileRows.push({ id: `profile-${profileRows.length + 1}`, ...create });
      return profileRows[index >= 0 ? index : profileRows.length - 1];
    },
    updateMany: async () => ({ count: profileRows.length })
  },
  $transaction: async operations => Promise.all(operations)
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const service = require('../src/services/socialConnectionService');
const { decryptToken } = require('../src/utils/tokenCrypto');

test('LinkedIn, YouTube, and X authorization URLs use signed state and minimal linking scopes', () => {
  process.env.APP_URL = 'https://social.example.test/';
  process.env.LINKEDIN_CLIENT_ID = 'linkedin-client';
  process.env.LINKEDIN_CLIENT_SECRET = 'linkedin-secret';
  process.env.GOOGLE_CLIENT_ID = 'google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
  process.env.X_CLIENT_ID = 'x-client';
  process.env.X_CLIENT_SECRET = 'x-secret';

  const linkedIn = new URL(service.authorization('linkedin', 'user-1').authorizationUrl);
  assert.equal(linkedIn.origin, 'https://www.linkedin.com');
  assert.equal(linkedIn.searchParams.get('redirect_uri'), 'https://social.example.test/api/social-connections/oauth/linkedin/callback');
  assert.deepEqual(linkedIn.searchParams.get('scope').split(' '), ['openid', 'profile', 'email']);
  assert.ok(linkedIn.searchParams.get('state'));

  const youtube = new URL(service.authorization('youtube', 'user-1').authorizationUrl);
  assert.equal(youtube.origin, 'https://accounts.google.com');
  assert.match(youtube.searchParams.get('scope'), /youtube\.readonly/);
  assert.equal(youtube.searchParams.get('access_type'), 'offline');
  assert.equal(youtube.searchParams.get('prompt'), 'consent select_account');

  const x = new URL(service.authorization('x', 'user-1').authorizationUrl);
  assert.equal(x.origin, 'https://x.com');
  assert.equal(x.searchParams.get('redirect_uri'), 'https://social.example.test/api/social-connections/oauth/x/callback');
  assert.deepEqual(x.searchParams.get('scope').split(' '), ['tweet.read', 'users.read', 'offline.access']);
  assert.equal(x.searchParams.get('code_challenge_method'), 'S256');
  assert.match(x.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
});

test('X linking exchanges PKCE securely and stores a read-only profile', async t => {
  connectionRow = null;
  profileRows = [];
  process.env.APP_URL = 'https://social.example.test';
  process.env.X_CLIENT_ID = 'x-client';
  process.env.X_CLIENT_SECRET = 'x-secret';
  const start = service.authorization('x', 'user-1');
  const state = new URL(start.authorizationUrl).searchParams.get('state');
  t.mock.method(axios, 'post', async (url, body, options) => {
    assert.equal(url, 'https://api.x.com/2/oauth2/token');
    assert.equal(options.auth.username, 'x-client');
    assert.equal(options.auth.password, 'x-secret');
    const params = new URLSearchParams(body);
    assert.equal(params.get('grant_type'), 'authorization_code');
    assert.match(params.get('code_verifier'), /^[A-Za-z0-9_-]{43}$/);
    return { data: { access_token: 'x-access', refresh_token: 'x-refresh', expires_in: 7200 } };
  });
  t.mock.method(axios, 'get', async (url, options) => {
    assert.equal(url, 'https://api.x.com/2/users/me');
    assert.equal(options.headers.Authorization, 'Bearer x-access');
    return { data: { data: { id: 'x-user-1', name: 'INX Social', username: 'inxsocial', profile_image_url: 'https://images.example/x.jpg', public_metrics: { followers_count: 12, following_count: 3, tweet_count: 8 } } } };
  });

  await service.completeOAuth('x', { code: 'x-code', state });
  assert.equal(connectionRow.platform, 'x');
  assert.equal(decryptToken(connectionRow.encryptedAccessToken), 'x-access');
  assert.equal(decryptToken(connectionRow.encryptedRefreshToken), 'x-refresh');
  assert.deepEqual(JSON.parse(profileRows[0].capabilitiesJson), { identity: true, publish: false, analytics: false, readonly: true });
});

test('Instagram linking stores encrypted read/insight access without claiming publishing', async t => {
  connectionRow = null;
  profileRows = [];
  t.mock.method(axios, 'get', async (url, options) => {
    assert.match(url, /fb-page-1$/);
    assert.match(options.params.fields, /instagram_business_account/);
    return { data: { instagram_business_account: {
      id: 'ig-1', username: 'inxsocial', name: 'INX Social', profile_picture_url: 'https://images.example/ig.jpg', followers_count: 42, media_count: 7
    } } };
  });

  const result = await service.syncInstagram('user-1');
  assert.equal(result.connections.length, 1);
  assert.equal(connectionRow.platform, 'instagram');
  assert.equal(decryptToken(connectionRow.encryptedAccessToken), 'page-token');
  assert.deepEqual(JSON.parse(connectionRow.scopesJson), ['instagram_basic', 'instagram_manage_insights']);
  assert.deepEqual(JSON.parse(profileRows[0].capabilitiesJson), { identity: true, publish: false, analytics: true });
  assert.equal(profileRows[0].metadataJson.includes('page-token'), false);
});

test('public connection data excludes credentials and tolerates malformed provider metadata', () => {
  const publicRow = service.publicConnection({
    id: 'connection-1',
    platform: 'youtube',
    accountType: 'GOOGLE_ACCOUNT',
    displayName: 'Owner',
    status: 'ACTIVE',
    scopesJson: '{bad',
    encryptedAccessToken: 'secret',
    encryptedRefreshToken: 'refresh-secret',
    profiles: [{
      id: 'profile-1', platform: 'youtube', externalProfileId: 'channel-1', displayName: 'Channel',
      status: 'ACTIVE', isDefault: true, capabilitiesJson: '{bad', metadataJson: '{bad'
    }]
  });
  assert.deepEqual(publicRow.scopes, []);
  assert.deepEqual(publicRow.profiles[0].capabilities, {});
  assert.equal(publicRow.encryptedAccessToken, undefined);
  assert.equal(JSON.stringify(publicRow).includes('secret'), false);
});
