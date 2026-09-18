const prisma = require('../db/prisma');
const postForMe = require('./postForMeService');

const ANALYTICS_CACHE_TTL_MS = 2 * 60 * 1000;
const ANALYTICS_STALE_TTL_MS = 6 * 60 * 60 * 1000;
const ANALYTICS_PERSISTED_MAX_STALE_MS = 14 * 24 * 60 * 60 * 1000;
const ANALYTICS_CACHE_RUNTIME_INTERVAL_MS = 2 * 60 * 1000;
const ANALYTICS_CACHE_RUNTIME_BATCH_SIZE = 4;
const ANALYTICS_CACHE_RUNTIME_ACCOUNT_DELAY_MS = 1500;
const ANALYTICS_CACHE_RUNTIME_RETRY_AFTER_MS = 10 * 60 * 1000;
const SNAPSHOT_MIN_INTERVAL_MS = 45 * 60 * 1000;
const SNAPSHOT_RETENTION_DAYS = 120;
const SNAPSHOT_RUNTIME_INTERVAL_MS = 60 * 60 * 1000;
const SNAPSHOT_RUNTIME_ACCOUNT_DELAY_MS = 5000;
const FEED_HISTORY_MAX_PAGES = 30;
const FEED_HISTORY_MAX_POSTS = 3000;
const analyticsInflight = new Map();
let snapshotRuntimeTimer = null;
let snapshotRuntimeRunning = false;
let analyticsCacheRuntimeTimer = null;
let analyticsCacheRuntimeRunning = false;

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

function genericMetrics(raw = {}) {
  const reactions = pick(raw, ['reactions_total', 'reactions', 'likes', 'like_count']);
  const comments = pick(raw, ['comments', 'comment_count', 'replies', 'reply_count']);
  const shares = pick(raw, ['shares', 'share_count', 'reposts', 'retweet_count']);
  const saves = pick(raw, ['saves', 'saved', 'bookmarks', 'bookmark_count']);
  const clicks = pick(raw, ['clicks', 'link_clicks', 'post_clicks', 'outbound_clicks', 'website_clicks']);
  const views = pick(raw, ['views', 'media_views', 'video_views', 'impressions', 'impression_count', 'reach']);
  const explicitInteractions = pick(raw, ['engagements', 'engagement', 'total_interactions', 'interactions']);
  const interactions = explicitInteractions || reactions + comments + shares + saves;
  const follows = pick(raw, ['follows', 'new_followers', 'subscribers_gained']);
  return { views, reactions, comments, shares, clicks, follows, interactions };
}

function normaliseMetrics(platform, raw = {}) {
  const generic = genericMetrics(raw);
  if (platform === 'facebook') {
    const views = generic.views || pick(raw, ['media_views', 'video_views', 'reach', 'impressions']);
    const reactions = generic.reactions || pick(raw, ['reactions_total']);
    const comments = generic.comments || pick(raw, ['comments']);
    const shares = generic.shares || pick(raw, ['shares']);
    const clicks = generic.clicks || pick(raw, ['post_clicks', 'link_clicks']);
    const interactions = generic.interactions || reactions + comments + shares;
    return { views, reactions, comments, shares, clicks, follows: generic.follows, interactions };
  }
  if (platform === 'instagram') {
    const reactions = generic.reactions || pick(raw, ['likes']);
    const comments = generic.comments || pick(raw, ['comments', 'replies']);
    const shares = generic.shares || pick(raw, ['shares']);
    const interactions = generic.interactions || pick(raw, ['total_interactions']) || reactions + comments + shares + pick(raw, ['saved']);
    const profileActivity = typeof raw.profile_activity === 'number' ? raw.profile_activity : 0;
    return { views: generic.views || pick(raw, ['views', 'reach', 'impressions']), reactions, comments, shares, clicks: generic.clicks || profileActivity, follows: generic.follows || pick(raw, ['follows']), interactions };
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
  return generic;
}

function metricAggregation(key) {
  return /(rate|percentage|percent|average|avg)/i.test(key) ? 'average' : 'sum';
}

function collectNumericMetrics(value, path = '', output = new Map()) {
  if (value == null) return output;
  if (typeof value === 'number' && Number.isFinite(value) && path) {
    const row = output.get(path) || { values: [], aggregation: metricAggregation(path) };
    row.values.push(value);
    output.set(path, row);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const label = item.age || item.country || item.region || item.gender || item.name || item.type || item.key || '';
        const prefix = label ? `${path}.${String(label).replace(/\s+/g, '_')}` : path;
        collectNumericMetrics(item, prefix, output);
      } else {
        collectNumericMetrics(item, path, output);
      }
    });
    return output;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      if (['age', 'country', 'region', 'gender', 'name', 'type', 'key'].includes(key) && typeof child === 'string') return;
      collectNumericMetrics(child, path ? `${path}.${key}` : key, output);
    });
  }
  return output;
}

