const assert = require('node:assert/strict');
const test = require('node:test');

const prismaPath = require.resolve('../src/db/prisma');
const licensePath = require.resolve('../src/services/licenseService');
let storedPolicy = null;
let used = 0;
let license = { allowed: true, plan: 'PRO', userRole: 'USER', currentPeriodStart: new Date('2026-08-01T00:00:00Z'), currentPeriodEnd: new Date('2026-09-01T00:00:00Z') };
const prisma = {
  appSetting: {
    findUnique: async () => storedPolicy ? { value: JSON.stringify(storedPolicy) } : null,
    upsert: async input => { storedPolicy = JSON.parse(input.update.value); return { key: input.where.key, value: input.update.value }; }
  },
  agentPlan: { count: async () => used }
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
require.cache[licensePath] = { id: licensePath, filename: licensePath, loaded: true, exports: { getLicenseStatus: async () => license } };
const access = require('../src/services/agentAccessService');

test('Social Agent defaults to administrator-only access with current plan limits', async () => {
  storedPolicy = null;
  const policy = await access.getPolicy();
  assert.equal(policy.availability, 'ADMIN_ONLY');
  assert.equal(policy.planLimits.TRIAL, 1);
  assert.equal(policy.planLimits.CREATOR, 25);
  assert.equal(policy.planLimits.PRO, 100);
  assert.equal(policy.planLimits.BUSINESS, 250);
  assert.equal(policy.planLimits.AGENCY, 500);
});

test('regular subscribers can be enabled for paid plans or everyone', async () => {
  storedPolicy = { availability: 'ADMIN_ONLY', planLimits: { PRO: 100 } };
  used = 7;
  license = { ...license, userRole: 'USER', plan: 'PRO' };
  const hidden = await access.getEntitlement('user-1');
  assert.equal(hidden.visible, false);

  storedPolicy = { availability: 'PAID_PLANS', planLimits: { PRO: 100 } };
  const paid = await access.getEntitlement('user-1');
  assert.equal(paid.visible, true);
  assert.equal(paid.usage.remaining, 93);

  license = { ...license, plan: 'TRIAL' };
  storedPolicy = { availability: 'EVERYONE', planLimits: { TRIAL: 1 } };
  const trial = await access.getEntitlement('user-1');
  assert.equal(trial.visible, true);
  assert.equal(trial.usage.limit, 1);
});

test('admin development access bypasses mission quota but disabled blocks everyone', async () => {
  license = { ...license, userRole: 'ADMIN' };
  storedPolicy = { availability: 'ADMIN_ONLY', planLimits: { PRO: 0 } };
  const admin = await access.requireAccess('admin-1', { consume: true });
  assert.equal(admin.usage.limit, null);
  storedPolicy = { availability: 'DISABLED', planLimits: { PRO: 100 } };
  await assert.rejects(access.requireAccess('admin-1'), /not currently available/);
});
