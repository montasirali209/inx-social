const prisma = require('../db/prisma');

function isTrialActive(user) {
  return user.trialEndsAt && new Date(user.trialEndsAt).getTime() > Date.now();
}

function getPlanLimits(plan) {
  const limits = {
    TRIAL: { pages: 1, batchPosts: 25, postsPerDay: 25, devices: 1 },
    STARTER: { pages: 10, batchPosts: 100, postsPerDay: 100, devices: 1 },
    PRO: { pages: 50, batchPosts: null, postsPerDay: null, devices: 3 },
    LIFETIME: { pages: 10, batchPosts: null, postsPerDay: null, devices: 2 }
  };
  return limits[String(plan || 'TRIAL').toUpperCase()] || limits.TRIAL;
}

async function getLicenseStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });
  if (!user) throw new Error('User not found');

  const sub = user.subscriptions[0] || null;
  const trialActive = isTrialActive(user);
  const subscriptionStatus = String(sub?.status || '').toUpperCase();
  const paidActive = ['ACTIVE', 'TRIALING', 'MANUAL'].includes(subscriptionStatus);
  const accountEnabled = !['SUSPENDED', 'DISABLED', 'REVOKED'].includes(String(user.status || '').toUpperCase());
  const plan = String(sub?.plan || 'TRIAL').toUpperCase();

  return {
    allowed: Boolean(accountEnabled && (trialActive || paidActive || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')),
    status: user.status,
    plan,
    subscriptionStatus: sub?.status || (trialActive ? 'TRIALING' : 'EXPIRED'),
    provider: sub?.provider || null,
    trialEndsAt: user.trialEndsAt,
    currentPeriodEnd: sub?.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    limits: getPlanLimits(plan)
  };
}

module.exports = { getLicenseStatus, getPlanLimits };
