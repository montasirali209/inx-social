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
      campaignSetup: { x: 1280, y: 215 },
      creativeStrategy: { x: 1710, y: 185 },
      generateCreatives: { x: 2160, y: 225 }
    },
    creativePositions: {},
    schedulePosition: null,
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

function normalizeWorkflow(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const defaults = defaultCanvas();
  const positions = input.canvas?.positions && typeof input.canvas.positions === 'object'
    ? input.canvas.positions
    : {};
  const rawCreativePositions = input.canvas?.creativePositions && typeof input.canvas.creativePositions === 'object'
    ? input.canvas.creativePositions
    : {};
  const creativePositions = Object.fromEntries(
    Object.entries(rawCreativePositions)
      .map(([key, value]) => [clean(key, 160), cleanPosition(value, { x: 0, y: 0 })])
      .filter(([key]) => Boolean(key))
      .slice(0, 50)
  );
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
    strategyPlan: input.strategyPlan && typeof input.strategyPlan === 'object' && !Array.isArray(input.strategyPlan)
      ? input.strategyPlan
      : null,
    selectedConceptSequences: (Array.isArray(input.selectedConceptSequences) ? input.selectedConceptSequences : [])
      .map(Number)
      .filter(value => Number.isInteger(value) && value > 0 && value <= 50)
      .slice(0, 50),
    generation: {
      plannedCredits: Math.max(0, Number(input.generation?.plannedCredits || 0)),
      creditsPerCreative: Math.max(0, Number(input.generation?.creditsPerCreative || 0))
    },
    review: {
      selectedPostIds: [...new Set((Array.isArray(input.review?.selectedPostIds) ? input.review.selectedPostIds : [])
        .map(value => clean(value, 160))
        .filter(Boolean))].slice(0, 50),
      revealedPostIds: [...new Set((Array.isArray(input.review?.revealedPostIds) ? input.review.revealedPostIds : [])
        .map(value => clean(value, 160))
        .filter(Boolean))].slice(0, 50),
      failedPostId: clean(input.review?.failedPostId, 160) || null,
      failedPostError: clean(input.review?.failedPostError, 1200) || null
    },
    canvas: {
      positions: {
        productUrl: cleanPosition(positions.productUrl, defaults.positions.productUrl),
        productImages: cleanPosition(positions.productImages, defaults.positions.productImages),
        analyzeProduct: cleanPosition(positions.analyzeProduct, defaults.positions.analyzeProduct),
        productIntelligence: cleanPosition(positions.productIntelligence, defaults.positions.productIntelligence),
        campaignSetup: cleanPosition(positions.campaignSetup, defaults.positions.campaignSetup),
        creativeStrategy: cleanPosition(positions.creativeStrategy, defaults.positions.creativeStrategy),
        generateCreatives: cleanPosition(positions.generateCreatives, defaults.positions.generateCreatives)
      },
      creativePositions,
      schedulePosition: input.canvas?.schedulePosition
        ? cleanPosition(input.canvas.schedulePosition, { x: 0, y: 0 })
        : null,
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
    activeJobId: project.activeJobId || null,
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
  const [projects, archivedProjects] = await Promise.all([
    prisma.creativeFlowProject.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ activeJobType: 'desc' }, { updatedAt: 'desc' }],
      take: 100
    }),
    prisma.creativeFlowProject.findMany({
      where: { userId, archivedAt: { not: null } },
      orderBy: { archivedAt: 'desc' },
      take: 50
    })
  ]);
  const active = projects.find(project => Boolean(project.activeJobType)) || null;
  return {
    projects: projects.map(projectView),
    archivedProjects: archivedProjects.map(projectView),
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

async function reconcileProjectState(userId, projectId, options = {}) {
  const project = await requireProject(userId, projectId);
  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  const data = {};
  let workflowChanged = false;

  if (options.touchOpened) data.lastOpenedAt = new Date();

  if (project.renderCampaignId) {
    const campaign = await prisma.aiPostCampaign.findFirst({
      where: { id: project.renderCampaignId, userId },
      include: {
        posts: {
          orderBy: { sequence: 'asc' },
          select: { id: true, contentType: true, mediaAssetId: true }
        }
      }
    });

    if (!campaign) {
      data.renderCampaignId = null;
      data.handoffCampaignId = null;
      data.status = 'WAITING';
      data.currentStage = workflow.strategyPlan ? 'STRATEGY_READY' : 'CAMPAIGN_READY';
      data.progressCurrent = 0;
      data.progressTotal = 0;
      data.progressLabel = 'Render campaign was unavailable; the project was restored to the last safe planning stage.';
      if (['CREATIVE_RENDER', 'CREATIVE_REGENERATE'].includes(project.activeJobType)) {
        data.activeJobType = null;
        data.activeJobId = null;
        data.activeJobStartedAt = null;
      }
      workflow.review.selectedPostIds = [];
      workflow.review.revealedPostIds = [];
      workflow.review.failedPostId = null;
      workflow.review.failedPostError = null;
      workflow.canvas.creativePositions = {};
      workflow.canvas.schedulePosition = null;
      workflowChanged = true;
    } else {
      const imagePosts = campaign.posts.filter(post => post.contentType === 'IMAGE');
      const validIds = new Set(imagePosts.map(post => post.id));
      const completedIds = new Set(imagePosts.filter(post => Boolean(post.mediaAssetId)).map(post => post.id));
      const ready = completedIds.size;
      const total = imagePosts.length;

      const selected = workflow.review.selectedPostIds.filter(id => completedIds.has(id));
      if (selected.length !== workflow.review.selectedPostIds.length) {
        workflow.review.selectedPostIds = selected;
        workflowChanged = true;
      }

      const persistedReveal = workflow.review.revealedPostIds.filter(id => validIds.has(id));
      const revealed = campaign.status === 'GENERATING_IMAGES'
        ? persistedReveal
        : imagePosts.map(post => post.id);
      if (
        revealed.length !== workflow.review.revealedPostIds.length
        || revealed.some((id, index) => id !== workflow.review.revealedPostIds[index])
      ) {
        workflow.review.revealedPostIds = revealed;
        workflowChanged = true;
      }

      // Stage 6 review nodes use a deterministic fixed graph. Discard Stage 5
      // persisted creative/schedule positions so old projects cannot reopen with
      // overlapping or user-moved final nodes.
      if (Object.keys(workflow.canvas.creativePositions || {}).length) {
        workflow.canvas.creativePositions = {};
        workflowChanged = true;
      }
      if (workflow.canvas.schedulePosition) {
        workflow.canvas.schedulePosition = null;
        workflowChanged = true;
      }

      if (workflow.review.failedPostId && !validIds.has(workflow.review.failedPostId)) {
        workflow.review.failedPostId = null;
        workflow.review.failedPostError = null;
        workflowChanged = true;
      }

      data.progressCurrent = ready;
      data.progressTotal = total;

      if (campaign.status === 'GENERATING_IMAGES') {
        if (!project.activeJobType) {
          const active = await activeProject(userId);
          if (!active || active.id === project.id) {
            data.activeJobType = 'CREATIVE_RENDER';
            data.activeJobId = null;
            data.activeJobStartedAt = new Date();
            data.status = ACTIVE_STATUS;
            data.currentStage = 'CREATIVE_RENDER_RUNNING';
          }
        }
        data.progressLabel = `${ready} of ${total} creatives generated`;
      } else if (project.activeJobType === 'CREATIVE_RENDER') {
        data.activeJobType = null;
        data.activeJobId = null;
        data.activeJobStartedAt = null;
        data.status = 'WAITING';
        data.currentStage = selected.length
          ? 'REVIEW_READY'
          : campaign.status === 'READY'
            ? 'RENDER_READY'
            : 'RENDER_PARTIAL';
        data.progressLabel = campaign.status === 'READY'
          ? `${ready} creatives ready for review`
          : `${ready} of ${total} creatives ready · some need retry`;
      } else if (!project.activeJobType && !['HANDOFF_READY', 'REVIEW_READY'].includes(project.currentStage)) {
        data.status = 'WAITING';
        data.currentStage = selected.length
          ? 'REVIEW_READY'
          : campaign.status === 'READY'
            ? 'RENDER_READY'
            : 'RENDER_PARTIAL';
        data.progressLabel = campaign.status === 'READY'
          ? `${ready} creatives ready for review`
          : `${ready} of ${total} creatives ready · some need retry`;
      }
    }
  }

  if (project.handoffCampaignId) {
    const handoff = await prisma.aiPostCampaign.findFirst({
      where: { id: project.handoffCampaignId, userId },
      select: { id: true }
    });
    if (handoff) {
      data.status = 'WAITING';
      data.currentStage = 'HANDOFF_READY';
      data.progressLabel = 'Approved creatives sent to Bulk Scheduler';
    } else {
      data.handoffCampaignId = null;
      if (project.currentStage === 'HANDOFF_READY') {
        data.currentStage = workflow.review.selectedPostIds.length ? 'REVIEW_READY' : 'RENDER_READY';
        data.progressLabel = workflow.review.selectedPostIds.length
          ? `${workflow.review.selectedPostIds.length} creatives selected for review`
          : project.progressLabel;
      }
    }
  }

  if (workflowChanged) data.workflowJson = JSON.stringify(workflow);
  if (!Object.keys(data).length) return projectView(project);

  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data
  });
  return projectView(updated);
}

