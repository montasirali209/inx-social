'use strict';

const prisma = require('../db/prisma');
const googleAnalytics = require('./googleAnalyticsService');
const googleSearchConsole = require('./googleSearchConsoleService');
const attribution = require('./growthAttributionService');
const autopilot = require('./growthAutopilotService');
const seo = require('./growthSeoMaintenanceService');
const authority = require('./growthAuthorityService');
const optimization = require('./growthOptimizationService');
const content = require('./growthContentService');

const FAST_TTL_MS = 25 * 1000;
const SLOW_TTL_MS = 5 * 60 * 1000;

let fastCache = { at: 0, value: null };
let slowCache = { at: 0, value: null };

const nowIso = () => new Date().toISOString();
const n = value => Number(value || 0);
const rate = (value, base) => base > 0 ? value / base : 0;
const pct = (value, base) => Math.round(rate(value, base) * 1000) / 10;

function safeJson(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
}

function settledValue(result, fallback = null) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function warning(label, result) {
  if (result.status === 'fulfilled') return null;
  return label + ': ' + String(result.reason?.publicMessage || result.reason?.message || result.reason || 'unavailable').slice(0, 280);
}

function eventCount(performance, names) {
  const wanted = new Set(names);
  return (performance?.events || []).reduce((sum, row) => wanted.has(String(row.eventName || '')) ? sum + n(row.eventCount) : sum, 0);
}

function buildActivity({ autopilotStatus, emailLogs, auditLogs, articles }) {
  const rows = [];
  for (const event of (autopilotStatus?.state?.recentEvents || []).slice(0, 20)) {
    rows.push({
      at: event.at || null,
      type: String(event.type || 'AUTOPILOT'),
      level: String(event.level || 'info'),
      title: String(event.message || event.type || 'Growth Autopilot event').slice(0, 220),
      source: 'Growth Autopilot'
    });
  }
  for (const email of emailLogs || []) {
    rows.push({
      at: email.createdAt,
      type: email.status === 'SENT' ? 'OUTREACH_SENT' : 'OUTREACH_' + String(email.status || 'EVENT'),
      level: email.status === 'FAILED' ? 'warning' : 'success',
      title: email.status === 'SENT'
        ? 'Authority outreach sent: ' + String(email.subject || 'INXSocial outreach').slice(0, 150)
        : 'Authority outreach ' + String(email.status || '').toLowerCase() + ': ' + String(email.subject || '').slice(0, 150),
      source: 'Authority Email'
    });
  }
  for (const log of auditLogs || []) {
    const meta = safeJson(log.metadata, {});
    let title = String(log.action || 'Growth event').replaceAll('_', ' ');
    if (log.action === 'GROWTH_ATTRIBUTION_SIGNUP') title = 'New attributed signup';
    if (log.action === 'GROWTH_ATTRIBUTION_TRIAL') title = 'Trial started';
    if (log.action === 'GROWTH_ATTRIBUTION_PURCHASE') title = 'Paid conversion' + (meta.plan ? ' · ' + meta.plan : '');
    rows.push({
      at: log.createdAt,
      type: log.action,
      level: /FAILED|ERROR/.test(log.action) ? 'warning' : 'success',
      title,
      source: 'Conversion'
    });
  }
  for (const article of (articles || []).slice(0, 5)) {
    if (!article.published_at) continue;
    rows.push({
      at: article.published_at,
      type: 'CONTENT_PUBLISHED',
      level: 'success',
      title: 'Published: ' + String(article.title || article.slug || 'Growth article').slice(0, 180),
      source: 'Content Engine'
    });
  }
  return rows
    .filter(row => row.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 30);
}

