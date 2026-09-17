const prisma = require('../db/prisma');
const postForMe = require('./postForMeService');

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDays(value) {
  return Math.min(90, Math.max(7, Number(value || 30)));
}

function providerAccountId(profile) {
  const metadata = postForMe.parseJson(profile.metadataJson, {});
  return String(metadata.postForMeAccountId || profile.externalProfileId || '');
}

function available(reason) {
  return { state: 'available', available: true, reason, metaCode: null };
}

function unavailable(reason, state = 'unavailable') {
  return { state, available: false, reason, metaCode: null };
}

function dateRange(days) {
  const until = new Date();
  const since = new Date(until.getTime() - (days - 1) * 86400000);
  since.setUTCHours(0, 0, 0, 0);
  until.setUTCHours(23, 59, 59, 999);
  return { since, until };
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] != null && Number.isFinite(Number(obj[key]))) return Number(obj[key]);
  }
  return 0;
}

function pinterestWindow(metrics) {
  return metrics?.lifetime_metrics || metrics?.['90d'] || {};
}

function normaliseMetrics(platform, raw = {}) {
  if (platform === 'facebook') {
    const views = pick(raw, ['media_views', 'video_views', 'reach']);
    const reactions = pick(raw, ['reactions_total']);
    const comments = pick(raw, ['comments']);
    const shares = pick(raw, ['shares']);
    return { views, reactions, comments, shares, clicks: 0, follows: 0, interactions: reactions + comments + shares };
  }
  if (platform === 'instagram') {
    const reactions = pick(raw, ['likes']);
    const comments = pick(raw, ['comments', 'replies']);
    const shares = pick(raw, ['shares']);
    const interactions = pick(raw, ['total_interactions']) || reactions + comments + shares + pick(raw, ['saved']);
    const profileActivity = typeof raw.profile_activity === 'number' ? raw.profile_activity : 0;
    return { views: pick(raw, ['views', 'reach']), reactions, comments, shares, clicks: profileActivity, follows: pick(raw, ['follows']), interactions };
  }
  if (platform === 'linkedin') {
    const reactions = pick(raw, ['likeCount']);
    const comments = pick(raw, ['commentCount']);
    const shares = pick(raw, ['shareCount']);
    return { views: pick(raw, ['impressionCount', 'videoView']), reactions, comments, shares, clicks: pick(raw, ['clickCount']), follows: 0, interactions: reactions + comments + shares };
  }
  if (platform === 'tiktok') {
    const reactions = pick(raw, ['likes', 'like_count', 'engagement_likes']);
    const comments = pick(raw, ['comments', 'comment_count']);
    const shares = pick(raw, ['shares', 'share_count']);
    const clicks = pick(raw, ['website_clicks', 'profile_views', 'phone_number_clicks', 'email_clicks', 'address_clicks', 'lead_submissions', 'app_download_clicks']);
    return { views: pick(raw, ['video_views', 'view_count', 'reach']), reactions, comments, shares, clicks, follows: pick(raw, ['new_followers']), interactions: reactions + comments + shares + pick(raw, ['favorites']) };
  }
  if (platform === 'youtube') {
    const reactions = pick(raw, ['likes']);
    const comments = pick(raw, ['comments']);
    const shares = pick(raw, ['shares']);
    const clicks = pick(raw, ['annotationClicks', 'cardClicks', 'cardTeaserClicks']);
    const follows = pick(raw, ['subscribersGained']) - pick(raw, ['subscribersLost']);
    return { views: pick(raw, ['views', 'engagedViews']), reactions, comments, shares, clicks, follows, interactions: reactions + comments + shares };
  }
  if (platform === 'pinterest') {
    const window = pinterestWindow(raw);
    const reactions = pick(window, ['reaction', 'save']);
    const comments = pick(window, ['comment']);
    const shares = pick(window, ['save']);
    const clicks = pick(window, ['outbound_click', 'pin_click']);
    return { views: pick(window, ['impression', 'video_views']), reactions, comments, shares, clicks, follows: 0, interactions: reactions + comments + shares + clicks };
  }
  if (platform === 'x') {
    const publicMetrics = raw.public_metrics || {};
    const organic = raw.organic_metrics || {};
    const reactions = pick(publicMetrics, ['like_count']);
    const comments = pick(publicMetrics, ['reply_count']);
    const shares = pick(publicMetrics, ['retweet_count', 'quote_count']);
    const clicks = pick(organic, ['url_link_clicks', 'user_profile_clicks']);
    return { views: pick(publicMetrics, ['impression_count']) || pick(organic, ['impression_count']), reactions, comments, shares, clicks, follows: 0, interactions: reactions + comments + shares + pick(publicMetrics, ['bookmark_count']) };
  }
  if (platform === 'threads') {
    const reactions = pick(raw, ['likes']);
    const comments = pick(raw, ['replies']);
    const shares = pick(raw, ['shares', 'reposts', 'quotes']);
    return { views: pick(raw, ['views']), reactions, comments, shares, clicks: 0, follows: 0, interactions: reactions + comments + shares };
  }
  if (platform === 'bluesky') {
    const reactions = pick(raw, ['likeCount']);
    const comments = pick(raw, ['replyCount']);
    const shares = pick(raw, ['repostCount', 'quoteCount']);
    return { views: 0, reactions, comments, shares, clicks: 0, follows: 0, interactions: reactions + comments + shares };
  }
  return { views: 0, reactions: 0, comments: 0, shares: 0, clicks: 0, follows: 0, interactions: 0 };
}

