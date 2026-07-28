'use strict';

process.env.JWT_SECRET ||= 'inx-social-unit-test-jwt-secret';
process.env.TOKEN_ENCRYPTION_KEY ||= 'inx-social-unit-test-token-encryption-key';
process.env.PAYMENT_GRACE_DAYS = '7';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  paymentGraceEnd,
  resolveGraceEnd
} = require('../src/controllers/billingController');

test('a first failed payment creates a seven-day grace period', () => {
  const now = new Date('2026-07-27T12:00:00.000Z');
  assert.equal(paymentGraceEnd(now).toISOString(), '2026-08-03T12:00:00.000Z');
});

test('later Stripe retries do not extend an existing grace deadline', () => {
  const originalDeadline = new Date('2026-08-03T12:00:00.000Z');
  const laterRetry = new Date('2026-08-02T12:00:00.000Z');
  assert.equal(resolveGraceEnd(originalDeadline, laterRetry).toISOString(), originalDeadline.toISOString());
});
