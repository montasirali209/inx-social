const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const { encryptToken, decryptToken } = require('../utils/tokenCrypto');

const OAUTH_TTL = '10m';
const LINKEDIN_SCOPES = ['openid', 'profile', 'email'];
const YOUTUBE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/youtube.readonly'
];
const X_SCOPES = ['tweet.read', 'users.read', 'offline.access'];

function publicOrigin() {
  const configured = String(process.env.APP_URL || 'http://localhost:5050').trim();
  return configured.replace(/\/+$/, '');
}

function callbackUrl(platform) {
  return `${publicOrigin()}/api/social-connections/oauth/${platform}/callback`;
}

function stateSecret() {
  const value = String(process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || '').trim();
  if (!value) throw Object.assign(new Error('OAuth state signing is not configured.'), { status: 503 });
  return value;
}

function providerConfig(platform) {
  if (platform === 'linkedin') {
    return {
      platform,
      clientId: String(process.env.LINKEDIN_CLIENT_ID || '').trim(),
      clientSecret: String(process.env.LINKEDIN_CLIENT_SECRET || '').trim(),
      scopes: LINKEDIN_SCOPES,
      authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken'
    };
  }
  if (platform === 'youtube') {
    return {
      platform,
      clientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
      clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
      scopes: YOUTUBE_SCOPES,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token'
    };
  }
  if (platform === 'x') {
    return {
      platform,
      clientId: String(process.env.X_CLIENT_ID || '').trim(),
      clientSecret: String(process.env.X_CLIENT_SECRET || '').trim(),
      scopes: X_SCOPES,
      authorizationUrl: 'https://x.com/i/oauth2/authorize',
      tokenUrl: 'https://api.x.com/2/oauth2/token'
    };
  }
  throw Object.assign(new Error('This social connection provider is not supported.'), { status: 404 });
}

function requireProviderConfig(platform) {
  const config = providerConfig(platform);
  if (!config.clientId || !config.clientSecret) {
    const label = platform === 'linkedin' ? 'LinkedIn' : platform === 'youtube' ? 'Google/YouTube' : 'X';
    throw Object.assign(new Error(`${label} OAuth credentials are not configured on the server.`), { status: 503 });
  }
  return config;
}

function authorization(platform, userId) {
  const config = requireProviderConfig(platform);
  const nonce = crypto.randomBytes(18).toString('base64url');
  const state = jwt.sign({
    sub: userId,
    purpose: 'social-oauth',
    platform,
    nonce
  }, stateSecret(), { expiresIn: OAUTH_TTL, issuer: 'inx-social' });
  const url = new URL(config.authorizationUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', callbackUrl(platform));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state);
  if (platform === 'youtube') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent select_account');
  }
  if (platform === 'x') {
    const verifier = xCodeVerifier(nonce);
    url.searchParams.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url'));
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return { authorizationUrl: url.toString(), redirectUri: callbackUrl(platform), platform };
}

function xCodeVerifier(nonce) {
  return crypto.createHmac('sha256', stateSecret()).update(`x-pkce:${nonce}`).digest('base64url');
}

function verifyState(platform, state) {
  let payload;
  try {
    payload = jwt.verify(String(state || ''), stateSecret(), { issuer: 'inx-social' });
  } catch (_) {
    throw Object.assign(new Error('The social connection session expired. Start the connection again.'), { status: 401 });
  }
  if (payload.purpose !== 'social-oauth' || payload.platform !== platform || !payload.sub) {
    throw Object.assign(new Error('The social connection session is invalid.'), { status: 401 });
  }
  return payload;
}

async function exchangeCode(config, code, statePayload = null) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(config.platform)
  });
  const requestConfig = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 };
  if (config.platform === 'x') {
    body.set('code_verifier', xCodeVerifier(statePayload.nonce));
    requestConfig.auth = { username: config.clientId, password: config.clientSecret };
  } else {
    body.set('client_id', config.clientId);
    body.set('client_secret', config.clientSecret);
  }
  const response = await axios.post(config.tokenUrl, body.toString(), {
    ...requestConfig
  });
  if (!response.data?.access_token) throw new Error(`${config.platform} did not return an access token.`);
  return response.data;
}

