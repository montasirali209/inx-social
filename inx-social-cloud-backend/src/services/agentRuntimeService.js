const prisma = require('../db/prisma');
const brain = require('./agentBrainService');
const env = require('../config/env');

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
  return prisma.agentMemory.findMany({ where: { userId, approvalStatus: 'APPROVED', category: task.type }, orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }], take: 5, select: { title: true, content: true, source: true } });
}

async function markWaiting(plan, task, status, message) {
  await prisma.agentTask.update({ where: { id: task.id }, data: { status, outputJson: JSON.stringify({ message }) } });
  await event(plan.userId, plan.id, task.id, 'TASK_WAITING', 'WAITING', task.title, message);
}

async function runPlan(planId) {
  if (activePlanId && activePlanId !== planId) return false;
  activePlanId = planId;
  try {
    const plan = await prisma.agentPlan.findUnique({ where: { id: planId }, include: { tasks: { orderBy: { sequence: 'asc' } } } });
    if (!plan || !['APPROVED', 'QUEUED', 'RUNNING', 'WAITING_PROVIDER'].includes(plan.status)) return false;
    await prisma.agentPlan.update({ where: { id: plan.id }, data: { status: 'RUNNING', startedAt: plan.startedAt || new Date(), lastError: null } });
    await event(plan.userId, plan.id, null, 'RUN_STARTED', 'RUNNING', 'Mission started', `${plan.operationMode === 'AUTOPILOT' ? 'Autopilot' : 'Hybrid'} execution started with the private INX Agent route.`, { queueMode: 'FIFO_SINGLE_WORKER' });
    let waiting = false;
    let paidFallbackCalls = 0;
    for (const task of plan.tasks) {
      if (['COMPLETED', 'CANCELLED'].includes(task.status)) continue;
      if (BRAIN_TASKS.has(task.type)) {
        await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'RUNNING', startedAt: new Date() } });
        await event(plan.userId, plan.id, task.id, 'TASK_STARTED', 'RUNNING', task.title, 'Ollama is processing this task with approved reusable playbooks.');
        try {
          const memories = await approvedMemories(plan.userId, task);
          const result = await brain.generateTaskOutput(plan, task, { allowPaidFallback: paidFallbackCalls < env.aiFallback.maxCallsPerMission, approvedMemories: memories });
          if (result.provider === 'paid-fallback') paidFallbackCalls += 1;
          await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'COMPLETED', outputJson: JSON.stringify(result), completedAt: new Date() } });
          const candidate = await createLearningCandidate(plan.userId, task, result);
          await event(plan.userId, plan.id, task.id, 'LEARNING_CANDIDATE', 'REVIEW', 'Learning candidate created', 'A concise reusable playbook is waiting for administrator approval.', { memoryId: candidate.id, provider: result.provider, model: result.model });
          await event(plan.userId, plan.id, task.id, 'TASK_COMPLETED', 'SUCCESS', task.title, 'Output saved. Reuse requires administrator approval.', { provider: result.provider, model: result.model });
        } catch (error) {
          waiting = true;
          const customerMessage = error.code === 'OLLAMA_NOT_CONFIGURED'
            ? 'INX Agent is waiting for the private processing gateway to be connected.'
            : 'INX Agent is temporarily unavailable. Saved work is safe and this mission can be resumed.';
          await markWaiting(plan, task, 'WAITING_PROVIDER', customerMessage);
          if (error.code !== 'OLLAMA_NOT_CONFIGURED') await prisma.agentPlan.update({ where: { id: plan.id }, data: { lastError: error.message } });
          break;
        }
      } else {
        waiting = true;
        if (task.type === 'MEDIA_GENERATION') await markWaiting(plan, task, 'WAITING_PROVIDER', 'Media generation is waiting for a configured local or hosted media worker. No paid request was made.');
        else if (task.type === 'PUBLISH') await markWaiting(plan, task, plan.operationMode === 'AUTOPILOT' ? 'WAITING_ASSETS' : 'WAITING_REVIEW', plan.operationMode === 'AUTOPILOT' ? 'Autopilot will publish organic content when approved assets and a connected platform worker are ready.' : 'Hybrid mode is waiting for the owner review checkpoint.');
        else if (task.type === 'PAGE_SETUP') await markWaiting(plan, task, 'WAITING_REVIEW', 'Page ownership, security and identity settings remain guided actions.');
        else await markWaiting(plan, task, 'WAITING_DEPENDENCY', 'This task will resume when its earlier dependencies are complete.');
        break;
      }
    }
    await prisma.agentPlan.update({ where: { id: plan.id }, data: waiting ? { status: 'WAITING_PROVIDER' } : { status: 'COMPLETED', completedAt: new Date() } });
    await event(plan.userId, plan.id, null, waiting ? 'RUN_PAUSED' : 'RUN_COMPLETED', waiting ? 'WAITING' : 'SUCCESS', waiting ? 'Mission paused' : 'Mission completed', waiting ? 'Completed work is saved. Resolve the displayed dependency, then resume.' : 'Every task completed successfully.');
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

module.exports = { queuePlan, runPlan, recover, startAgentRuntime, getRuntimeStatus, BRAIN_TASKS };
