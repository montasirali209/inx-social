const prisma = require('../db/prisma');
const brain = require('./agentBrainService');
const env = require('../config/env');
const media = require('./agentMediaService');
const webResearch = require('./webResearchService');
const campaigns = require('./agentCampaignService');
const branding = require('./agentBrandingService');

let activePlanId = null;
let intervalHandle = null;
let pumpPending = false;
const BRAIN_TASKS = new Set(['BRAND_REVIEW', 'CONTENT_STRATEGY', 'COPY_GENERATION', 'PLATFORM_VARIANT', 'SCHEDULE']);

async function event(userId, planId, taskId, type, status, title, message, metadata = null) {
  return prisma.agentEvent.create({ data: { userId, planId, taskId, type, status, title, message, metadataJson: metadata ? JSON.stringify(metadata) : null } });
}

async function createLearningCandidate(userId, task, result) {
  return prisma.agentMemory.create({ data: {
    userId, category: task.type, title: task.title, content: result.content,
    source: `${String(result.provider).toUpperCase()}:${result.model}`, confidence: 80,
    approvalStatus: 'PENDING_REVIEW', importance: ['BRAND_REVIEW', 'CONTENT_STRATEGY', 'PAGE_SETUP'].includes(task.type) ? 'HIGH' : 'ROUTINE'
  } });
}

async function approvedMemories(userId, task) {
  return prisma.agentMemory.findMany({ where: { userId, approvalStatus: 'APPROVED', category: { in: [task.type, 'WEB_RESEARCH'] } }, orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }], take: 5, select: { title: true, content: true, source: true } });
}

async function selectedVisionAssets(userId, plan) {
  if (!env.ollama.visionEnabled) return [];
  return branding.visionAssets(userId, plan);
}

async function createResearchLearningCandidate(userId, task, result) {
  const content = String(result?.reusableLearning || '').trim();
  if (!content) return null;
  const existing = await prisma.agentMemory.findFirst({ where: { userId, category: 'WEB_RESEARCH', content, approvalStatus: { in: ['PENDING_REVIEW', 'APPROVED'] } }, select: { id: true } });
  if (existing) return null;
  return prisma.agentMemory.create({ data: {
    userId,
    category: 'WEB_RESEARCH',
    title: 'Reusable live-research decision pattern',
    content,
    source: result.refinementUsed ? 'OLLAMA_FIRST:OPENAI_WEB_REFINED' : 'OLLAMA_FIRST',
    confidence: result.refinementUsed ? 85 : 75,
    approvalStatus: 'PENDING_REVIEW',
    importance: 'HIGH'
  } });
}

async function markWaiting(plan, task, status, message) {
  await prisma.agentTask.update({ where: { id: task.id }, data: { status, outputJson: JSON.stringify({ message }) } });
  await event(plan.userId, plan.id, task.id, 'TASK_WAITING', 'WAITING', task.title, message);
}

function campaignArtifactIssues(campaign, strategy = {}) {
  const posts = Array.isArray(campaign?.posts) ? campaign.posts : [];
  const expected = Math.max(1, Number(strategy.assetCount || 1));
  const issues = [];
  if (posts.length < expected) issues.push(`Only ${posts.length} of ${expected} requested posts reached Campaign Review.`);
  posts.forEach((post, index) => {
    if (!String(post.caption || '').trim()) issues.push(`Post ${index + 1} has no publishable caption.`);
    if (!post.connectedPage) issues.push(`Post ${index + 1} has no connected Page target.`);
    if (!post.scheduledAt && !strategy.draftOnly) issues.push(`Post ${index + 1} has no future publishing time.`);
    if (String(post.format || 'IMAGE').toUpperCase() !== 'TEXT' && (!post.asset || post.asset.status !== 'READY' || post.asset.qualityScore === null || post.asset.qualityScore === undefined)) issues.push(`Post ${index + 1} has no image that passed the visual quality gate.`);
  });
  return issues;
}

