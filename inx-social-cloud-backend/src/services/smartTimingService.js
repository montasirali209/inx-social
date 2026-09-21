const crypto = require('node:crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');

const MAX_ITEMS = 200;
const MAX_SHIFT_MINUTES = 20;
const FALLBACK_SHIFT_MINUTES = 12;
const HISTORY_DAYS = 90;

function publicError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  return error;
}

function safeTimezone(value) {
  const timezone = String(value || 'Europe/London').trim();
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch (_) {
    return 'Europe/London';
  }
}

function parseBaselineTimes(values) {
  if (!Array.isArray(values) || !values.length) throw publicError('Smart Timing needs at least one scheduled post.');
  if (values.length > MAX_ITEMS) throw publicError(`Smart Timing can optimise up to ${MAX_ITEMS} posts in one batch.`);
  const now = Date.now();
  return values.map((value) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw publicError('Smart Timing received an invalid scheduled time.');
    if (date.getTime() <= now) throw publicError('Smart Timing can only optimise future scheduled posts.');
    return date;
  });
}

function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    weekday: map.weekday || '',
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0),
    label: `${map.weekday || ''} ${map.day || ''}/${map.month || ''} ${map.hour || '00'}:${map.minute || '00'}`
  };
}

function snapshotValue(row) {
  const views = Math.max(0, Number(row.views || 0));
  const interactions = Math.max(0, Number(row.interactions || 0));
  const clicks = Math.max(0, Number(row.clicks || 0));
  const follows = Math.max(0, Number(row.follows || 0));
  const engagementRate = views > 0 ? interactions / views : 0;
  return {
    views,
    interactions,
    clicks,
    follows,
    score: (interactions * 4) + (clicks * 3) + (follows * 6) + Math.min(20, views / 100) + (engagementRate * 100)
  };
}

async function historySummary(userId, requestedProfileIds, timezone) {
  const profileIds = [...new Set((requestedProfileIds || []).map(String).filter(Boolean))].slice(0, 50);
  if (!profileIds.length) throw publicError('Choose at least one connected destination before using Smart Timing.');

  const profiles = await prisma.socialProfile.findMany({
    where: { id: { in: profileIds }, userId, status: 'ACTIVE' },
    select: { id: true, platform: true, displayName: true }
  });
  if (!profiles.length) throw publicError('The selected destinations are no longer connected.', 404);

  const allowedIds = profiles.map((profile) => profile.id);
  const cutoff = new Date(Date.now() - HISTORY_DAYS * 86400000);
  const snapshots = await prisma.analyticsMetricSnapshot.findMany({
    where: {
      userId,
      profileId: { in: allowedIds },
      postPublishedAt: { not: null },
      capturedAt: { gte: cutoff }
    },
    select: {
      profileId: true,
      externalPostId: true,
      postPublishedAt: true,
      capturedAt: true,
      views: true,
      interactions: true,
      clicks: true,
      follows: true
    },
    orderBy: { capturedAt: 'desc' },
    take: 2000
  });

  const latestByPost = new Map();
  for (const row of snapshots) {
    const key = `${row.profileId}:${row.externalPostId}`;
    if (!latestByPost.has(key)) latestByPost.set(key, row);
  }

  const buckets = new Map();
  for (const row of latestByPost.values()) {
    if (!row.postPublishedAt) continue;
    const profile = profiles.find((item) => item.id === row.profileId);
    if (!profile) continue;
    const local = localParts(row.postPublishedAt, timezone);
    const key = `${profile.platform}|${local.weekday}|${String(local.hour).padStart(2, '0')}`;
    const current = buckets.get(key) || {
      platform: profile.platform,
      weekday: local.weekday,
      hour: local.hour,
      posts: 0,
      views: 0,
      interactions: 0,
      clicks: 0,
      follows: 0,
      score: 0
    };
    const value = snapshotValue(row);
    current.posts += 1;
    current.views += value.views;
    current.interactions += value.interactions;
    current.clicks += value.clicks;
    current.follows += value.follows;
    current.score += value.score;
    buckets.set(key, current);
  }

  const windows = [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      averageScore: bucket.posts ? Number((bucket.score / bucket.posts).toFixed(2)) : 0,
      averageViews: bucket.posts ? Math.round(bucket.views / bucket.posts) : 0,
      averageInteractions: bucket.posts ? Number((bucket.interactions / bucket.posts).toFixed(2)) : 0
    }))
    .sort((left, right) => right.averageScore - left.averageScore)
    .slice(0, 18);

  return {
    profiles,
    postsMeasured: latestByPost.size,
    windows
  };
}

