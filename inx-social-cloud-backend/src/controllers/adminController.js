const prisma = require('../db/prisma');
const crypto = require('crypto');
const { z } = require('zod');
const { hashPassword } = require('../utils/auth');
const aiModelRouting = require('../services/aiModelRoutingService');
const agentBrain = require('../services/agentBrainService');
const agentAccess = require('../services/agentAccessService');
const licenseService = require('../services/licenseService');
const aiCredits = require('../services/aiCreditService');
const aiStudioPolicy = require('../services/aiStudioPolicyService');
const env = require('../config/env');

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

function activeAdminOverride(subscriptions = [], now = new Date()) {
  return subscriptions.find(sub => licenseService.isActiveAdminOverride(sub, now)) || null;
}

function underlyingSubscription(subscriptions = []) {
  return subscriptions.find(sub => String(sub?.provider || '').toLowerCase() !== 'admin_override') || null;
}

async function commercialSnapshot(userId) {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  const license = await licenseService.getLicenseStatus(userId);
  let credits = null;
  if (license.allowed) {
    try { credits = await aiCredits.getBalance(userId); } catch (_) { credits = null; }
  }
  const override = activeAdminOverride(subscriptions);
  const billing = underlyingSubscription(subscriptions);
  return {
    effectivePlan: license.plan,
    sourcePlan: license.sourcePlan,
    provider: license.provider,
    administrator: Boolean(license.administrator),
    manualOverride: override ? {
      id: override.id,
      plan: override.plan,
      status: override.status,
      startsAt: override.currentPeriodStart,
      expiresAt: override.currentPeriodEnd,
      permanent: !override.currentPeriodEnd
    } : null,
    underlyingBilling: billing ? {
      plan: billing.plan,
      status: billing.status,
      provider: billing.provider,
      currentPeriodEnd: billing.currentPeriodEnd,
      stripeManaged: billing.provider === 'stripe'
    } : null,
    credits
  };
}

async function overview(req, res, next) {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [users, trials, activeSubs, pages, jobs, failedJobs, activeUsers, suspendedUsers, unverifiedUsers, joinedToday, recentUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'TRIAL' } }),
      prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'MANUAL'] } } }),
      prisma.connectedPage.count({ where: { status: 'ACTIVE' } }),
      prisma.scheduleJob.count(),
      prisma.scheduleJob.count({ where: { status: 'FAILED' } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { emailVerifiedAt: null, role: 'USER' } }),
      prisma.user.count({ where: { role: 'USER', createdAt: { gte: today } } }),
      prisma.user.findMany({ where: { role: 'USER' }, orderBy: { createdAt: 'desc' }, take: 12, select: { id: true, name: true, email: true, status: true, createdAt: true, emailVerifiedAt: true, subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, select: { plan: true, status: true } } } })
    ]);

    res.json({ overview: { users, trials, joinedToday, activeUsers, suspendedUsers, unverifiedUsers, activeSubscriptions: activeSubs, connectedPages: pages, scheduleJobs: jobs, failedJobs, recentUsers } });
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
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 8 },
        devices: { select: { id: true, deviceName: true, deviceId: true, status: true, lastSeenAt: true } },
        connectedPages: { select: { id: true, facebookPageName: true, facebookPageId: true, status: true } }
      }
    });
    const overrides = await agentAccess.getUserOverrides();
    const now = new Date();
    res.json({ users: users.map(user => {
      const override = activeAdminOverride(user.subscriptions || [], now);
      const base = underlyingSubscription(user.subscriptions || []);
      const effectivePlan = ['ADMIN', 'SUPER_ADMIN'].includes(String(user.role || '').toUpperCase())
        ? 'AGENCY'
        : (override?.plan || base?.plan || 'TRIAL');
      return { ...user, effectivePlan, manualPlanOverride: Boolean(override), aiStudioAccess: overrides[user.id] || 'DEFAULT' };
    }) });
  } catch (err) { next(err); }
}

async function userDetail(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: safeUserSelect() });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { ...user, effectivePlan: (await licenseService.getLicenseStatus(user.id)).plan, commercialAccess: await commercialSnapshot(user.id), aiStudioAccess: await agentAccess.getUserOverride(user.id) } });
  } catch (err) { next(err); }
}

async function updateUserAccess(req, res, next) {
  try {
    const input = z.object({
      status: z.enum(['PENDING_VERIFICATION', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
      role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
      trialDays: z.number().int().min(0).max(365).optional(),
      aiStudioAccess: z.enum(['DEFAULT', 'ALLOW', 'DENY']).optional()
    }).parse(req.body || {});
    const { status, role, trialDays, aiStudioAccess } = input;
    const currentUser = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });
    if (role && role !== currentUser.role && req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Only a super administrator can change account roles.' });
    if (req.params.id === req.user.id && ((role && !['ADMIN', 'SUPER_ADMIN'].includes(role)) || ['SUSPENDED', 'CANCELLED'].includes(status))) {
      return res.status(400).json({ error: 'You cannot remove your own administrator access.' });
    }
    const data = {};
    if (status) data.status = status;
    if (role) data.role = role;
    if (typeof trialDays === 'number') {
      data.status = status || 'TRIAL';
      data.trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    }

    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    if (aiStudioAccess) await agentAccess.setUserOverride(user.id, aiStudioAccess);

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_UPDATE_USER_ACCESS',
        entity: 'User',
        entityId: user.id,
        metadata: JSON.stringify({ status, role, trialDays, aiStudioAccess })
      }
    });

    const updated = await prisma.user.findUnique({ where: { id: req.params.id }, select: safeUserSelect() });
    res.json({ ok: true, user: { ...updated, commercialAccess: await commercialSnapshot(user.id), aiStudioAccess: await agentAccess.getUserOverride(user.id) } });
  } catch (err) { next(err); }
}

