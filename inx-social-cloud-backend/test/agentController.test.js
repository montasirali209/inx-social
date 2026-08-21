const assert = require('node:assert/strict');
const test = require('node:test');

const prismaPath = require.resolve('../src/db/prisma');
const licensePath = require.resolve('../src/services/licenseService');
let created = null;
const prisma = {
  agentPlan: {
    create: async input => {
      created = input.data;
      return { id: 'agent-plan-1', ...input.data, status: 'AWAITING_APPROVAL', approvedAt: null, cancelledAt: null, createdAt: new Date(), updatedAt: new Date(), tasks: input.data.tasks.create.map((item, index) => ({ id: `task-${index}`, planId: 'agent-plan-1', status: 'PLANNED', ...item })) };
    },
    findMany: async () => []
  },
  auditLog: { create: async () => ({ id: 'audit-1' }) }
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
require.cache[licensePath] = { id: licensePath, filename: licensePath, loaded: true, exports: { getLicenseStatus: async () => ({ allowed: true, plan: 'PRO' }) } };
const controller = require('../src/controllers/agentController');

function responseRecorder() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('creating an agent plan persists costed tasks but performs no external action', async () => {
  const res = responseRecorder();
  let error = null;
  await controller.createPlan({ user: { id: 'user-1' }, body: { prompt: 'Create 5 social posts for Facebook', platforms: ['facebook'] } }, res, value => { error = value; });
  assert.equal(error, null);
  assert.equal(res.statusCode, 201);
  assert.equal(created.status, 'AWAITING_APPROVAL');
  assert.equal(created.operationMode, 'HYBRID');
  assert.equal(created.estimatedCostCents, 25);
  assert.ok(created.tasks.create.some(item => item.type === 'PUBLISH' && item.riskLevel === 'HIGH'));
  assert.equal(res.body.plan.status, 'AWAITING_APPROVAL');
});