async function loadFast() {
  const now = Date.now();
  if (fastCache.value && now - fastCache.at < FAST_TTL_MS) return fastCache.value;

  const [realtimeResult, todayResult, todayAttributionResult] = await Promise.allSettled([
    googleAnalytics.realtime(),
    googleAnalytics.performance(1),
    attribution.summary(1)
  ]);

  const realtime = settledValue(realtimeResult);
  const today = settledValue(todayResult);
  const todayAttribution = settledValue(todayAttributionResult);

  const sessions = n(today?.summary?.sessions);
  const activeUsers = n(today?.summary?.activeUsers);
  const ctaClicks = eventCount(today, ['cta_click', 'begin_checkout', 'select_plan', 'pricing_cta_click']);
  const checkoutStarts = eventCount(today, ['begin_checkout']);
  const gaPurchases = eventCount(today, ['purchase']);
  const registrations = n(todayAttribution?.funnel?.registrations);
  const trials = n(todayAttribution?.funnel?.attributedTrials);
  const purchases = n(todayAttribution?.funnel?.attributedPurchases);

  const value = {
    generatedAt: nowIso(),
    live: {
      windowMinutes: n(realtime?.windowMinutes || 30),
      activeUsers: n(realtime?.summary?.activeUsers),
      views: n(realtime?.summary?.screenPageViews),
      events: n(realtime?.summary?.eventCount),
      keyEvents: n(realtime?.summary?.keyEvents),
      pages: (realtime?.pages || []).slice(0, 8),
      countries: (realtime?.countries || []).slice(0, 8),
      devices: (realtime?.devices || []).slice(0, 6),
      eventsTop: (realtime?.events || []).slice(0, 12)
    },
    today: {
      activeUsers,
      sessions,
      views: n(today?.summary?.screenPageViews),
      keyEvents: n(today?.summary?.keyEvents),
      gaRevenue: n(today?.summary?.totalRevenue),
      ctaClicks,
      checkoutStarts,
      gaPurchases,
      registrations,
      trials,
      purchases,
      attributedRevenueGbp: n(todayAttribution?.revenue?.attributedRevenueGbp),
      rates: {
        visitorToCtaPercent: pct(ctaClicks, sessions),
        visitorToSignupPercent: pct(registrations, sessions),
        signupToTrialPercent: pct(trials, registrations),
        trialToPaidPercent: pct(purchases, trials),
        visitorToPaidPercent: pct(purchases, sessions)
      }
    },
    warnings: [
      warning('GA4 realtime', realtimeResult),
      warning('GA4 today', todayResult),
      warning('Today attribution', todayAttributionResult)
    ].filter(Boolean)
  };

  fastCache = { at: now, value };
  return value;
}