function fallbackTimes(baselineTimes) {
  const now = Date.now();
  const minimumFuture = now + 2 * 60_000;
  return baselineTimes.map((baseline, index) => {
    const jitter = crypto.randomInt(-FALLBACK_SHIFT_MINUTES, FALLBACK_SHIFT_MINUTES + 1);
    let candidate = baseline.getTime() + jitter * 60_000;
    const min = baseline.getTime() - MAX_SHIFT_MINUTES * 60_000;
    const max = baseline.getTime() + MAX_SHIFT_MINUTES * 60_000;
    candidate = Math.max(min, Math.min(max, candidate));
    candidate = Math.max(candidate, minimumFuture);
    if (index > 0) {
      const prior = baselineTimes[index - 1].getTime();
      if (candidate <= prior) candidate = Math.min(max, prior + 5 * 60_000);
    }
    return new Date(candidate).toISOString();
  });
}

function parseJson(value) {
  const raw = String(value || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { return null; }
}

function validateAiTimes(values, baselineTimes) {
  if (!Array.isArray(values) || values.length !== baselineTimes.length) return null;
  const result = [];
  let previous = 0;
  for (let index = 0; index < values.length; index += 1) {
    const candidate = new Date(values[index]);
    if (!Number.isFinite(candidate.getTime())) return null;
    const baseline = baselineTimes[index].getTime();
    const delta = Math.abs(candidate.getTime() - baseline);
    if (delta > MAX_SHIFT_MINUTES * 60_000) return null;
    if (candidate.getTime() <= Date.now() + 60_000) return null;
    if (previous && candidate.getTime() <= previous) return null;
    previous = candidate.getTime();
    result.push(candidate.toISOString());
  }
  return result;
}

async function aiTimes(baselineTimes, timezone, history) {
  const config = env.postEnhancement || {};
  if (!config.apiKey || !config.baseUrl) return null;
  const model = String(process.env.SMART_TIMING_MODEL || process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || config.model || 'gpt-4o-mini').trim();
  const baseline = baselineTimes.map((date, index) => {
    const local = localParts(date, timezone);
    return { index, iso: date.toISOString(), local: local.label };
  });
  const evidence = {
    timezone,
    destinations: history.profiles.map((profile) => ({ platform: profile.platform, name: profile.displayName })),
    measuredPosts: history.postsMeasured,
    strongestHistoricalWindows: history.windows,
    baseline
  };
  const system = [
    'You are INX Social Smart Timing.',
    'Choose the exact publishing timestamp for every supplied baseline slot.',
    `Each chosen timestamp MUST stay within plus or minus ${MAX_SHIFT_MINUTES} minutes of its own baseline.`,
    'Preserve item order. Never move a post to another day unless the allowed minute window itself crosses midnight.',
    'Use account-specific historical performance when evidence exists. Otherwise make small natural variations suitable for the listed social platforms.',
    'Do not bunch posts together. Do not change the number of items.',
    'Return JSON only: {"times":["ISO-8601 UTC timestamp"],"reason":"one short sentence"}.'
  ].join('\n');

  const response = await axios.post(`${String(config.baseUrl).replace(/\/$/, '')}/chat/completions`, {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(evidence) }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.25,
    max_completion_tokens: 1800
  }, {
    timeout: Math.min(90000, Number(config.timeoutMs || 60000)),
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    maxContentLength: 4 * 1024 * 1024,
    maxBodyLength: 4 * 1024 * 1024
  });

  const parsed = parseJson(response.data?.choices?.[0]?.message?.content);
  if (!parsed) return null;
  const times = validateAiTimes(parsed.times, baselineTimes);
  if (!times) return null;
  return {
    times,
    reason: String(parsed.reason || 'Times were adjusted using Smart Timing.').trim().slice(0, 300)
  };
}

async function optimiseSmartTiming(userId, input = {}) {
  const baselineTimes = parseBaselineTimes(input.baselineTimes);
  const timezone = safeTimezone(input.timezone);
  const history = await historySummary(userId, input.profileIds, timezone);
  const fallback = fallbackTimes(baselineTimes);

  try {
    const ai = await aiTimes(baselineTimes, timezone, history);
    if (ai) {
      return {
        times: ai.times,
        source: 'ai',
        reason: ai.reason,
        historyPosts: history.postsMeasured,
        maxShiftMinutes: MAX_SHIFT_MINUTES
      };
    }
  } catch (error) {
    console.warn('[smart-timing] AI optimisation fell back safely', {
      status: Number(error?.response?.status || error?.status || 0) || null,
      error: error?.message || String(error)
    });
  }

  return {
    times: fallback,
    source: 'fallback',
    reason: history.postsMeasured
      ? 'Smart Timing used your existing performance data with safe timing variation because the AI timing service was unavailable.'
      : 'Smart Timing used safe timing variation while this account builds enough performance history.',
    historyPosts: history.postsMeasured,
    maxShiftMinutes: MAX_SHIFT_MINUTES
  };
}

module.exports = {
  MAX_SHIFT_MINUTES,
  optimiseSmartTiming,
  validateAiTimes
};
