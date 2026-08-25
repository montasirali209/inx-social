const prisma = require('../db/prisma');
const { buildPlan, SUPPORTED_PLATFORMS, CONTENT_OUTPUTS, mediaCatalog } = require('../services/socialAgentPlanner');
const { queuePlan, getRuntimeStatus } = require('../services/agentRuntimeService');
const agentBrain = require('../services/agentBrainService');
const agentAccess = require('../services/agentAccessService');
const agentAssets = require('../services/agentAssetService');
const agentMedia = require('../services/agentMediaService');
const webResearch = require('../services/webResearchService');
const agentCampaigns = require('../services/agentCampaignService');

const ASSET_SELECT = { id: true, planId: true, kind: true, source: true, status: true, originalName: true, mimeType: true, byteSize: true, createdAt: true };
const PLAN_INCLUDE = {
  tasks: { orderBy: { sequence: 'asc' } },
  events: { orderBy: { createdAt: 'desc' }, take: 80 },
  assets: { orderBy: { createdAt: 'desc' }, select: ASSET_SELECT },
  campaign: { include: agentCampaigns.CAMPAIGN_INCLUDE }
};

function publicGenerationChoice(value) {
  const code = String(value || '').toUpperCase();
  const legacy = { OLLAMA_IMAGE: 'IMAGE_FAST', INX_TEMPLATE: 'VIDEO_FAST', WAN_2_2_FAST: 'VIDEO_QUALITY', LTX_2_3_FAST: 'VIDEO_QUALITY' };
  const safe = legacy[code] || code;
  return ['TEXT_ONLY', 'IMAGE_FAST', 'IMAGE_QUALITY', 'VIDEO_FAST', 'VIDEO_QUALITY'].includes(safe) ? safe : null;
}

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function publicPlan(plan) {
  const strategy = parseJson(plan.strategyJson, {});
  return {
    id: plan.id,
    prompt: plan.prompt,
    status: plan.status,
    platforms: parseJson(plan.platformsJson, []),
    strategy: {
      assetCount: strategy.assetCount || 0,
      contentOutput: strategy.contentOutput || null,
      mediaModel: publicGenerationChoice(strategy.mediaModel || strategy.executionMode),
      estimatedCredits: Number(strategy.estimatedCredits || 0),
      executionMode: publicGenerationChoice(strategy.executionMode),
      guardrails: strategy.guardrails || [],
      pageTargets: Array.isArray(strategy.pageTargets) ? strategy.pageTargets.map(publicPageTarget) : []
    },
    operationMode: plan.operationMode || 'HYBRID',
    approvedAt: plan.approvedAt,
    startedAt: plan.startedAt,
    completedAt: plan.completedAt,
    cancelledAt: plan.cancelledAt,
    lastError: plan.lastError && ['FAILED', 'WAITING_PROVIDER'].includes(plan.status) ? 'INX Agent could not complete the current step. Try again or contact support if it continues.' : null,
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
      executionMode: publicGenerationChoice(item.executionMode),
      output: publicTaskOutput(parseJson(item.outputJson, null)),
      startedAt: item.startedAt,
      completedAt: item.completedAt
    })),
    events: (plan.events || []).map(item => ({ id: item.id, taskId: item.taskId, type: item.type, status: item.status, title: item.title, message: item.message, createdAt: item.createdAt })),
    assets: (plan.assets || []).map(agentAssets.publicAsset),
    campaign: agentCampaigns.publicCampaign(plan.campaign)
  };
}

function publicPageTarget(page) {
  return {
    id: String(page.id || ''),
    facebookPageId: String(page.facebookPageId || ''),
    name: String(page.name || page.facebookPageName || 'Facebook Page'),
    picture: page.picture || page.facebookPagePicture || null,
    category: page.category || page.facebookCategory || null
  };
}

async function connectedPagesForUser(userId) {
  if (typeof prisma.connectedPage?.findMany !== 'function') return [];
  return prisma.connectedPage.findMany({
    where: { userId, status: 'ACTIVE' },
    orderBy: [{ isSelected: 'desc' }, { facebookPageName: 'asc' }],
    select: { id: true, facebookPageId: true, facebookPageName: true, facebookPagePicture: true, facebookCategory: true, isSelected: true, status: true }
  });
}

