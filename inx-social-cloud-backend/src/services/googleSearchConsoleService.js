const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const { encryptToken, decryptToken } = require('../utils/tokenCrypto');

const CONNECTION_ID = 'primary';
const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEARCH_CONSOLE_BASE_URL = 'https://www.googleapis.com/webmasters/v3';

function publicError(message, status = 400, code = null) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  if (code) error.code = code;
  return error;
}

function settings() {
  const clientId = String(process.env.GSC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GSC_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim();
  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret)
  };
}

function requireSettings() {
  const current = settings();
  if (!current.configured) {
    throw publicError('Google OAuth credentials are not configured on the server.', 503, 'GSC_OAUTH_NOT_CONFIGURED');
  }
  return current;
}

function stateSecret() {
  const value = String(process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || '').trim();
  if (!value) throw publicError('OAuth state signing is not configured.', 503, 'GSC_STATE_NOT_CONFIGURED');
  return value;
}

function callbackUrl() {
  const explicit = String(process.env.GSC_OAUTH_REDIRECT_URL || '').trim();
  if (explicit) return explicit;
  const origin = process.env.NODE_ENV === 'production'
    ? 'https://www.inxsocial.co.uk'
    : String(process.env.APP_URL || 'http://localhost:5050').trim().replace(/\/+$/, '');
  return `${origin}/api/admin/search-console/oauth/callback`;
}

function authorization(adminUserId) {
  if (!adminUserId) throw publicError('Administrator session is required.', 401);
  const { clientId } = requireSettings();
  const state = jwt.sign({
    sub: String(adminUserId),
    purpose: 'google-search-console-admin-oauth',
    nonce: crypto.randomBytes(18).toString('base64url')
  }, stateSecret(), { expiresIn: '10m', issuer: 'inx-social' });

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SEARCH_CONSOLE_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  return {
    authorizationUrl: url.toString(),
    redirectUri: callbackUrl(),
    scope: SEARCH_CONSOLE_SCOPE
  };
}

function verifyState(value) {
  try {
    const payload = jwt.verify(String(value || ''), stateSecret(), { issuer: 'inx-social' });
    if (payload.purpose !== 'google-search-console-admin-oauth' || !payload.sub) throw new Error('invalid state');
    return payload;
  } catch (_) {
    throw publicError('The Google Search Console connection session expired. Start the connection again.', 401, 'GSC_INVALID_STATE');
  }
}

function splitScopes(value) {
  return String(value || '')
    .split(/[\s,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function tokenExpiry(expiresIn) {
  const seconds = Number(expiresIn || 0);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(Date.now() + seconds * 1000)
    : null;
}

async function tokenExchange(code) {
  const { clientId, clientSecret } = requireSettings();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: String(code),
    grant_type: 'authorization_code',
    redirect_uri: callbackUrl()
  });

  try {
    const response = await axios.post(GOOGLE_TOKEN_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    });
    return response.data || {};
  } catch (error) {
    const detail = error.response?.data?.error_description || error.response?.data?.error || error.message;
    throw publicError(`Google authorization could not be completed: ${detail}`, 400, 'GSC_TOKEN_EXCHANGE_FAILED');
  }
}

async function refreshAccessToken(connection) {
  const refreshToken = decryptToken(connection?.encryptedRefreshToken);
  if (!refreshToken) {
    throw publicError('Google Search Console needs to be reconnected because no refresh token is stored.', 401, 'GSC_RECONNECT_REQUIRED');
  }

  const { clientId, clientSecret } = requireSettings();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  try {
    const response = await axios.post(GOOGLE_TOKEN_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    });
    const token = response.data || {};
    if (!token.access_token) throw new Error('Google did not return an access token.');

    await prisma.searchConsoleConnection.update({
      where: { id: CONNECTION_ID },
      data: {
        encryptedAccessToken: encryptToken(token.access_token),
        tokenExpiresAt: tokenExpiry(token.expires_in),
        status: 'ACTIVE',
        lastError: null
      }
    });

    return token.access_token;
  } catch (error) {
    const detail = error.response?.data?.error_description || error.response?.data?.error || error.message;
    await prisma.searchConsoleConnection.update({
      where: { id: CONNECTION_ID },
      data: { status: 'ERROR', lastError: String(detail || 'Token refresh failed').slice(0, 1000) }
    }).catch(() => {});
    throw publicError(`Google Search Console authorization needs attention: ${detail}`, 401, 'GSC_TOKEN_REFRESH_FAILED');
  }
}