function tokenExpiry(token) {
  const seconds = Number(token.expires_in || 0);
  return seconds > 0 ? new Date(Date.now() + seconds * 1000) : null;
}

async function upsertConnection({ userId, platform, externalAccountId, accountType, displayName, token, scopes, profile }) {
  const existing = await prisma.socialConnection.findUnique({
    where: { userId_platform_externalAccountId: { userId, platform, externalAccountId } }
  });
  const connection = await prisma.socialConnection.upsert({
    where: { userId_platform_externalAccountId: { userId, platform, externalAccountId } },
    create: {
      userId,
      platform,
      externalAccountId,
      accountType,
      displayName,
      status: 'ACTIVE',
      encryptedAccessToken: encryptToken(token.access_token),
      encryptedRefreshToken: encryptToken(token.refresh_token),
      tokenExpiresAt: tokenExpiry(token),
      scopesJson: JSON.stringify(scopes),
      metadataJson: JSON.stringify({ connectedBy: 'OAUTH', connectedAt: new Date().toISOString() }),
      lastSyncedAt: new Date(),
      lastError: null
    },
    update: {
      accountType,
      displayName,
      status: 'ACTIVE',
      encryptedAccessToken: encryptToken(token.access_token),
      encryptedRefreshToken: token.refresh_token ? encryptToken(token.refresh_token) : existing?.encryptedRefreshToken || undefined,
      tokenExpiresAt: tokenExpiry(token) || undefined,
      scopesJson: JSON.stringify(scopes),
      lastSyncedAt: new Date(),
      lastError: null
    }
  });
  await prisma.socialProfile.upsert({
    where: { connectionId_externalProfileId: { connectionId: connection.id, externalProfileId: profile.externalProfileId } },
    create: { userId, connectionId: connection.id, platform, ...profile, status: 'ACTIVE' },
    update: { ...profile, status: 'ACTIVE' }
  });
  return prisma.socialConnection.findUnique({ where: { id: connection.id }, include: { profiles: true } });
}

async function connectLinkedIn(userId, code) {
  const config = requireProviderConfig('linkedin');
  const token = await exchangeCode(config, code);
  const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
    timeout: 20000
  });
  const member = response.data || {};
  if (!member.sub) throw new Error('LinkedIn did not return a member identity.');
  return upsertConnection({
    userId,
    platform: 'linkedin',
    externalAccountId: String(member.sub),
    accountType: 'MEMBER',
    displayName: member.name || member.email || 'LinkedIn member',
    token,
    scopes: LINKEDIN_SCOPES,
    profile: {
      externalProfileId: String(member.sub),
      displayName: member.name || 'LinkedIn member',
      username: member.email || null,
      profileType: 'MEMBER',
      avatarUrl: member.picture || null,
      isDefault: true,
      capabilitiesJson: JSON.stringify({ identity: true, publish: false, analytics: false }),
      metadataJson: JSON.stringify({ email: member.email || null, locale: member.locale || null })
    }
  });
}

