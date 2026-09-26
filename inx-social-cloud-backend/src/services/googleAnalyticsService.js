const prisma = require('../db/prisma');
const google = require('./googleSearchConsoleService');

const PROPERTY_SETTING_KEY = 'growth_intelligence_ga4_property_v1';
const ANALYTICS_ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';
const ANALYTICS_DATA_BASE = 'https://analyticsdata.googleapis.com/v1beta';

function publicError(message, status = 400, code = null) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  if (code) error.code = code;
  return error;
}

function safeJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

async function readSelectedProperty() {
  const setting = await prisma.appSetting.findUnique({ where: { key: PROPERTY_SETTING_KEY } });
  return setting ? safeJson(setting.value, null) : null;
}

async function writeSelectedProperty(property) {
  const payload = property ? {
    propertyId: String(property.propertyId),
    displayName: String(property.displayName || ''),
    account: String(property.account || '')
  } : null;
  await prisma.appSetting.upsert({
    where: { key: PROPERTY_SETTING_KEY },
    create: {
      key: PROPERTY_SETTING_KEY,
      value: JSON.stringify(payload),
      description: 'Selected GA4 property for INXSocial Growth Intelligence.'
    },
    update: {
      value: JSON.stringify(payload),
      description: 'Selected GA4 property for INXSocial Growth Intelligence.'
    }
  });
  return payload;
}

async function connection() {
  return prisma.searchConsoleConnection.findUnique({ where: { id: google.CONNECTION_ID } });
}

function grantedScopes(current) {
  const scopes = safeJson(current?.scopesJson, []);
  return Array.isArray(scopes) ? scopes.map(value => String(value)) : [];
}

function hasAnalyticsScope(current) {
  return grantedScopes(current).includes(google.ANALYTICS_READONLY_SCOPE);
}

function requireAnalyticsScope(current) {
  if (!current) throw publicError('Connect Google before loading Analytics.', 409, 'GA4_GOOGLE_NOT_CONNECTED');
  if (!hasAnalyticsScope(current)) {
    throw publicError(
      'Reconnect Google from the Control Centre to grant the Analytics read-only scope.',
      409,
      'GA4_SCOPE_REQUIRED'
    );
  }
}

function normalizePropertyName(value) {
  const match = String(value || '').match(/properties\/(\d+)/);
  return match ? match[1] : '';
}

function flattenProperties(payload) {
  const properties = [];
  for (const account of Array.isArray(payload?.accountSummaries) ? payload.accountSummaries : []) {
    for (const property of Array.isArray(account?.propertySummaries) ? account.propertySummaries : []) {
      const propertyId = normalizePropertyName(property.property);
      if (!propertyId) continue;
      properties.push({
        propertyId,
        displayName: String(property.displayName || propertyId),
        account: String(account.displayName || account.account || '')
      });
    }
  }
  return properties;
}

async function listProperties(current = null) {
  const activeConnection = current || await connection();
  requireAnalyticsScope(activeConnection);
  const payload = await google.googleRequest({
    url: `${ANALYTICS_ADMIN_BASE}/accountSummaries?pageSize=200`,
    connection: activeConnection,
    serviceLabel: 'Google Analytics Admin API'
  });
  return flattenProperties(payload);
}

async function status() {
  const current = await connection();
  const oauthConfigured = google.settings().configured;
  if (!current) {
    return {
      oauthConfigured,
      connected: false,
      analyticsScopeGranted: false,
      reconnectRequired: false,
      properties: [],
      selectedProperty: null,
      lastError: null
    };
  }

  const scopeGranted = hasAnalyticsScope(current);
  if (!scopeGranted) {
    return {
      oauthConfigured,
      connected: true,
      analyticsScopeGranted: false,
      reconnectRequired: true,
      properties: [],
      selectedProperty: await readSelectedProperty(),
      lastError: 'Analytics read-only permission has not been granted yet.'
    };
  }

  try {
    const properties = await listProperties(current);
    let selectedProperty = await readSelectedProperty();
    if (selectedProperty && !properties.some(item => item.propertyId === selectedProperty.propertyId)) {
      selectedProperty = null;
      await writeSelectedProperty(null);
    }
    if (!selectedProperty && properties.length === 1) {
      selectedProperty = await writeSelectedProperty(properties[0]);
    }
    return {
      oauthConfigured,
      connected: true,
      analyticsScopeGranted: true,
      reconnectRequired: false,
      properties,
      selectedProperty,
      lastError: null
    };
  } catch (error) {
    return {
      oauthConfigured,
      connected: true,
      analyticsScopeGranted: true,
      reconnectRequired: false,
      properties: [],
      selectedProperty: await readSelectedProperty(),
      lastError: String(error.publicMessage || error.message || 'Google Analytics could not be loaded.').slice(0, 500)
    };
  }
}