async function getProject(userId, projectId) {
  return reconcileProjectState(userId, projectId);
}

async function openProject(userId, projectId) {
  return reconcileProjectState(userId, projectId, { touchOpened: true });
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

async function restoreProject(userId, projectId) {
  const project = await prisma.creativeFlowProject.findFirst({
    where: { id: String(projectId), userId, archivedAt: { not: null } }
  });
  if (!project) {
    throw publicError('Archived Creative Flow project not found.', 'CREATIVE_FLOW_ARCHIVED_PROJECT_NOT_FOUND', 404);
  }
  const restored = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      archivedAt: null,
      status: project.currentStage === 'PROJECT_CREATED' ? 'DRAFT' : 'WAITING',
      lastOpenedAt: new Date(),
      updatedAt: new Date()
    }
  });
  return reconcileProjectState(userId, restored.id, { touchOpened: true });
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
      activeJobType: input.jobType == null ? undefined : clean(input.jobType, 80),
      activeJobId: input.jobId == null ? undefined : (clean(input.jobId, 160) || null),
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
  if (project.renderCampaignId) {
    throw publicError(
      'Product sources are locked after creative generation starts.',
      'CREATIVE_FLOW_UPSTREAM_LOCKED',
      409
    );
  }
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
  workflow.strategyPlan = null;
  workflow.selectedConceptSequences = [];
  workflow.generation = { plannedCredits: 0, creditsPerCreative: 0 };
  workflow.review = { selectedPostIds: [] };
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
  if (project.renderCampaignId) {
    throw publicError(
      'Campaign Setup is locked after creative generation starts.',
      'CREATIVE_FLOW_UPSTREAM_LOCKED',
      409
    );
  }
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
  workflow.strategyPlan = null;
  workflow.selectedConceptSequences = [];
  workflow.generation = { plannedCredits: 0, creditsPerCreative: 0 };
  workflow.review = { selectedPostIds: [] };

  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      status: 'WAITING',
      currentStage: 'CAMPAIGN_READY',
      renderCampaignId: null,
      handoffCampaignId: null,
      workflowJson: JSON.stringify(workflow),
      lastError: null,
      updatedAt: new Date()
    }
  });
  return projectView(updated);
}

