const axios = require('axios');
const prisma = require('../db/prisma');
const { decryptToken } = require('../utils/tokenCrypto');

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
}

function daysRange(days) {
  const safeDays = Math.min(90, Math.max(7, Number(days || 30)));
  const end = new Date();
  const start = new Date(end.getTime() - (safeDays - 1) * 86400000);
  return { days: safeDays, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function unavailable(reason, state = 'unavailable') {
  return { state, available: false, reason, metaCode: null };
}

function available(reason) {
  return { state: 'available', available: true, reason, metaCode: null };
}

async function socialSource(userId, profileId, platform) {
  const profile = await prisma.socialProfile.findFirst({
    where: { id: profileId, userId, platform, status: 'ACTIVE' },
    include: { connection: true }
  });
  if (!profile || profile.connection?.status !== 'ACTIVE') {
    throw Object.assign(new Error('The selected analytics account is no longer connected.'), { status: 404 });
  }
  if (!profile.connection.encryptedAccessToken) {
    throw Object.assign(new Error('The selected account needs to be reconnected before analytics can be loaded.'), { status: 409 });
  }
  return { profile, connection: profile.connection, accessToken: decryptToken(profile.connection.encryptedAccessToken) };
}

function normaliseInstagramDemographics(data, account) {
  const breakdowns = data?.data?.[0]?.total_value?.breakdowns || [];
  const counts = breakdowns.flatMap(item => {
    const keys = item.dimension_keys || [];
    const ageIndex = keys.findIndex(key => String(key).toLowerCase() === 'age');
    const genderIndex = keys.findIndex(key => String(key).toLowerCase() === 'gender');
    return (item.results || []).map(row => {
      const rawGender = String(row.dimension_values?.[genderIndex < 0 ? 1 : genderIndex] || '').toLowerCase();
      const gender = ['f', 'female', 'women', 'woman'].includes(rawGender)
        ? 'women'
        : ['m', 'male', 'men', 'man'].includes(rawGender) ? 'men' : 'unknown';
      return {
        age: String(row.dimension_values?.[ageIndex < 0 ? 0 : ageIndex] || 'Unknown'),
        gender,
        value: Math.max(0, Number(row.value || 0))
      };
    });
  }).filter(row => row.value > 0);
  const total = counts.reduce((sum, row) => sum + row.value, 0);
  if (!counts.length) return null;
  return {
    source: 'instagram_api',
    capturedAt: new Date().toISOString(),
    audienceSize: Number(account.followers || 0) || total || null,
    account,
    ageGender: counts.map(row => ({ ...row, percentage: total ? Number((row.value / total * 100).toFixed(2)) : 0 }))
  };
}

function contentFromInstagram(items) {
  return (items || []).map(item => ({
    id: String(item.id || ''),
    message: String(item.caption || ''),
    createdTime: item.timestamp || null,
    permalinkUrl: item.permalink || null,
    thumbnailUrl: item.thumbnail_url || item.media_url || null,
    contentType: String(item.media_type || 'POST'),
    reactions: Number(item.like_count || 0),
    comments: Number(item.comments_count || 0),
    shares: 0,
    insights: {
      views: null,
      uniqueViewers: null,
      clicks: null,
      engagement: Number(item.like_count || 0) + Number(item.comments_count || 0),
      totalInteractions: Number(item.like_count || 0) + Number(item.comments_count || 0),
      engagementRate: null
    }
  })).filter(item => item.id);
}

function seriesFromContent(content) {
  const engagement = new Map();
  content.forEach(item => {
    if (!item.createdTime) return;
    const date = String(item.createdTime).slice(0, 10);
    engagement.set(date, (engagement.get(date) || 0) + item.reactions + item.comments + item.shares);
  });
  return {
    views: [],
    engagements: [...engagement.entries()].map(([date, value]) => ({ date, value })),
    follows: []
  };
}

async function getInstagramAnalytics(userId, profileId, days) {
  const { profile, connection, accessToken } = await socialSource(userId, profileId, 'instagram');
  const range = daysRange(days);
  const connectionMeta = parseJson(connection.metadataJson, {});
  const profileMeta = parseJson(profile.metadataJson, {});
  const authMethods = new Set([...(connectionMeta.authMethods || []), connectionMeta.authMethod, ...(profileMeta.authMethods || [])].filter(Boolean));
  const direct = authMethods.has('INSTAGRAM_LOGIN');
  const graphVersion = process.env.FB_GRAPH_VERSION || process.env.GRAPH_VERSION || 'v25.0';
  const base = direct ? 'https://graph.instagram.com' : `https://graph.facebook.com/${graphVersion}`;
  const accountId = profile.externalProfileId;
  const headers = direct ? { Authorization: `Bearer ${accessToken}` } : undefined;
  const tokenParams = direct ? {} : { access_token: accessToken };
  let account = {
    id: accountId,
    username: profile.username || null,
    name: profile.displayName || connection.displayName || null,
    pictureUrl: profile.avatarUrl || null,
    followers: Number(profileMeta.followers || 0)
  };
  const warnings = [];
  try {
    const response = await axios.get(`${base}/${encodeURIComponent(accountId)}`, {
      headers,
      params: { fields: 'id,username,name,profile_picture_url,followers_count,media_count', ...tokenParams },
      timeout: 20000
    });
    const live = response.data || {};
    account = {
      id: String(live.id || account.id),
      username: live.username || account.username,
      name: live.name || account.name,
      pictureUrl: live.profile_picture_url || account.pictureUrl,
      followers: Number(live.followers_count ?? account.followers ?? 0)
    };
  } catch (error) {
    warnings.push(`Instagram profile refresh: ${error.response?.data?.error?.message || error.message}`);
  }

  let media = [];
  let contentCapability = unavailable('Instagram did not return recent media for this connection.', 'no_data');
  try {
    const response = await axios.get(`${base}/${encodeURIComponent(accountId)}/media`, {
      headers,
      params: { fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count', limit: 50, ...tokenParams },
      timeout: 20000
    });
    media = contentFromInstagram(response.data?.data || []);
    const since = Date.now() - range.days * 86400000;
    media = media.filter(item => !item.createdTime || new Date(item.createdTime).getTime() >= since);
    contentCapability = available('Recent Instagram media and engagement were returned by the connected professional account.');
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    contentCapability = unavailable(message, error.response?.status === 403 ? 'permission_required' : 'temporary_error');
    warnings.push(`Instagram media: ${message}`);
  }

  let demographics = null;
  let demographicCapability = unavailable('Instagram returned no follower demographic breakdown for this account.', 'no_data');
  try {
    const response = await axios.get(`${base}/${encodeURIComponent(accountId)}/insights`, {
      headers,
      params: {
        metric: 'follower_demographics',
        period: 'lifetime',
        metric_type: 'total_value',
        breakdown: 'age,gender',
        timeframe: 'last_90_days',
        ...tokenParams
      },
      timeout: 20000
    });
    demographics = normaliseInstagramDemographics(response.data, account);
    if (demographics) demographicCapability = available('Live Instagram follower age and gender demographics were returned.');
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    demographicCapability = unavailable(message, error.response?.status === 403 ? 'permission_required' : 'no_data');
    warnings.push(`Instagram demographics: ${message}`);
  }

  const reactions = media.reduce((sum, item) => sum + item.reactions, 0);
  const comments = media.reduce((sum, item) => sum + item.comments, 0);
  const interactions = reactions + comments;
  return {
    platform: 'instagram',
    fetchedAt: new Date().toISOString(),
    period: { days: range.days, since: `${range.start}T00:00:00.000Z`, until: `${range.end}T23:59:59.999Z` },
    page: { id: account.id, name: account.name || account.username || 'Instagram', followers: account.followers, pictureUrl: account.pictureUrl, username: account.username },
    capabilities: {
      basicEngagement: contentCapability,
      publishedContent: contentCapability,
      pageInsights: contentCapability,
      postInsights: contentCapability,
      instagramDemographics: demographicCapability,
      metrics: {}
    },
    summary: {
      followers: Number(account.followers || 0), posts: media.length, reactions, comments, shares: 0,
      engagements: interactions, totalInteractions: interactions, views: null, postViews: 0,
      uniqueViewers: 0, clicks: 0, follows: null, pageEngagements: interactions, engagementRate: null,
      calculationNote: 'Instagram interactions currently include likes and comments returned for recent media.'
    },
    series: seriesFromContent(media),
    demographics: { instagram: demographics, facebookSnapshot: null },
    content: media,
    warnings
  };
}

function youtubeDemographics(rows, account) {
  const values = (rows || []).map(row => ({
    age: String(row[0] || 'Unknown').replace(/^age/, '').replace(/_/g, '-'),
    gender: String(row[1] || '').toLowerCase() === 'female' ? 'women' : String(row[1] || '').toLowerCase() === 'male' ? 'men' : 'unknown',
    value: null,
    percentage: Number(row[2] || 0)
  })).filter(row => row.percentage > 0);
  if (!values.length) return null;
  return { source: 'youtube_api', capturedAt: new Date().toISOString(), audienceSize: account.followers || null, account, ageGender: values };
}

async function getYouTubeAnalytics(userId, profileId, days) {
  const { profile, accessToken } = await socialSource(userId, profileId, 'youtube');
  const range = daysRange(days);
  const headers = { Authorization: `Bearer ${accessToken}` };
  const profileMeta = parseJson(profile.metadataJson, {});
  const account = {
    id: profile.externalProfileId,
    name: profile.displayName,
    username: profile.username,
    pictureUrl: profile.avatarUrl,
    followers: Number(profileMeta.subscribers || 0)
  };
  let channel = null;
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      headers,
      params: { part: 'id,snippet,statistics', id: profile.externalProfileId },
      timeout: 20000
    });
    channel = response.data?.items?.[0] || null;
  } catch (_) {}
  const statistics = channel?.statistics || {};
  account.followers = Number(statistics.subscriberCount ?? account.followers ?? 0);
  account.name = channel?.snippet?.title || account.name;
  account.pictureUrl = channel?.snippet?.thumbnails?.medium?.url || account.pictureUrl;

  let dailyRows = [];
  let demographicRows = [];
  let analyticsCapability = unavailable('Reconnect YouTube to grant YouTube Analytics read permission.', 'permission_required');
  let demographicCapability = analyticsCapability;
  const warnings = [];
  try {
    const common = { ids: `channel==${profile.externalProfileId}`, startDate: range.start, endDate: range.end };
    const daily = await axios.get('https://youtubeanalytics.googleapis.com/v2/reports', {
      headers,
      params: { ...common, metrics: 'views,likes,comments,shares,subscribersGained,subscribersLost', dimensions: 'day', sort: 'day' },
      timeout: 20000
    });
    dailyRows = daily.data?.rows || [];
    analyticsCapability = available('Live YouTube Analytics metrics were returned for this channel.');
    try {
      const demographics = await axios.get('https://youtubeanalytics.googleapis.com/v2/reports', {
        headers,
        params: { ...common, metrics: 'viewerPercentage', dimensions: 'ageGroup,gender' },
        timeout: 20000
      });
      demographicRows = demographics.data?.rows || [];
      demographicCapability = demographicRows.length
        ? available('Live YouTube viewer age and gender percentages were returned for this channel.')
        : unavailable('YouTube returned no eligible viewer demographic rows for this period.', 'no_data');
    } catch (error) {
      const message = error.response?.data?.error?.message || error.message;
      demographicCapability = unavailable(message, error.response?.status === 403 ? 'permission_required' : 'no_data');
    }
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    analyticsCapability = unavailable(message, error.response?.status === 403 ? 'permission_required' : 'temporary_error');
    demographicCapability = analyticsCapability;
    warnings.push(`YouTube Analytics: ${message}`);
  }

  const totals = dailyRows.reduce((sum, row) => ({
    views: sum.views + Number(row[1] || 0), likes: sum.likes + Number(row[2] || 0), comments: sum.comments + Number(row[3] || 0), shares: sum.shares + Number(row[4] || 0), gained: sum.gained + Number(row[5] || 0), lost: sum.lost + Number(row[6] || 0)
  }), { views: 0, likes: 0, comments: 0, shares: 0, gained: 0, lost: 0 });
  const demographic = youtubeDemographics(demographicRows, account);
  const interactions = totals.likes + totals.comments + totals.shares;
  return {
    platform: 'youtube',
    fetchedAt: new Date().toISOString(),
    period: { days: range.days, since: `${range.start}T00:00:00.000Z`, until: `${range.end}T23:59:59.999Z` },
    page: { id: account.id, name: account.name || 'YouTube channel', followers: account.followers, pictureUrl: account.pictureUrl, username: account.username },
    capabilities: {
      basicEngagement: analyticsCapability, publishedContent: unavailable('Content-level YouTube rows are not loaded in this analytics view yet.', 'not_requested'),
      pageInsights: analyticsCapability, postInsights: unavailable('Video-level enrichment is not loaded in this analytics view yet.', 'not_requested'),
      instagramDemographics: demographicCapability, metrics: {}
    },
    summary: {
      followers: account.followers, posts: Number(statistics.videoCount ?? profileMeta.videos ?? 0), reactions: totals.likes,
      comments: totals.comments, shares: totals.shares, engagements: interactions, totalInteractions: interactions,
      views: dailyRows.length ? totals.views : Number(statistics.viewCount ?? profileMeta.views ?? 0), postViews: totals.views,
      uniqueViewers: 0, clicks: 0, follows: totals.gained - totals.lost, pageEngagements: interactions,
      engagementRate: totals.views > 0 ? Number((interactions / totals.views * 100).toFixed(2)) : null,
      calculationNote: 'YouTube engagement rate is likes, comments and shares divided by views for the selected period.'
    },
    series: {
      views: dailyRows.map(row => ({ date: String(row[0]), value: Number(row[1] || 0) })),
      engagements: dailyRows.map(row => ({ date: String(row[0]), value: Number(row[2] || 0) + Number(row[3] || 0) + Number(row[4] || 0) })),
      follows: dailyRows.map(row => ({ date: String(row[0]), value: Number(row[5] || 0) - Number(row[6] || 0) }))
    },
    demographics: { instagram: demographic, facebookSnapshot: null },
    content: [],
    warnings
  };
}

