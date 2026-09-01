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

test('LinkedIn and YouTube authorization URLs use signed state and minimal linking scopes', () => {
  process.env.APP_URL = 'https://social.example.test/';
  process.env.LINKEDIN_CLIENT_ID = 'linkedin-client';
  process.env.LINKEDIN_CLIENT_SECRET = 'linkedin-secret';
  process.env.GOOGLE_CLIENT_ID = 'google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'google-secret';

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