async function connectYouTube(userId, code) {
  const config = requireProviderConfig('youtube');
  const token = await exchangeCode(config, code);
  const headers = { Authorization: `Bearer ${token.access_token}` };
  const [identityResponse, channelsResponse] = await Promise.all([
    axios.get('https://openidconnect.googleapis.com/v1/userinfo', { headers, timeout: 20000 }),
    axios.get('https://www.googleapis.com/youtube/v3/channels', {
      headers,
      params: { part: 'id,snippet,statistics', mine: 'true', maxResults: 50 },
      timeout: 20000
    })
  ]);
  const identity = identityResponse.data || {};
  const channels = channelsResponse.data?.items || [];
  if (!identity.sub) throw new Error('Google did not return an account identity.');
  if (!channels.length) throw Object.assign(new Error('No YouTube channel was found for this Google account.'), { status: 400 });
  let result = null;
  for (const [index, channel] of channels.entries()) {
    result = await upsertConnection({
      userId,
      platform: 'youtube',
      externalAccountId: String(identity.sub),
      accountType: 'GOOGLE_ACCOUNT',
      displayName: identity.name || identity.email || 'Google account',
      token,
      scopes: YOUTUBE_SCOPES,
      profile: {
        externalProfileId: String(channel.id),
        displayName: channel.snippet?.title || 'YouTube channel',
        username: channel.snippet?.customUrl || null,
        profileType: 'CHANNEL',
        avatarUrl: channel.snippet?.thumbnails?.default?.url || channel.snippet?.thumbnails?.medium?.url || null,
        isDefault: index === 0,
        capabilitiesJson: JSON.stringify({ identity: true, publish: false, analytics: false, readonly: true }),
        metadataJson: JSON.stringify({
          description: channel.snippet?.description || null,
          subscribers: Number(channel.statistics?.subscriberCount || 0),
          videos: Number(channel.statistics?.videoCount || 0),
          views: Number(channel.statistics?.viewCount || 0)
        })
      }
    });
  }
  return result;
}

async function connectX(userId, code, statePayload) {
  const config = requireProviderConfig('x');
  const token = await exchangeCode(config, code, statePayload);
  const response = await axios.get('https://api.x.com/2/users/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
    params: { 'user.fields': 'id,name,username,profile_image_url,public_metrics,verified,description' },
    timeout: 20000
  });
  const member = response.data?.data || {};
  if (!member.id) throw new Error('X did not return an account identity.');
  return upsertConnection({
    userId,
    platform: 'x',
    externalAccountId: String(member.id),
    accountType: 'PROFILE',
    displayName: member.name || member.username || 'X account',
    token,
    scopes: X_SCOPES,
    profile: {
      externalProfileId: String(member.id),
      displayName: member.name || member.username || 'X account',
      username: member.username || null,
      profileType: 'PROFILE',
      avatarUrl: member.profile_image_url || null,
      isDefault: true,
      capabilitiesJson: JSON.stringify({ identity: true, publish: false, analytics: false, readonly: true }),
      metadataJson: JSON.stringify({
        verified: Boolean(member.verified),
        description: member.description || null,
        followers: Number(member.public_metrics?.followers_count || 0),
        following: Number(member.public_metrics?.following_count || 0),
        posts: Number(member.public_metrics?.tweet_count || 0)
      })
    }
  });
}

async function completeOAuth(platform, query) {
  const payload = verifyState(platform, query.state);
  if (query.error) throw Object.assign(new Error(String(query.error_description || query.error)), { status: 400 });
  if (!query.code) throw Object.assign(new Error('The provider did not return an authorization code.'), { status: 400 });
  if (platform === 'linkedin') return connectLinkedIn(payload.sub, String(query.code));
  if (platform === 'youtube') return connectYouTube(payload.sub, String(query.code));
  if (platform === 'x') return connectX(payload.sub, String(query.code), payload);
  throw Object.assign(new Error('This social connection provider is not supported.'), { status: 404 });
}

