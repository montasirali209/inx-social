const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const prismaPath = require.resolve('../src/db/prisma');
let existingConnection = null;
let upsertCalled = false;
const prisma = {
  socialConnection: {
    findUnique: async () => existingConnection,
    upsert: async () => {
      upsertCalled = true;
      throw new Error('upsert should not run in this test');
    }
  },
  socialProfile: {
    upsert: async () => {
      upsertCalled = true;
      throw new Error('profile upsert should not run in this test');
    }
  }
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const service = require('../src/services/socialConnectionService');

test('Facebook Login for Business uses config_id without mixed Instagram scopes', () => {
  process.env.APP_URL = 'https://social.example.test';
  process.env.FACEBOOK_APP_ID = 'facebook-app';
  process.env.FACEBOOK_LOGIN_CONFIG_ID = 'business-config';
  process.env.FB_GRAPH_VERSION = 'v25.0';

  const start = service.facebookAuthorization('user-1');
  const url = new URL(start.authorizationUrl);

  assert.equal(url.origin, 'https://www.facebook.com');
  assert.equal(url.pathname, '/v25.0/dialog/oauth');
  assert.equal(url.searchParams.get('client_id'), 'facebook-app');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://social.example.test/studio/facebook-callback.html');
  assert.equal(url.searchParams.get('config_id'), 'business-config');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.has('scope'), false);
  assert.ok(start.state);
  assert.equal(start.businessLoginConfigured, true);

  delete process.env.FACEBOOK_LOGIN_CONFIG_ID;
  delete process.env.FACEBOOK_APP_ID;
});

test('Facebook fallback requests Page scopes only and never legacy Instagram scopes', () => {
  process.env.APP_URL = 'https://social.example.test';
  process.env.FACEBOOK_APP_ID = 'facebook-app';
  delete process.env.FACEBOOK_LOGIN_CONFIG_ID;

  const start = service.facebookAuthorization('user-1');
  const url = new URL(start.authorizationUrl);
  const scopes = String(url.searchParams.get('scope') || '').split(',').filter(Boolean);

  assert.deepEqual(scopes, service.FACEBOOK_PAGE_SCOPES);
  assert.equal(scopes.includes('instagram_basic'), false);
  assert.equal(scopes.includes('instagram_content_publish'), false);
  assert.equal(scopes.includes('instagram_manage_insights'), false);
  assert.equal(start.businessLoginConfigured, false);

  delete process.env.FACEBOOK_APP_ID;
});

test('direct Instagram refuses a profile that is already connected only through Meta', async t => {
  process.env.APP_URL = 'https://social.example.test';
  process.env.INSTAGRAM_CLIENT_ID = 'instagram-client';
  process.env.INSTAGRAM_CLIENT_SECRET = 'instagram-secret';

  existingConnection = {
    id: 'connection-meta-1',
    userId: 'user-1',
    platform: 'instagram',
    externalAccountId: 'ig-page-linked',
    accountType: 'PROFESSIONAL',
    displayName: '@pageprofile',
    status: 'ACTIVE',
    scopesJson: JSON.stringify(['instagram_basic', 'instagram_manage_insights']),
    metadataJson: JSON.stringify({ authMethod: 'FACEBOOK_LOGIN', authMethods: ['FACEBOOK_LOGIN'] }),
    profiles: []
  };
  upsertCalled = false;

  const start = service.authorization('instagram', 'user-1');
  const state = new URL(start.authorizationUrl).searchParams.get('state');

  t.mock.method(axios, 'post', async url => {
    assert.equal(url, 'https://api.instagram.com/oauth/access_token');
    return { data: { access_token: 'short-token', user_id: 'ig-page-linked' } };
  });
  t.mock.method(axios, 'get', async url => {
    if (url === 'https://graph.instagram.com/access_token') {
      return { data: { access_token: 'long-token', expires_in: 5184000 } };
    }
    assert.equal(url, 'https://graph.instagram.com/me');
    return {
      data: {
        id: 'ig-page-linked',
        user_id: 'ig-page-linked',
        username: 'pageprofile',
        name: 'Page Profile',
        account_type: 'BUSINESS'
      }
    };
  });

  await assert.rejects(
    service.completeOAuth('instagram', { code: 'instagram-code', state }),
    error => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'INSTAGRAM_ALREADY_CONNECTED_VIA_META');
      assert.match(error.message, /@pageprofile is already connected through Meta/);
      return true;
    }
  );
  assert.equal(upsertCalled, false);
});
