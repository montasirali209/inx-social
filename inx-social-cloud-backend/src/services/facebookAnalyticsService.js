const axios = require('axios');

const CACHE_TTL_MS = 15 * 60 * 1000;
const MIN_FORCE_REFRESH_MS = 60 * 1000;
const RATE_LIMIT_COOLDOWN_MS = 70 * 60 * 1000;
const analyticsCache = new Map();
let rateLimitUntil = 0;

const INSIGHT_CANDIDATES = [
  { key: 'views', metric: 'page_media_view', label: 'Content views' },
  { key: 'engagements', metric: 'page_post_engagements', label: 'Post engagements' },
  { key: 'follows', metric: 'page_follows', label: 'Page follows' }
];

function graphError(error) {
  const body = error?.response?.data?.error || error?.response?.data || {};
  return {
    status: Number(error?.response?.status || 0),
    code: Number(body.code || 0),
    subcode: Number(body.error_subcode || 0),
    type: String(body.type || ''),
    message: String(body.message || error?.message || 'Meta request failed.')
  };
}

function isRateLimit(error) {
  const detail = graphError(error);
  return detail.status === 429 || [4, 17, 32, 613].includes(detail.code);
}

function capabilityFromError(error) {
  const detail = graphError(error);
  if (isRateLimit(error)) return { state: 'rate_limited', available: false, reason: 'Meta temporarily limited analytics requests. INX Social will wait before checking again.', metaCode: detail.code || null };
  if (/metric|valid metric|does not exist|unsupported|get field/i.test(detail.message)) {
    return { state: 'unsupported_metric', available: false, reason: detail.message, metaCode: detail.code || null };
  }
  if ([10, 100, 190, 200, 299].includes(detail.code) || detail.status === 403) {
    return { state: 'permission_required', available: false, reason: detail.message, metaCode: detail.code || null };
  }
  return { state: 'temporary_error', available: false, reason: detail.message, metaCode: detail.code || null };
}

function usagePercent(headers = {}) {
  const raw = headers['x-app-usage'] || headers['X-App-Usage'];
  if (!raw) return 0;
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Math.max(Number(value.call_count || 0), Number(value.total_cputime || 0), Number(value.total_time || 0));
  } catch (_) {
    return 0;
  }
}

function noteUsage(headers) {
  if (usagePercent(headers) >= 85) rateLimitUntil = Math.max(rateLimitUntil, Date.now() + RATE_LIMIT_COOLDOWN_MS);
}

function sumMetricValues(rows) {
  return (rows || []).reduce((total, row) => total + (row.values || []).reduce((inner, value) => inner + Number(value.value || 0), 0), 0);
}

function metricSeries(row) {
  return (row?.values || []).map(value => ({
    date: String(value.end_time || '').slice(0, 10),
    value: Number(value.value || 0)
  })).filter(item => item.date);
}

function countSummary(edge) {
  return Number(edge?.summary?.total_count || 0);
}

function normalisePost(post) {
  return {
    id: String(post.id || ''),
    message: String(post.message || ''),
    createdTime: post.created_time || null,
    permalinkUrl: post.permalink_url || null,
    thumbnailUrl: post.full_picture || null,
    contentType: post.status_type || 'post',
    reactions: countSummary(post.reactions),
    comments: countSummary(post.comments),
    shares: Number(post.shares?.count || 0)
  };
}

async function graphGet(http, graphVersion, path, accessToken, params = {}) {
  const response = await http.get(`https://graph.facebook.com/${graphVersion}/${path}`, {
    params: { ...params, access_token: accessToken },
    timeout: 20000,
    validateStatus: () => true
  });
  noteUsage(response.headers || {});
  if (response.status >= 400 || response.data?.error) {
    const error = new Error(response.data?.error?.message || `Meta request failed (HTTP ${response.status}).`);
    error.response = response;
    throw error;
  }
  return response.data;
}

