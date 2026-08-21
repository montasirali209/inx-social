const prisma = require('../db/prisma');
const aiModelRouting = require('../services/aiModelRoutingService');
const agentBrain = require('../services/agentBrainService');
const agentAccess = require('../services/agentAccessService');

function safeUserSelect() {
  return {
    id: true,
    name: true,
    email: true,
    role: true,
    status: true,
    trialEndsAt: true,
    emailVerifiedAt: true,
    marketingOptIn: true,
    createdAt: true,
    updatedAt: true,
    subscriptions: { orderBy: { createdAt: 'desc' }, take: 3 },
    devices: { orderBy: { createdAt: 'desc' }, take: 10 },
    connectedPages: { orderBy: { createdAt: 'desc' }, take: 10 },
    scheduleJobs: { orderBy: { createdAt: 'desc' }, take: 10 }
  };
}

async function overview(req, res, next) {
  try {
    const [users, trials, activeSubs, pages, jobs, failedJobs, activeUsers, suspendedUsers, unverifiedUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'TRIAL' } }),
      prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'MANUAL'] } } }),
      prisma.connectedPage.count({ where: { status: 'ACTIVE' } }),
      prisma.scheduleJob.count(),
      prisma.scheduleJob.count({ where: { status: 'FAILED' } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { emailVerifiedAt: null, role: 'USER' } })
    ]);

    res.json({ overview: { users, trials, activeUsers, suspendedUsers, unverifiedUsers, activeSubscriptions: activeSubs, connectedPages: pages, scheduleJobs: jobs, failedJobs } });
  } catch (err) { next(err); }
}

async function users(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    const where = q ? {
      OR: [
        { email: { contains: q } },
        { name: { contains: q } }
      ]
    } : {};
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 250,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        trialEndsAt: true,
        emailVerifiedAt: true,
        marketingOptIn: true,
        createdAt: true,
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        devices: { select: { id: true, deviceName: true, deviceId: true, status: true, lastSeenAt: true } },
        connectedPages: { select: { id: true, facebookPageName: true, facebookPageId: true, status: true } }
      }
    });
    res.json({ users });
  } catch (err) { next(err); }
}

async function userDetail(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: safeUserSelect() });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
}

async function updateUserAccess(req, res, next) {
  try {
    const { status, role, trialDays, plan, subscriptionStatus } = req.body || {};
    const data = {};
    if (status) data.status = status;
    if (role) data.role = role;
    if (typeof trialDays === 'number') {
      data.status = status || 'TRIAL';
      data.trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    }

    const user = await prisma.user.update({ where: { id: req.params.id }, data });

    if (plan || subscriptionStatus) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: plan || 'MANUAL',
          status: subscriptionStatus || 'MANUAL',
          provider: 'manual',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_UPDATE_USER_ACCESS',
        entity: 'User',
        entityId: user.id,
        metadata: JSON.stringify({ status, role, trialDays, plan, subscriptionStatus })
      }
    });

    const updated = await prisma.user.findUnique({ where: { id: req.params.id }, select: safeUserSelect() });
    res.json({ ok: true, user: updated });
  } catch (err) { next(err); }
}

async function settings(req, res, next) {
  try {
    const settings = await prisma.appSetting.findMany({ orderBy: { key: 'asc' } });
    res.json({ settings });
  } catch (err) { next(err); }
}

async function updateSetting(req, res, next) {
  try {
    const { key, value, description } = req.body || {};
    if (!key) return res.status(400).json({ error: 'key is required' });
    const setting = await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: String(value ?? ''), description: description || null },
      update: { value: String(value ?? ''), description: description || undefined }
    });
    res.json({ ok: true, setting });
  } catch (err) { next(err); }
}

async function aiRouting(req, res, next) {
  try {
    res.json({ routing: await aiModelRouting.getRouting(), mediaPolicy: await aiModelRouting.getMediaPolicy(), mediaProviders: aiModelRouting.MEDIA_PROVIDERS, brain: agentBrain.status(), routes: aiModelRouting.ROUTES });
  } catch (err) { next(err); }
}

async function updateAiRouting(req, res, next) {
  try {
    const routing = await aiModelRouting.updateRouting(req.body?.routing || req.body || {});
    const mediaPolicy = await aiModelRouting.updateMediaPolicy(req.body?.mediaPolicy || {});
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'ADMIN_UPDATE_AI_ROUTING', entity: 'AppSetting', metadata: JSON.stringify({ routing, mediaPolicy }) } });
    res.json({ ok: true, routing, mediaPolicy, brain: agentBrain.status() });
  } catch (err) { next(err); }
}

async function agentAccessPolicy(req, res, next) {
  try {
    res.json({ policy: await agentAccess.getPolicy(), availabilityOptions: Object.values(agentAccess.AVAILABILITY) });
  } catch (err) { next(err); }
}

async function updateAgentAccessPolicy(req, res, next) {
  try {
    const policy = await agentAccess.updatePolicy(req.body || {});
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'ADMIN_UPDATE_AGENT_ACCESS', entity: 'AppSetting', metadata: JSON.stringify(policy) } });
    res.json({ ok: true, policy });
  } catch (err) { next(err); }
}

async function agentLearning(req, res, next) {
  try {
    const status = String(req.query.status || '').toUpperCase();
    const where = status && ['PENDING_REVIEW', 'APPROVED', 'DECLINED'].includes(status) ? { approvalStatus: status } : {};
    const memories = await prisma.agentMemory.findMany({ where, orderBy: [{ approvalStatus: 'asc' }, { importance: 'asc' }, { updatedAt: 'desc' }], take: 200, include: { user: { select: { id: true, name: true, email: true } } } });
    const grouped = await prisma.agentMemory.groupBy({ by: ['approvalStatus'], _count: { _all: true } });
    res.json({ memories, counts: Object.fromEntries(grouped.map(item => [item.approvalStatus, item._count._all])), policy: 'Only administrator-approved summaries and playbooks may be reused. Hidden chain-of-thought is never stored.' });
  } catch (err) { next(err); }
}

async function reviewAgentLearning(req, res, next) {
  try {
    const approvalStatus = String(req.body?.approvalStatus || '').toUpperCase();
    if (!['APPROVED', 'DECLINED', 'PENDING_REVIEW'].includes(approvalStatus)) return res.status(400).json({ error: 'approvalStatus must be APPROVED, DECLINED or PENDING_REVIEW.' });
    const memory = await prisma.agentMemory.update({ where: { id: req.params.id }, data: {
      approvalStatus,
      content: req.body?.content === undefined ? undefined : String(req.body.content).trim().slice(0, 12000),
      reviewNote: req.body?.reviewNote === undefined ? undefined : String(req.body.reviewNote).trim().slice(0, 1000),
      reviewedAt: approvalStatus === 'PENDING_REVIEW' ? null : new Date(),
      reviewedById: approvalStatus === 'PENDING_REVIEW' ? null : req.user.id
    } });
    await prisma.auditLog.create({ data: { userId: req.user.id, action: `ADMIN_AGENT_MEMORY_${approvalStatus}`, entity: 'AgentMemory', entityId: memory.id } });
    res.json({ ok: true, memory });
  } catch (err) { next(err); }
}

module.exports = { overview, users, userDetail, updateUserAccess, settings, updateSetting, aiRouting, updateAiRouting, agentAccessPolicy, updateAgentAccessPolicy, agentLearning, reviewAgentLearning };