async function accessToken(connection = null, forceRefresh = false) {
  const current = connection || await prisma.searchConsoleConnection.findUnique({ where: { id: CONNECTION_ID } });
  if (!current) throw publicError('Google Search Console is not connected.', 409, 'GSC_NOT_CONNECTED');

  const stored = decryptToken(current.encryptedAccessToken);
  const expiry = current.tokenExpiresAt ? new Date(current.tokenExpiresAt).getTime() : 0;
  const freshEnough = stored && expiry > Date.now() + 60 * 1000;

  if (!forceRefresh && freshEnough) return stored;
  if (!forceRefresh && stored && !current.encryptedRefreshToken) return stored;
  return refreshAccessToken(current);
}

async function googleRequest({ method = 'GET', url, data = null, connection = null }) {
  const current = connection || await prisma.searchConsoleConnection.findUnique({ where: { id: CONNECTION_ID } });
  if (!current) throw publicError('Google Search Console is not connected.', 409, 'GSC_NOT_CONNECTED');

  const request = async forceRefresh => axios({
    method,
    url,
    data,
    headers: { Authorization: `Bearer ${await accessToken(current, forceRefresh)}` },
    timeout: 25000
  });

  try {
    return (await request(false)).data;
  } catch (error) {
    if (error.response?.status === 401 && current.encryptedRefreshToken) {
      try {
        return (await request(true)).data;
      } catch (retryError) {
        error = retryError;
      }
    }

    const detail = error.response?.data?.error?.message || error.response?.data?.error_description || error.message;
    const status = error.response?.status === 403 ? 403 : 502;
    throw publicError(
      status === 403
        ? `Google Search Console denied the request: ${detail}. Confirm the Search Console API is enabled and this Google account can access the property.`
        : `Google Search Console request failed: ${detail}`,
      status,
      status === 403 ? 'GSC_API_FORBIDDEN' : 'GSC_API_FAILED'
    );
  }
}

function normalizeSites(payload) {
  return (payload?.siteEntry || [])
    .map(item => ({
      siteUrl: String(item.siteUrl || ''),
      permissionLevel: String(item.permissionLevel || 'unknown')
    }))
    .filter(item => item.siteUrl);
}

function preferredSite(sites) {
  const exactDomain = sites.find(item => item.siteUrl.toLowerCase() === 'sc-domain:inxsocial.co.uk');
  if (exactDomain) return exactDomain.siteUrl;
  const exactWww = sites.find(item => item.siteUrl.toLowerCase() === 'https://www.inxsocial.co.uk/');
  if (exactWww) return exactWww.siteUrl;
  const brandSite = sites.find(item => item.siteUrl.toLowerCase().includes('inxsocial.co.uk'));
  return brandSite?.siteUrl || sites[0]?.siteUrl || null;
}

async function listSites(connection = null) {
  const payload = await googleRequest({
    url: `${SEARCH_CONSOLE_BASE_URL}/sites`,
    connection
  });
  return normalizeSites(payload);
}

async function completeOAuth(query) {
  const state = verifyState(query.state);
  if (query.error) {
    throw publicError(String(query.error_description || query.error), 400, 'GSC_OAUTH_DENIED');
  }
  if (!query.code) throw publicError('Google did not return an authorization code.', 400, 'GSC_AUTH_CODE_MISSING');

  const token = await tokenExchange(query.code);
  if (!token.access_token) throw publicError('Google did not return an access token.', 400, 'GSC_ACCESS_TOKEN_MISSING');

  const existing = await prisma.searchConsoleConnection.findUnique({ where: { id: CONNECTION_ID } });
  const grantedScopes = splitScopes(token.scope);
  const refreshToken = token.refresh_token
    ? encryptToken(token.refresh_token)
    : existing?.encryptedRefreshToken || null;

  let connection = await prisma.searchConsoleConnection.upsert({
    where: { id: CONNECTION_ID },
    create: {
      id: CONNECTION_ID,
      provider: 'google',
      connectedByUserId: String(state.sub),
      encryptedAccessToken: encryptToken(token.access_token),
      encryptedRefreshToken: refreshToken,
      tokenExpiresAt: tokenExpiry(token.expires_in),
      scopesJson: JSON.stringify(grantedScopes.length ? grantedScopes : [SEARCH_CONSOLE_SCOPE]),
      status: 'ACTIVE',
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
      lastError: null
    },
    update: {
      connectedByUserId: String(state.sub),
      encryptedAccessToken: encryptToken(token.access_token),
      encryptedRefreshToken: refreshToken,
      tokenExpiresAt: tokenExpiry(token.expires_in),
      scopesJson: JSON.stringify(grantedScopes.length ? grantedScopes : [SEARCH_CONSOLE_SCOPE]),
      status: 'ACTIVE',
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
      lastError: null
    }
  });

  const sites = await listSites(connection);
  const selectedSiteUrl = (
    connection.selectedSiteUrl && sites.some(item => item.siteUrl === connection.selectedSiteUrl)
      ? connection.selectedSiteUrl
      : preferredSite(sites)
  );

  connection = await prisma.searchConsoleConnection.update({
    where: { id: CONNECTION_ID },
    data: {
      selectedSiteUrl,
      availableSitesJson: JSON.stringify(sites),
      lastSyncedAt: new Date(),
      lastError: sites.length ? null : 'The connected Google account has no Search Console properties.'
    }
  });

  return { connection, sites, adminUserId: String(state.sub) };
}