async function saveStrategyPlan(userId, projectId, strategyPlan) {
  const project = await requireProject(userId, projectId);
  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  if (!workflow.analysis || !workflow.campaignSetup?.platforms?.length) {
    throw publicError(
      'Complete Product Intelligence and Campaign Setup before building strategy.',
      'CREATIVE_FLOW_CAMPAIGN_SETUP_REQUIRED',
      409
    );
  }
  const plan = strategyPlan && typeof strategyPlan === 'object' && !Array.isArray(strategyPlan)
    ? strategyPlan
    : null;
  const concepts = Array.isArray(plan?.concepts) ? plan.concepts.slice(0, 50) : [];
  if (!plan || !concepts.length) {
    throw publicError('Creative Flow strategy did not return any concepts.', 'CREATIVE_FLOW_STRATEGY_EMPTY', 502);
  }
  workflow.strategyPlan = plan;
  workflow.selectedConceptSequences = concepts
    .map(concept => Number(concept.sequence))
    .filter(value => Number.isInteger(value) && value > 0 && value <= 50);
  workflow.generation = { plannedCredits: 0, creditsPerCreative: 0 };
  workflow.review = { selectedPostIds: [] };

  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      status: 'WAITING',
      currentStage: 'STRATEGY_READY',
      renderCampaignId: null,
      handoffCampaignId: null,
      workflowJson: JSON.stringify(workflow),
      lastError: null,
      updatedAt: new Date()
    }
  });
  return projectView(updated);
}

