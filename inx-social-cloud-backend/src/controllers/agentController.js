const prisma = require('../db/prisma');
const { getLicenseStatus } = require('../services/licenseService');
const { buildPlan, PROVIDERS, SUPPORTED_PLATFORMS } = require('../services/socialAgentPlanner');
const { queuePlan } = require('../services/agentRuntimeService');
const agentBrain = require('../services/agentBrainService');

const PLAN_INCLUDE = { tasks: { orderBy: { sequence: 'asc' } }, events: { orderBy: { createdAt: 'desc' }, take: 80 } };

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function publicPlan(plan) {
  return {
    id: plan.id,
    prompt: plan.prompt,
    status: plan.status,
    platforms: parseJson(plan.platformsJson, []),
    strategy: parseJson(plan.strategyJson, {}),
    estimatedCostCents: plan.estimatedCostCents,
    operationMode: plan.operationMode || 'HYBRID',
    approvedAt: plan.approvedAt,
    startedAt: plan.startedAt,
    completedAt: plan.completedAt,
    cancelledAt: plan.cancelledAt,
    lastError: plan.lastError,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    tasks: (plan.tasks || []).map(item => ({
      id: item.id,
      sequence: item.sequence,
      type: item.type,
      platform: item.platform,
      title: item.title,
      description: item.description,
      status: item.status,
      riskLevel: item.riskLevel,
      executionMode: item.executionMode,
      estimatedCostCents: item.estimatedCostCents,
      output: parseJson(item.outputJson, null),
      startedAt: item.startedAt,
      completedAt: item.completedAt
    })),
    events: (plan.events || []).map(item => ({ id: item.id, taskId: item.taskId, type: item.type, status: item.status, title: item.title, message: item.message, metadata: parseJson(item.metadataJson, null), createdAt: item.createdAt }))
  };
}

function publicMemory(item) {
  return { id: item.id, pageId: item.pageId, category: item.category, title: item.title, content: item.content, source: item.source, confidence: item.confidence, createdAt: item.createdAt, updatedAt: item.updatedAt };
}

async function requireAgentAccess(userId) {
  const license = await getLicenseStatus(userId);
  if (!license.allowed) {
    const error = new Error('An active INX Social plan is required to use Social Agent.');
    error.status = 403;
    throw error;
  }
  return license;
}

async function overview(req, res, next) {
  try {
    const license = await requireAgentAccess(req.user.id);
    const recentPlans = await prisma.agentPlan.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: PLAN_INCLUDE
    });
    const memories = await prisma.agentMemory.findMany({ where: { userId: req.user.id }, orderBy: { updatedAt: 'desc' }, take: 30 });
    res.json({
      phase: '11.1',
      mode: 'OLLAMA_FIRST_RUNTIME',
      license: { plan: license.plan, allowed: license.allowed },
      capabilities: {
        planning: true,
        approvals: true,
        providerRouting: true,
        autonomousPublishing: true,
        hybridReview: true,
        paidPromotion: false,
        brain: agentBrain.status(),
        note: 'Autopilot may publish organic content inside user guardrails after the required platform and media workers are connected. Paid advertising remains disabled.'
      },
      supportedPlatforms: SUPPORTED_PLATFORMS,
      providers: Object.entries(PROVIDERS).map(([code, value]) => ({ code, ...value })),
      plans: recentPlans.map(publicPlan),
      memories: memories.map(publicMemory)
    });
  } catch (error) { next(error); }
}