async function status() {
  const configured = settings().configured;
  const connection = await prisma.searchConsoleConnection.findUnique({ where: { id: CONNECTION_ID } });
  if (!connection) {
    return {
      configured,
      connected: false,
      status: configured ? 'NOT_CONNECTED' : 'NOT_CONFIGURED',
      callbackUrl: callbackUrl(),
      scope: SEARCH_CONSOLE_SCOPE,
      selectedSiteUrl: null,
      sites: []
    };
  }

  let sites = [];
  let lastError = connection.lastError;
  let selectedSiteUrl = connection.selectedSiteUrl;
  try {
    sites = await listSites(connection);
    lastError = null;
    if (!selectedSiteUrl || !sites.some(item => item.siteUrl === selectedSiteUrl)) {
      selectedSiteUrl = preferredSite(sites);
    }
    await prisma.searchConsoleConnection.update({
      where: { id: CONNECTION_ID },
      data: {
        selectedSiteUrl,
        availableSitesJson: JSON.stringify(sites),
        lastSyncedAt: new Date(),
        status: 'ACTIVE',
        lastError: null
      }
    });
  } catch (error) {
    lastError = error.publicMessage || error.message;
    try { sites = JSON.parse(connection.availableSitesJson || '[]'); } catch (_) { sites = []; }
  }

  return {
    configured,
    connected: Boolean(connection.encryptedAccessToken || connection.encryptedRefreshToken),
    status: lastError ? 'ERROR' : connection.status,
    callbackUrl: callbackUrl(),
    scope: SEARCH_CONSOLE_SCOPE,
    selectedSiteUrl,
    sites,
    connectedAt: connection.connectedAt,
    lastSyncedAt: connection.lastSyncedAt,
    lastError
  };
}

async function selectSite(siteUrl) {
  const requested = String(siteUrl || '').trim();
  if (!requested) throw publicError('Choose a Search Console property.', 400);
  const sites = await listSites();
  if (!sites.some(item => item.siteUrl === requested)) {
    throw publicError('The connected Google account does not have access to that Search Console property.', 403);
  }
  return prisma.searchConsoleConnection.update({
    where: { id: CONNECTION_ID },
    data: {
      selectedSiteUrl: requested,
      availableSitesJson: JSON.stringify(sites),
      lastSyncedAt: new Date(),
      status: 'ACTIVE',
      lastError: null
    }
  });
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateRange(days, offsetDays = 1) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - offsetDays);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));
  return { startDate: isoDate(start), endDate: isoDate(end), start, end };
}

async function querySearchAnalytics(siteUrl, startDate, endDate, dimensions = [], rowLimit = 100) {
  const encoded = encodeURIComponent(siteUrl);
  const body = {
    startDate,
    endDate,
    type: 'web',
    rowLimit: Math.max(1, Math.min(25000, Number(rowLimit || 100)))
  };
  if (dimensions.length) body.dimensions = dimensions;

  const payload = await googleRequest({
    method: 'POST',
    url: `${SEARCH_CONSOLE_BASE_URL}/sites/${encoded}/searchAnalytics/query`,
    data: body
  });
  return payload?.rows || [];
}

