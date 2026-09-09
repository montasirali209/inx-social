const prisma = require('../db/prisma');

function isTrialActive(user, now = new Date()) {
  return Boolean(user.trialEndsAt && new Date(user.trialEndsAt).getTime() > now.getTime());
}

function getPlanLimits(plan) {
  const limits = {
    TRIAL: { pages: 2, batchPosts: null, postsPerDay: null, devices: 1, schedulingWindowDays: 30 },
    STARTER: { pages: null, batchPosts: null, postsPerDay: null, devices: 1, schedulingWindowDays: null },
    PRO: { pages: null, batchPosts: null, postsPerDay: null, devices: 3, schedulingWindowDays: null },
    PLUS: { pages: null, batchPosts: null, postsPerDay: null, devices: 3, schedulingWindowDays: null },
    LIFETIME: { pages: null, batchPosts: null, postsPerDay: null, devices: 3, schedulingWindowDays: null }
  };
  return limits[String(plan || 'TRIAL').toUpperCase()] || limits.TRIAL;
}

function evaluateLicense(user, sub, now = new Date()) {
  const trialActive = isTrialActive(user, now);
  const subscriptionStatus = String(sub?.status || '').toUpperCase();
  const provider = String(sub?.provider || '').toLowerCase();
  const plan = String(sub?.plan || 'TRIAL').toUpperCase();
  const internalTrial = (!provider || provider === 'internal') && plan === 'TRIAL';
  const stripeActive = provider === 'stripe' && ['ACTIVE', 'TRIALING'].includes(subscriptionStatus);
  const graceActive = provider === 'stripe' &&
    subscriptionStatus === 'PAST_DUE' &&
    sub?.graceEndsAt &&
    new Date(sub.graceEndsAt).getTime() > now.getTime();
  const manualActive = (provider === 'manual' || !provider) &&
    ['ACTIVE', 'MANUAL'].includes(subscriptionStatus) &&
    plan !== 'TRIAL';
  const accountEnabled = !['SUSPENDED', 'DISABLED', 'REVOKED'].includes(String(user.status || '').toUpperCase());
  const administrator = ['ADMIN', 'SUPER_ADMIN'].includes(String(user.role || '').toUpperCase());
  let effectiveStatus = subscriptionStatus || (trialActive ? 'TRIALING' : 'EXPIRED');

  if (internalTrial) effectiveStatus = trialActive ? 'TRIALING' : 'EXPIRED';
  else if (graceActive) effectiveStatus = 'GRACE_PERIOD';

  return {
    allowed: Boolean(accountEnabled && (administrator || (internalTrial && trialActive) || stripeActive || graceActive || manualActive)),
    status: user.status,
    plan,
    subscriptionStatus: effectiveStatus,
    provider: sub?.provider || null,
    userRole: user.role || 'USER',
    trialEndsAt: user.trialEndsAt,
    currentPeriodStart: sub?.currentPeriodStart || null,
    currentPeriodEnd: sub?.currentPeriodEnd || null,
    graceEndsAt: sub?.graceEndsAt || null,
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    limits: getPlanLimits(plan)
  };
}

async function getLicenseStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });
  if (!user) throw new Error('User not found');

  return evaluateLicense(user, user.subscriptions[0] || null);
}

module.exports = { evaluateLicense, getLicenseStatus, getPlanLimits, isTrialActive };
