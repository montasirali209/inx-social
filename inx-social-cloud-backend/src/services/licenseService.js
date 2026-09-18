const prisma = require('../db/prisma');

function isTrialActive(user, now = new Date()) {
  return Boolean(user.trialEndsAt && new Date(user.trialEndsAt).getTime() > now.getTime());
}

function getPlanLimits(plan) {
  const limits = {
    TRIAL: { pages: 2, batchPosts: null, postsPerDay: null, publishedPostsPerTrial: 50, devices: 1, schedulingWindowDays: null },
    CREATOR: { pages: 5, batchPosts: null, postsPerDay: null, publishedPostsPerTrial: null, devices: 1, schedulingWindowDays: null },
    PRO: { pages: 12, batchPosts: null, postsPerDay: null, publishedPostsPerTrial: null, devices: 3, schedulingWindowDays: null },
    BUSINESS: { pages: 25, batchPosts: null, postsPerDay: null, publishedPostsPerTrial: null, devices: 5, schedulingWindowDays: null },
    AGENCY: { pages: 50, batchPosts: null, postsPerDay: null, publishedPostsPerTrial: null, devices: 10, schedulingWindowDays: null },
    STARTER: { pages: 5, batchPosts: null, postsPerDay: null, publishedPostsPerTrial: null, devices: 1, schedulingWindowDays: null },
    PLUS: { pages: 12, batchPosts: null, postsPerDay: null, publishedPostsPerTrial: null, devices: 3, schedulingWindowDays: null },
    LIFETIME: { pages: 12, batchPosts: null, postsPerDay: null, publishedPostsPerTrial: null, devices: 3, schedulingWindowDays: null }
  };
  return limits[String(plan || 'TRIAL').toUpperCase()] || limits.TRIAL;
}

function isActiveAdminOverride(sub, now = new Date()) {
  if (String(sub?.provider || '').toLowerCase() !== 'admin_override') return false;
  if (!['ACTIVE', 'MANUAL'].includes(String(sub?.status || '').toUpperCase())) return false;
  return !sub?.currentPeriodEnd || new Date(sub.currentPeriodEnd).getTime() > now.getTime();
}

function selectEffectiveSubscription(subscriptions = [], now = new Date()) {
  const activeOverride = subscriptions.find(sub => isActiveAdminOverride(sub, now));
  if (activeOverride) return { subscription: activeOverride, override: activeOverride };
  const subscription = subscriptions.find(sub => String(sub?.provider || '').toLowerCase() !== 'admin_override') || null;
  return { subscription, override: null };
}

function evaluateLicense(user, sub, now = new Date(), override = null) {
  const trialActive = isTrialActive(user, now);
  const subscriptionStatus = String(sub?.status || '').toUpperCase();
  const provider = String(sub?.provider || '').toLowerCase();
  const sourcePlan = String(sub?.plan || 'TRIAL').toUpperCase();
  const administrator = ['ADMIN', 'SUPER_ADMIN'].includes(String(user.role || '').toUpperCase());
  const plan = administrator ? 'AGENCY' : sourcePlan;
  const internalTrial = (!provider || provider === 'internal') && sourcePlan === 'TRIAL';
  const stripeActive = provider === 'stripe' && ['ACTIVE', 'TRIALING'].includes(subscriptionStatus);
  const graceActive = provider === 'stripe' &&
    subscriptionStatus === 'PAST_DUE' &&
    sub?.graceEndsAt &&
    new Date(sub.graceEndsAt).getTime() > now.getTime();
  const manualActive = ['manual', 'admin_override'].includes(provider) &&
    ['ACTIVE', 'MANUAL'].includes(subscriptionStatus) &&
    sourcePlan !== 'TRIAL' &&
    (!sub?.currentPeriodEnd || new Date(sub.currentPeriodEnd).getTime() > now.getTime());
  const accountEnabled = !['SUSPENDED', 'DISABLED', 'REVOKED'].includes(String(user.status || '').toUpperCase());
  let effectiveStatus = subscriptionStatus || (trialActive ? 'TRIALING' : 'EXPIRED');

  if (administrator) effectiveStatus = 'MANUAL';
  else if (internalTrial) effectiveStatus = trialActive ? 'TRIALING' : 'EXPIRED';
  else if (graceActive) effectiveStatus = 'GRACE_PERIOD';

  const limits = administrator
    ? { ...getPlanLimits('AGENCY'), pages: null, devices: null }
    : getPlanLimits(plan);

  return {
    allowed: Boolean(accountEnabled && (administrator || (internalTrial && trialActive) || stripeActive || graceActive || manualActive)),
    status: user.status,
    plan,
    sourcePlan,
    subscriptionStatus: effectiveStatus,
    provider: administrator ? 'admin' : (sub?.provider || null),
    userRole: user.role || 'USER',
    administrator,
    manualOverride: Boolean(override),
    overrideId: override?.id || null,
    overrideExpiresAt: override?.currentPeriodEnd || null,
    trialEndsAt: user.trialEndsAt,
    trialStartsAt: user.createdAt || null,
    currentPeriodStart: sub?.currentPeriodStart || null,
    currentPeriodEnd: sub?.currentPeriodEnd || null,
    graceEndsAt: sub?.graceEndsAt || null,
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    limits
  };
}

async function getLicenseStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 20 } }
  });
  if (!user) throw new Error('User not found');

  const { subscription, override } = selectEffectiveSubscription(user.subscriptions || []);
  return evaluateLicense(user, subscription, new Date(), override);
}

module.exports = { evaluateLicense, getLicenseStatus, getPlanLimits, isTrialActive, isActiveAdminOverride, selectEffectiveSubscription };