function providerMetricSummary(posts) {
  const metrics = new Map();
  posts.forEach((post) => collectNumericMetrics(post.metrics || {}, '', metrics));
  return [...metrics.entries()].map(([key, row]) => {
    const values = row.values || [];
    const sum = values.reduce((total, value) => total + value, 0);
    const value = row.aggregation === 'average' && values.length ? sum / values.length : sum;
    return {
      key,
      value: Number(value.toFixed(4)),
      aggregation: row.aggregation,
      samples: values.length
    };
  }).sort((left, right) => left.key.localeCompare(right.key));
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

function postExternalId(profile, post) {
  return String(post.platform_post_id || post.external_post_id || post.social_post_result_id || `${profile.id}:${post.posted_at || 'unknown'}`);
}

function utcDay(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

function metricSnapshotRow(userId, profile, post, capturedAt) {
  const rawMetrics = post.metrics && typeof post.metrics === 'object' ? post.metrics : {};
  const metrics = normaliseMetrics(profile.platform, rawMetrics);
  const publishedAt = post.posted_at ? new Date(post.posted_at) : null;
  return {
    userId,
    profileId: profile.id,
    platform: profile.platform,
    externalPostId: postExternalId(profile, post),
    postPublishedAt: publishedAt && Number.isFinite(publishedAt.getTime()) ? publishedAt : null,
    capturedAt,
    views: Math.max(0, Math.round(number(metrics.views))),
    interactions: Math.max(0, Math.round(number(metrics.interactions))),
    clicks: Math.max(0, Math.round(number(metrics.clicks))),
    follows: Math.round(number(metrics.follows)),
    metricsJson: Object.keys(rawMetrics).length ? JSON.stringify(rawMetrics) : null
  };
}

async function persistMetricSnapshots(userId, profile, feed) {
  if (!feed.length) return false;
  const latest = await prisma.analyticsMetricSnapshot.findFirst({
    where: { profileId: profile.id },
    orderBy: { capturedAt: 'desc' },
    select: { capturedAt: true }
  });
  if (latest?.capturedAt && Date.now() - latest.capturedAt.getTime() < SNAPSHOT_MIN_INTERVAL_MS) return false;

  const capturedAt = new Date();
  const rows = feed.map((post) => metricSnapshotRow(userId, profile, post, capturedAt));
  if (!rows.length) return false;

  await prisma.analyticsMetricSnapshot.createMany({ data: rows });
  const retentionCutoff = new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 86400000);
  await prisma.analyticsMetricSnapshot.deleteMany({
    where: { profileId: profile.id, capturedAt: { lt: retentionCutoff } }
  });
  return true;
}

function positiveDelta(current, previous) {
  return Math.max(0, number(current) - number(previous));
}

async function buildMeasuredSeries(profile, feed, since) {
  const externalPostIds = [...new Set(feed.map((post) => postExternalId(profile, post)).filter(Boolean))];
  const empty = {
    views: new Map(),
    engagements: new Map(),
    clicks: new Map(),
    follows: new Map(),
    tracking: { mode: 'measured_snapshot_delta', startedAt: null, latestAt: null, sampledDays: 0, historicalDailyAvailable: false }
  };
  if (!externalPostIds.length) return empty;

  const querySince = new Date(since.getTime() - 2 * 86400000);
  const [snapshots, firstSnapshot, latestSnapshot] = await Promise.all([
    prisma.analyticsMetricSnapshot.findMany({
      where: {
        profileId: profile.id,
        externalPostId: { in: externalPostIds },
        capturedAt: { gte: querySince }
      },
      select: {
        externalPostId: true,
        capturedAt: true,
        views: true,
        interactions: true,
        clicks: true,
        follows: true
      },
      orderBy: [{ externalPostId: 'asc' }, { capturedAt: 'asc' }]
    }),
    prisma.analyticsMetricSnapshot.findFirst({
      where: { profileId: profile.id },
      orderBy: { capturedAt: 'asc' },
      select: { capturedAt: true }
    }),
    prisma.analyticsMetricSnapshot.findFirst({
      where: { profileId: profile.id },
      orderBy: { capturedAt: 'desc' },
      select: { capturedAt: true }
    })
  ]);

  const byPost = new Map();
  const sampledDays = new Set();
  for (const snapshot of snapshots) {
    const day = utcDay(snapshot.capturedAt);
    if (!day) continue;
    sampledDays.add(day);
    const postDays = byPost.get(snapshot.externalPostId) || new Map();
    const dayRows = postDays.get(day) || { first: snapshot, last: snapshot };
    dayRows.last = snapshot;
    postDays.set(day, dayRows);
    byPost.set(snapshot.externalPostId, postDays);
  }

  const views = new Map();
  const engagements = new Map();
  const clicks = new Map();
  const follows = new Map();
  const selectedSince = utcDay(since);

  for (const postDays of byPost.values()) {
    const rows = [...postDays.entries()].sort(([left], [right]) => left.localeCompare(right));
    let previousLast = null;
    for (const [day, bucket] of rows) {
      const baseline = previousLast || bucket.first;
      if (day >= selectedSince) {
        incrementSeries(views, day, positiveDelta(bucket.last.views, baseline.views));
        incrementSeries(engagements, day, positiveDelta(bucket.last.interactions, baseline.interactions));
        incrementSeries(clicks, day, positiveDelta(bucket.last.clicks, baseline.clicks));
        const followDelta = number(bucket.last.follows) - number(baseline.follows);
        if (followDelta) incrementSeries(follows, day, followDelta);
      }
      previousLast = bucket.last;
    }
  }

  return {
    views,
    engagements,
    clicks,
    follows,
    tracking: {
      mode: 'measured_snapshot_delta',
      startedAt: firstSnapshot?.capturedAt?.toISOString?.() || null,
      latestAt: latestSnapshot?.capturedAt?.toISOString?.() || null,
      sampledDays: sampledDays.size,
      historicalDailyAvailable: sampledDays.size >= 2
    }
  };
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
    throw Object.assign(new Error('Reconnect this account before loading analytics.'), { status: 409 });
  }
  if (expectedPlatform && String(profile.platform) !== String(expectedPlatform)) {
    throw Object.assign(new Error('The selected analytics source does not match that platform.'), { status: 400 });
  }
  return profile;
}

