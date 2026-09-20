const axios = require('axios');
const crypto = require('crypto');
const prisma = require('../db/prisma');
const { getLicenseStatus } = require('./licenseService');

const PROVIDER_ENGINE = 'POST_FOR_ME';
const DEFAULT_BASE_URL = 'https://api.postforme.dev/v1';
const DEFAULT_WEBHOOK_URL = 'https://www.inxsocial.co.uk/api/social-connections/post-for-me/webhook';
const WEBHOOK_EVENTS = Object.freeze([
  'social.post.created',
  'social.post.updated',
  'social.post.deleted',
  'social.post.result.created',
  'social.account.created',
  'social.account.updated'
]);
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

let runtimeWebhookSecret = '';
let runtimeWebhookId = '';
let runtimeTimer = null;

const PROVIDER_GET_MAX_PER_SECOND = Math.max(1, Math.min(5, Number(process.env.POST_FOR_ME_GET_MAX_PER_SECOND || 4)));
const PROVIDER_GET_MAX_PER_MINUTE = Math.max(PROVIDER_GET_MAX_PER_SECOND, Math.min(40, Number(process.env.POST_FOR_ME_GET_MAX_PER_MINUTE || 32)));
const CONNECTION_SYNC_TTL_MS = Math.max(60_000, Number(process.env.POST_FOR_ME_CONNECTION_SYNC_TTL_MS || 5 * 60 * 1000));
const providerReadTimestamps = [];
const connectionSyncState = new Map();
let providerReadQueue = Promise.resolve();
let providerCooldownUntil = 0;

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

function configured() {
  return Boolean(apiKey());
}

