const prisma = require('../db/prisma');

const ACTIVE_STATUS = 'RUNNING';

function publicError(message, code = 'CREATIVE_FLOW_PROJECT_ERROR', status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.publicMessage = message;
  return error;
}

function clean(value, max = 160) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function projectView(project) {
  if (!project) return null;
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    currentStage: project.currentStage,
    activeJobType: project.activeJobType || null,
    progress: {
      current: Number(project.progressCurrent || 0),
      total: Number(project.progressTotal || 0),
      label: project.progressLabel || null
    },
    productUrl: project.productUrl || null,
    renderCampaignId: project.renderCampaignId || null,
    handoffCampaignId: project.handoffCampaignId || null,
    lastError: project.lastError || null,
    lastOpenedAt: project.lastOpenedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

async function listProjects(userId) {
  const projects = await prisma.creativeFlowProject.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ activeJobType: 'desc' }, { updatedAt: 'desc' }],
    take: 100
  });
  const active = projects.find(project => Boolean(project.activeJobType)) || null;
  return {
    projects: projects.map(projectView),
    activeProject: projectView(active)
  };
}

async function createProject(userId, name) {
  const value = clean(name, 120);
  if (!value) throw publicError('Give this Creative Flow project a name.', 'CREATIVE_FLOW_PROJECT_NAME_REQUIRED', 400);
  const project = await prisma.creativeFlowProject.create({
    data: {
      userId,
      name: value,
      status: 'DRAFT',
      currentStage: 'PROJECT_CREATED',
      progressCurrent: 0,
      progressTotal: 0,
      progressLabel: null,
      lastOpenedAt: new Date()
    }
  });
  return projectView(project);
}

async function requireProject(userId, projectId) {
  const project = await prisma.creativeFlowProject.findFirst({
    where: { id: String(projectId), userId, archivedAt: null }
  });
  if (!project) throw publicError('Creative Flow project not found.', 'CREATIVE_FLOW_PROJECT_NOT_FOUND', 404);
  return project;
}

async function openProject(userId, projectId) {
  await requireProject(userId, projectId);
  const project = await prisma.creativeFlowProject.update({
    where: { id: String(projectId) },
    data: { lastOpenedAt: new Date() }
  });
  return projectView(project);
}

async function renameProject(userId, projectId, name) {
  const value = clean(name, 120);
  if (!value) throw publicError('Project name cannot be empty.', 'CREATIVE_FLOW_PROJECT_NAME_REQUIRED', 400);
  const project = await requireProject(userId, projectId);
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: { name: value }
  });
  return projectView(updated);
}

async function archiveProject(userId, projectId) {
  const project = await requireProject(userId, projectId);
  if (project.activeJobType) {
    throw publicError(
      'This project has an active Creative Flow job. Wait for it to finish before archiving the project.',
      'CREATIVE_FLOW_PROJECT_ACTIVE',
      409
    );
  }
  await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: { archivedAt: new Date(), status: 'ARCHIVED' }
  });
  return { ok: true };
}

async function activeProject(userId, tx = prisma) {
  return tx.creativeFlowProject.findFirst({
    where: { userId, archivedAt: null, activeJobType: { not: null } },
    orderBy: { activeJobStartedAt: 'asc' }
  });
}

async function claimActiveJob(userId, projectId, input = {}) {
  const jobType = clean(input.jobType, 80);
  if (!jobType) throw publicError('Creative Flow job type is required.', 'CREATIVE_FLOW_JOB_TYPE_REQUIRED', 400);

  try {
    return await prisma.$transaction(async tx => {
      const project = await tx.creativeFlowProject.findFirst({
        where: { id: String(projectId), userId, archivedAt: null }
      });
      if (!project) throw publicError('Creative Flow project not found.', 'CREATIVE_FLOW_PROJECT_NOT_FOUND', 404);

      const active = await activeProject(userId, tx);
      if (active && active.id !== project.id) {
        throw publicError(
          `“${active.name}” is still working in the background. This project is saved and can start when the active job finishes.`,
          'CREATIVE_FLOW_JOB_ALREADY_ACTIVE',
          409
        );
      }

      const updated = await tx.creativeFlowProject.update({
        where: { id: project.id },
        data: {
          status: ACTIVE_STATUS,
          currentStage: clean(input.currentStage || project.currentStage, 80) || project.currentStage,
          activeJobType: jobType,
          activeJobId: clean(input.jobId, 160) || null,
          activeJobStartedAt: new Date(),
          progressCurrent: Math.max(0, Number(input.progressCurrent || 0)),
          progressTotal: Math.max(0, Number(input.progressTotal || 0)),
          progressLabel: clean(input.progressLabel, 240) || null,
          lastError: null
        }
      });
      return projectView(updated);
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      const active = await activeProject(userId);
      throw publicError(
        active
          ? `“${active.name}” is still working in the background. This project is saved and can start when the active job finishes.`
          : 'Another Creative Flow job started at the same time. Try this project again when it finishes.',
        'CREATIVE_FLOW_JOB_ALREADY_ACTIVE',
        409
      );
    }
    throw error;
  }
}

async function updateActiveJob(userId, projectId, input = {}) {
  const project = await requireProject(userId, projectId);
  if (!project.activeJobType) throw publicError('This project does not have an active Creative Flow job.', 'CREATIVE_FLOW_JOB_NOT_ACTIVE', 409);
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      progressCurrent: input.progressCurrent == null ? undefined : Math.max(0, Number(input.progressCurrent || 0)),
      progressTotal: input.progressTotal == null ? undefined : Math.max(0, Number(input.progressTotal || 0)),
      progressLabel: input.progressLabel == null ? undefined : clean(input.progressLabel, 240),
      currentStage: input.currentStage == null ? undefined : clean(input.currentStage, 80)
    }
  });
  return projectView(updated);
}

async function releaseActiveJob(userId, projectId, input = {}) {
  const project = await requireProject(userId, projectId);
  const nextStatus = clean(input.status || 'WAITING', 40) || 'WAITING';
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      status: nextStatus,
      currentStage: clean(input.currentStage || project.currentStage, 80) || project.currentStage,
      activeJobType: null,
      activeJobId: null,
      activeJobStartedAt: null,
      progressCurrent: input.progressCurrent == null ? project.progressCurrent : Math.max(0, Number(input.progressCurrent || 0)),
      progressTotal: input.progressTotal == null ? project.progressTotal : Math.max(0, Number(input.progressTotal || 0)),
      progressLabel: input.progressLabel == null ? project.progressLabel : clean(input.progressLabel, 240),
      lastError: input.lastError ? clean(input.lastError, 1200) : null
    }
  });
  return projectView(updated);
}

module.exports = {
  listProjects,
  createProject,
  openProject,
  renameProject,
  archiveProject,
  activeProject,
  claimActiveJob,
  updateActiveJob,
  releaseActiveJob,
  projectView
};