async function saveStrategySelection(userId, projectId, sequences) {
  const project = await requireProject(userId, projectId);
  if (project.renderCampaignId) {
    throw publicError(
      'Strategy selection is locked after creative generation starts.',
      'CREATIVE_FLOW_UPSTREAM_LOCKED',
      409
    );
  }
  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  const concepts = Array.isArray(workflow.strategyPlan?.concepts) ? workflow.strategyPlan.concepts : [];
  if (!concepts.length) {
    throw publicError('Build the creative strategy before selecting concepts.', 'CREATIVE_FLOW_STRATEGY_REQUIRED', 409);
  }
  const allowed = new Set(concepts.map(concept => Number(concept.sequence)));
  const selected = [...new Set((Array.isArray(sequences) ? sequences : []).map(Number))]
    .filter(value => Number.isInteger(value) && allowed.has(value))
    .slice(0, 50);
  if (!selected.length) {
    throw publicError('Keep at least one strategy concept.', 'CREATIVE_FLOW_CONCEPT_SELECTION_REQUIRED', 400);
  }
  workflow.selectedConceptSequences = selected;
  workflow.generation = { plannedCredits: 0, creditsPerCreative: 0 };
  workflow.review = { selectedPostIds: [] };
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      workflowJson: JSON.stringify(workflow),
      renderCampaignId: null,
      handoffCampaignId: null,
      currentStage: 'STRATEGY_READY',
      updatedAt: new Date()
    }
  });
  return projectView(updated);
}

async function linkRenderCampaign(userId, projectId, campaignId, generation = {}) {
  const project = await requireProject(userId, projectId);
  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  workflow.generation = {
    plannedCredits: Math.max(0, Number(generation.plannedCredits || 0)),
    creditsPerCreative: Math.max(0, Number(generation.creditsPerCreative || 0))
  };
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      renderCampaignId: clean(campaignId, 160) || null,
      workflowJson: JSON.stringify(workflow),
      updatedAt: new Date()
    }
  });
  return projectView(updated);
}

async function saveReviewSelection(userId, projectId, postIds) {
  const project = await requireProject(userId, projectId);
  if (!project.renderCampaignId) {
    throw publicError('Generate creatives before selecting review items.', 'CREATIVE_FLOW_RENDER_REQUIRED', 409);
  }

  const requested = [...new Set((Array.isArray(postIds) ? postIds : [])
    .map(value => clean(value, 160))
    .filter(Boolean))].slice(0, 50);

  if (requested.length) {
    const posts = await prisma.aiPostCampaignPost.findMany({
      where: {
        campaignId: project.renderCampaignId,
        id: { in: requested },
        contentType: 'IMAGE',
        mediaAssetId: { not: null }
      },
      select: { id: true }
    });
    const validIds = new Set(posts.map(post => post.id));
    if (requested.some(id => !validIds.has(id))) {
      throw publicError(
        'Only completed creatives from this project can be selected.',
        'CREATIVE_FLOW_REVIEW_SELECTION_INVALID',
        409
      );
    }
  }

  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  workflow.review.selectedPostIds = requested;
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      workflowJson: JSON.stringify(workflow),
      currentStage: requested.length ? 'REVIEW_READY' : (project.currentStage === 'HANDOFF_READY' ? 'REVIEW_READY' : project.currentStage),
      updatedAt: new Date()
    }
  });
  return projectView(updated);
}