async function updateCommercialPlan(req, res, next) {
  try {
    const input = z.object({
      action: z.enum(['APPLY', 'REVOKE']).default('APPLY'),
      plan: z.enum(['TRIAL', 'CREATOR', 'PRO', 'BUSINESS', 'AGENCY']).optional(),
      durationDays: z.number().int().min(1).max(3650).nullable().optional(),
      reason: z.string().trim().max(500).optional()
    }).parse(req.body || {});
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true, status: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'USER') return res.status(400).json({ error: 'Administrator accounts already receive administrator access and do not need a customer plan override.' });

    const now = new Date();
    await prisma.subscription.updateMany({
      where: { userId: user.id, provider: 'admin_override', status: { in: ['ACTIVE', 'MANUAL'] } },
      data: { status: 'CANCELLED', currentPeriodEnd: now }
    });

    if (input.action === 'APPLY') {
      if (!input.plan) return res.status(400).json({ error: 'plan is required when applying an override.' });
      const effectiveDays = input.plan === 'TRIAL' && input.durationDays == null ? 7 : input.durationDays;
      const expiresAt = typeof effectiveDays === 'number' ? new Date(now.getTime() + effectiveDays * 86400000) : null;
      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: input.plan,
          status: 'MANUAL',
          provider: 'admin_override',
          currentPeriodStart: now,
          currentPeriodEnd: expiresAt
        }
      });
      if (user.status !== 'SUSPENDED') {
        await prisma.user.update({ where: { id: user.id }, data: { status: input.plan === 'TRIAL' ? 'TRIAL' : 'ACTIVE', ...(input.plan === 'TRIAL' && expiresAt ? { trialEndsAt: expiresAt } : {}) } });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: input.action === 'APPLY' ? 'ADMIN_PLAN_OVERRIDE_APPLIED' : 'ADMIN_PLAN_OVERRIDE_REVOKED',
        entity: 'User',
        entityId: user.id,
        metadata: JSON.stringify({ plan: input.plan || null, durationDays: input.durationDays ?? null, reason: input.reason || null })
      }
    });

    res.json({ ok: true, commercialAccess: await commercialSnapshot(user.id) });
  } catch (err) { next(err); }
}

async function adjustUserCredits(req, res, next) {
  try {
    const input = z.object({
      action: z.enum(['ADD', 'REMOVE', 'SET', 'RESET_PLAN']),
      credits: z.number().int().min(0).max(1000000).default(0),
      reason: z.string().trim().max(500).optional()
    }).parse(req.body || {});
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const balance = await aiCredits.adminAdjustCredits(user.id, input.action, input.credits, {
      adminUserId: req.user.id,
      reason: input.reason || null
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_AI_CREDITS_ADJUSTED',
        entity: 'User',
        entityId: user.id,
        metadata: JSON.stringify({ action: input.action, credits: input.credits, reason: input.reason || null, resultingBalance: balance.remaining })
      }
    });
    res.json({ ok: true, balance, commercialAccess: await commercialSnapshot(user.id) });
  } catch (err) { next(err); }
}

function temporaryPassword() {
  return `Inx!${crypto.randomBytes(9).toString('base64url')}9a`;
}

async function createUser(req, res, next) {
  try {
    const input = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email(),
      plan: z.enum(['TRIAL', 'CREATOR', 'PRO', 'BUSINESS', 'AGENCY']).default('TRIAL'),
      trialDays: z.coerce.number().int().min(1).max(365).default(7)
    }).parse(req.body || {});
    const email = input.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'A user with this email already exists.' });
    const password = temporaryPassword();
    const now = new Date();
    const trialEndsAt = input.plan === 'TRIAL' ? new Date(now.getTime() + input.trialDays * 86400000) : null;
    const user = await prisma.$transaction(async tx => {
      const created = await tx.user.create({ data: { name: input.name, email, passwordHash: await hashPassword(password), role: 'USER', status: input.plan === 'TRIAL' ? 'TRIAL' : 'ACTIVE', emailVerifiedAt: now, trialEndsAt } });
      await tx.subscription.create({ data: { userId: created.id, plan: input.plan, status: input.plan === 'TRIAL' ? 'TRIALING' : 'MANUAL', provider: input.plan === 'TRIAL' ? 'internal' : 'admin_override', currentPeriodStart: now, currentPeriodEnd: input.plan === 'TRIAL' ? trialEndsAt : null } });
      await tx.auditLog.create({ data: { userId: req.user.id, action: 'ADMIN_CREATE_USER', entity: 'User', entityId: created.id, metadata: JSON.stringify({ email, plan: input.plan }) } });
      return created;
    });
    res.status(201).json({ ok: true, user: { id: user.id, name: user.name, email: user.email, status: user.status, plan: input.plan }, temporaryPassword: password, passwordNotice: 'This temporary password is shown once. Ask the user to reset it after first sign-in.' });
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