async function fetchFeed(profile, days, options = {}) {
  const accountId = providerAccountId(profile);
  if (!accountId) throw Object.assign(new Error('The analytics connection mapping is missing.'), { status: 409 });
  const { since } = dateRange(days);
  const rows = [];
  const seenPostIds = new Set();
  const seenCursors = new Set();
  const maxPages = Math.max(1, Math.min(FEED_HISTORY_MAX_PAGES, Number(options.feedMaxPages || FEED_HISTORY_MAX_PAGES)));
  const maxPosts = Math.max(1, Math.min(FEED_HISTORY_MAX_POSTS, Number(options.feedMaxPosts || FEED_HISTORY_MAX_POSTS)));
  let cursor = '';

  for (let page = 0; page < maxPages && rows.length < maxPosts; page += 1) {
    const params = new URLSearchParams({ limit: '100' });
    params.append('expand', 'metrics');
    if (cursor) params.set('cursor', cursor);

    const response = await postForMe.apiRequest('GET', `/social-account-feeds/${encodeURIComponent(accountId)}?${params.toString()}`);
    const items = Array.isArray(response?.data) ? response.data : [];
    for (const item of items) {
      const key = String(item?.id || item?.platform_post_id || item?.external_post_id || `${item?.posted_at || ''}:${item?.caption || ''}`);
      if (key && seenPostIds.has(key)) continue;
      if (key) seenPostIds.add(key);
      rows.push(item);
      if (rows.length >= maxPosts) break;
    }

    if (!items.length || !response?.meta?.has_more || rows.length >= maxPosts) break;

    const timestamps = items
      .map((item) => new Date(item.posted_at || 0).getTime())
      .filter((value) => Number.isFinite(value) && value > 0);
    const newest = timestamps.length ? Math.max(...timestamps) : null;

    // Account feeds are normally newest-first. Only stop at the date boundary
    // when the entire returned page is already older than the requested range.
    // A page that merely straddles the boundary can still contain valid posts.
    if (newest && newest < since.getTime()) break;

    const nextCursor = String(response?.meta?.cursor || '').trim();
    if (!nextCursor || seenCursors.has(nextCursor)) break;
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return rows;
}

async function loadPostForMeAnalytics(userId, platform, profileId, daysInput = 30, options = {}) {
  const days = safeDays(daysInput);
  const profile = await resolveProfile(userId, profileId, platform);
  const { since, until } = dateRange(days);
  const allFeed = await fetchFeed(profile, days, options);
  const feed = allFeed.filter((item) => {
    const timestamp = new Date(item.posted_at || 0).getTime();
    return Number.isFinite(timestamp) && timestamp >= since.getTime() && timestamp <= until.getTime();
  });

  const totals = { views: 0, reactions: 0, comments: 0, shares: 0, clicks: 0, follows: 0, interactions: 0 };
  let postsWithMetrics = 0;
  const content = feed.map((post) => {
    const rawMetrics = post.metrics && typeof post.metrics === 'object' ? post.metrics : {};
    const metrics = normaliseMetrics(profile.platform, rawMetrics);
    if (Object.keys(rawMetrics).length) postsWithMetrics += 1;
    for (const key of Object.keys(totals)) totals[key] += number(metrics[key]);
    return {
      id: postExternalId(profile, post),
      platform: profile.platform,
      message: String(post.caption || ''),
      createdTime: post.posted_at || null,
      permalinkUrl: post.platform_url || null,
      thumbnailUrl: mediaThumbnail(post.media),
      contentType: contentType(post),
      reactions: metrics.reactions,
      comments: metrics.comments,
      shares: metrics.shares,
      providerMetrics: rawMetrics,
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

  await persistMetricSnapshots(userId, profile, feed);
  const measuredSeries = await buildMeasuredSeries(profile, feed, since);

  const hasMetrics = postsWithMetrics > 0;
  const metricCapability = hasMetrics
    ? available(`Live post metrics returned for ${postsWithMetrics} post${postsWithMetrics === 1 ? '' : 's'}.`)
    : unavailable('Connected content was returned, but no numeric metrics are available for this source yet.', feed.length ? 'no_data' : 'no_content');
  const contentCapability = feed.length
    ? available('Live connected-account content returned successfully.')
    : unavailable('No feed posts were returned for the selected period.', 'no_data');
  const engagementRate = totals.views > 0 ? Number((totals.interactions / totals.views * 100).toFixed(2)) : null;
  const profileMeta = postForMe.parseJson(profile.metadataJson, {});
  const followerValue = number(profileMeta.followers || profileMeta.subscribers || 0);
  const metricSummary = providerMetricSummary(feed);

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
      instagramDemographics: unavailable('Separate account-level audience demographics are not available for this connection. Demographic breakdowns present inside returned post metrics are retained with the analytics item.', 'not_available'),
      metrics: Object.fromEntries(metricSummary.map((metric) => [metric.key, available(`Returned for ${metric.samples} metric sample${metric.samples === 1 ? '' : 's'}.`)]))
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
      calculationNote: 'Current totals are lifetime post metrics for content returned in the selected period. The timeline uses measured snapshot-to-snapshot changes instead of assigning lifetime totals to publish dates.'
    },
    series: {
      views: [...measuredSeries.views.entries()].map(([date, value]) => ({ date, value })),
      engagements: [...measuredSeries.engagements.entries()].map(([date, value]) => ({ date, value })),
      clicks: [...measuredSeries.clicks.entries()].map(([date, value]) => ({ date, value })),
      follows: [...measuredSeries.follows.entries()].map(([date, value]) => ({ date, value }))
    },
    tracking: {
      ...measuredSeries.tracking,
      note: measuredSeries.tracking.historicalDailyAvailable
        ? 'Daily trend values are measured changes between stored metric snapshots.'
        : 'Daily trend tracking has just started. Earlier lifetime totals cannot be placed on historical dates without fabricating when those views happened.'
    },
    demographics: { instagram: null, facebookSnapshot: null },
    content,
    warnings: hasMetrics ? [] : ['Some platforms only return analytics after provider-side processing or when a metric is available for that content type.'],
    provider: {
      engine: postForMe.PROVIDER_ENGINE,
      accountId: providerAccountId(profile),
      postsWithMetrics,
      metricSummary
    }
  };
}

async function runSnapshotSweep() {
  if (snapshotRuntimeRunning || !postForMe.configured()) return;
  snapshotRuntimeRunning = true;
  try {
    const profiles = await prisma.socialProfile.findMany({
      where: { status: 'ACTIVE', connection: { is: { status: 'ACTIVE' } } },
      include: { connection: true },
      orderBy: { updatedAt: 'desc' }
    });
    const providerProfiles = profiles.filter((profile) => {
      const connectionMeta = postForMe.parseJson(profile.connection?.metadataJson, {});
      const profileMeta = postForMe.parseJson(profile.metadataJson, {});
      return connectionMeta.providerEngine === postForMe.PROVIDER_ENGINE && profileMeta.providerEngine === postForMe.PROVIDER_ENGINE;
    });

    for (let index = 0; index < providerProfiles.length; index += 1) {
      const profile = providerProfiles[index];
      try {
        await loadPostForMeAnalytics(profile.userId, profile.platform, profile.id, 90, { feedMaxPages: 1, feedMaxPosts: 100 });
      } catch (error) {
        console.warn('[analytics-snapshot] profile refresh skipped', {
          profileId: profile.id,
          platform: profile.platform,
          status: error?.status || null,
          error: error?.message || String(error)
        });
      }
      if (index < providerProfiles.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, SNAPSHOT_RUNTIME_ACCOUNT_DELAY_MS));
      }
    }
  } catch (error) {
    console.error('[analytics-snapshot] sweep failed', { error: error?.message || String(error) });
  } finally {
    snapshotRuntimeRunning = false;
  }
}

