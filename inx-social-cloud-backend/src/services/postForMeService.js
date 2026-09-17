const axios = require('axios');
const crypto = require('crypto');
const prisma = require('../db/prisma');

const PROVIDER_ENGINE = 'POST_FOR_ME';
const DEFAULT_BASE_URL = 'https://api.postforme.dev/v1';
const SUPPORTED_PLATFORMS = Object.freeze([
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'youtube',
  'pinterest',
  'threads',
  'bluesky',
  'x'
]);

const PLATFORM_LABELS = Object.freeze({
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  threads: 'Threads',
  bluesky: 'Bluesky',
  x: 'X'
});

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function apiKey() {
  return String(process.env.POST_FOR_ME_API_KEY || '').trim();
}

function webhookSecret() {
  return String(process.env.POST_FOR_ME_WEBHOOK_SECRET || '').trim();
}

function configured() {
  return Boolean(apiKey());
}

function requireConfigured() {
  if (!configured()) {
    const message = 'Post for Me is not configured on the INXSocial backend.';
    throw Object.assign(new Error(message), {
      status: 503,
      publicMessage: message,
      code: 'POST_FOR_ME_NOT_CONFIGURED'
    });
  }
}

function client() {
  requireConfigured();
  return axios.create({
    baseURL: String(process.env.POST_FOR_ME_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    timeout: Number(process.env.POST_FOR_ME_TIMEOUT_MS || 30000),
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  });
}

function publicPlatform(platform) {
  return platform === 'tiktok_business' ? 'tiktok' : String(platform || '').toLowerCase();
}

function providerPlatform(account) {
  return String(account?.platform || '').toLowerCase();
}

function assertSupportedPlatform(platform) {
  const value = publicPlatform(platform);
  if (!SUPPORTED_PLATFORMS.includes(value)) {
    throw Object.assign(new Error('This social platform is not supported by INXSocial.'), { status: 404 });
  }
  return value;
}

function safePlatformData(platform, input = {}) {
  if (platform === 'instagram') {
    return { instagram: { connection_type: input.connectionType === 'facebook' ? 'facebook' : 'instagram' } };
  }
  if (platform === 'linkedin') {
    const configuredType = String(process.env.POST_FOR_ME_LINKEDIN_CONNECTION_TYPE || 'organization').toLowerCase();
    return { linkedin: { connection_type: configuredType === 'personal' ? 'personal' : 'organization' } };
  }
  if (platform === 'x') {
    return { x: { connection_type: String(process.env.POST_FOR_ME_X_CONNECTION_TYPE || 'oauth2').toLowerCase() === 'oauth1' ? 'oauth1' : 'oauth2' } };
  }
  if (platform === 'bluesky') {
    const handle = String(input.handle || '').trim();
    const appPassword = String(input.appPassword || '').trim();
    if (!handle || !appPassword) {
      const message = 'Bluesky requires your handle and a Bluesky app password.';
      throw Object.assign(new Error(message), { status: 400, publicMessage: message, code: 'BLUESKY_CREDENTIALS_REQUIRED' });
    }
    return { bluesky: { handle, app_password: appPassword } };
  }
  return undefined;
}

async function createAuthUrl(userId, requestedPlatform, input = {}) {
  if (!userId) throw Object.assign(new Error('Sign in before connecting a social account.'), { status: 401 });
  const platform = assertSupportedPlatform(requestedPlatform);
  const body = {
    platform,
    external_id: String(userId),
    permissions: ['posts', 'feeds']
  };
  const platformData = safePlatformData(platform, input);
  if (platformData) body.platform_data = platformData;

  // Post for Me Quickstart projects reject redirect_url_override. White-label
  // deployments can opt into it later by setting this explicit environment value.
  const redirectOverride = String(process.env.POST_FOR_ME_REDIRECT_URL_OVERRIDE || '').trim();
  if (redirectOverride) body.redirect_url_override = redirectOverride;

  try {
    const response = await client().post('/social-accounts/auth-url', body);
    const url = response.data?.url;
    if (!url) throw new Error('Post for Me did not return an authorization URL.');
    return {
      authorizationUrl: url,
      platform,
      providerEngine: PROVIDER_ENGINE
    };
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'The social connection could not be started.';
    throw Object.assign(new Error(String(message)), {
      status: Number(error.response?.status || 502),
      publicMessage: String(message).slice(0, 300),
      code: 'POST_FOR_ME_CONNECTION_START_FAILED'
    });
  }
}

async function listProviderAccounts(userId) {
  requireConfigured();
  const rows = [];
  let offset = 0;
  const limit = 100;
  while (rows.length < 2000) {
    const query = `/social-accounts?external_id=${encodeURIComponent(String(userId))}&limit=${limit}&offset=${offset}`;
    const response = await client().get(query);
    const page = Array.isArray(response.data?.data) ? response.data.data : [];
    rows.push(...page);
    const total = Number(response.data?.meta?.total || rows.length);
    if (!page.length || rows.length >= total || page.length < limit) break;
    offset += page.length;
  }
  return rows;
}

function connectionMetadata(account) {
  return {
    providerEngine: PROVIDER_ENGINE,
    postForMeAccountId: String(account.id),
    providerPlatform: providerPlatform(account),
    providerUserId: account.user_id ? String(account.user_id) : null,
    externalId: account.external_id ? String(account.external_id) : null
  };
}

function profileType(platform, rawPlatform) {
  if (rawPlatform === 'tiktok_business') return 'BUSINESS';
  if (platform === 'facebook') return 'PAGE';
  if (platform === 'youtube') return 'CHANNEL';
  if (platform === 'linkedin') return 'PROFILE_OR_ORGANIZATION';
  if (platform === 'instagram') return 'PROFESSIONAL';
  return 'PROFILE';
}

async function upsertProviderAccount(userId, account) {
  if (!account?.id) throw new Error('Post for Me account is missing its identifier.');
  if (String(account.external_id || '') !== String(userId)) {
    throw Object.assign(new Error('Post for Me returned an account outside this INXSocial workspace.'), { status: 403 });
  }

  const rawPlatform = providerPlatform(account);
  const platform = assertSupportedPlatform(rawPlatform);
  const externalAccountId = String(account.id);
  const username = account.username ? String(account.username) : null;
  const displayName = username || `${PLATFORM_LABELS[platform]} account`;
  const active = String(account.status || '').toLowerCase() === 'connected';
  const metadata = connectionMetadata(account);

  const connection = await prisma.socialConnection.upsert({
    where: { userId_platform_externalAccountId: { userId, platform, externalAccountId } },
    create: {
      userId,
      platform,
      externalAccountId,
      accountType: rawPlatform === 'tiktok_business' ? 'BUSINESS' : 'SOCIAL_ACCOUNT',
      displayName,
      status: active ? 'ACTIVE' : 'REVOKED',
      tokenExpiresAt: account.access_token_expires_at ? new Date(account.access_token_expires_at) : null,
      scopesJson: JSON.stringify(['posts', 'feeds']),
      metadataJson: JSON.stringify(metadata),
      lastSyncedAt: new Date(),
      lastError: null
    },
    update: {
      accountType: rawPlatform === 'tiktok_business' ? 'BUSINESS' : 'SOCIAL_ACCOUNT',
      displayName,
      status: active ? 'ACTIVE' : 'REVOKED',
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenExpiresAt: account.access_token_expires_at ? new Date(account.access_token_expires_at) : null,
      scopesJson: JSON.stringify(['posts', 'feeds']),
      metadataJson: JSON.stringify(metadata),
      lastSyncedAt: new Date(),
      lastError: null
    }
  });

  await prisma.socialProfile.upsert({
    where: { connectionId_externalProfileId: { connectionId: connection.id, externalProfileId: externalAccountId } },
    create: {
      userId,
      connectionId: connection.id,
      platform,
      externalProfileId: externalAccountId,
      displayName,
      username,
      profileType: profileType(platform, rawPlatform),
      avatarUrl: account.profile_photo_url || null,
      status: active ? 'ACTIVE' : 'REVOKED',
      isDefault: false,
      capabilitiesJson: JSON.stringify({ identity: true, publish: true, analytics: true, feeds: true }),
      metadataJson: JSON.stringify({
        providerEngine: PROVIDER_ENGINE,
        postForMeAccountId: externalAccountId,
        providerPlatform: rawPlatform,
        providerUserId: account.user_id ? String(account.user_id) : null
      })
    },
    update: {
      displayName,
      username,
      profileType: profileType(platform, rawPlatform),
      avatarUrl: account.profile_photo_url || null,
      status: active ? 'ACTIVE' : 'REVOKED',
      capabilitiesJson: JSON.stringify({ identity: true, publish: true, analytics: true, feeds: true }),
      metadataJson: JSON.stringify({
        providerEngine: PROVIDER_ENGINE,
        postForMeAccountId: externalAccountId,
        providerPlatform: rawPlatform,
        providerUserId: account.user_id ? String(account.user_id) : null
      })
    }
  });

  return prisma.socialConnection.findUnique({ where: { id: connection.id }, include: { profiles: true } });
}

async function syncConnections(userId) {
  const accounts = await listProviderAccounts(userId);
  const seen = new Set();
  for (const account of accounts) {
    seen.add(String(account.id));
    await upsertProviderAccount(userId, account);
  }

  const existing = await prisma.socialConnection.findMany({
    where: { userId },
    select: { id: true, externalAccountId: true, metadataJson: true }
  });
  const staleIds = existing
    .filter((connection) => parseJson(connection.metadataJson, {}).providerEngine === PROVIDER_ENGINE)
    .filter((connection) => !seen.has(String(connection.externalAccountId)))
    .map((connection) => connection.id);

  if (staleIds.length) {
    await prisma.$transaction([
      prisma.socialProfile.updateMany({ where: { connectionId: { in: staleIds }, userId }, data: { status: 'REVOKED' } }),
      prisma.socialConnection.updateMany({ where: { id: { in: staleIds }, userId }, data: { status: 'REVOKED', lastSyncedAt: new Date() } })
    ]);
  }

  return accounts;
}

async function disconnect(userId, connectionId) {
  const connection = await prisma.socialConnection.findFirst({ where: { id: connectionId, userId }, include: { profiles: true } });
  if (!connection) throw Object.assign(new Error('Social connection not found.'), { status: 404 });
  const metadata = parseJson(connection.metadataJson, {});
  if (metadata.providerEngine !== PROVIDER_ENGINE) return null;

  const postForMeAccountId = String(metadata.postForMeAccountId || connection.externalAccountId || '');
  if (!postForMeAccountId) throw Object.assign(new Error('The Post for Me account mapping is missing.'), { status: 409 });

  try {
    await client().post(`/social-accounts/${encodeURIComponent(postForMeAccountId)}/disconnect`);
  } catch (error) {
    if (Number(error.response?.status || 0) !== 404) {
      const message = error.response?.data?.message || error.response?.data?.error || error.message || 'The social account could not be disconnected.';
      throw Object.assign(new Error(String(message)), { status: Number(error.response?.status || 502), publicMessage: String(message).slice(0, 300) });
    }
  }

  await prisma.$transaction([
    prisma.socialProfile.updateMany({ where: { connectionId: connection.id, userId }, data: { status: 'REVOKED' } }),
    prisma.socialConnection.update({ where: { id: connection.id }, data: { status: 'REVOKED', tokenExpiresAt: null, lastError: null, lastSyncedAt: new Date() } })
  ]);
  return { ok: true };
}

function verifyWebhookSecret(received) {
  const expected = webhookSecret();
  if (!expected) return false;
  const left = Buffer.from(String(received || ''), 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function handleWebhook(payload) {
  const eventType = String(payload?.event_type || '');
  const data = payload?.data || {};

  if (eventType === 'social.account.created' || eventType === 'social.account.updated') {
    const userId = String(data.external_id || '');
    if (!userId || !data.id) return;
    await upsertProviderAccount(userId, data);
  }
}

function providerState() {
  const isConfigured = configured();
  return Object.fromEntries(SUPPORTED_PLATFORMS.map((platform) => [platform, {
    configured: isConfigured,
    method: platform === 'bluesky' ? 'POST_FOR_ME_APP_PASSWORD' : 'POST_FOR_ME_OAUTH',
    providerEngine: PROVIDER_ENGINE
  }]));
}

module.exports = {
  PROVIDER_ENGINE,
  SUPPORTED_PLATFORMS,
  configured,
  createAuthUrl,
  listProviderAccounts,
  upsertProviderAccount,
  syncConnections,
  disconnect,
  verifyWebhookSecret,
  handleWebhook,
  providerState,
  publicPlatform
};