function metricRow(row = {}) {
  return {
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number(row.position || 0)
  };
}

function percentChange(current, previous) {
  const now = Number(current || 0);
  const before = Number(previous || 0);
  if (!before) return now ? 100 : 0;
  return ((now - before) / Math.abs(before)) * 100;
}

function mapDimensionRows(rows, dimension) {
  return rows.map(row => ({
    [dimension]: String(row.keys?.[0] || ''),
    ...metricRow(row)
  }));
}

async function performance(days = 28) {
  const periodDays = [7, 28, 90].includes(Number(days)) ? Number(days) : 28;
  const connection = await prisma.searchConsoleConnection.findUnique({ where: { id: CONNECTION_ID } });
  if (!connection?.selectedSiteUrl) {
    throw publicError('Connect Search Console and choose a property before loading performance.', 409, 'GSC_PROPERTY_REQUIRED');
  }

  const current = dateRange(periodDays, 1);
  const previousEnd = new Date(current.start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousEnd.getUTCDate() - (periodDays - 1));
  const previous = { startDate: isoDate(previousStart), endDate: isoDate(previousEnd) };

  const [summaryRows, previousRows, dailyRows, queryRows, pageRows, countryRows, deviceRows] = await Promise.all([
    querySearchAnalytics(connection.selectedSiteUrl, current.startDate, current.endDate, [], 1),
    querySearchAnalytics(connection.selectedSiteUrl, previous.startDate, previous.endDate, [], 1),
    querySearchAnalytics(connection.selectedSiteUrl, current.startDate, current.endDate, ['date'], Math.min(500, periodDays + 5)),
    querySearchAnalytics(connection.selectedSiteUrl, current.startDate, current.endDate, ['query'], 100),
    querySearchAnalytics(connection.selectedSiteUrl, current.startDate, current.endDate, ['page'], 100),
    querySearchAnalytics(connection.selectedSiteUrl, current.startDate, current.endDate, ['country'], 30),
    querySearchAnalytics(connection.selectedSiteUrl, current.startDate, current.endDate, ['device'], 10)
  ]);

  const summary = metricRow(summaryRows[0]);
  const previousSummary = metricRow(previousRows[0]);
  const topQueries = mapDimensionRows(queryRows, 'query');
  const topPages = mapDimensionRows(pageRows, 'page');

  const opportunities = topQueries
    .filter(row => row.impressions >= 10 && row.position >= 4 && row.position <= 30 && row.ctr < 0.08)
    .map(row => ({
      ...row,
      score: Math.round(row.impressions * Math.max(0.1, 1 - row.ctr) * Math.max(0.1, (31 - row.position) / 27))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  await prisma.searchConsoleConnection.update({
    where: { id: CONNECTION_ID },
    data: { lastSyncedAt: new Date(), status: 'ACTIVE', lastError: null }
  });

  return {
    siteUrl: connection.selectedSiteUrl,
    periodDays,
    range: { startDate: current.startDate, endDate: current.endDate },
    previousRange: previous,
    summary,
    previousSummary,
    comparison: {
      clicksPercent: percentChange(summary.clicks, previousSummary.clicks),
      impressionsPercent: percentChange(summary.impressions, previousSummary.impressions),
      ctrPoints: (summary.ctr - previousSummary.ctr) * 100,
      positionChange: previousSummary.position - summary.position
    },
    daily: mapDimensionRows(dailyRows, 'date'),
    topQueries,
    topPages,
    countries: mapDimensionRows(countryRows, 'country'),
    devices: mapDimensionRows(deviceRows, 'device'),
    opportunities
  };
}

async function disconnect() {
  const connection = await prisma.searchConsoleConnection.findUnique({ where: { id: CONNECTION_ID } });
  if (!connection) return { ok: true };

  const token = decryptToken(connection.encryptedRefreshToken) || decryptToken(connection.encryptedAccessToken);
  if (token) {
    axios.post('https://oauth2.googleapis.com/revoke', new URLSearchParams({ token }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    }).catch(() => {});
  }

  await prisma.searchConsoleConnection.delete({ where: { id: CONNECTION_ID } });
  return { ok: true };
}

module.exports = {
  CONNECTION_ID,
  SEARCH_CONSOLE_SCOPE,
  authorization,
  callbackUrl,
  completeOAuth,
  status,
  selectSite,
  performance,
  disconnect,
  settings
};
