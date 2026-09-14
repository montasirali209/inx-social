const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const { encryptToken } = require('../utils/tokenCrypto');

const LINKEDIN_SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

function error(message, status = 400, code = null) {
  const value = new Error(message);
  value.status = status;
  value.publicMessage = message;
  if (code) value.code = code;
  return value;
}

function publicOrigin() {
  return String(process.env.APP_URL || 'http://localhost:5050').trim().replace(/\/+$/, '');
}

// Keep the callback URI used by the original INXSocial LinkedIn app. This is
// already registered in LinkedIn and avoids breaking existing production app
// configuration while adding w_member_social publishing permission.
function callbackUrl() {
  return `${publicOrigin()}/api/social-connections/oauth/linkedin/callback`;
}

function stateSecret() {
  const value = String(process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || '').trim();
  if (!value) throw error('OAuth state signing is not configured.', 503);
  return value;
}

function settings() {
  const clientId = String(process.env.LINKEDIN_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.LINKEDIN_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    throw error('LinkedIn OAuth credentials are not configured on the server.', 503, 'OAUTH_PROVIDER_NOT_CONFIGURED');
  }
  return { clientId, clientSecret };
}

function authorization(userId) {
  if (!userId) throw error('Sign in before connecting LinkedIn.', 401);
  const { clientId } = settings();
  const state = jwt.sign({
    sub: String(userId),
    purpose: 'linkedin-publishing-oauth',
    nonce: crypto.randomBytes(18).toString('base64url')
  }, stateSecret(), { expiresIn: '10m', issuer: 'inx-social' });

  const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl());
  url.searchParams.set('scope', LINKEDIN_SCOPES.join(' '));
  url.searchParams.set('state', state);
  return { authorizationUrl: url.toString(), redirectUri: callbackUrl(), platform: 'linkedin' };
}

function verifyState(state) {
  try {
    const payload = jwt.verify(String(state || ''), stateSecret(), { issuer: 'inx-social' });
    if (payload.purpose !== 'linkedin-publishing-oauth' || !payload.sub) throw new Error('invalid state');
    return payload;
  } catch (_) {
    throw error('The LinkedIn connection session expired. Start the connection again.', 401);
  }
}

function splitScopes(value) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || '').split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
}

async function completeOAuth(query) {
  const payload = verifyState(query.state);
  if (query.error) throw error(String(query.error_description || query.error), 400);
  if (!query.code) throw error('LinkedIn did not return an authorization code.', 400);

  const { clientId, clientSecret } = settings();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(query.code),
    redirect_uri: callbackUrl(),
    client_id: clientId,
    client_secret: clientSecret
  });

  let token;
  try {
    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    });
    token = tokenResponse.data || {};
  } catch (value) {
    const message = value.response?.data?.error_description || value.response?.data?.message || value.message || 'LinkedIn could not complete authorization.';
    throw error(message, 400, 'LINKEDIN_TOKEN_EXCHANGE_FAILED');
  }
  if (!token.access_token) throw error('LinkedIn did not return an access token.', 400);

  const userInfoResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
    timeout: 20000
  });
  const userInfo = userInfoResponse.data || {};
  if (!userInfo.sub) throw error('LinkedIn did not return a member identity.', 400);

  let memberId = String(userInfo.sub);
  try {
    const memberResponse = await axios.get('https://api.linkedin.com/v2/me', {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'X-Restli-Protocol-Version': '2.0.0'
      },
      timeout: 15000
    });
    if (memberResponse.data?.id) memberId = String(memberResponse.data.id);
  } catch (_) {
    // OpenID Connect identity remains the fallback for apps without /v2/me.
  }

  const tokenScopes = splitScopes(token.scope);
  const grantedScopes = tokenScopes.length ? tokenScopes : LINKEDIN_SCOPES;
  if (!grantedScopes.includes('w_member_social')) {
    throw error('LinkedIn connected, but publishing permission was not granted. Reconnect and allow Share on LinkedIn.', 403, 'LINKEDIN_PUBLISH_SCOPE_MISSING');
  }

  const expiresAt = Number(token.expires_in || 0) > 0
    ? new Date(Date.now() + Number(token.expires_in) * 1000)
    : null;
  const userId = String(payload.sub);
  const externalAccountId = String(userInfo.sub);
  const displayName = userInfo.name || userInfo.email || 'LinkedIn member';

  const connection = await prisma.socialConnection.upsert({
    where: { userId_platform_externalAccountId: { userId, platform: 'linkedin', externalAccountId } },
    create: {
      userId,
      platform: 'linkedin',
      externalAccountId,
      accountType: 'MEMBER',
      displayName,
      status: 'ACTIVE',
      encryptedAccessToken: encryptToken(token.access_token),
      encryptedRefreshToken: token.refresh_token ? encryptToken(token.refresh_token) : null,
      tokenExpiresAt: expiresAt,
      scopesJson: JSON.stringify(grantedScopes),
      metadataJson: JSON.stringify({ connectedBy: 'OAUTH', authMethod: 'LINKEDIN_SHARE', memberId }),
      lastSyncedAt: new Date(),
      lastError: null
    },
    update: {
      accountType: 'MEMBER',
      displayName,
      status: 'ACTIVE',
      encryptedAccessToken: encryptToken(token.access_token),
      encryptedRefreshToken: token.refresh_token ? encryptToken(token.refresh_token) : undefined,
      tokenExpiresAt: expiresAt || undefined,
      scopesJson: JSON.stringify(grantedScopes),
      metadataJson: JSON.stringify({ connectedBy: 'OAUTH', authMethod: 'LINKEDIN_SHARE', memberId }),
      lastSyncedAt: new Date(),
      lastError: null
    }
  });

  await prisma.socialProfile.updateMany({
    where: { connectionId: connection.id, externalProfileId: { not: memberId } },
    data: { status: 'REVOKED', isDefault: false }
  });

  await prisma.socialProfile.upsert({
    where: { connectionId_externalProfileId: { connectionId: connection.id, externalProfileId: memberId } },
    create: {
      userId,
      connectionId: connection.id,
      platform: 'linkedin',
      externalProfileId: memberId,
      displayName: userInfo.name || 'LinkedIn member',
      username: userInfo.email || null,
      profileType: 'MEMBER',
      avatarUrl: userInfo.picture || null,
      status: 'ACTIVE',
      isDefault: true,
      capabilitiesJson: JSON.stringify({
        identity: true,
        publish: true,
        publishText: true,
        publishImage: true,
        publishVideo: true,
        scheduling: true,
        analytics: false
      }),
      metadataJson: JSON.stringify({
        email: userInfo.email || null,
        locale: userInfo.locale || null,
        authorUrn: `urn:li:person:${memberId}`
      })
    },
    update: {
      displayName: userInfo.name || 'LinkedIn member',
      username: userInfo.email || null,
      profileType: 'MEMBER',
      avatarUrl: userInfo.picture || null,
      status: 'ACTIVE',
      isDefault: true,
      capabilitiesJson: JSON.stringify({
        identity: true,
        publish: true,
        publishText: true,
        publishImage: true,
        publishVideo: true,
        scheduling: true,
        analytics: false
      }),
      metadataJson: JSON.stringify({
        email: userInfo.email || null,
        locale: userInfo.locale || null,
        authorUrn: `urn:li:person:${memberId}`
      })
    }
  });

  return prisma.socialConnection.findUnique({
    where: { id: connection.id },
    include: { profiles: true }
  });
}

module.exports = { authorization, completeOAuth, callbackUrl, LINKEDIN_SCOPES };