async function selectProperty(propertyId) {
  const requested = String(propertyId || '').replace(/^properties\//, '').trim();
  if (!/^\d+$/.test(requested)) throw publicError('Choose a valid GA4 property.', 400, 'GA4_PROPERTY_INVALID');
  const properties = await listProperties();
  const selected = properties.find(item => item.propertyId === requested);
  if (!selected) throw publicError('The connected Google account cannot access that GA4 property.', 403, 'GA4_PROPERTY_FORBIDDEN');
  return writeSelectedProperty(selected);
}

async function selectedProperty() {
  const selected = await readSelectedProperty();
  if (!selected?.propertyId) throw publicError('Choose a GA4 property before loading Analytics.', 409, 'GA4_PROPERTY_REQUIRED');
  return selected;
}

async function dataRequest(propertyId, method, body) {
  return google.googleRequest({
    method: 'POST',
    url: `${ANALYTICS_DATA_BASE}/properties/${encodeURIComponent(propertyId)}:${method}`,
    data: body,
    serviceLabel: 'Google Analytics Data API'
  });
}

function mapRows(payload) {
  const dimensions = (payload?.dimensionHeaders || []).map(item => String(item.name || 'dimension'));
  const metrics = (payload?.metricHeaders || []).map(item => String(item.name || 'metric'));
  return (payload?.rows || []).map(row => {
    const result = {};
    dimensions.forEach((name, index) => { result[name] = String(row.dimensionValues?.[index]?.value || ''); });
    metrics.forEach((name, index) => {
      const raw = row.metricValues?.[index]?.value;
      const number = Number(raw);
      result[name] = Number.isFinite(number) ? number : 0;
    });
    return result;
  });
}

function firstMetrics(payload) {
  return mapRows(payload)[0] || {};
}

function percentageChange(current, previous) {
  const now = Number(current || 0);
  const before = Number(previous || 0);
  if (!before) return now ? 100 : 0;
  return ((now - before) / Math.abs(before)) * 100;
}

async function realtime() {
  const property = await selectedProperty();
  const propertyId = property.propertyId;
  const [summaryPayload, pagePayload, countryPayload, devicePayload, eventPayload] = await Promise.all([
    dataRequest(propertyId, 'runRealtimeReport', {
      metrics: ['activeUsers', 'eventCount', 'screenPageViews', 'keyEvents'].map(name => ({ name }))
    }),
    dataRequest(propertyId, 'runRealtimeReport', {
      dimensions: [{ name: 'unifiedScreenName' }],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
      limit: 12,
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
    }),
    dataRequest(propertyId, 'runRealtimeReport', {
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 10,
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
    }),
    dataRequest(propertyId, 'runRealtimeReport', {
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 10,
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
    }),
    dataRequest(propertyId, 'runRealtimeReport', {
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      limit: 20,
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }]
    })
  ]);

  return {
    generatedAt: new Date().toISOString(),
    property,
    windowMinutes: 30,
    summary: firstMetrics(summaryPayload),
    pages: mapRows(pagePayload),
    countries: mapRows(countryPayload),
    devices: mapRows(devicePayload),
    events: mapRows(eventPayload)
  };
}

function summaryRequest(startDate, endDate) {
  return {
    dateRanges: [{ startDate, endDate }],
    metrics: ['activeUsers', 'sessions', 'screenPageViews', 'keyEvents', 'totalRevenue'].map(name => ({ name }))
  };
}

async function performance(days = 28) {
  const periodDays = [7, 28, 90].includes(Number(days)) ? Number(days) : 28;
  const property = await selectedProperty();
  const propertyId = property.propertyId;
  const currentStart = `${periodDays - 1}daysAgo`;
  const previousStart = `${periodDays * 2 - 1}daysAgo`;
  const previousEnd = `${periodDays}daysAgo`;

  const [summaryPayload, previousPayload, dailyPayload, pagePayload, channelPayload, eventPayload] = await Promise.all([
    dataRequest(propertyId, 'runReport', summaryRequest(currentStart, 'today')),
    dataRequest(propertyId, 'runReport', summaryRequest(previousStart, previousEnd)),
    dataRequest(propertyId, 'runReport', {
      dateRanges: [{ startDate: currentStart, endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'keyEvents' }],
      limit: 100,
      orderBys: [{ dimension: { dimensionName: 'date' } }]
    }),
    dataRequest(propertyId, 'runReport', {
      dateRanges: [{ startDate: currentStart, endDate: 'today' }],
      dimensions: [{ name: 'landingPagePlusQueryString' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'keyEvents' }],
      limit: 20,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
    }),
    dataRequest(propertyId, 'runReport', {
      dateRanges: [{ startDate: currentStart, endDate: 'today' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'keyEvents' }],
      limit: 20,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
    }),
    dataRequest(propertyId, 'runReport', {
      dateRanges: [{ startDate: currentStart, endDate: 'today' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      limit: 100,
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }]
    })
  ]);

  const summary = firstMetrics(summaryPayload);
  const previous = firstMetrics(previousPayload);
  const events = mapRows(eventPayload);
  const eventCounts = Object.fromEntries(events.map(row => [String(row.eventName || ''), Number(row.eventCount || 0)]));

  return {
    generatedAt: new Date().toISOString(),
    property,
    periodDays,
    summary,
    comparison: {
      activeUsersPercent: percentageChange(summary.activeUsers, previous.activeUsers),
      sessionsPercent: percentageChange(summary.sessions, previous.sessions),
      viewsPercent: percentageChange(summary.screenPageViews, previous.screenPageViews),
      keyEventsPercent: percentageChange(summary.keyEvents, previous.keyEvents),
      revenuePercent: percentageChange(summary.totalRevenue, previous.totalRevenue)
    },
    daily: mapRows(dailyPayload),
    landingPages: mapRows(pagePayload),
    channels: mapRows(channelPayload),
    events,
    funnel: {
      signUp: Number(eventCounts.sign_up || 0),
      beginCheckout: Number(eventCounts.begin_checkout || 0),
      purchase: Number(eventCounts.purchase || 0),
      aiGenerationRequested: Number(eventCounts.ai_generation_requested || 0)
    }
  };
}

module.exports = {
  PROPERTY_SETTING_KEY,
  status,
  listProperties,
  selectProperty,
  realtime,
  performance,
  mapRows
};
