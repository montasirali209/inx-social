'use strict';

process.env.JWT_SECRET ||= 'inx-social-unit-test-jwt-secret';
process.env.TOKEN_ENCRYPTION_KEY ||= 'inx-social-unit-test-token-encryption-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const { trialLifecycleState } = require('../src/services/subscriptionLifecycleService');

const NOW = new Date('2026-07-27T12:00:00.000Z');

test('trial lifecycle identifies the two-day reminder window', () => {
  assert.equal(trialLifecycleState(new Date('2026-07-29T11:00:00.000Z'), NOW), 'TWO_DAYS');
});

test('trial lifecycle identifies the one-day reminder window', () => {
  assert.equal(trialLifecycleState(new Date('2026-07-28T11:00:00.000Z'), NOW), 'ONE_DAY');
});

test('trial lifecycle expires access when the deadline passes', () => {
  assert.equal(trialLifecycleState(new Date('2026-07-27T11:59:59.000Z'), NOW), 'EXPIRED');
});