async function createPlan(req, res, next) {
  try {
    await requireAgentAccess(req.user.id);
    const strategy = buildPlan(req.body || {});
    const autopilot = strategy.operationMode === 'AUTOPILOT';
    const plan = await prisma.agentPlan.create({
      data: {
        userId: req.user.id,
        prompt: strategy.prompt,
        platformsJson: JSON.stringify(strategy.platforms),
        strategyJson: JSON.stringify({
          assetCount: strategy.assetCount,
          executionMode: strategy.executionMode,
          provider: strategy.provider,
          guardrails: strategy.guardrails
        }),
        operationMode: strategy.operationMode,
        status: autopilot ? 'APPROVED' : 'AWAITING_APPROVAL',
        approvedAt: autopilot ? new Date() : null,
        estimatedCostCents: strategy.estimatedCostCents,
        tasks: {
          create: strategy.tasks.map(item => ({
            sequence: item.sequence,
            type: item.type,
            platform: item.platform,
            title: item.title,
            description: item.description,
            riskLevel: item.riskLevel,
            executionMode: item.executionMode,
            estimatedCostCents: item.estimatedCostCents,
            status: autopilot ? 'APPROVED' : 'PLANNED'
          }))
        }
      },
      include: PLAN_INCLUDE
    });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'AGENT_PLAN_CREATED', entity: 'AgentPlan', entityId: plan.id, metadata: JSON.stringify({ platforms: strategy.platforms, estimatedCostCents: strategy.estimatedCostCents }) }
    });
    if (autopilot) await queuePlan(plan.id, req.user.id);
    const current = autopilot ? await findOwnedPlan(req.user.id, plan.id) : plan;
    res.status(201).json({ plan: publicPlan(current), notice: autopilot ? 'Autopilot accepted the mission and started the Ollama-first runtime.' : 'Hybrid mission created. Review it, then start the run.' });
  } catch (error) { next(error); }
}

async function listPlans(req, res, next) {
  try {
    await requireAgentAccess(req.user.id);
    const plans = await prisma.agentPlan.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50, include: PLAN_INCLUDE });
    res.json({ plans: plans.map(publicPlan) });
  } catch (error) { next(error); }
}

async function findOwnedPlan(userId, id) {
  const plan = await prisma.agentPlan.findFirst({ where: { id, userId }, include: PLAN_INCLUDE });
  if (!plan) throw Object.assign(new Error('Social Agent plan not found.'), { status: 404 });
  return plan;
}

async function approvePlan(req, res, next) {
  try {
    await requireAgentAccess(req.user.id);
    const existing = await findOwnedPlan(req.user.id, req.params.id);
    if (existing.status !== 'AWAITING_APPROVAL') return res.status(409).json({ error: `This plan is already ${existing.status.toLowerCase().replaceAll('_', ' ')}.` });
    const plan = await prisma.agentPlan.update({
      where: { id: existing.id },
      data: { status: 'APPROVED', approvedAt: new Date(), tasks: { updateMany: { where: { status: 'PLANNED' }, data: { status: 'APPROVED' } } } },
      include: PLAN_INCLUDE
    });
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'AGENT_PLAN_APPROVED', entity: 'AgentPlan', entityId: plan.id } });
    await queuePlan(plan.id, req.user.id);
    const queued = await findOwnedPlan(req.user.id, plan.id);
    res.json({ plan: publicPlan(queued), notice: 'Hybrid mission approved and sent to the Ollama-first runtime.' });
  } catch (error) { next(error); }
}

async function resumePlan(req, res, next) {
  try {
    await requireAgentAccess(req.user.id);
    const existing = await findOwnedPlan(req.user.id, req.params.id);
    if (['CANCELLED', 'COMPLETED'].includes(existing.status)) return res.status(409).json({ error: `This plan is already ${existing.status.toLowerCase()}.` });
    if (!existing.approvedAt && existing.operationMode !== 'AUTOPILOT') return res.status(409).json({ error: 'Approve this Hybrid mission before starting it.' });
    await queuePlan(existing.id, req.user.id);
    const queued = await findOwnedPlan(req.user.id, existing.id);
    res.json({ plan: publicPlan(queued), notice: 'Mission resumed. Live activity will update automatically.' });
  } catch (error) { next(error); }
}

async function cancelPlan(req, res, next) {
  try {
    await requireAgentAccess(req.user.id);
    const existing = await findOwnedPlan(req.user.id, req.params.id);
    if (['CANCELLED', 'COMPLETED'].includes(existing.status)) return res.status(409).json({ error: `This plan is already ${existing.status.toLowerCase()}.` });
    const plan = await prisma.agentPlan.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), tasks: { updateMany: { where: { status: { in: ['PLANNED', 'APPROVED'] } }, data: { status: 'CANCELLED' } } } },
      include: PLAN_INCLUDE
    });
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'AGENT_PLAN_CANCELLED', entity: 'AgentPlan', entityId: plan.id } });
    res.json({ plan: publicPlan(plan) });
  } catch (error) { next(error); }
}

module.exports = { overview, createPlan, listPlans, approvePlan, resumePlan, cancelPlan, publicPlan, publicMemory };