function startAnalyticsSnapshotRuntime() {
  if (String(process.env.ANALYTICS_BACKGROUND_SNAPSHOT_ENABLED || '').toLowerCase() !== 'true') return;
  if (!postForMe.configured()) return;
  setTimeout(() => { void runSnapshotSweep(); }, 30000).unref?.();
  if (!snapshotRuntimeTimer) {
    snapshotRuntimeTimer = setInterval(() => { void runSnapshotSweep(); }, SNAPSHOT_RUNTIME_INTERVAL_MS);
    snapshotRuntimeTimer.unref?.();
  }
}

function cacheDescriptor(userId, platform, profileId, daysInput, options = {}) {
  const periodDays = safeDays(daysInput);
  const cacheVariant = String(options.cacheVariant || 'full');
  return {
    key: [String(userId), String(platform), String(profileId), String(periodDays), cacheVariant].join(':'),
    userId: String(userId),
    platform: String(platform),
    profileId: String(profileId),
    periodDays,
    cacheVariant
  };
}

function cacheUniqueWhere(descriptor) {
  return {
    userId_profileId_periodDays_cacheVariant: {
      userId: descriptor.userId,
      profileId: descriptor.profileId,
      periodDays: descriptor.periodDays,
      cacheVariant: descriptor.cacheVariant
    }
  };
}

