const assert = require('node:assert/strict');
const test = require('node:test');

const prismaPath = require.resolve('../src/db/prisma');
const licensePath = require.resolve('../src/services/licenseService');
const accessPath = require.resolve('../src/services/agentAccessService');
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
require.cache[accessPath] = { id: accessPath, filename: accessPath, loaded: true, exports: { requireAccess: async () => ({ allowed: true, plan: 'PRO', usage: { used: 1, limit: 100, remaining: 99 } }) } };
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
  assert.equal(res.body.plan.estimatedCostCents, undefined);
  assert.equal(res.body.plan.actualPaidCalls, undefined);
  assert.equal(res.body.plan.strategy.provider, undefined);
});

test('customer plan output never exposes private routes, models or provider costs', () => {
  const plan = controller.publicPlan({
    id: 'plan-private', prompt: 'test', status: 'COMPLETED', platformsJson: '["facebook"]',
    strategyJson: JSON.stringify({ provider: { label: 'Private provider', estimatedCostCents: 99 }, assetCount: 1 }),
    estimatedCostCents: 99, lastError: 'https://private-gateway.example/model failed',
    tasks: [{ id: 'task-private', sequence: 1, title: 'Write', description: 'Write copy', status: 'COMPLETED', outputJson: JSON.stringify({ provider: 'paid-fallback', model: 'private/model', content: 'Customer-safe output' }) }],
    events: [{ id: 'event-private', title: 'Done', message: 'Output saved.', status: 'SUCCESS', metadataJson: JSON.stringify({ provider: 'paid-fallback', model: 'private/model' }), createdAt: new Date() }]
  });
  assert.equal(plan.estimatedCostCents, undefined);
  assert.equal(plan.strategy.provider, undefined);
  assert.equal(plan.tasks[0].output.model, undefined);
  assert.equal(plan.tasks[0].output.provider, undefined);
  assert.equal(plan.events[0].metadata, undefined);
  assert.doesNotMatch(plan.lastError, /private-gateway|model/);
});