async function aiStudioPolicyStatus(req, res, next) {
  try {
    const policy = await aiStudioPolicy.getPolicy();
    const credits = {
      TRIAL: aiCredits.creditLimitForPlan('trial'),
      CREATOR: aiCredits.creditLimitForPlan('creator'),
      PRO: aiCredits.creditLimitForPlan('pro'),
      BUSINESS: aiCredits.creditLimitForPlan('business'),
      AGENCY: aiCredits.creditLimitForPlan('agency')
    };
    const topupPacks = Object.entries(env.aiCredits?.topupPriceIds || {})
      .filter(([, priceId]) => Boolean(priceId))
      .map(([amount]) => Number(amount))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    res.json({
      policy,
      credits,
      topups: {
        configured: Boolean(env.aiCredits?.stripeWebhookSecret && topupPacks.length),
        packs: topupPacks
      },
      providers: {
        runware: {
          configured: Boolean(env.runware?.apiKey),
          label: 'Runware',
          detail: env.runware?.apiKey ? 'Image and AI video generation gateway' : 'API key not configured',
          models: {
            image: env.runware?.imageModel || null,
            premiumImage: env.runware?.imagePremiumModel || null,
            economyVideo: env.runware?.videoEconomyModel || null,
            video: env.runware?.videoModel || null,
            longVideo: env.runware?.videoLongModel || null,
            ugc: env.runware?.ugcModel || null
          }
        },
        openMontage: {
          configured: Boolean(env.stockVideo?.openMontageUrls?.length),
          label: 'Stock Video Creator',
          detail: env.stockVideo?.openMontageUrls?.length
            ? `${env.stockVideo.openMontageUrls.length} worker endpoint${env.stockVideo.openMontageUrls.length === 1 ? '' : 's'} configured`
            : 'No worker endpoint configured',
          sources: {
            pexels: Boolean(env.stockVideo?.pexelsConfigured),
            pixabay: Boolean(env.stockVideo?.pixabayConfigured)
          }
        },
        openai: {
          configured: Boolean(env.openaiImage?.apiKey || env.postEnhancement?.apiKey),
          label: 'OpenAI support routes',
          detail: 'Caption enhancement, planning/review and configured support tasks',
          models: {
            image: env.openaiImage?.model || null,
            postEnhancement: env.postEnhancement?.model || null
          }
        }
      }
    });
  } catch (err) { next(err); }
}

async function updateAiStudioPolicy(req, res, next) {
  try {
    const input = z.object({
      enabled: z.boolean(),
      trialEnabled: z.boolean(),
      paidEnabled: z.boolean(),
      administratorEnabled: z.boolean()
    }).parse(req.body || {});
    const policy = await aiStudioPolicy.updatePolicy(input);
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_UPDATE_AI_STUDIO_POLICY',
        entity: 'AppSetting',
        metadata: JSON.stringify(policy)
      }
    });
    res.json({ ok: true, policy });
  } catch (err) { next(err); }
}

async function aiRouting(req, res, next) {
  try {
    const imagePolicy = await aiModelRouting.getImagePolicy();
    res.json({ routing: await aiModelRouting.getRouting(), imagePolicy, imageProviders: aiModelRouting.imageProviderCapabilities(imagePolicy), imageRoutes: aiModelRouting.IMAGE_ROUTES, mediaPolicy: await aiModelRouting.getMediaPolicy(), mediaProviders: aiModelRouting.MEDIA_PROVIDERS, brain: agentBrain.status(), routes: aiModelRouting.ROUTES });
  } catch (err) { next(err); }
}

async function updateAiRouting(req, res, next) {
  try {
    const routing = await aiModelRouting.updateRouting(req.body?.routing || req.body || {});
    const mediaPolicy = await aiModelRouting.updateMediaPolicy(req.body?.mediaPolicy || {});
    const imagePolicy = await aiModelRouting.updateImagePolicy(req.body?.imagePolicy || {});
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'ADMIN_UPDATE_AI_ROUTING', entity: 'AppSetting', metadata: JSON.stringify({ routing, imagePolicy, mediaPolicy }) } });
    res.json({ ok: true, routing, imagePolicy, mediaPolicy, brain: agentBrain.status() });
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

module.exports = { overview, users, userDetail, createUser, updateUserAccess, updateCommercialPlan, adjustUserCredits, settings, updateSetting, aiStudioPolicyStatus, updateAiStudioPolicy, aiRouting, updateAiRouting, agentAccessPolicy, updateAgentAccessPolicy, agentLearning, reviewAgentLearning };