async function syncInstagram(userId) {
  const pages = await prisma.connectedPage.findMany({
    where: { userId, status: 'ACTIVE', encryptedAccessToken: { not: null } },
    select: { id: true, facebookPageId: true, facebookPageName: true, encryptedAccessToken: true }
  });
  if (!pages.length) throw Object.assign(new Error('Connect a Facebook Page first, then link its Instagram professional account.'), { status: 400 });
  const graphVersion = process.env.FB_GRAPH_VERSION || process.env.GRAPH_VERSION || 'v25.0';
  const linked = [];
  const errors = [];
  for (const page of pages) {
    try {
      const accessToken = decryptToken(page.encryptedAccessToken);
      const response = await axios.get(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(page.facebookPageId)}`, {
        params: { fields: 'instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}', access_token: accessToken },
        timeout: 20000
      });
      const account = response.data?.instagram_business_account;
      if (!account?.id) continue;
      const connection = await upsertConnection({
        userId,
        platform: 'instagram',
        externalAccountId: String(account.id),
        accountType: 'PROFESSIONAL',
        displayName: account.username ? `@${account.username}` : account.name || 'Instagram account',
        token: { access_token: accessToken },
        scopes: ['instagram_basic', 'instagram_manage_insights'],
        profile: {
          externalProfileId: String(account.id),
          displayName: account.name || account.username || 'Instagram account',
          username: account.username || null,
          profileType: 'PROFESSIONAL',
          avatarUrl: account.profile_picture_url || null,
          isDefault: linked.length === 0,
          capabilitiesJson: JSON.stringify({ identity: true, publish: false, analytics: true }),
          metadataJson: JSON.stringify({ facebookPageId: page.facebookPageId, facebookPageName: page.facebookPageName, followers: Number(account.followers_count || 0), media: Number(account.media_count || 0) })
        }
      });
      linked.push(connection);
    } catch (error) {
      errors.push(`${page.facebookPageName}: ${error.response?.data?.error?.message || error.message}`);
    }
  }
  if (!linked.length) {
    const message = errors[0] || 'No linked Instagram professional account was found. Link Instagram to the Facebook Page in Meta Business Suite and reconnect Facebook permissions.';
    throw Object.assign(new Error(message), { status: 400 });
  }
  return { connections: linked, errors };
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function publicConnection(connection) {
  return {
    id: connection.id,
    platform: connection.platform,
    accountType: connection.accountType,
    displayName: connection.displayName,
    status: connection.status,
    scopes: parseJson(connection.scopesJson, []),
    connectedAt: connection.connectedAt,
    lastSyncedAt: connection.lastSyncedAt,
    lastError: connection.lastError,
    profiles: (connection.profiles || []).map(profile => ({
      id: profile.id,
      platform: profile.platform,
      externalProfileId: profile.externalProfileId,
      displayName: profile.displayName,
      username: profile.username,
      profileType: profile.profileType,
      avatarUrl: profile.avatarUrl,
      status: profile.status,
      isDefault: profile.isDefault,
      capabilities: parseJson(profile.capabilitiesJson, {}),
      metadata: parseJson(profile.metadataJson, {})
    }))
  };
}

async function listConnections(userId) {
  const rows = await prisma.socialConnection.findMany({
    where: { userId, status: 'ACTIVE' },
    orderBy: [{ platform: 'asc' }, { connectedAt: 'desc' }],
    include: {
      profiles: {
        where: { status: 'ACTIVE' },
        orderBy: [{ isDefault: 'desc' }, { displayName: 'asc' }]
      }
    }
  });
  return rows.map(publicConnection);
}

async function disconnect(userId, connectionId) {
  const connection = await prisma.socialConnection.findFirst({ where: { id: connectionId, userId } });
  if (!connection) throw Object.assign(new Error('Social connection not found.'), { status: 404 });
  await prisma.$transaction([
    prisma.socialProfile.updateMany({ where: { connectionId: connection.id, userId }, data: { status: 'REVOKED' } }),
    prisma.socialConnection.update({
      where: { id: connection.id },
      data: { status: 'REVOKED', encryptedAccessToken: null, encryptedRefreshToken: null, tokenExpiresAt: null, lastError: null }
    })
  ]);
  return { ok: true };
}

module.exports = {
  authorization,
  completeOAuth,
  syncInstagram,
  listConnections,
  disconnect,
  publicConnection,
  callbackUrl,
  LINKEDIN_SCOPES,
  YOUTUBE_SCOPES,
  X_SCOPES
};