async function saveReviewReveal(userId, projectId, postIds) {
  const project = await requireProject(userId, projectId);
  if (!project.renderCampaignId) {
    throw publicError('Generate creatives before saving review progress.', 'CREATIVE_FLOW_RENDER_REQUIRED', 409);
  }

  const requested = [...new Set((Array.isArray(postIds) ? postIds : [])
    .map(value => clean(value, 160))
    .filter(Boolean))].slice(0, 50);

  if (requested.length) {
    const posts = await prisma.aiPostCampaignPost.findMany({
      where: {
        campaignId: project.renderCampaignId,
        id: { in: requested },
        contentType: 'IMAGE',
        mediaAssetId: { not: null }
      },
      select: { id: true }
    });
    const validIds = new Set(posts.map(post => post.id));
    if (requested.some(id => !validIds.has(id))) {
      throw publicError(
        'Only completed creatives from this project can be restored in review.',
        'CREATIVE_FLOW_REVIEW_REVEAL_INVALID',
        409
      );
    }
  }

  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  workflow.review.revealedPostIds = requested;
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: { workflowJson: JSON.stringify(workflow), updatedAt: new Date() }
  });
  return projectView(updated);
}

async function markReviewFailure(userId, projectId, postId, message) {
  const project = await requireProject(userId, projectId);
  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  workflow.review.failedPostId = clean(postId, 160) || null;
  workflow.review.failedPostError = clean(message, 1200) || null;
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: { workflowJson: JSON.stringify(workflow), updatedAt: new Date() }
  });
  return projectView(updated);
}

async function clearReviewFailure(userId, projectId, postId = null) {
  const project = await requireProject(userId, projectId);
  const workflow = normalizeWorkflow(parseJson(project.workflowJson, {}));
  if (postId && workflow.review.failedPostId && workflow.review.failedPostId !== String(postId)) {
    return projectView(project);
  }
  workflow.review.failedPostId = null;
  workflow.review.failedPostError = null;
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: { workflowJson: JSON.stringify(workflow), updatedAt: new Date() }
  });
  return projectView(updated);
}

async function linkHandoffCampaign(userId, projectId, campaignId) {
  const project = await requireProject(userId, projectId);
  const updated = await prisma.creativeFlowProject.update({
    where: { id: project.id },
    data: {
      handoffCampaignId: clean(campaignId, 160) || null,
      status: 'WAITING',
      currentStage: 'HANDOFF_READY',
      progressLabel: 'Approved creatives sent to Bulk Scheduler',
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
    campaignSetup: cleanPosition(positions.campaignSetup, workflow.canvas.positions.campaignSetup),
    creativeStrategy: cleanPosition(positions.creativeStrategy, workflow.canvas.positions.creativeStrategy),
    generateCreatives: cleanPosition(positions.generateCreatives, workflow.canvas.positions.generateCreatives)
  };
  if (input.creativePositions && typeof input.creativePositions === 'object') {
    workflow.canvas.creativePositions = Object.fromEntries(
      Object.entries(input.creativePositions)
        .map(([key, value]) => [clean(key, 160), cleanPosition(value, workflow.canvas.creativePositions?.[key] || { x: 0, y: 0 })])
        .filter(([key]) => Boolean(key))
        .slice(0, 50)
    );
  }
  if (input.schedulePosition !== undefined) {
    workflow.canvas.schedulePosition = input.schedulePosition
      ? cleanPosition(input.schedulePosition, workflow.canvas.schedulePosition || { x: 0, y: 0 })
      : null;
  }
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
  reconcileProjectState,
  renameProject,
  archiveProject,
  restoreProject,
  activeProject,
  claimActiveJob,
  updateActiveJob,
  releaseActiveJob,
  saveProductSource,
  saveProductAnalysis,
  saveCampaignSetup,
  saveStrategyPlan,
  saveStrategySelection,
  linkRenderCampaign,
  saveReviewSelection,
  saveReviewReveal,
  markReviewFailure,
  clearReviewFailure,
  linkHandoffCampaign,
  saveCanvasState,
  projectView,
  normalizeWorkflow,
  publicError
};