function mediaThumbnail(media) {
  if (!Array.isArray(media)) return null;
  for (const item of media.flat(Infinity)) {
    if (typeof item === 'string' && /^https?:\/\//i.test(item)) return item;
    if (item && typeof item === 'object') {
      const candidate = item.thumbnail_url || item.thumbnailUrl || item.url || item.media_url || item.mediaUrl;
      if (candidate) return String(candidate);
    }
  }
  return null;
}

function contentType(post) {
  const media = Array.isArray(post.media) ? post.media.flat(Infinity) : [];
  const text = JSON.stringify(media).toLowerCase();
  if (/video|\.mp4|\.mov|\.webm/.test(text)) return 'VIDEO';
  if (media.length) return 'IMAGE';
  return 'TEXT';
}

function incrementSeries(map, date, value) {
  if (!date || !value) return;
  map.set(date, (map.get(date) || 0) + value);
}

async function resolveProfile(userId, profileId, expectedPlatform) {
  const profile = await prisma.socialProfile.findFirst({
    where: { id: String(profileId), userId, status: 'ACTIVE' },
    include: { connection: true }
  });
  if (!profile || profile.connection?.status !== 'ACTIVE') {
    throw Object.assign(new Error('The selected analytics account is no longer connected.'), { status: 404 });
  }
  const connectionMeta = postForMe.parseJson(profile.connection.metadataJson, {});
  const profileMeta = postForMe.parseJson(profile.metadataJson, {});
  if (connectionMeta.providerEngine !== postForMe.PROVIDER_ENGINE || profileMeta.providerEngine !== postForMe.PROVIDER_ENGINE) {
    throw Object.assign(new Error('Reconnect this account through Post for Me before loading analytics.'), { status: 409 });
  }
  if (expectedPlatform && String(profile.platform) !== String(expectedPlatform)) {
    throw Object.assign(new Error('The selected analytics source does not match that platform.'), { status: 400 });
  }
  return profile;
}

async function fetchFeed(profile, days) {
  const accountId = providerAccountId(profile);
  if (!accountId) throw Object.assign(new Error('The Post for Me account mapping is missing.'), { status: 409 });
  const { since } = dateRange(days);
  const rows = [];
  let cursor = '';
  for (let page = 0; page < 10 && rows.length < 500; page += 1) {
    const params = new URLSearchParams({ limit: '50' });
    params.append('expand', 'metrics');
    if (cursor) params.set('cursor', cursor);
    const response = await postForMe.apiRequest('GET', `/social-account-feeds/${encodeURIComponent(accountId)}?${params.toString()}`);
    const items = Array.isArray(response?.data) ? response.data : [];
    rows.push(...items);
    if (!items.length || !response?.meta?.has_more) break;
    const oldest = items.map((item) => new Date(item.posted_at || 0).getTime()).filter(Number.isFinite).sort((a, b) => a - b)[0];
    if (oldest && oldest < since.getTime()) break;
    cursor = String(response?.meta?.cursor || '');
    if (!cursor) break;
  }
  return rows;
}

async function getPostForMeAnalytics(userId, platform, profileId, daysInput = 30) {
  const days = safeDays(daysInput);
  const profile = await resolveProfile(userId, profileId, platform);
  const { since, until } = dateRange(days);
  const allFeed = await fetchFeed(profile, days);
  const feed = allFeed.filter((item) => {
    const timestamp = new Date(item.posted_at || 0).getTime();
    return Number.isFinite(timestamp) && timestamp >= since.getTime() && timestamp <= until.getTime();
  });

  const totals = { views: 0, reactions: 0, comments: 0, shares: 0, clicks: 0, follows: 0, interactions: 0 };
  const viewsSeries = new Map();
  const engagementSeries = new Map();
  const followsSeries = new Map();
  let postsWithMetrics = 0;
  const content = feed.map((post) => {
    const metrics = normaliseMetrics(profile.platform, post.metrics || {});
    if (post.metrics && Object.keys(post.metrics).length) postsWithMetrics += 1;
    for (const key of Object.keys(totals)) totals[key] += number(metrics[key]);
    const date = post.posted_at ? String(post.posted_at).slice(0, 10) : '';
    incrementSeries(viewsSeries, date, metrics.views);
    incrementSeries(engagementSeries, date, metrics.interactions);
    incrementSeries(followsSeries, date, metrics.follows);
    return {
      id: String(post.platform_post_id || post.external_post_id || post.social_post_result_id || `${profile.id}:${post.posted_at}`),
      message: String(post.caption || ''),
      createdTime: post.posted_at || null,
      permalinkUrl: post.platform_url || null,
      thumbnailUrl: mediaThumbnail(post.media),
      contentType: contentType(post),
      reactions: metrics.reactions,
      comments: metrics.comments,
      shares: metrics.shares,
      insights: {
        views: metrics.views || null,
        uniqueViewers: null,
        clicks: metrics.clicks || null,
        engagement: metrics.interactions,
        totalInteractions: metrics.interactions,
        engagementRate: metrics.views > 0 ? Number((metrics.interactions / metrics.views * 100).toFixed(2)) : null
      }
    };
  });

  const hasMetrics = postsWithMetrics > 0;
  const metricCapability = hasMetrics
    ? available(`Live post metrics returned by Post for Me for ${postsWithMetrics} post${postsWithMetrics === 1 ? '' : 's'}.`)
    : unavailable('Post for Me returned feed content but no metrics for this source yet.', feed.length ? 'no_data' : 'no_content');
  const contentCapability = feed.length
    ? available('Live connected-account feed returned by Post for Me.')
    : unavailable('No feed posts were returned for the selected period.', 'no_data');
  const engagementRate = totals.views > 0 ? Number((totals.interactions / totals.views * 100).toFixed(2)) : null;
  const profileMeta = postForMe.parseJson(profile.metadataJson, {});
  const followerValue = number(profileMeta.followers || profileMeta.subscribers || 0);

  return {
    platform: profile.platform,
    fetchedAt: new Date().toISOString(),
    period: { days, since: since.toISOString(), until: until.toISOString() },
    page: {
      id: profile.id,
      name: profile.displayName || profile.username || `${profile.platform} account`,
      username: profile.username || null,
      followers: followerValue,
      pictureUrl: profile.avatarUrl || null,
      link: null
    },
    capabilities: {
      basicEngagement: metricCapability,
      publishedContent: contentCapability,
      pageInsights: metricCapability,
      postInsights: metricCapability,
      instagramDemographics: unavailable('Post for Me does not expose account-level audience demographics through the current feed endpoint.', 'not_available'),
      metrics: {}
    },
    summary: {
      followers: followerValue,
      posts: feed.length,
      reactions: totals.reactions,
      comments: totals.comments,
      shares: totals.shares,
      engagements: totals.interactions,
      totalInteractions: totals.interactions,
      views: hasMetrics ? totals.views : null,
      postViews: totals.views,
      uniqueViewers: 0,
      clicks: totals.clicks,
      follows: totals.follows || null,
      pageEngagements: totals.interactions,
      engagementRate,
      calculationNote: 'INXSocial aggregates the verified metrics returned by Post for Me for the selected connected account and period.'
    },
    series: {
      views: [...viewsSeries.entries()].map(([date, value]) => ({ date, value })),
      engagements: [...engagementSeries.entries()].map(([date, value]) => ({ date, value })),
      follows: [...followsSeries.entries()].map(([date, value]) => ({ date, value }))
    },
    demographics: { instagram: null, facebookSnapshot: null },
    content,
    warnings: hasMetrics ? [] : ['Some platforms only return analytics after provider-side processing or when a metric is available for that content type.'],
    provider: { engine: postForMe.PROVIDER_ENGINE, accountId: providerAccountId(profile), postsWithMetrics }
  };
}

module.exports = { getPostForMeAnalytics, normaliseMetrics };
