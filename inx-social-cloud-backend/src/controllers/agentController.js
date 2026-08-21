const prisma = require('../db/prisma');
const { getLicenseStatus } = require('../services/licenseService');
const { buildPlan, PROVIDERS, SUPPORTED_PLATFORMS } = require('../services/socialAgentPlanner');

const PLAN_INCLUDE = { tasks: { orderBy: { sequence: 'asc' } } };

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
    approvedAt: plan.approvedAt,
    cancelledAt: plan.cancelledAt,
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
      estimatedCostCents: item.estimatedCostCents
    }))
  };
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
    res.json({
      phase: '11.0',
      mode: 'APPROVAL_FIRST_FOUNDATION',
      license: { plan: license.plan, allowed: license.allowed },
      capabilities: {
        planning: true,
        approvals: true,
        providerRouting: true,
        autonomousPublishing: false,
        note: 'Generation and publishing remain locked until their execution phases are configured and approved.'
      },
      supportedPlatforms: SUPPORTED_PLATFORMS,
      providers: Object.entries(PROVIDERS).map(([code, value]) => ({ code, ...value })),
      plans: recentPlans.map(publicPlan)
    });
  } catch (error) { next(error); }
}

async function createPlan(req, res, next) {
  try {
    await requireAgentAccess(req.user.id);
    const strategy = buildPlan(req.body || {});
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
            estimatedCostCents: item.estimatedCostCents
          }))
        }
      },
      include: PLAN_INCLUDE
    });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'AGENT_PLAN_CREATED', entity: 'AgentPlan', entityId: plan.id, metadata: JSON.stringify({ platforms: strategy.platforms, estimatedCostCents: strategy.estimatedCostCents }) }
    });
    res.status(201).json({ plan: publicPlan(plan) });
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
    res.json({ plan: publicPlan(plan), notice: 'Plan approved. Execution remains paused until the media-generation and publishing workers are enabled.' });
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

module.exports = { overview, createPlan, listPlans, approvePlan, cancelPlan, publicPlan };