async function getLinkedInAnalytics(userId, profileId, days) {
  const { profile } = await socialSource(userId, profileId, 'linkedin');
  const range = daysRange(days);
  const reason = 'This LinkedIn connection currently has identity access only. Analytics will activate when organisation/member analytics permissions are enabled.';
  const capability = unavailable(reason, 'permission_required');
  return {
    platform: 'linkedin', fetchedAt: new Date().toISOString(), period: { days: range.days, since: `${range.start}T00:00:00.000Z`, until: `${range.end}T23:59:59.999Z` },
    page: { id: profile.externalProfileId, name: profile.displayName || 'LinkedIn', followers: 0, pictureUrl: profile.avatarUrl, username: profile.username },
    capabilities: { basicEngagement: capability, publishedContent: capability, pageInsights: capability, postInsights: capability, instagramDemographics: capability, metrics: {} },
    summary: { followers: 0, posts: 0, reactions: 0, comments: 0, shares: 0, engagements: 0, totalInteractions: 0, views: null, postViews: 0, uniqueViewers: 0, clicks: 0, follows: null, pageEngagements: null, engagementRate: null, calculationNote: reason },
    series: { views: [], engagements: [], follows: [] }, demographics: { instagram: null, facebookSnapshot: null }, content: [], warnings: [reason]
  };
}

async function getSocialAnalytics(userId, platform, profileId, days) {
  if (platform === 'instagram') return getInstagramAnalytics(userId, profileId, days);
  if (platform === 'youtube') return getYouTubeAnalytics(userId, profileId, days);
  if (platform === 'linkedin') return getLinkedInAnalytics(userId, profileId, days);
  throw Object.assign(new Error('Analytics are not available for this platform connection.'), { status: 404 });
}

module.exports = { getSocialAnalytics, getInstagramAnalytics, getYouTubeAnalytics, getLinkedInAnalytics, normaliseInstagramDemographics };
