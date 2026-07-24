'use strict';

// Unit tests use isolated non-production values. Real secrets are never needed.
process.env.JWT_SECRET ||= 'inx-social-unit-test-jwt-secret';
process.env.TOKEN_ENCRYPTION_KEY ||= 'inx-social-unit-test-token-encryption-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deleteCustomerAccount,
  removeStripeCustomerData
} = require('../src/services/accountDeletionService');

test('account deletion removes user-linked operational rows and the user', async () => {
  const calls = [];
  const tx = {
    auditLog: { deleteMany: async input => calls.push(['audit', input]) },
    emailLog: { deleteMany: async input => calls.push(['email', input]) },
    user: { delete: async input => calls.push(['user', input]) }
  };
  const prisma = {
    subscription: { findMany: async () => [] },
    metaAccount: { findMany: async () => [] },
    $transaction: async callback => callback(tx)
  };

  const result = await deleteCustomerAccount('user-1', {
    prisma,
    fetchImpl: async () => ({ ok: true })
  });

  assert.equal(result.deleted, true);
  assert.deepEqual(calls, [
    ['audit', { where: { userId: 'user-1' } }],
    ['email', { where: { userId: 'user-1' } }],
    ['user', { where: { id: 'user-1' } }]
  ]);
});

test('Stripe cancellation failure blocks local account deletion', async () => {
  const error = new Error('Stripe unavailable');
  const stripeFactory = () => ({
    subscriptions: { cancel: async () => { throw error; } },
    customers: { del: async () => ({ deleted: true }) }
  });

  await assert.rejects(
    removeStripeCustomerData([{
      provider: 'stripe',
      providerSubId: 'sub_123',
      providerCustomerId: 'cus_123'
    }], stripeFactory),
    failure => failure === error && failure.status === 502
  );
});

test('missing Stripe resources are treated as already removed', async () => {
  const missing = Object.assign(new Error('missing'), { code: 'resource_missing' });
  const stripeFactory = () => ({
    subscriptions: { cancel: async () => { throw missing; } },
    customers: { del: async () => { throw missing; } }
  });

  await removeStripeCustomerData([{
    provider: 'stripe',
    providerSubId: 'sub_missing',
    providerCustomerId: 'cus_missing'
  }], stripeFactory);
});
