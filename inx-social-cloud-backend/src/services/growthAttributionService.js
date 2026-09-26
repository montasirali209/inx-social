'use strict';

const prisma = require('../db/prisma');
const stripeService = require('./stripeService');

const ACTIONS = Object.freeze({
  SIGNUP: 'GROWTH_ATTRIBUTION_SIGNUP',
  TRIAL: 'GROWTH_ATTRIBUTION_TRIAL',
  PURCHASE: 'GROWTH_ATTRIBUTION_PURCHASE'
});

function cleanText(value, max = 180) {
  return String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

function safePath(value) {
  const raw = cleanText(value, 500);
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw.split('#')[0].slice(0, 500);
}

function safeHost(value) {
  const raw = cleanText(value, 180).toLowerCase();
  if (!raw) return '';
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL('https://' + raw);
    return String(url.hostname || '').toLowerCase().slice(0, 180);
  } catch (_) {
    return /^[a-z0-9.-]+$/i.test(raw) ? raw.slice(0, 180) : '';
  }
}

function sanitizeAcquisition(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const acquisition = {
    landingPath: safePath(input.landingPath || input.landing_path || '/'),
    referrerHost: safeHost(input.referrerHost || input.referrer_host || ''),
    utmSource: cleanText(input.utmSource || input.utm_source || '', 100).toLowerCase(),
    utmMedium: cleanText(input.utmMedium || input.utm_medium || '', 100).toLowerCase(),
    utmCampaign: cleanText(input.utmCampaign || input.utm_campaign || '', 140),
    utmContent: cleanText(input.utmContent || input.utm_content || '', 140),
    utmTerm: cleanText(input.utmTerm || input.utm_term || '', 140)
  };
  const hasSignal = acquisition.utmSource || acquisition.utmMedium || acquisition.utmCampaign || acquisition.referrerHost || acquisition.landingPath !== '/';
  return hasSignal ? acquisition : { ...acquisition, landingPath: acquisition.landingPath || '/' };
}

function sourceLabel(acquisition) {
  if (!acquisition) return 'direct';
  if (acquisition.utmSource) {
    return acquisition.utmMedium
      ? acquisition.utmSource + ' / ' + acquisition.utmMedium
      : acquisition.utmSource;
  }
  if (acquisition.referrerHost) return acquisition.referrerHost;
  return 'direct';
}

function parseMetadata(value) {
  if (!value) return {};
  try { return JSON.parse(value); } catch (_) { return {}; }
}

async function firstTouchForUser(userId, database = prisma) {
  const event = await database.auditLog.findFirst({
    where: { userId, action: ACTIONS.SIGNUP },
    orderBy: { createdAt: 'asc' }
  });
  return sanitizeAcquisition(parseMetadata(event?.metadata)?.acquisition || null);
}

async function recordOnce({ database = prisma, userId, action, entityId, metadata }) {
  const existing = await database.auditLog.findFirst({
    where: {
      userId: userId || null,
      action,
      ...(entityId ? { entityId: String(entityId) } : {})
    },
    orderBy: { createdAt: 'asc' }
  });
  if (existing) return { recorded: false, event: existing };

  const event = await database.auditLog.create({
    data: {
      userId: userId || null,
      action,
      entity: 'GrowthAttribution',
      entityId: entityId ? String(entityId) : (userId ? String(userId) : null),
      metadata: JSON.stringify(metadata || {})
    }
  });
  return { recorded: true, event };
}

async function recordSignup(user, acquisition, options = {}) {
  if (!user?.id) return { recorded: false };
  const clean = sanitizeAcquisition(acquisition);
  return recordOnce({
    database: options.prisma || prisma,
    userId: user.id,
    action: ACTIONS.SIGNUP,
    entityId: user.id,
    metadata: {
      acquisition: clean,
      source: sourceLabel(clean),
      occurredAt: new Date().toISOString()
    }
  });
}

async function recordTrial(userId, options = {}) {
  if (!userId) return { recorded: false };
  const database = options.prisma || prisma;
  const acquisition = await firstTouchForUser(userId, database);
  return recordOnce({
    database,
    userId,
    action: ACTIONS.TRIAL,
    entityId: userId,
    metadata: {
      acquisition,
      source: sourceLabel(acquisition),
      occurredAt: new Date().toISOString()
    }
  });
}