async function fetchBasic(http, options) {
  const { graphVersion, pageId, accessToken, since, until } = options;
  const profile = await graphGet(http, graphVersion, encodeURIComponent(pageId), accessToken, {
    fields: 'id,name,followers_count,fan_count,link,picture.type(large)'
  });
  let feed = { data: [] };
  let contentCapability = { state: 'available', available: true, reason: 'Published Page content was returned by Meta.', metaCode: null };
  try {
    feed = await graphGet(http, graphVersion, `${encodeURIComponent(pageId)}/published_posts`, accessToken, {
      fields: 'id,message,created_time,permalink_url,full_picture,status_type,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true)',
      since,
      until,
      limit: 100
    });
  } catch (error) {
    contentCapability = capabilityFromError(error);
    if (!['permission_required', 'rate_limited'].includes(contentCapability.state)) {
      try {
        feed = await graphGet(http, graphVersion, `${encodeURIComponent(pageId)}/posts`, accessToken, {
          fields: 'id,message,created_time,permalink_url,status_type,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true)', since, until, limit: 100
        });
        contentCapability = { state: 'available', available: true, reason: 'Page content was returned by Meta.', metaCode: null };
      } catch (fallbackError) { contentCapability = capabilityFromError(fallbackError); }
    }
  }
  return {
    page: {
      id: String(profile.id || pageId),
      name: String(profile.name || ''),
      followers: Number(profile.followers_count ?? profile.fan_count ?? 0),
      fans: Number(profile.fan_count || 0),
      link: profile.link || null,
      pictureUrl: profile.picture?.data?.url || null
    },
    content: (feed.data || []).map(normalisePost),
    contentCapability
  };
}

async function fetchInsight(http, options, candidate) {
  const { graphVersion, pageId, accessToken, since, until } = options;
  try {
    const data = await graphGet(http, graphVersion, `${encodeURIComponent(pageId)}/insights`, accessToken, {
      metric: candidate.metric,
      period: 'day',
      since,
      until
    });
    const row = data.data?.[0] || null;
    return {
      key: candidate.key,
      metric: candidate.metric,
      label: candidate.label,
      capability: { state: 'available', available: true, reason: 'Returned by Meta for this Page token.', metaCode: null },
      total: sumMetricValues(data.data),
      series: metricSeries(row)
    };
  } catch (error) {
    if (isRateLimit(error)) rateLimitUntil = Math.max(rateLimitUntil, Date.now() + RATE_LIMIT_COOLDOWN_MS);
    return { key: candidate.key, metric: candidate.metric, label: candidate.label, capability: capabilityFromError(error), total: null, series: [] };
  }
}

function cacheKey(options) {
  return `${options.cacheScope || 'shared'}:${options.graphVersion}:${options.pageId}:${options.days}`;
}