async function runPlan(planId) {
  if (activePlanId && activePlanId !== planId) return false;
  activePlanId = planId;
  try {
    const plan = await prisma.agentPlan.findUnique({ where: { id: planId }, include: { tasks: { orderBy: { sequence: 'asc' } } } });
    if (!plan || !['APPROVED', 'QUEUED', 'RUNNING', 'WAITING_PROVIDER'].includes(plan.status)) return false;
    await prisma.agentPlan.update({ where: { id: plan.id }, data: { status: 'RUNNING', startedAt: plan.startedAt || new Date(), lastError: null } });
    await event(plan.userId, plan.id, null, 'RUN_STARTED', 'RUNNING', 'Mission started', `${plan.operationMode === 'AUTOPILOT' ? 'Autopilot' : 'Hybrid'} execution started with the private INX Agent route.`, { queueMode: 'FIFO_SINGLE_WORKER' });
    let providerFailure = false;
    let actionRequired = false;
    let missionDelivered = false;
    let paidFallbackCalls = 0;
    for (const task of plan.tasks) {
      const latestState = await prisma.agentPlan.findUnique({ where: { id: plan.id }, select: { status: true } });
      if (latestState?.status === 'CANCELLED') {
        await event(plan.userId, plan.id, null, 'RUN_CANCELLED', 'CANCELLED', 'Mission cancelled', 'The active workspace was cleared and no further mission tasks will start.');
        return true;
      }
      if (['COMPLETED', 'CANCELLED'].includes(task.status)) continue;
      if (task.type === 'WEB_RESEARCH') {
        await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'RUNNING', startedAt: new Date() } });
        await event(plan.userId, plan.id, task.id, 'TASK_STARTED', 'RUNNING', task.title, 'Ollama is preparing the first analysis before current public evidence is checked.');
        try {
          const preference = await prisma.cloudPreference.findUnique({ where: { userId: plan.userId }, select: { settingsJson: true } });
          let researchSettings = {};
          try { researchSettings = JSON.parse(preference?.settingsJson || '{}'); } catch (_) {}
          const result = await webResearch.researchMission({ ...plan, researchSettings });
          await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'COMPLETED', outputJson: JSON.stringify(result), completedAt: new Date() } });
          task.status = 'COMPLETED';
          task.outputJson = JSON.stringify(result);
          const candidate = await createResearchLearningCandidate(plan.userId, task, result);
          if (candidate) await event(plan.userId, plan.id, task.id, 'LEARNING_CANDIDATE', 'REVIEW', 'Research learning candidate created', 'A durable research decision pattern is waiting for administrator approval. Current facts and hidden reasoning were not saved as memory.', { memoryId: candidate.id, ollamaFirst: true, refinementUsed: Boolean(result.refinementUsed) });
          await event(plan.userId, plan.id, task.id, 'TASK_COMPLETED', 'SUCCESS', task.title, `Ollama produced the first analysis, then OpenAI checked current evidence from ${result.sources.length} source link${result.sources.length === 1 ? '' : 's'} and refined the final strategy.`, { sourceCount: result.sources.length, ollamaFirst: true, refinementUsed: Boolean(result.refinementUsed) });
        } catch (error) {
          const message = error.code === 'WEB_RESEARCH_NOT_CONFIGURED' ? 'Current-web research is not connected. The mission will continue without claiming live research.' : 'Current-web research is temporarily unavailable. The mission will continue using supplied facts and approved knowledge only.';
          const output = { message, sources: [], researchAvailable: false };
          await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'COMPLETED', outputJson: JSON.stringify(output), completedAt: new Date() } });
          task.status = 'COMPLETED';
          task.outputJson = JSON.stringify(output);
          await event(plan.userId, plan.id, task.id, 'TASK_COMPLETED_WITH_WARNING', 'WARNING', task.title, message, { researchAvailable: false, reason: error.code || 'WEB_RESEARCH_UNAVAILABLE' });
        }
      } else if (BRAIN_TASKS.has(task.type)) {
        await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'RUNNING', startedAt: new Date() } });
        await event(plan.userId, plan.id, task.id, 'TASK_STARTED', 'RUNNING', task.title, 'Ollama is processing this task with approved reusable playbooks.');
        try {
          const memories = await approvedMemories(plan.userId, task);
          const visionAssets = task.type === 'BRAND_REVIEW' ? await selectedVisionAssets(plan.userId, plan) : [];
          const result = await brain.generateTaskOutput(plan, task, { allowPaidFallback: paidFallbackCalls < env.aiFallback.maxCallsPerMission, approvedMemories: memories, visionAssets });
          if (result.provider === 'paid-fallback') paidFallbackCalls += 1;
          await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'COMPLETED', outputJson: JSON.stringify(result), completedAt: new Date() } });
          const candidate = await createLearningCandidate(plan.userId, task, result);
          await event(plan.userId, plan.id, task.id, 'LEARNING_CANDIDATE', 'REVIEW', 'Learning candidate created', 'A concise reusable playbook is waiting for administrator approval.', { memoryId: candidate.id, provider: result.provider, model: result.model });
          await event(plan.userId, plan.id, task.id, 'TASK_COMPLETED', 'SUCCESS', task.title, 'Output saved. Reuse requires administrator approval.', { provider: result.provider, model: result.model });
        } catch (error) {
          if (error.code === 'COPY_QUALITY_FAILED') {
            actionRequired = true;
            await markWaiting(plan, task, 'WAITING_COPY_REVIEW', `The copy was withheld after two quality checks (${error.qualityReview?.score || 0}/100). The agent will retry from the saved research when you resume; no weak post was delivered.`);
            break;
          }
          providerFailure = true;
          const customerMessage = error.code === 'OLLAMA_NOT_CONFIGURED'
            ? 'INX Agent is waiting for the private processing gateway to be connected.'
            : 'INX Agent is temporarily unavailable. Saved work is safe and this mission can be resumed.';
          await markWaiting(plan, task, 'WAITING_PROVIDER', customerMessage);
          if (error.code !== 'OLLAMA_NOT_CONFIGURED') await prisma.agentPlan.update({ where: { id: plan.id }, data: { lastError: error.message } });
          break;
        }
      } else if (task.type === 'IMAGE_GENERATION') {
        await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'RUNNING', startedAt: new Date() } });
        await event(plan.userId, plan.id, task.id, 'TASK_STARTED', 'RUNNING', task.title, 'The private Ollama image worker is creating bounded brand-safe assets.');
        try {
          const currentPlan = await prisma.agentPlan.findUnique({ where: { id: plan.id }, include: { tasks: { orderBy: { sequence: 'asc' } } } });
          const result = await media.generateImages(currentPlan || plan, task);
          await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'COMPLETED', outputJson: JSON.stringify(result), completedAt: new Date() } });
          await event(plan.userId, plan.id, task.id, result.rejectedCount ? 'TASK_COMPLETED_WITH_WARNING' : 'TASK_COMPLETED', result.rejectedCount ? 'WARNING' : 'SUCCESS', task.title, result.summary || result.content, { assetCount: result.assets?.length || 0, rejectedCount: result.rejectedCount || 0 });
        } catch (error) {
          actionRequired = true;
          const message = error.code === 'OLLAMA_NOT_CONFIGURED'
            ? 'The private image worker is not connected. Your completed work is safe; connect it and resume.'
            : error.code === 'IMAGE_GENERATION_FAILED'
              ? 'The selected image quality is unavailable on the private image worker. Check that its image model is installed, then resume this mission.'
              : 'Image generation is paused. Check the private image worker in Admin, then resume this mission.';
          await markWaiting(plan, task, 'WAITING_MEDIA_WORKER', message);
        }
      } else {
        if (String(task.status).startsWith('WAITING_') || task.status === 'ACTION_REQUIRED') continue;
        if (['MEDIA_GENERATION', 'VIDEO_GENERATION'].includes(task.type)) {
          actionRequired = true;
          await markWaiting(plan, task, 'WAITING_MEDIA_WORKER', 'Video creation needs a configured video worker. No paid request was made; completed strategy, image and copy work remains available.');
        } else if (task.type === 'PUBLISH') {
          try {
            const campaign = await campaigns.prepareReview(plan.id);
            let strategy = {};
            try { strategy = JSON.parse(plan.strategyJson || '{}'); } catch (_) {}
            const artifactIssues = campaignArtifactIssues(campaign, strategy);
            if (artifactIssues.length) {
              actionRequired = true;
              await markWaiting(plan, task, 'WAITING_REVIEW', `Campaign Review is available, but the mission cannot complete yet: ${artifactIssues.join(' ')}`);
            } else if (plan.operationMode === 'AUTOPILOT' && !strategy.approvalRequested && !strategy.draftOnly) {
              const approved = await campaigns.approveAll(plan.userId, campaign.id);
              const scheduled = await campaigns.scheduleCampaign(plan.userId, approved.id);
              if (scheduled.failed || scheduled.scheduled < campaign.posts.length) {
                actionRequired = true;
                await markWaiting(plan, task, 'WAITING_REVIEW', `${scheduled.scheduled} post${scheduled.scheduled === 1 ? '' : 's'} scheduled; ${scheduled.failed} need attention in Campaign Review.`);
              } else {
                const output = { message: `${scheduled.scheduled} post${scheduled.scheduled === 1 ? '' : 's'} passed final checks and were scheduled.`, campaignId: campaign.id, scheduled: scheduled.scheduled };
                await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'COMPLETED', outputJson: JSON.stringify(output), completedAt: new Date() } });
                task.status = 'COMPLETED';
                await event(plan.userId, plan.id, task.id, 'TASK_COMPLETED', 'SUCCESS', task.title, output.message, { campaignId: campaign.id, scheduled: scheduled.scheduled });
                missionDelivered = true;
                break;
              }
            } else {
              actionRequired = true;
              const message = `${campaign.posts?.length || 0} complete post${campaign.posts?.length === 1 ? '' : 's'} are ready in Campaign Review. Check each caption, image and publishing time, then approve and schedule.`;
              await markWaiting(plan, task, 'WAITING_REVIEW', message);
            }
          } catch (error) {
            actionRequired = true;
            await markWaiting(plan, task, 'WAITING_CAMPAIGN_REVIEW', `Campaign Review could not be assembled yet: ${String(error.message || 'saved copy or media is incomplete').slice(0, 400)}`);
          }
        } else if (task.type === 'PAGE_SETUP') {
          actionRequired = true;
          await markWaiting(plan, task, 'ACTION_REQUIRED', 'Complete the displayed Facebook Page setup steps manually. The remaining strategy and copy tasks will continue with Ollama.');
        } else if (task.type === 'ANALYTICS') {
          actionRequired = true;
          await markWaiting(plan, task, 'WAITING_PLATFORM', 'Analytics will begin after content is published and the connected platform returns results.');
        } else {
          actionRequired = true;
          await markWaiting(plan, task, 'WAITING_DEPENDENCY', 'This task needs a connected platform capability, but independent Ollama work will continue.');
        }
        continue;
      }
    }
    const latestState = await prisma.agentPlan.findUnique({ where: { id: plan.id }, select: { status: true } });
    if (latestState?.status === 'CANCELLED') return true;
    const finalStatus = providerFailure ? 'WAITING_PROVIDER' : missionDelivered ? 'COMPLETED' : actionRequired ? 'ACTION_REQUIRED' : 'COMPLETED';
    await prisma.agentPlan.update({ where: { id: plan.id }, data: finalStatus === 'COMPLETED' ? { status: finalStatus, completedAt: new Date(), lastError: null } : { status: finalStatus, lastError: providerFailure ? undefined : null } });
    await event(plan.userId, plan.id, null,
      providerFailure ? 'RUN_PAUSED' : actionRequired ? 'RUN_ACTION_REQUIRED' : 'RUN_COMPLETED',
      providerFailure ? 'WAITING' : actionRequired ? 'ACTION' : 'SUCCESS',
      providerFailure ? 'Provider connection interrupted' : actionRequired ? 'AI work ready — action remains' : 'Mission completed',
      providerFailure ? 'Ollama could not complete the current AI task. Saved work is safe; restore the provider and resume.' : actionRequired ? 'Independent Ollama tasks continued. The mission now shows the exact Page, media, publishing or analytics dependency that remains.' : 'Every task completed successfully.');
    return true;
  } catch (error) {
    await prisma.agentPlan.update({ where: { id: planId }, data: { status: 'FAILED', lastError: error.message } }).catch(() => {});
    return false;
  } finally {
    activePlanId = null;
    setImmediate(() => pumpQueue().catch(error => console.error('Social Agent queue failed:', error.message)));
  }
}