async function loadSlow() {
  const now = Date.now();
  if (slowCache.value && now - slowCache.at < SLOW_TTL_MS) return slowCache.value;

  const [
    weekAnalyticsResult,
    monthAttributionResult,
    searchResult,
    autopilotResult,
    seoResult,
    authorityResult,
    optimizationResult,
    articlesResult,
    emailResult,
    auditResult
  ] = await Promise.allSettled([
    googleAnalytics.performance(7),
    attribution.summary(30),
    googleSearchConsole.growthPerformance(28),
    autopilot.status(),
    seo.status(),
    authority.status(),
    optimization.status(),
    content.listArticles({ publishedOnly: true }),
    prisma.emailLog.findMany({
      where: { type: 'AUTHORITY_OUTREACH', createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      orderBy: { createdAt: 'desc' },
      take: 20
    }),
    prisma.auditLog.findMany({
      where: {
        action: { in: ['GROWTH_ATTRIBUTION_SIGNUP', 'GROWTH_ATTRIBUTION_TRIAL', 'GROWTH_ATTRIBUTION_PURCHASE'] },
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 30
    })
  ]);

  const weekAnalytics = settledValue(weekAnalyticsResult);
  const monthAttribution = settledValue(monthAttributionResult);
  const search = settledValue(searchResult);
  const autopilotStatus = settledValue(autopilotResult);
  const seoStatus = settledValue(seoResult);
  const authorityStatus = settledValue(authorityResult);
  const optimizationStatus = settledValue(optimizationResult);
  const articles = settledValue(articlesResult, []);
  const emailLogs = settledValue(emailResult, []);
  const auditLogs = settledValue(auditResult, []);

  const sentEmails = emailLogs.filter(item => item.status === 'SENT').length;
  const failedEmails = emailLogs.filter(item => item.status === 'FAILED').length;

  const value = {
    generatedAt: nowIso(),
    week: {
      activeUsers: n(weekAnalytics?.summary?.activeUsers),
      sessions: n(weekAnalytics?.summary?.sessions),
      views: n(weekAnalytics?.summary?.screenPageViews),
      keyEvents: n(weekAnalytics?.summary?.keyEvents),
      revenue: n(weekAnalytics?.summary?.totalRevenue),
      comparison: weekAnalytics?.comparison || {},
      daily: (weekAnalytics?.daily || []).slice(-7),
      landingPages: (weekAnalytics?.landingPages || []).slice(0, 10),
      channels: (weekAnalytics?.channels || []).slice(0, 10),
      acquisitionSources: (weekAnalytics?.acquisitionSources || []).slice(0, 10)
    },
    revenue: monthAttribution?.revenue || null,
    funnel30d: monthAttribution?.funnel || null,
    sources: (monthAttribution?.sources || []).slice(0, 10),
    search: search ? {
      generatedAt: search.generatedAt,
      siteUrl: search.siteUrl,
      summary: search.summary,
      comparison: search.comparison,
      topQueries: (search.topQueries || []).slice(0, 10),
      topPages: (search.topPages || []).slice(0, 10)
    } : null,
    autopilot: autopilotStatus ? {
      config: autopilotStatus.config,
      state: autopilotStatus.state,
      content: autopilotStatus.content,
      providers: autopilotStatus.providers
    } : null,
    seo: seoStatus,
    authority: authorityStatus ? {
      generatedAt: authorityStatus.generatedAt,
      stats: authorityStatus.stats,
      provider: authorityStatus.provider,
      warnings: authorityStatus.warnings || []
    } : null,
    optimization: optimizationStatus ? {
      generatedAt: optimizationStatus.generatedAt,
      stats: optimizationStatus.stats,
      funnel: optimizationStatus.funnel,
      revenue: optimizationStatus.revenue,
      warnings: optimizationStatus.warnings || []
    } : null,
    content: {
      published: articles.length,
      latest: articles.slice(0, 8).map(article => ({
        id: article.id,
        title: article.title,
        slug: article.slug,
        publishedAt: article.published_at,
        qualityScore: article.quality?.score || null
      }))
    },
    outreach: {
      sent30d: sentEmails,
      failed30d: failedEmails,
      aiApprovedOpen: n(authorityStatus?.stats?.aiApproved),
      opportunitiesOpen: n(authorityStatus?.stats?.total)
    },
    activity: buildActivity({ autopilotStatus, emailLogs, auditLogs, articles }),
    warnings: [
      warning('GA4 7-day', weekAnalyticsResult),
      warning('30-day attribution', monthAttributionResult),
      warning('Search Console', searchResult),
      warning('Growth Autopilot', autopilotResult),
      warning('SEO', seoResult),
      warning('Authority', authorityResult),
      warning('Optimisation', optimizationResult),
      warning('Content', articlesResult)
    ].filter(Boolean)
  };

  slowCache = { at: now, value };
  return value;
}

async function snapshot(options = {}) {
  if (options.force) {
    fastCache = { at: 0, value: null };
    slowCache = { at: 0, value: null };
  }
  const [fast, slow] = await Promise.all([loadFast(), loadSlow()]);
  return {
    refreshSeconds: 30,
    freshness: {
      realtime: fast.generatedAt,
      business: slow.generatedAt,
      search: slow.search?.generatedAt || null
    },
    ...fast,
    ...slow,
    generatedAt: nowIso(),
    warnings: [...new Set([...(fast.warnings || []), ...(slow.warnings || [])])]
  };
}

module.exports = { snapshot, loadFast, loadSlow };
