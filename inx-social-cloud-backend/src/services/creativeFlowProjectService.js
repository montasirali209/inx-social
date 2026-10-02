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

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function cleanPosition(value, fallback) {
  const source = value && typeof value === 'object' ? value : {};
  const x = Number(source.x);
  const y = Number(source.y);
  return {
    x: Number.isFinite(x) ? Math.max(-10000, Math.min(10000, x)) : fallback.x,
    y: Number.isFinite(y) ? Math.max(-10000, Math.min(10000, y)) : fallback.y
  };
}

function cleanViewport(value, fallback = { x: 0, y: 0, zoom: 1 }) {
  const source = value && typeof value === 'object' ? value : {};
  const x = Number(source.x);
  const y = Number(source.y);
  const zoom = Number(source.zoom);
  return {
    x: Number.isFinite(x) ? Math.max(-20000, Math.min(20000, x)) : fallback.x,
    y: Number.isFinite(y) ? Math.max(-20000, Math.min(20000, y)) : fallback.y,
    zoom: Number.isFinite(zoom) ? Math.max(0.25, Math.min(2.5, zoom)) : fallback.zoom
  };
}

function defaultCanvas() {
  return {
    positions: {
      productUrl: { x: 80, y: 120 },
      productImages: { x: 80, y: 390 },
      analyzeProduct: { x: 470, y: 255 },
      productIntelligence: { x: 850, y: 225 },
      campaignSetup: { x: 1280, y: 215 }
    },
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

function normalizeWorkflow(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const defaults = defaultCanvas();
  const positions = input.canvas?.positions && typeof input.canvas.positions === 'object'
    ? input.canvas.positions
    : {};
  return {
    version: Math.max(2, Number(input.version || 2)),
    source: {
      websiteInput: clean(input.source?.websiteInput, 2000),
      normalizedUrl: clean(input.source?.normalizedUrl, 2000),
      referenceAssetIds: (Array.isArray(input.source?.referenceAssetIds) ? input.source.referenceAssetIds : [])
        .map(value => clean(value, 120)).filter(Boolean).slice(0, 8),
      referenceNames: (Array.isArray(input.source?.referenceNames) ? input.source.referenceNames : [])
        .map(value => clean(value, 220)).filter(Boolean).slice(0, 8)
    },
    analysis: input.analysis && typeof input.analysis === 'object' && !Array.isArray(input.analysis)
      ? input.analysis
      : null,
    campaignSetup: {
      goal: clean(input.campaignSetup?.goal || 'AI Recommended', 120) || 'AI Recommended',
      platforms: (Array.isArray(input.campaignSetup?.platforms) ? input.campaignSetup.platforms : ['Instagram'])
        .map(value => clean(value, 40))
        .filter(Boolean)
        .slice(0, 8),
      creativeCount: Math.max(1, Math.min(50, Number(input.campaignSetup?.creativeCount || 20))),
      style: clean(input.campaignSetup?.style || 'AI Recommended', 160) || 'AI Recommended',
      audience: clean(input.campaignSetup?.audience, 500)
    },
    canvas: {
      positions: {
        productUrl: cleanPosition(positions.productUrl, defaults.positions.productUrl),
        productImages: cleanPosition(positions.productImages, defaults.positions.productImages),
        analyzeProduct: cleanPosition(positions.analyzeProduct, defaults.positions.analyzeProduct),
        productIntelligence: cleanPosition(positions.productIntelligence, defaults.positions.productIntelligence),
        campaignSetup: cleanPosition(positions.campaignSetup, defaults.positions.campaignSetup)
      },
      viewport: cleanViewport(input.canvas?.viewport, defaults.viewport)
    }
  };
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
    workflow: normalizeWorkflow(parseJson(project.workflowJson, {})),
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
      workflowJson: JSON.stringify(normalizeWorkflow({})),
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

async function getProject(userId, projectId) {
  return projectView(await requireProject(userId, projectId));
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

async function saveProductSource(userId, projectId, input = {}) {
  const project = await requireProject(userId, projectId);
  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  workflow.source = {
    websiteInput: clean(input.websiteInput, 2000),
    normalizedUrl: clean(input.normalizedUrl, 2000),
    referenceAssetIds: (Array.isArray(input.referenceAssetIds) ? input.referenceAssetIds : [])
      .map(value => clean(value, 120)).filter(Boolean).slice(0, 8),
    referenceNames: (Array.isArray(input.referenceNames) ? input.referenceNames : [])
      .map(value => clean(value, 220)).filter(Boolean).slice(0, 8)
  };
  workflow.analysis = null;
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      productUrl: workflow.source.normalizedUrl || null,
      status: 'DRAFT',
      currentStage: 'PROJECT_CREATED',
      progressCurrent: 0,
      progressTotal: 0,
      progressLabel: null,
      lastError: null,
      workflowJson: JSON.stringify(workflow),
      updatedAt: new Date()
    }
  });
  return projectView(updated);
}

async function saveProductAnalysis(userId, projectId, analysis) {
  const project = await requireProject(userId, projectId);
  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  workflow.analysis = analysis && typeof analysis === 'object' ? analysis : null;
  if (analysis?.analysedUrl?.url) workflow.source.normalizedUrl = clean(analysis.analysedUrl.url, 2000);
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      productUrl: workflow.source.normalizedUrl || project.productUrl || null,
      workflowJson: JSON.stringify(workflow),
      updatedAt: new Date()
    }
  });
  return projectView(updated);
}