async function resolvePageTargets(userId, strategy, requestedIds) {
  if (!strategy.platforms.includes('facebook')) return [];
  const ids = [...new Set((Array.isArray(requestedIds) ? requestedIds : []).map(value => String(value || '').trim()).filter(Boolean))];
  if (!ids.length) throw Object.assign(new Error('Select at least one connected Facebook Page for this mission.'), { status: 400 });
  if (ids.length > 50) throw Object.assign(new Error('A mission can target up to 50 connected Facebook Pages.'), { status: 400 });
  const pages = await connectedPagesForUser(userId);
  const owned = new Map(pages.map(page => [page.id, page]));
  if (ids.some(id => !owned.has(id))) throw Object.assign(new Error('One or more selected Facebook Pages are no longer connected to this INX Social account.'), { status: 400 });
  return ids.map(id => publicPageTarget(owned.get(id)));
}

function publicTaskOutput(output) {
  if (!output || typeof output !== 'object') return output;
  const allowed = {};
  for (const key of ['content', 'message', 'summary', 'checklist', 'recommendations', 'assets', 'sources']) {
    if (output[key] !== undefined) allowed[key] = output[key];
  }
  return Object.keys(allowed).length ? allowed : null;
}

function publicMemory(item) {
  return { id: item.id, pageId: item.pageId, category: item.category, title: item.title, content: item.content, confidence: item.confidence, approvalStatus: item.approvalStatus, importance: item.importance, createdAt: item.createdAt, updatedAt: item.updatedAt };
}

async function overview(req, res, next) {
  try {
    const entitlement = await agentAccess.requireAccess(req.user.id);
    const recentPlans = await prisma.agentPlan.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: PLAN_INCLUDE
    });
    const memories = await prisma.agentMemory.findMany({ where: { userId: req.user.id, approvalStatus: 'APPROVED' }, orderBy: { updatedAt: 'desc' }, take: 30 });
    const pendingMemoryCount = await prisma.agentMemory.count({ where: { userId: req.user.id, approvalStatus: 'PENDING_REVIEW' } });
    const runtime = await getRuntimeStatus();
    const connectedPages = await connectedPagesForUser(req.user.id);
    const availableAssets = await agentAssets.list(req.user.id, { source: 'UPLOAD' });
    const userQueue = runtime.queuedPlanIds.filter(id => recentPlans.some(plan => plan.id === id));
    res.json({
      phase: '11.5.1',
      mode: 'OLLAMA_FIRST_RUNTIME',
      license: { plan: entitlement.plan, allowed: entitlement.allowed },
      usage: entitlement.usage,
      capabilities: {
        planning: true,
        approvals: true,
        providerRouting: true,
        autonomousPublishing: false,
        hybridReview: true,
        campaignReview: true,
        facebookOrganicScheduling: true,
        paidPromotion: false,
        brain: { configured: agentBrain.status().configured },
        imageWorker: agentMedia.status(),
        webResearch: webResearch.status(),
        note: 'The agent prepares complete campaign posts. Facebook text and image posts are scheduled only after the owner approves them; paid advertising remains disabled.'
      },
      supportedPlatforms: SUPPORTED_PLATFORMS,
      contentOutputs: Object.entries(CONTENT_OUTPUTS).map(([code, value]) => ({ code, label: value.label, mediaKind: value.mediaKind })),
      mediaModels: mediaCatalog(entitlement.plan),
      mediaCreditPolicy: { mode: 'ESTIMATE_ONLY_UNTIL_PROVIDER_BILLING', note: 'Subscription access and estimated credits are shown before launch. Deduction activates with the provider billing worker; local private image generation uses zero paid media credits.' },
      connectedPages: connectedPages.map(page => ({ ...publicPageTarget(page), isSelected: Boolean(page.isSelected), status: page.status })),
      assets: availableAssets.map(agentAssets.publicAsset),
      plans: recentPlans.map(publicPlan),
      memories: memories.map(publicMemory),
      pendingMemoryCount,
      runtime: { ...runtime, queuedPlanIds: userQueue }
    });
  } catch (error) { next(error); }
}

async function preflightMission(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
    const prompt = String(req.body?.prompt || '').trim();
    if (prompt.length < 3) return res.status(400).json({ error: 'Tell the Social Agent what you want to achieve.' });
    const analysis = await agentBrain.analyseMission({ prompt, platforms: req.body?.platforms });
    res.json({ analysis });
  } catch (error) { next(error); }
}