function withCacheState(value, cacheState, warning) {
  return {
    ...value,
    warnings: warning ? [...(value.warnings || []), warning] : (value.warnings || []),
    provider: { ...(value.provider || {}), cacheState }
  };
}

function parsePersistedPayload(row) {
  if (!row?.payloadJson) return null;
  try {
    const value = JSON.parse(row.payloadJson);
    return value && typeof value === 'object' ? value : null;
  } catch (error) {
    console.warn('[analytics-cache] invalid persisted payload ignored', {
      cacheId: row.id,
      profileId: row.profileId,
      error: error?.message || String(error)
    });
    return null;
  }
}

async function readPersistedAnalyticsCache(descriptor) {
  const row = await prisma.analyticsSourceCache.findUnique({
    where: cacheUniqueWhere(descriptor)
  });
  return { row, value: parsePersistedPayload(row) };
}

async function markAnalyticsRefreshStarted(descriptor) {
  const now = new Date();
  await prisma.analyticsSourceCache.upsert({
    where: cacheUniqueWhere(descriptor),
    create: {
      userId: descriptor.userId,
      profileId: descriptor.profileId,
      platform: descriptor.platform,
      periodDays: descriptor.periodDays,
      cacheVariant: descriptor.cacheVariant,
      syncStatus: 'REFRESHING',
      refreshRequestedAt: now,
      lastAttemptAt: now
    },
    update: {
      platform: descriptor.platform,
      syncStatus: 'REFRESHING',
      refreshRequestedAt: now,
      lastAttemptAt: now,
      lastError: null
    }
  });
}