async function getFacebookAnalytics(options, dependencies = {}) {
  const now = Date.now();
  const days = Math.min(90, Math.max(7, Number(options.days || 30)));
  const until = Math.floor(now / 1000);
  const since = until - days * 86400;
  const prepared = { ...options, days, since, until };
  const key = cacheKey(prepared);
  const cached = analyticsCache.get(key);
  const recentlyFetched = cached && cached.createdAt > now - MIN_FORCE_REFRESH_MS;
  if (cached && cached.expiresAt > now && (!options.force || recentlyFetched)) {
    return { ...cached.value, cache: { hit: true, expiresAt: new Date(cached.expiresAt).toISOString() } };
  }
  if (rateLimitUntil > now) {
    const error = new Error(`Meta analytics is cooling down until ${new Date(rateLimitUntil).toLocaleString('en-GB')}.`);
    error.status = 429;
    error.publicMessage = error.message;
    error.retryAt = new Date(rateLimitUntil).toISOString();
    throw error;
  }

  const http = dependencies.http || axios;
  let basic;
  try {
    basic = await fetchBasic(http, prepared);
  } catch (error) {
    if (isRateLimit(error)) rateLimitUntil = Math.max(rateLimitUntil, Date.now() + RATE_LIMIT_COOLDOWN_MS);
    const detail = capabilityFromError(error);
    const publicError = new Error(detail.reason);
    publicError.status = detail.state === 'rate_limited' ? 429 : 502;
    publicError.publicMessage = detail.reason;
    throw publicError;
  }

  const insights = {};
  for (const candidate of INSIGHT_CANDIDATES) {
    if (rateLimitUntil > Date.now()) {
      insights[candidate.key] = { key: candidate.key, metric: candidate.metric, label: candidate.label, capability: { state: 'rate_limited', available: false, reason: 'Further Meta checks were stopped to protect the application quota.', metaCode: null }, total: null, series: [] };
      continue;
    }
    insights[candidate.key] = await fetchInsight(http, prepared, candidate);
  }

  const content = basic.content;
  const reactions = content.reduce((sum, item) => sum + item.reactions, 0);
  const comments = content.reduce((sum, item) => sum + item.comments, 0);
  const shares = content.reduce((sum, item) => sum + item.shares, 0);
  const availableInsights = Object.values(insights).filter(item => item.capability.available).length;
  const value = {
    platform: 'facebook',
    fetchedAt: new Date().toISOString(),
    period: { days, since: new Date(since * 1000).toISOString(), until: new Date(until * 1000).toISOString() },
    page: basic.page,
    capabilities: {
      basicEngagement: basic.contentCapability.available
        ? { state: 'available', available: true, reason: 'Page and post engagement data was returned by Meta.' }
        : basic.contentCapability,
      publishedContent: basic.contentCapability,
      pageInsights: {
        state: availableInsights ? 'available' : (Object.values(insights)[0]?.capability.state || 'unavailable'),
        available: availableInsights > 0,
        reason: availableInsights ? `${availableInsights} of ${INSIGHT_CANDIDATES.length} tested insight metrics are available.` : 'Meta did not return any tested Page insight metric for this Page token.'
      },
      metrics: Object.fromEntries(Object.entries(insights).map(([name, item]) => [name, item.capability]))
    },
    reviewEvidence: {
      status: availableInsights > 0 && basic.contentCapability.available ? 'ready' : 'partial',
      graphVersion: prepared.graphVersion,
      pageId: basic.page.id,
      pageName: basic.page.name,
      fetchedAt: new Date().toISOString(),
      dateRange: {
        days,
        since: new Date(since * 1000).toISOString(),
        until: new Date(until * 1000).toISOString()
      },
      permissionEvidence: basic.contentCapability.available
        ? 'The selected Page profile and published content were returned using the connected Page token.'
        : 'The Page identity check succeeded, but the stored Page token cannot yet read published content. Reconnect the Page after pages_read_user_content is enabled so Meta issues a token containing the new scope.',
      requiredPermissions: [
        {
          permission: 'pages_show_list',
          purpose: 'Lists the Facebook Pages a person manages during the connection flow.',
          verification: 'connection_flow'
        },
        {
          permission: 'pages_read_engagement',
          purpose: 'Reads the selected Page profile and engagement data shown in Analytics.',
          verification: 'verified_by_live_page_response'
        },
        {
          permission: 'pages_read_user_content',
          purpose: 'Reads posts published by the Page so INX Social can show content-level performance.',
          verification: basic.contentCapability.available ? 'verified_by_live_published_posts_response' : 'reconnect_required'
        }
      ],
      endpointChecks: [
        { endpoint: `/${basic.page.id}`, purpose: 'Page identity and audience check', ok: true },
        { endpoint: `/${basic.page.id}/published_posts`, purpose: 'Published content and engagement check', ok: Boolean(basic.contentCapability.available), state: basic.contentCapability.state, reason: basic.contentCapability.reason },
        ...Object.values(insights).map(item => ({
          endpoint: `/${basic.page.id}/insights?metric=${item.metric}`,
          purpose: item.label,
          ok: Boolean(item.capability.available),
          state: item.capability.state
        }))
      ],
      requestedMetrics: INSIGHT_CANDIDATES.map(item => item.metric),
      returnedMetrics: Object.values(insights).filter(item => item.capability.available).map(item => item.metric),
      unavailableMetrics: Object.values(insights).filter(item => !item.capability.available).map(item => ({
        metric: item.metric,
        state: item.capability.state,
        reason: item.capability.reason
      })),
      privacy: 'Access tokens are decrypted only on the server and are never returned to the browser.',
      reviewerSteps: [
        'Sign in to INX Social with the supplied reviewer account.',
        'Open Connected Pages and connect the supplied Facebook Page. If it was connected before pages_read_user_content was enabled, disconnect and reconnect it so Meta issues a fresh Page token.',
        'Open Analytics, keep Facebook selected, choose the Page and date range, then click Refresh analytics.',
        'Confirm the Page identity, live content engagement, Data availability results and this Meta review evidence panel.',
        'Change the date range and refresh again to verify that INX Social requests Page analytics for the selected period.'
      ],
      reconnectRequired: basic.contentCapability.state === 'permission_required'
    },
    summary: {
      followers: basic.page.followers,
      posts: content.length,
      reactions,
      comments,
      shares,
      engagements: reactions + comments + shares,
      views: insights.views?.total,
      pageEngagements: insights.engagements?.total,
      follows: insights.follows?.total
    },
    series: Object.fromEntries(Object.entries(insights).map(([name, item]) => [name, item.series])),
    content,
    warnings: Object.values(insights).filter(item => !item.capability.available).map(item => `${item.label}: ${item.capability.reason}`),
    cache: { hit: false, expiresAt: new Date(now + CACHE_TTL_MS).toISOString() }
  };
  analyticsCache.set(key, { createdAt: now, expiresAt: now + CACHE_TTL_MS, value });
  return value;
}

function resetAnalyticsState() {
  analyticsCache.clear();
  rateLimitUntil = 0;
}

module.exports = {
  getFacebookAnalytics,
  resetAnalyticsState,
  capabilityFromError,
  isRateLimit,
  INSIGHT_CANDIDATES,
  CACHE_TTL_MS,
  RATE_LIMIT_COOLDOWN_MS
};