async function createPlan(req, res, next) {
  try {
    const entitlement = await agentAccess.requireAccess(req.user.id);
    const strategy = buildPlan({ ...(req.body || {}), subscriptionPlan: entitlement.plan });
    const pageTargets = await resolvePageTargets(req.user.id, strategy, req.body?.targetPageIds);
    const referenceAssets = await agentAssets.resolveOwned(req.user.id, Array.isArray(req.body?.referenceAssetIds) ? req.body.referenceAssetIds : []);
    await agentAccess.requireAccess(req.user.id, { consume: true });
    const autopilot = strategy.operationMode === 'AUTOPILOT';
    const plan = await prisma.agentPlan.create({
      data: {
        userId: req.user.id,
        prompt: strategy.prompt,
        platformsJson: JSON.stringify(strategy.platforms),
        strategyJson: JSON.stringify({
          assetCount: strategy.assetCount,
          contentOutput: strategy.contentOutput,
          mediaModel: strategy.mediaModel,
          estimatedCredits: strategy.estimatedCredits,
          executionMode: strategy.executionMode,
          provider: strategy.provider,
          guardrails: strategy.guardrails,
          pageTargets,
          referenceAssets: referenceAssets.map(asset => ({ id: asset.id, kind: asset.kind, originalName: asset.originalName, mimeType: asset.mimeType, byteSize: asset.byteSize }))
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
      data: { userId: req.user.id, action: 'AGENT_PLAN_CREATED', entity: 'AgentPlan', entityId: plan.id, metadata: JSON.stringify({ platforms: strategy.platforms, targetPageIds: pageTargets.map(page => page.id), estimatedCostCents: strategy.estimatedCostCents }) }
    });
    if (autopilot) await queuePlan(plan.id, req.user.id);
    const current = autopilot ? await findOwnedPlan(req.user.id, plan.id) : plan;
    res.status(201).json({ plan: publicPlan(current), notice: autopilot ? 'Autopilot accepted the mission and started the Ollama-first runtime.' : 'Hybrid mission created. Review it, then start the run.' });
  } catch (error) { next(error); }
}

async function uploadAsset(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
    const asset = await agentAssets.createUpload(req.user.id, req.body || {});
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'AGENT_BRAND_ASSET_UPLOADED', entity: 'AgentAsset', entityId: asset.id, metadata: JSON.stringify({ kind: asset.kind, mimeType: asset.mimeType, byteSize: asset.byteSize }) } });
    res.status(201).json({ asset: agentAssets.publicAsset(asset) });
  } catch (error) { next(error); }
}

async function assetContent(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
    const asset = await agentAssets.findContent(req.user.id, req.params.id);
    if (!asset) return res.status(404).json({ error: 'Agent image not found.' });
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', asset.data.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('ETag', `"${asset.checksum}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(asset.data);
  } catch (error) { next(error); }
}

async function deleteAsset(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
    const removed = await agentAssets.remove(req.user.id, req.params.id);
    if (!removed) return res.status(409).json({ error: 'This image is attached to a mission or cannot be removed.' });
    res.json({ ok: true });
  } catch (error) { next(error); }
}

async function listPlans(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
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
    await agentAccess.requireAccess(req.user.id);
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
    await agentAccess.requireAccess(req.user.id);
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
    await agentAccess.requireAccess(req.user.id);
    const existing = await findOwnedPlan(req.user.id, req.params.id);
    if (['CANCELLED', 'COMPLETED'].includes(existing.status)) return res.status(409).json({ error: `This plan is already ${existing.status.toLowerCase()}.` });
    const plan = await prisma.agentPlan.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), tasks: { updateMany: { where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } }, data: { status: 'CANCELLED' } } } },
      include: PLAN_INCLUDE
    });
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'AGENT_PLAN_CANCELLED', entity: 'AgentPlan', entityId: plan.id } });
    res.json({ plan: publicPlan(plan) });
  } catch (error) { next(error); }
}

