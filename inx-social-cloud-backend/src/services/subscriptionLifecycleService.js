'use strict';

const prisma = require('../db/prisma');
const emailService = require('./emailService');

const DAY_MS = 86400000;
const RUN_INTERVAL_MS = 60 * 60 * 1000;

function trialLifecycleState(trialEndsAt, now = new Date()) {
  if (!trialEndsAt) return 'NONE';
  const remaining = new Date(trialEndsAt).getTime() - now.getTime();
  if (remaining <= 0) return 'EXPIRED';
  if (remaining <= DAY_MS) return 'ONE_DAY';
  if (remaining <= 2 * DAY_MS) return 'TWO_DAYS';
  return 'ACTIVE';
}

async function sendOnce(database, user, action, sendEmail) {
  const previous = await database.auditLog.findFirst({
    where: { userId: user.id, action },
    orderBy: { createdAt: 'desc' }
  });
  if (previous) return false;

  await sendEmail();
  await database.auditLog.create({
    data: {
      userId: user.id,
      action,
      entity: 'Subscription'
    }
  });
  return true;
}

function notificationKey(prefix, value) {
  return `${prefix}:${new Date(value).toISOString()}`;
}

async function processTrialUser(database, user, now) {
  const subscription = user.subscriptions?.[0] || null;
  const provider = String(subscription?.provider || '').toLowerCase();
  const plan = String(subscription?.plan || 'TRIAL').toUpperCase();
  if ((provider && provider !== 'internal') || plan !== 'TRIAL') return;

  const state = trialLifecycleState(user.trialEndsAt, now);
  const trialKey = user.trialEndsAt || user.id;

  if (state === 'TWO_DAYS') {
    await sendOnce(
      database,
      user,
      notificationKey('TRIAL_ENDING_2_DAYS', trialKey),
      () => emailService.sendTrialEnding(user, 2)
    );
  } else if (state === 'ONE_DAY') {
    await sendOnce(
      database,
      user,
      notificationKey('TRIAL_ENDING_1_DAY', trialKey),
      () => emailService.sendTrialEnding(user, 1)
    );
  } else if (state === 'EXPIRED') {
    await database.$transaction(async tx => {
      if (subscription && String(subscription.status).toUpperCase() !== 'EXPIRED') {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' }
        });
      }
      if (!['SUSPENDED', 'DISABLED', 'REVOKED', 'EXPIRED'].includes(String(user.status || '').toUpperCase())) {
        await tx.user.update({
          where: { id: user.id },
          data: { status: 'EXPIRED' }
        });
      }
    });
    await sendOnce(
      database,
      user,
      notificationKey('TRIAL_EXPIRED', trialKey),
      () => emailService.sendTrialExpired(user)
    );
  }
}

async function runSubscriptionLifecycle(options = {}) {
  const database = options.prisma || prisma;
  const now = options.now || new Date();
  const trialUsers = await database.user.findMany({
    where: { trialEndsAt: { not: null } },
    include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });

  for (const user of trialUsers) {
    await processTrialUser(database, user, now);
  }

  const expiredGraceSubscriptions = await database.subscription.findMany({
    where: {
      provider: 'stripe',
      status: 'PAST_DUE',
      graceEndsAt: { not: null, lte: now }
    },
    include: { user: true }
  });

  for (const subscription of expiredGraceSubscriptions) {
    const user = subscription.user;
    if (!['SUSPENDED', 'DISABLED', 'REVOKED', 'EXPIRED'].includes(String(user.status || '').toUpperCase())) {
      await database.user.update({
        where: { id: user.id },
        data: { status: 'EXPIRED' }
      });
    }
    await sendOnce(
      database,
      user,
      notificationKey('PAYMENT_GRACE_EXPIRED', subscription.graceEndsAt),
      () => emailService.sendAccessRestricted(user)
    );
  }

  return {
    trialUsersChecked: trialUsers.length,
    gracePeriodsExpired: expiredGraceSubscriptions.length
  };
}

function startSubscriptionLifecycle() {
  const run = () => runSubscriptionLifecycle()
    .then(result => {
      if (result.gracePeriodsExpired) {
        console.log(`[SUBSCRIPTION LIFECYCLE] Restricted ${result.gracePeriodsExpired} expired grace-period account(s).`);
      }
    })
    .catch(error => console.error('[SUBSCRIPTION LIFECYCLE]', error));

  run();
  const timer = setInterval(run, RUN_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = {
  processTrialUser,
  runSubscriptionLifecycle,
  startSubscriptionLifecycle,
  trialLifecycleState
};