async function recordPurchase(userId, purchase = {}, options = {}) {
  if (!userId) return { recorded: false };
  const database = options.prisma || prisma;
  const transactionId = cleanText(purchase.transactionId || purchase.sessionId || purchase.subscriptionId || '', 180);
  if (!transactionId) return { recorded: false };
  const acquisition = await firstTouchForUser(userId, database);
  const amount = Number(purchase.amount || 0);
  const currency = cleanText(purchase.currency || 'GBP', 12).toUpperCase() || 'GBP';
  const plan = cleanText(purchase.plan || '', 40).toUpperCase();
  return recordOnce({
    database,
    userId,
    action: ACTIONS.PURCHASE,
    entityId: transactionId,
    metadata: {
      acquisition,
      source: sourceLabel(acquisition),
      transactionId,
      plan,
      amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
      currency,
      occurredAt: new Date().toISOString()
    }
  });
}

function daysAgo(days) {
  return new Date(Date.now() - Math.max(1, Number(days || 28)) * 86400000);
}

function sourceBucket(map, source) {
  const key = cleanText(source || 'direct', 220) || 'direct';
  if (!map.has(key)) {
    map.set(key, { source: key, signups: 0, trials: 0, purchases: 0, revenue: 0, currency: 'GBP' });
  }
  return map.get(key);
}

async function summary(days = 28, options = {}) {
  const database = options.prisma || prisma;
  const periodDays = Math.max(7, Math.min(365, Number(days || 28)));
  const since = daysAgo(periodDays);

  const [events, users, subscriptions] = await Promise.all([
    database.auditLog.findMany({
      where: {
        action: { in: [ACTIONS.SIGNUP, ACTIONS.TRIAL, ACTIONS.PURCHASE] },
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'asc' }
    }),
    database.user.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, status: true, emailVerifiedAt: true, trialEndsAt: true, createdAt: true }
    }),
    database.subscription.findMany({
      where: {
        provider: 'stripe',
        status: { in: ['ACTIVE', 'TRIALING'] }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const sources = new Map();
  let signups = 0;
  let trials = 0;
  let purchases = 0;
  let attributedRevenue = 0;

  for (const event of events) {
    const metadata = parseMetadata(event.metadata);
    const bucket = sourceBucket(sources, metadata.source || sourceLabel(metadata.acquisition));
    if (event.action === ACTIONS.SIGNUP) {
      signups += 1;
      bucket.signups += 1;
    } else if (event.action === ACTIONS.TRIAL) {
      trials += 1;
      bucket.trials += 1;
    } else if (event.action === ACTIONS.PURCHASE) {
      purchases += 1;
      bucket.purchases += 1;
      const amount = Number(metadata.amount || 0);
      if (Number.isFinite(amount) && amount > 0) {
        attributedRevenue += amount;
        bucket.revenue += amount;
      }
      bucket.currency = String(metadata.currency || bucket.currency || 'GBP').toUpperCase();
    }
  }

  const latestByUser = new Map();
  for (const subscription of subscriptions) {
    if (!latestByUser.has(subscription.userId)) latestByUser.set(subscription.userId, subscription);
  }
  let activePaidCustomers = 0;
  let projectedMrrGbp = 0;
  for (const subscription of latestByUser.values()) {
    const definition = stripeService.planDefinition(subscription.plan);
    if (!definition) continue;
    activePaidCustomers += 1;
    projectedMrrGbp += Number(definition.price || 0);
  }

  const verifiedUsers = users.filter(user => Boolean(user.emailVerifiedAt)).length;
  const currentTrialUsers = users.filter(user => String(user.status || '').toUpperCase() === 'TRIAL').length;
  const sourceRows = [...sources.values()]
    .map(row => ({
      ...row,
      signupToTrialRate: row.signups ? row.trials / row.signups : 0,
      trialToPaidRate: row.trials ? row.purchases / row.trials : 0
    }))
    .sort((a, b) => (b.revenue - a.revenue) || (b.purchases - a.purchases) || (b.trials - a.trials));

  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    funnel: {
      registrations: users.length,
      verified: verifiedUsers,
      currentTrials: currentTrialUsers,
      attributedSignups: signups,
      attributedTrials: trials,
      attributedPurchases: purchases,
      signupToTrialRate: signups ? trials / signups : 0,
      trialToPaidRate: trials ? purchases / trials : 0
    },
    revenue: {
      attributedRevenueGbp: Math.round(attributedRevenue * 100) / 100,
      activePaidCustomers,
      projectedMrrGbp: Math.round(projectedMrrGbp * 100) / 100,
      note: 'Projected MRR is derived from active local Stripe-plan records; attributed revenue uses recorded checkout completions.'
    },
    sources: sourceRows.slice(0, 30)
  };
}

module.exports = {
  ACTIONS,
  sanitizeAcquisition,
  sourceLabel,
  firstTouchForUser,
  recordSignup,
  recordTrial,
  recordPurchase,
  summary
};