async function persistAnalyticsPayload(descriptor, value) {
  const now = new Date();
  const fetchedAt = new Date(value?.fetchedAt || now);
  const syncedAt = Number.isFinite(fetchedAt.getTime()) ? fetchedAt : now;
  await prisma.analyticsSourceCache.upsert({
    where: cacheUniqueWhere(descriptor),
    create: {
      userId: descriptor.userId,
      profileId: descriptor.profileId,
      platform: descriptor.platform,
      periodDays: descriptor.periodDays,
      cacheVariant: descriptor.cacheVariant,
      payloadJson: JSON.stringify(value),
      syncStatus: 'READY',
      syncedAt,
      lastAttemptAt: now
    },
    update: {
      platform: descriptor.platform,
      payloadJson: JSON.stringify(value),
      syncStatus: 'READY',
      syncedAt,
      refreshRequestedAt: null,
      lastAttemptAt: now,
      lastError: null
    }
  });
}

async function markAnalyticsRefreshFailed(descriptor, error) {
  await prisma.analyticsSourceCache.updateMany({
    where: {
      userId: descriptor.userId,
      profileId: descriptor.profileId,
      periodDays: descriptor.periodDays,
      cacheVariant: descriptor.cacheVariant
    },
    data: {
      syncStatus: 'ERROR',
      refreshRequestedAt: null,
      lastAttemptAt: new Date(),
      lastError: String(error?.message || error || 'Analytics refresh failed').slice(0, 1000)
    }
  });
}

function startAnalyticsRefresh(userId, platform, profileId, daysInput = 30, options = {}) {
  const descriptor = cacheDescriptor(userId, platform, profileId, daysInput, options);
  const existing = analyticsInflight.get(descriptor.key);
  if (existing) return existing;

  const task = (async () => {
    await markAnalyticsRefreshStarted(descriptor);
    try {
      const value = await loadPostForMeAnalytics(userId, platform, profileId, descriptor.periodDays, options);
      await persistAnalyticsPayload(descriptor, value);
      return withCacheState(value, 'live');
    } catch (error) {
      await markAnalyticsRefreshFailed(descriptor, error).catch(() => {});
      throw error;
    }
  })().finally(() => analyticsInflight.delete(descriptor.key));

  analyticsInflight.set(descriptor.key, task);
  return task;
}

function queueAnalyticsRefresh(userId, platform, profileId, daysInput = 30, options = {}) {
  const refresh = startAnalyticsRefresh(userId, platform, profileId, daysInput, options);
  void refresh.catch((error) => {
    console.warn('[analytics-refresh] background refresh delayed', {
      profileId: String(profileId),
      platform: String(platform),
      status: Number(error?.status || 0) || null,
      error: error?.message || String(error)
    });
  });
  return refresh;
}

