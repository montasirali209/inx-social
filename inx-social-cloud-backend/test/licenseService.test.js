'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateLicense, getPlanLimits, selectEffectiveSubscription } = require('../src/services/licenseService');

const NOW = new Date('2026-07-27T12:00:00.000Z');

function user(overrides = {}) {
  return {
    id: 'user-1',
    role: 'USER',
    status: 'ACTIVE',
    trialEndsAt: new Date('2026-08-01T12:00:00.000Z'),
    ...overrides
  };
}

function subscription(overrides = {}) {
  return {
    plan: 'TRIAL',
    status: 'TRIALING',
    provider: 'internal',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    graceEndsAt: null,
    ...overrides
  };
}

test('an active internal trial allows publishing', () => {
  const result = evaluateLicense(user(), subscription(), NOW);
  assert.equal(result.allowed, true);
  assert.equal(result.subscriptionStatus, 'TRIALING');
});

test('an expired internal TRIALING record cannot keep publishing access alive', () => {
  const result = evaluateLicense(
    user({ trialEndsAt: new Date('2026-07-26T12:00:00.000Z') }),
    subscription(),
    NOW
  );
  assert.equal(result.allowed, false);
  assert.equal(result.subscriptionStatus, 'EXPIRED');
});

test('an active Stripe subscription allows publishing', () => {
  const result = evaluateLicense(
    user({ trialEndsAt: new Date('2026-07-01T12:00:00.000Z') }),
    subscription({ provider: 'stripe', plan: 'STARTER', status: 'ACTIVE' }),
    NOW
  );
  assert.equal(result.allowed, true);
  assert.equal(result.subscriptionStatus, 'ACTIVE');
});

test('a past-due Stripe subscription remains active inside its grace period', () => {
  const result = evaluateLicense(
    user({ status: 'PAYMENT_DUE', trialEndsAt: null }),
    subscription({
      provider: 'stripe',
      plan: 'PRO',
      status: 'PAST_DUE',
      graceEndsAt: new Date('2026-07-30T12:00:00.000Z')
    }),
    NOW
  );
  assert.equal(result.allowed, true);
  assert.equal(result.subscriptionStatus, 'GRACE_PERIOD');
});

test('a past-due Stripe subscription is blocked after its grace period', () => {
  const result = evaluateLicense(
    user({ status: 'PAYMENT_DUE', trialEndsAt: null }),
    subscription({
      provider: 'stripe',
      plan: 'PRO',
      status: 'PAST_DUE',
      graceEndsAt: new Date('2026-07-26T12:00:00.000Z')
    }),
    NOW
  );
  assert.equal(result.allowed, false);
  assert.equal(result.subscriptionStatus, 'PAST_DUE');
});

test('manual lifetime access remains valid', () => {
  const result = evaluateLicense(
    user({ trialEndsAt: null }),
    subscription({ provider: 'manual', plan: 'LIFETIME', status: 'MANUAL' }),
    NOW
  );
  assert.equal(result.allowed, true);
});

test('new billing plans enforce connected-account and Trial publishing limits', () => {
  assert.equal(getPlanLimits('TRIAL').pages, 2);
  assert.equal(getPlanLimits('TRIAL').publishedPostsPerTrial, 50);
  assert.equal(getPlanLimits('TRIAL').schedulingWindowDays, null);
  assert.equal(getPlanLimits('CREATOR').pages, 5);
  assert.equal(getPlanLimits('PRO').pages, 12);
  assert.equal(getPlanLimits('BUSINESS').pages, 25);
  assert.equal(getPlanLimits('AGENCY').pages, 50);
});


test('active administrator override wins over an underlying Stripe subscription', () => {
  const override = subscription({
    provider: 'admin_override',
    plan: 'BUSINESS',
    status: 'MANUAL',
    currentPeriodEnd: new Date('2026-08-27T12:00:00.000Z')
  });
  const stripe = subscription({ provider: 'stripe', plan: 'CREATOR', status: 'ACTIVE' });
  const selected = selectEffectiveSubscription([override, stripe], NOW);
  assert.equal(selected.subscription.plan, 'BUSINESS');
  assert.equal(selected.override.plan, 'BUSINESS');
});

test('expired administrator override falls back to normal billing', () => {
  const override = subscription({
    provider: 'admin_override',
    plan: 'AGENCY',
    status: 'MANUAL',
    currentPeriodEnd: new Date('2026-07-26T12:00:00.000Z')
  });
  const stripe = subscription({ provider: 'stripe', plan: 'PRO', status: 'ACTIVE' });
  const selected = selectEffectiveSubscription([override, stripe], NOW);
  assert.equal(selected.subscription.plan, 'PRO');
  assert.equal(selected.override, null);
});

test('administrator accounts receive explicit Agency-equivalent access without customer limits', () => {
  const result = evaluateLicense(
    user({ role: 'ADMIN', trialEndsAt: null }),
    subscription({ provider: 'stripe', plan: 'PRO', status: 'ACTIVE' }),
    NOW
  );
  assert.equal(result.allowed, true);
  assert.equal(result.administrator, true);
  assert.equal(result.plan, 'AGENCY');
  assert.equal(result.sourcePlan, 'PRO');
  assert.equal(result.provider, 'admin');
  assert.equal(result.limits.pages, null);
});
