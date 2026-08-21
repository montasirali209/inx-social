const prisma = require('../db/prisma');
const brain = require('./agentBrainService');
const env = require('../config/env');

const activeRuns = new Set();
let intervalHandle = null;
const BRAIN_TASKS = new Set(['BRAND_REVIEW', 'CONTENT_STRATEGY', 'COPY_GENERATION', 'PLATFORM_VARIANT', 'SCHEDULE']);

async function event(userId, planId, taskId, type, status, title, message, metadata = null) {
  return prisma.agentEvent.create({ data: { userId, planId, taskId, type, status, title, message, metadataJson: metadata ? JSON.stringify(metadata) : null } });
}

async function memory(userId, plan, task, result) {
  return prisma.agentMemory.create({ data: {
    userId,
    category: task.type,
    title: task.title,
    content: result.content,
    source: `${String(result.provider).toUpperCase()}:${result.model}`,
    confidence: 80
  } });
}

async function markWaiting(plan, task, status, message) {
  await prisma.agentTask.update({ where: { id: task.id }, data: { status, outputJson: JSON.stringify({ message }) } });
  await event(plan.userId, plan.id, task.id, 'TASK_WAITING', 'WAITING', task.title, message);
}

async function runPlan(planId) {
  if (activeRuns.has(planId)) return;
  activeRuns.add(planId);
  try {
    const plan = await prisma.agentPlan.findUnique({ where: { id: planId }, include: { tasks: { orderBy: { sequence: 'asc' } } } });
    if (!plan || !['APPROVED', 'QUEUED', 'RUNNING', 'WAITING_PROVIDER'].includes(plan.status)) return;
    await prisma.agentPlan.update({ where: { id: plan.id }, data: { status: 'RUNNING', startedAt: plan.startedAt || new Date(), lastError: null } });
    await event(plan.userId, plan.id, null, 'RUN_STARTED', 'RUNNING', 'Mission started', `${plan.operationMode === 'AUTOPILOT' ? 'Autopilot' : 'Hybrid'} execution started with ${brain.status().model}.`);
    let waiting = false;
    let paidFallbackCalls = 0;
    for (const task of plan.tasks) {
      if (['COMPLETED', 'CANCELLED'].includes(task.status)) continue;
      if (BRAIN_TASKS.has(task.type)) {
        await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'RUNNING', startedAt: new Date() } });
        await event(plan.userId, plan.id, task.id, 'TASK_STARTED', 'RUNNING', task.title, 'Ollama is working on this task.');
        try {
          const allowPaidFallback = paidFallbackCalls < env.aiFallback.maxCallsPerMission;
          const result = await brain.generateTaskOutput(plan, task, { allowPaidFallback });
          if (result.provider === 'paid-fallback') paidFallbackCalls += 1;
          await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'COMPLETED', outputJson: JSON.stringify(result), completedAt: new Date() } });
          await memory(plan.userId, plan, task, result);
          await event(plan.userId, plan.id, task.id, 'TASK_COMPLETED', 'SUCCESS', task.title, 'Output saved to working memory.', { provider: result.provider, model: result.model });
        } catch (error) {
          waiting = true;
          await markWaiting(plan, task, 'WAITING_PROVIDER', error.message);
          if (error.code !== 'OLLAMA_NOT_CONFIGURED') await prisma.agentPlan.update({ where: { id: plan.id }, data: { lastError: error.message } });
        }
        continue;
      }
      if (task.type === 'MEDIA_GENERATION') {
        waiting = true;
        await markWaiting(plan, task, 'WAITING_PROVIDER', 'Media generation is waiting for a configured local or hosted media worker. No paid request was made.');
      } else if (task.type === 'PUBLISH') {
        waiting = true;
        await markWaiting(plan, task, plan.operationMode === 'AUTOPILOT' ? 'WAITING_ASSETS' : 'WAITING_REVIEW', plan.operationMode === 'AUTOPILOT' ? 'Autopilot will publish organic content when approved assets and a connected platform worker are ready.' : 'Hybrid mode is waiting for the owner review checkpoint.');
      } else if (task.type === 'PAGE_SETUP') {
        waiting = true;
        await markWaiting(plan, task, 'WAITING_REVIEW', 'Page ownership, security and identity settings remain guided actions.');
      } else {
        waiting = true;
        await markWaiting(plan, task, 'WAITING_DEPENDENCY', 'This task will resume when its earlier content and publishing dependencies are complete.');
      }
    }
    await prisma.agentPlan.update({ where: { id: plan.id }, data: waiting ? { status: 'WAITING_PROVIDER' } : { status: 'COMPLETED', completedAt: new Date() } });
    await event(plan.userId, plan.id, null, 'RUN_PAUSED', waiting ? 'WAITING' : 'SUCCESS', waiting ? 'Mission waiting' : 'Mission completed', waiting ? 'Completed work is saved. The live feed shows exactly what must be connected next.' : 'Every task completed successfully.');
  } catch (error) {
    await prisma.agentPlan.update({ where: { id: planId }, data: { status: 'FAILED', lastError: error.message } }).catch(() => {});
  } finally { activeRuns.delete(planId); }
}

async function queuePlan(planId, userId) {
  await prisma.agentPlan.update({ where: { id: planId }, data: { status: 'QUEUED' } });
  await event(userId, planId, null, 'RUN_QUEUED', 'QUEUED', 'Mission queued', 'The Social Agent runtime accepted this mission.');
  setImmediate(() => runPlan(planId));
}

async function recover() {
  const plans = await prisma.agentPlan.findMany({ where: { status: { in: ['QUEUED', 'RUNNING'] } }, select: { id: true }, take: 10 });
  for (const plan of plans) setImmediate(() => runPlan(plan.id));
}

function startAgentRuntime() {
  recover().catch(error => console.error('Social Agent recovery failed:', error.message));
  intervalHandle = setInterval(() => recover().catch(error => console.error('Social Agent recovery failed:', error.message)), 30000);
  intervalHandle.unref?.();
}

module.exports = { queuePlan, runPlan, recover, startAgentRuntime, BRAIN_TASKS };
