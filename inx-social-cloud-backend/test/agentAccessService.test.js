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

test('Social Agent defaults to administrators only', async () => {
  storedPolicy = null;
  const policy = await access.getPolicy();
  assert.equal(policy.availability, 'ADMIN_ONLY');
  assert.equal(policy.planLimits.TRIAL, 1);
  assert.equal(policy.planLimits.PRO, 100);
});

test('regular subscribers stay hidden until the admin enables everyone', async () => {
  storedPolicy = { availability: 'ADMIN_ONLY', planLimits: { PRO: 100 } };
  used = 7;
  license = { ...license, userRole: 'USER' };
  const hidden = await access.getEntitlement('user-1');
  assert.equal(hidden.visible, false);
  storedPolicy = { availability: 'EVERYONE', planLimits: { PRO: 100 } };
  const enabled = await access.getEntitlement('user-1');
  assert.equal(enabled.visible, true);
  assert.equal(enabled.usage.used, 7);
  assert.equal(enabled.usage.remaining, 93);
});

test('admin development access bypasses mission quota but disabled blocks everyone', async () => {
  license = { ...license, userRole: 'ADMIN' };
  storedPolicy = { availability: 'ADMIN_ONLY', planLimits: { PRO: 0 } };
  const admin = await access.requireAccess('admin-1', { consume: true });
  assert.equal(admin.usage.limit, null);
  storedPolicy = { availability: 'DISABLED', planLimits: { PRO: 100 } };
  await assert.rejects(access.requireAccess('admin-1'), /not currently available/);
});
