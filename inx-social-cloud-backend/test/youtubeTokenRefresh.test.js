const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const prismaPath = require.resolve('../src/db/prisma');
const connection = {
  id: 'youtube-connection-1',
  status: 'ACTIVE',
  encryptedAccessToken: null,
  encryptedRefreshToken: null,
  tokenExpiresAt: new Date(0)
};
const prisma = {
  socialProfile: {
    findFirst: async () => ({ id: 'profile-1', connection })
  },
  socialConnection: {
    update: async ({ data }) => { Object.assign(connection, data); return connection; }
  }
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const { encryptToken, decryptToken } = require('../src/utils/tokenCrypto');
const service = require('../src/services/youtubeTokenService');

test('expired YouTube token refreshes with Google and persists replacement access token', async t => {
  process.env.GOOGLE_CLIENT_ID = 'google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
  connection.encryptedAccessToken = encryptToken('old-access');
  connection.encryptedRefreshToken = encryptToken('refresh-token');
  connection.tokenExpiresAt = new Date(Date.now() - 1000);

  t.mock.method(axios, 'post', async (url, body, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const params = new URLSearchParams(body);
    assert.equal(params.get('grant_type'), 'refresh_token');
    assert.equal(params.get('refresh_token'), 'refresh-token');
    return { data: { access_token: 'new-access', expires_in: 3600 } };
  });

  const token = await service.ensureFreshYouTubeToken('user-1', 'profile-1');
  assert.equal(token, 'new-access');
  assert.equal(decryptToken(connection.encryptedAccessToken), 'new-access');
  assert.ok(new Date(connection.tokenExpiresAt).getTime() > Date.now());
});