async function prepareCampaignReview(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
    const plan = await findOwnedPlan(req.user.id, req.params.id);
    if (plan.status === 'CANCELLED') return res.status(409).json({ error: 'A cancelled mission cannot be approved or scheduled.' });
    const reviewTask = (plan.tasks || []).find(task => task.type === 'PUBLISH' && ['WAITING_REVIEW', 'WAITING_ASSETS'].includes(task.status));
    if (!reviewTask && !plan.campaign) return res.status(409).json({ error: 'This mission has not reached its campaign review checkpoint yet.' });
    const campaign = plan.campaign || await agentCampaigns.prepareReview(plan.id);
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'AGENT_CAMPAIGN_REVIEW_OPENED', entity: 'AgentCampaign', entityId: campaign.id, metadata: JSON.stringify({ planId: plan.id, backfilled: !plan.campaign }) } });
    res.json({ campaign: agentCampaigns.publicCampaign(campaign), notice: plan.campaign ? 'Campaign Review opened.' : 'The previous mission has been upgraded into Campaign Review.' });
  } catch (error) { next(error); }
}

async function campaignDetails(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
    const campaign = await agentCampaigns.findOwned(req.user.id, req.params.campaignId);
    res.json({ campaign: agentCampaigns.publicCampaign(campaign) });
  } catch (error) { next(error); }
}

async function updateCampaignPost(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
    const campaign = await agentCampaigns.updatePost(req.user.id, req.params.campaignId, req.params.postId, req.body || {});
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'AGENT_CAMPAIGN_POST_EDITED', entity: 'AgentCampaignPost', entityId: req.params.postId, metadata: JSON.stringify({ campaignId: req.params.campaignId }) } });
    res.json({ campaign: agentCampaigns.publicCampaign(campaign), notice: 'Post changes saved. Review approval was reset for this post.' });
  } catch (error) { next(error); }
}

async function approveCampaignPost(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
    const campaign = await agentCampaigns.approvePost(req.user.id, req.params.campaignId, req.params.postId);
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'AGENT_CAMPAIGN_POST_APPROVED', entity: 'AgentCampaignPost', entityId: req.params.postId, metadata: JSON.stringify({ campaignId: req.params.campaignId }) } });
    res.json({ campaign: agentCampaigns.publicCampaign(campaign), notice: 'Post approved. It has not been scheduled yet.' });
  } catch (error) { next(error); }
}

async function approveCampaign(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
    const campaign = await agentCampaigns.approveAll(req.user.id, req.params.campaignId);
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'AGENT_CAMPAIGN_APPROVED', entity: 'AgentCampaign', entityId: req.params.campaignId } });
    res.json({ campaign: agentCampaigns.publicCampaign(campaign), notice: 'All review-ready posts approved. Nothing has been published yet.' });
  } catch (error) { next(error); }
}

async function regenerateCampaignPostImage(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
    const campaign = await agentCampaigns.regeneratePostImage(req.user.id, req.params.campaignId, req.params.postId);
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'AGENT_CAMPAIGN_IMAGE_REGENERATED', entity: 'AgentCampaignPost', entityId: req.params.postId, metadata: JSON.stringify({ campaignId: req.params.campaignId }) } });
    res.json({ campaign: agentCampaigns.publicCampaign(campaign), notice: 'A new image was generated for this post. Review and approve it again.' });
  } catch (error) { next(error); }
}

async function scheduleCampaign(req, res, next) {
  try {
    await agentAccess.requireAccess(req.user.id);
    const result = await agentCampaigns.scheduleCampaign(req.user.id, req.params.campaignId);
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'AGENT_CAMPAIGN_SCHEDULED', entity: 'AgentCampaign', entityId: req.params.campaignId, metadata: JSON.stringify({ scheduled: result.scheduled, failed: result.failed }) } });
    res.status(result.failed ? 207 : 200).json({ campaign: agentCampaigns.publicCampaign(result.campaign), results: result.results, notice: result.failed ? `${result.scheduled} posts scheduled; ${result.failed} need attention.` : `${result.scheduled} posts scheduled successfully on Facebook.` });
  } catch (error) { next(error); }
}

module.exports = {
  overview, preflightMission, createPlan, listPlans, approvePlan, resumePlan, cancelPlan, prepareCampaignReview,
  uploadAsset, assetContent, deleteAsset,
  campaignDetails, updateCampaignPost, approveCampaignPost, approveCampaign,
  regenerateCampaignPostImage, scheduleCampaign,
  publicPlan, publicMemory, publicPageTarget, resolvePageTargets
};