async function saveCampaignSetup(userId, projectId, input = {}) {
  const project = await requireProject(userId, projectId);
  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  if (!workflow.analysis) {
    throw publicError(
      'Analyse the product before configuring the campaign.',
      'CREATIVE_FLOW_PRODUCT_ANALYSIS_REQUIRED',
      409
    );
  }

  const allowedPlatforms = new Map([
    ['facebook', 'Facebook'],
    ['instagram', 'Instagram'],
    ['x', 'X'],
    ['linkedin', 'LinkedIn'],
    ['tiktok', 'TikTok'],
    ['threads', 'Threads'],
    ['bluesky', 'Bluesky'],
    ['pinterest', 'Pinterest']
  ]);
  const platforms = [];
  for (const value of Array.isArray(input.platforms) ? input.platforms : []) {
    const normalized = allowedPlatforms.get(String(value || '').trim().toLowerCase());
    if (normalized && !platforms.includes(normalized)) platforms.push(normalized);
  }
  workflow.campaignSetup = {
    goal: clean(input.goal || 'AI Recommended', 120) || 'AI Recommended',
    platforms: platforms.length ? platforms : ['Instagram'],
    creativeCount: Math.max(1, Math.min(50, Number(input.creativeCount || 20))),
    style: clean(input.style || 'AI Recommended', 160) || 'AI Recommended',
    audience: clean(input.audience, 500)
  };

  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      status: 'WAITING',
      currentStage: 'CAMPAIGN_READY',
      workflowJson: JSON.stringify(workflow),
      lastError: null,
      updatedAt: new Date()
    }
  });
  return projectView(updated);
}

async function saveCanvasState(userId, projectId, input = {}) {
  const project = await requireProject(userId, projectId);
  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  const positions = input.positions && typeof input.positions === 'object' ? input.positions : {};
  workflow.canvas.positions = {
    productUrl: cleanPosition(positions.productUrl, workflow.canvas.positions.productUrl),
    productImages: cleanPosition(positions.productImages, workflow.canvas.positions.productImages),
    analyzeProduct: cleanPosition(positions.analyzeProduct, workflow.canvas.positions.analyzeProduct),
    productIntelligence: cleanPosition(positions.productIntelligence, workflow.canvas.positions.productIntelligence),
    campaignSetup: cleanPosition(positions.campaignSetup, workflow.canvas.positions.campaignSetup)
  };
  workflow.canvas.viewport = cleanViewport(input.viewport, workflow.canvas.viewport);
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: { workflowJson: JSON.stringify(workflow), updatedAt: new Date() }
  });
  return projectView(updated);
}

module.exports = {
  listProjects,
  createProject,
  getProject,
  openProject,
  renameProject,
  archiveProject,
  activeProject,
  claimActiveJob,
  updateActiveJob,
  releaseActiveJob,
  saveProductSource,
  saveProductAnalysis,
  saveCampaignSetup,
  saveCanvasState,
  projectView,
  normalizeWorkflow,
  publicError
};
