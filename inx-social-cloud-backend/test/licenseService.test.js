'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateLicense } = require('../src/services/licenseService');

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