async function pumpQueue() {
  if (activePlanId || pumpPending) return;
  pumpPending = true;
  try {
    const next = await prisma.agentPlan.findFirst({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (next) {
      // Reserve the worker before yielding. Without this reservation, two
      // near-simultaneous queue requests can schedule the same mission twice.
      activePlanId = next.id;
      setImmediate(() => runPlan(next.id));
    }
  } finally { pumpPending = false; }
}

async function queuePlan(planId, userId) {
  await prisma.agentPlan.update({ where: { id: planId }, data: { status: 'QUEUED' } });
  const ahead = await prisma.agentPlan.count({ where: { status: { in: ['QUEUED', 'RUNNING'] }, id: { not: planId } } });
  await event(userId, planId, null, 'RUN_QUEUED', 'QUEUED', 'Mission queued', `Mission accepted in FIFO position ${ahead + 1}.`, { queuePosition: ahead + 1 });
  await pumpQueue();
}

async function recover() {
  if (activePlanId) return;
  await prisma.agentPlan.updateMany({ where: { status: 'RUNNING' }, data: { status: 'QUEUED' } });
  await pumpQueue();
}

async function getRuntimeStatus() {
  const queued = await prisma.agentPlan.findMany({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  return { workerMode: 'FIFO_SINGLE_WORKER', activePlanId, queueLength: queued.length, queuedPlanIds: queued.map(item => item.id) };
}

function startAgentRuntime() {
  recover().catch(error => console.error('Social Agent recovery failed:', error.message));
  intervalHandle = setInterval(() => recover().catch(error => console.error('Social Agent recovery failed:', error.message)), 30000);
  intervalHandle.unref?.();
}

module.exports = { queuePlan, runPlan, recover, startAgentRuntime, getRuntimeStatus, BRAIN_TASKS, campaignArtifactIssues };
