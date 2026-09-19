const assert = require('node:assert/strict');
const test = require('node:test');

const prismaPath = require.resolve('../src/db/prisma');
let stored = null;
const prisma = {
  appSetting: {
    findUnique: async () => stored ? { value: JSON.stringify(stored) } : null,
    upsert: async input => {
      stored = JSON.parse(input.update.value);
      return { key: input.where.key, value: input.update.value };
    }
  }
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const policy = require('../src/services/aiStudioPolicyService');

test('AI Content Studio policy defaults to enabled for Trial, paid and administrator access', async () => {
  stored = null;
  assert.deepEqual(await policy.getPolicy(), {
    enabled: true,
    trialEnabled: true,
    paidEnabled: true,
    administratorEnabled: true
  });
});

test('global and audience switches are enforced independently', async () => {
  const configured = policy.normalizePolicy({ enabled: true, trialEnabled: false, paidEnabled: true, administratorEnabled: false });
  assert.equal(policy.permits(configured, { plan: 'trial', administrator: false }), false);
  assert.equal(policy.permits(configured, { plan: 'pro', administrator: false }), true);
  assert.equal(policy.permits(configured, { plan: 'agency', administrator: true }), false);
  assert.equal(policy.permits({ ...configured, enabled: false }, { plan: 'pro', administrator: false }), false);
});