function requireConfigured() {
  if (!configured()) {
    const message = 'The social publishing gateway is not configured on the INX Social backend.';
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

function retryAfterMs(headers) {
  const raw = headers?.['retry-after'];
  if (raw == null || raw === '') return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const timestamp = Date.parse(String(raw));
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneProviderReadTimestamps(now) {
  while (providerReadTimestamps.length && providerReadTimestamps[0] <= now - 60_000) {
    providerReadTimestamps.shift();
  }
}

function providerReadDelay(now) {
  pruneProviderReadTimestamps(now);
  let waitMs = Math.max(0, providerCooldownUntil - now);
  const recentSecond = providerReadTimestamps.filter((timestamp) => timestamp > now - 1000);
  if (recentSecond.length >= PROVIDER_GET_MAX_PER_SECOND) {
    waitMs = Math.max(waitMs, recentSecond[recentSecond.length - PROVIDER_GET_MAX_PER_SECOND] + 1000 - now);
  }
  if (providerReadTimestamps.length >= PROVIDER_GET_MAX_PER_MINUTE) {
    waitMs = Math.max(waitMs, providerReadTimestamps[providerReadTimestamps.length - PROVIDER_GET_MAX_PER_MINUTE] + 60_000 - now);
  }
  return waitMs;
}

function reserveProviderReadSlot() {
  const task = providerReadQueue.then(async () => {
    while (true) {
      const now = Date.now();
      const waitMs = providerReadDelay(now);
      if (waitMs > 0) {
        await sleep(Math.min(60_000, waitMs + 25));
        continue;
      }
      providerReadTimestamps.push(Date.now());
      return;
    }
  });
  providerReadQueue = task.catch(() => {});
  return task;
}

async function apiRequest(method, path, options = {}) {
  const upperMethod = String(method || 'GET').toUpperCase();
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : (upperMethod === 'GET' ? 2 : 0);
  let attempt = 0;

  while (true) {
    try {
      if (upperMethod === 'GET') await reserveProviderReadSlot();
      const response = await client().request({
        method: upperMethod,
        url: path,
        data: options.data,
        params: options.params,
        headers: options.headers,
        timeout: options.timeout || Number(process.env.POST_FOR_ME_TIMEOUT_MS || 30000)
      });
      return response.data;
    } catch (error) {
      const raw = error.response?.data;
      const status = Number(error.response?.status || 502);
      const retryDelay = retryAfterMs(error.response?.headers);
      if (status === 429) {
        const fallbackDelay = 1200 * (attempt + 1);
        const cooldown = Math.min(60_000, Math.max(1000, retryDelay || fallbackDelay));
        providerCooldownUntil = Math.max(providerCooldownUntil, Date.now() + cooldown);
        if (attempt < maxRetries) {
          await sleep(cooldown);
          attempt += 1;
          continue;
        }
      }

      const rawError = raw?.error;
      const message = Array.isArray(rawError)
        ? rawError.join(' · ')
        : typeof rawError === 'string'
          ? rawError
          : raw?.message || (rawError && typeof rawError === 'object' ? rawError.message : null) || error.message || 'Social publishing request failed.';
      throw Object.assign(new Error(String(message)), {
        status,
        publicMessage: String(message).slice(0, 500),
        provider: PROVIDER_ENGINE,
        providerResponse: raw,
        retryAfterMs: retryDelay
      });
    }
  }
}

function publicPlatform(platform) {
  return String(platform || '').toLowerCase() === 'tiktok_business' ? 'tiktok' : String(platform || '').toLowerCase();
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

  // Quickstart projects reject redirect_url_override. White-label projects can opt
  // into it explicitly once the provider credentials are owned by INXSocial.
  const redirectOverride = String(process.env.POST_FOR_ME_REDIRECT_URL_OVERRIDE || '').trim();
  if (redirectOverride) body.redirect_url_override = redirectOverride;

  const data = await apiRequest('POST', '/social-accounts/auth-url', { data: body });
  if (!data?.url) throw Object.assign(new Error('The social publishing gateway did not return an authorization URL.'), { status: 502 });
  return { authorizationUrl: data.url, platform, providerEngine: PROVIDER_ENGINE };
}

async function listProviderAccounts(userId) {
  requireConfigured();
  const rows = [];
  let offset = 0;
  const limit = 100;
  while (rows.length < 2000) {
    const query = `/social-accounts?external_id=${encodeURIComponent(String(userId))}&limit=${limit}&offset=${offset}`;
    const response = await apiRequest('GET', query);
    const page = Array.isArray(response?.data) ? response.data : [];
    rows.push(...page);
    const total = Number(response?.meta?.total || rows.length);
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
  if (!account?.id) throw new Error('The social publishing account is missing its identifier.');
  if (String(account.external_id || '') !== String(userId)) {
    throw Object.assign(new Error('The social publishing gateway returned an account outside this INX Social workspace.'), { status: 403 });
  }

  const rawPlatform = providerPlatform(account);
  const platform = assertSupportedPlatform(rawPlatform);
  const externalAccountId = String(account.id);
  const username = account.username ? String(account.username) : null;
  const displayName = username || `${PLATFORM_LABELS[platform]} account`;
  const active = String(account.status || '').toLowerCase() === 'connected';
  const metadata = connectionMetadata(account);

  const existingConnection = await prisma.socialConnection.findUnique({
    where: { userId_platform_externalAccountId: { userId, platform, externalAccountId } }
  });
  if (!existingConnection) {
    const license = await getLicenseStatus(userId);
    const limit = license.limits?.pages;
    if (Number.isFinite(limit)) {
      const activeConnections = await prisma.socialConnection.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { metadataJson: true }
      });
      const providerCount = activeConnections.filter(row => parseJson(row.metadataJson, {}).providerEngine === PROVIDER_ENGINE).length;
      if (providerCount >= Number(limit)) {
        try { await apiRequest('POST', `/social-accounts/${encodeURIComponent(externalAccountId)}/disconnect`); } catch (_) { /* local limit still applies */ }
        const message = `Your current INXSocial plan supports up to ${limit} connected social accounts. Upgrade in Billing & Plans to connect another account.`;
        throw Object.assign(new Error(message), {
          status: 402,
          publicMessage: message,
          code: 'CONNECTED_ACCOUNT_LIMIT_REACHED'
        });
      }
    }
  }

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

async function performConnectionSync(userId) {
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

async function syncConnections(userId, options = {}) {
  const key = String(userId);
  const force = Boolean(options.force);
  const current = connectionSyncState.get(key);
  if (!force && current?.updatedAt && Date.now() - current.updatedAt < CONNECTION_SYNC_TTL_MS) {
    return current.accounts || [];
  }
  if (current?.promise) return current.promise;

  const promise = performConnectionSync(userId);
  connectionSyncState.set(key, { ...(current || {}), promise });
  try {
    const accounts = await promise;
    connectionSyncState.set(key, { accounts, updatedAt: Date.now(), promise: null });
    return accounts;
  } catch (error) {
    if (current?.updatedAt) {
      connectionSyncState.set(key, { ...current, promise: null });
    } else {
      connectionSyncState.delete(key);
    }
    throw error;
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
    profiles: (connection.profiles || []).map((profile) => ({
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
  return rows
    .filter((row) => parseJson(row.metadataJson, {}).providerEngine === PROVIDER_ENGINE)
    .map(publicConnection);
}

async function disconnect(userId, connectionId) {
  const connection = await prisma.socialConnection.findFirst({ where: { id: connectionId, userId }, include: { profiles: true } });
  if (!connection) throw Object.assign(new Error('Social connection not found.'), { status: 404 });
  const metadata = parseJson(connection.metadataJson, {});
  if (metadata.providerEngine !== PROVIDER_ENGINE) {
    throw Object.assign(new Error('This is a legacy connection. Reconnect it through the new INXSocial connection flow.'), { status: 409 });
  }

  const postForMeAccountId = String(metadata.postForMeAccountId || connection.externalAccountId || '');
  if (!postForMeAccountId) throw Object.assign(new Error('The social publishing account mapping is missing.'), { status: 409 });

  try {
    await apiRequest('POST', `/social-accounts/${encodeURIComponent(postForMeAccountId)}/disconnect`);
  } catch (error) {
    if (Number(error.status || 0) !== 404) throw error;
  }

  await prisma.$transaction([
    prisma.socialProfile.updateMany({ where: { connectionId: connection.id, userId }, data: { status: 'REVOKED' } }),
    prisma.socialConnection.update({ where: { id: connection.id }, data: { status: 'REVOKED', tokenExpiresAt: null, lastError: null, lastSyncedAt: new Date() } })
  ]);
  return { ok: true };
}

function configuredWebhookSecret() {
  return String(process.env.POST_FOR_ME_WEBHOOK_SECRET || runtimeWebhookSecret || '').trim();
}

function secureEquals(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ''), 'utf8');
  const right = Buffer.from(String(rightValue || ''), 'utf8');
  return Boolean(left.length && left.length === right.length && crypto.timingSafeEqual(left, right));
}

async function ensureWebhook() {
  requireConfigured();
  const url = String(process.env.POST_FOR_ME_WEBHOOK_URL || DEFAULT_WEBHOOK_URL).trim();
  const encodedUrl = encodeURIComponent(url);
  const response = await apiRequest('GET', `/webhooks?url=${encodedUrl}&limit=50&offset=0`);
  const webhooks = Array.isArray(response?.data) ? response.data : [];
  let webhook = webhooks.find((item) => String(item.url || '') === url) || null;

  if (!webhook) {
    webhook = await apiRequest('POST', '/webhooks', { data: { url, event_types: [...WEBHOOK_EVENTS] } });
  } else {
    const currentEvents = new Set(Array.isArray(webhook.event_types) ? webhook.event_types : []);
    const missingEvent = WEBHOOK_EVENTS.some((event) => !currentEvents.has(event));
    if (missingEvent) {
      webhook = await apiRequest('PATCH', `/webhooks/${encodeURIComponent(webhook.id)}`, {
        data: { url, event_types: [...WEBHOOK_EVENTS] }
      });
    }
  }

  if (!webhook?.secret) throw new Error('Social publishing webhook registration did not return a verification secret.');
  runtimeWebhookId = String(webhook.id || '');
  runtimeWebhookSecret = String(webhook.secret);
  return { id: runtimeWebhookId, url, eventTypes: [...WEBHOOK_EVENTS] };
}

async function verifyWebhookSecret(received) {
  let expected = configuredWebhookSecret();
  if (!expected && configured()) {
    await ensureWebhook();
    expected = configuredWebhookSecret();
  }
  return secureEquals(received, expected);
}

async function handleAccountWebhook(payload) {
  const eventType = String(payload?.event_type || '');
  const data = payload?.data || {};
  if (eventType !== 'social.account.created' && eventType !== 'social.account.updated') return false;
  const userId = String(data.external_id || '');
  if (!userId || !data.id) return true;
  await upsertProviderAccount(userId, data);
  return true;
}

function startRuntime() {
  if (!configured()) return;
  const refresh = () => ensureWebhook().catch((error) => {
    console.error('[post-for-me] webhook registration failed:', error?.message || error);
  });
  setTimeout(refresh, 1500).unref?.();
  if (!runtimeTimer) {
    runtimeTimer = setInterval(refresh, 6 * 60 * 60 * 1000);
    runtimeTimer.unref?.();
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
  WEBHOOK_EVENTS,
  SUPPORTED_PLATFORMS,
  configured,
  apiRequest,
  createAuthUrl,
  listProviderAccounts,
  upsertProviderAccount,
  syncConnections,
  listConnections,
  disconnect,
  ensureWebhook,
  verifyWebhookSecret,
  handleAccountWebhook,
  startRuntime,
  providerState,
  publicPlatform,
  parseJson
};