async function getPostForMeAnalytics(userId, platform, profileId, daysInput = 30, options = {}) {
  const descriptor = cacheDescriptor(userId, platform, profileId, daysInput, options);
  await resolveProfile(userId, profileId, platform);

  const { row, value } = await readPersistedAnalyticsCache(descriptor);
  const referenceTime = row?.syncedAt || row?.updatedAt || null;
  const age = referenceTime ? Math.max(0, Date.now() - referenceTime.getTime()) : Infinity;
  const forceRefresh = Boolean(options.forceRefresh);

  if (value) {
    if (forceRefresh || age > ANALYTICS_CACHE_TTL_MS) {
      queueAnalyticsRefresh(userId, platform, profileId, descriptor.periodDays, options);
      const stale = age > ANALYTICS_STALE_TTL_MS;
      const veryStale = age > ANALYTICS_PERSISTED_MAX_STALE_MS;
      const warning = veryStale
        ? 'INXSocial is showing an older verified analytics snapshot while the connected platform is refreshed in the background.'
        : stale
          ? 'INXSocial is showing the most recent verified analytics snapshot while the connected platform refreshes in the background.'
          : null;
      return withCacheState(value, stale ? 'stale' : 'refreshing', warning);
    }
    return withCacheState(value, 'fresh');
  }

  const existing = analyticsInflight.get(descriptor.key);
  if (existing) return existing;

  return startAnalyticsRefresh(userId, platform, profileId, descriptor.periodDays, options);
}

async function runAnalyticsCacheRefreshSweep() {
  if (analyticsCacheRuntimeRunning || !postForMe.configured()) return;
  analyticsCacheRuntimeRunning = true;
  try {
    const refreshBefore = new Date(Date.now() - ANALYTICS_CACHE_TTL_MS);
    const retryBefore = new Date(Date.now() - ANALYTICS_CACHE_RUNTIME_RETRY_AFTER_MS);
    const rows = await prisma.analyticsSourceCache.findMany({
      where: {
        payloadJson: { not: null },
        OR: [{ syncedAt: null }, { syncedAt: { lt: refreshBefore } }],
        AND: [{
          OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: retryBefore } }]
        }]
      },
      orderBy: [{ syncedAt: 'asc' }, { updatedAt: 'asc' }],
      take: ANALYTICS_CACHE_RUNTIME_BATCH_SIZE
    });

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const options = row.cacheVariant === 'summary'
        ? { cacheVariant: 'summary', feedMaxPages: 1, feedMaxPosts: 100 }
        : { cacheVariant: row.cacheVariant || 'full' };
      try {
        await startAnalyticsRefresh(row.userId, row.platform, row.profileId, row.periodDays, options);
      } catch (error) {
        console.warn('[analytics-cache] scheduled refresh skipped', {
          cacheId: row.id,
          profileId: row.profileId,
          platform: row.platform,
          status: Number(error?.status || 0) || null,
          error: error?.message || String(error)
        });
      }
      if (index < rows.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, ANALYTICS_CACHE_RUNTIME_ACCOUNT_DELAY_MS));
      }
    }
  } catch (error) {
    console.error('[analytics-cache] refresh sweep failed', { error: error?.message || String(error) });
  } finally {
    analyticsCacheRuntimeRunning = false;
  }
}

function startAnalyticsCacheRuntime() {
  if (!postForMe.configured()) return;
  setTimeout(() => { void runAnalyticsCacheRefreshSweep(); }, 20000).unref?.();
  if (!analyticsCacheRuntimeTimer) {
    analyticsCacheRuntimeTimer = setInterval(() => { void runAnalyticsCacheRefreshSweep(); }, ANALYTICS_CACHE_RUNTIME_INTERVAL_MS);
    analyticsCacheRuntimeTimer.unref?.();
  }
}

module.exports = {
  getPostForMeAnalytics,
  normaliseMetrics,
  collectNumericMetrics,
  providerMetricSummary,
  runSnapshotSweep,
  startAnalyticsSnapshotRuntime,
  runAnalyticsCacheRefreshSweep,
  startAnalyticsCacheRuntime
};