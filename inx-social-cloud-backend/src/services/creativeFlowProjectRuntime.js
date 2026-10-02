const prisma = require('../db/prisma');
const postStudio = require('./aiPostStudioService');
const creativeFlow = require('./creativeFlowService');
const projects = require('./creativeFlowProjectService');

const activeProductAnalyses = new Set();
const activeStrategyPlans = new Set();
const activeRenderStarts = new Set();
const activeCreativeRegenerations = new Set();
const renderMonitorTimers = new Map();
let runtimeStarted = false;

function clean(value, max = 800) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function normalizedWebsite(value) {
  const input = clean(value, 2000);
  if (!input) return '';
  const normalized = postStudio.normalizeUrl(input);
  if (!normalized) {
    throw projects.publicError(
      'Enter a public product or business website.',
      'CREATIVE_FLOW_URL_INVALID',
      400
    );
  }
  return normalized;
}

function projectProductName(project) {
  return clean(
    project.workflow?.analysis?.sourceAnalysis?.productName ||
    project.workflow?.analysis?.brandPack?.brandName ||
    project.name,
    160
  );
}

function projectStrategyPrompt(project) {
  const setup = project.workflow?.campaignSetup || {};
  const product = projectProductName(project) || 'this product';
  return [
    `Create a ${clean(setup.goal || 'social marketing', 120)} campaign for ${product}.`,
    'Use Product Intelligence as the factual source of truth.',
    'Plan distinct concepts with materially different hooks, compositions and message angles.',
    'Do not invent unsupported claims, prices, testimonials, integrations, awards or performance statistics.'
  ].join(' ');
}

async function processProductAnalysis(userId, projectId) {
  const project = await projects.getProject(userId, projectId);
  if (!project || project.activeJobType !== 'PRODUCT_ANALYSIS') return;

  const source = project.workflow?.source || {};
  try {
    await projects.updateActiveJob(userId, projectId, {
      currentStage: 'PRODUCT_ANALYSIS_RUNNING',
      progressCurrent: 1,
      progressTotal: 5,
      progressLabel: source.normalizedUrl
        ? 'Collecting the product website and supplied references'
        : 'Collecting the supplied product references'
    });

    const analysis = await creativeFlow.analyzeCreativeFlow(userId, {
      website: source.normalizedUrl || source.websiteInput || '',
      productName: '',
      prompt: 'Understand this product and brand for a future Creative Flow campaign. Extract only evidence supported by the supplied website and product references.',
      audience: '',
      referenceAssetIds: source.referenceAssetIds || []
    }, {
      onProgress: ({ current, total, label }) => projects.updateActiveJob(userId, projectId, {
        currentStage: 'PRODUCT_ANALYSIS_RUNNING',
        progressCurrent: current,
        progressTotal: total,
        progressLabel: label
      })
    });

    await projects.saveProductAnalysis(userId, projectId, analysis);
    await projects.releaseActiveJob(userId, projectId, {
      status: 'WAITING',
      currentStage: 'PRODUCT_READY',
      progressCurrent: 5,
      progressTotal: 5,
      progressLabel: 'Product Intelligence ready'
    });
  } catch (error) {
    console.error('[CREATIVE FLOW PRODUCT ANALYSIS]', projectId, clean(error?.message, 800));
    await projects.releaseActiveJob(userId, projectId, {
      status: 'FAILED',
      currentStage: 'PRODUCT_ANALYSIS_FAILED',
      progressLabel: 'Product analysis needs attention',
      lastError: error?.publicMessage || error?.message || 'Product analysis failed.'
    }).catch(() => {});
  }
}

function queueProductAnalysis(userId, projectId) {
  const key = String(projectId);
  if (activeProductAnalyses.has(key)) return;
  activeProductAnalyses.add(key);
  setImmediate(() => {
    void processProductAnalysis(userId, projectId)
      .catch(error => console.error('[CREATIVE FLOW PRODUCT QUEUE]', key, clean(error?.message, 800)))
      .finally(() => activeProductAnalyses.delete(key));
  });
}

async function startProductAnalysis(userId, projectId, input = {}) {
  const websiteInput = clean(input.website, 2000);
  const normalizedUrl = normalizedWebsite(websiteInput);
  const referenceAssetIds = [...new Set((Array.isArray(input.referenceAssetIds) ? input.referenceAssetIds : [])
    .map(value => clean(value, 120)).filter(Boolean))].slice(0, 8);
  const referenceNames = (Array.isArray(input.referenceNames) ? input.referenceNames : [])
    .map(value => clean(value, 220)).filter(Boolean).slice(0, 8);

  if (!normalizedUrl && !referenceAssetIds.length) {
    throw projects.publicError(
      'Add a product website or at least one product image before analysing.',
      'CREATIVE_FLOW_PRODUCT_SOURCE_REQUIRED',
      400
    );
  }

  await projects.saveProductSource(userId, projectId, {
    websiteInput,
    normalizedUrl,
    referenceAssetIds,
    referenceNames
  });

  const claimed = await projects.claimActiveJob(userId, projectId, {
    jobType: 'PRODUCT_ANALYSIS',
    currentStage: 'PRODUCT_ANALYSIS_RUNNING',
    progressCurrent: 0,
    progressTotal: 5,
    progressLabel: 'Preparing product sources'
  });

  queueProductAnalysis(userId, projectId);
  return claimed;
}

async function processStrategyPlanning(userId, projectId) {
  const project = await projects.getProject(userId, projectId);
  if (!project || project.activeJobType !== 'STRATEGY_PLANNING') return;

  try {
    const analysis = project.workflow?.analysis;
    const setup = project.workflow?.campaignSetup;
    if (!analysis || !setup?.platforms?.length) {
      throw projects.publicError(
        'Complete Product Intelligence and Campaign Setup before building strategy.',
        'CREATIVE_FLOW_CAMPAIGN_SETUP_REQUIRED',
        409
      );
    }

    await projects.updateActiveJob(userId, projectId, {
      currentStage: 'STRATEGY_PLANNING',
      progressCurrent: 1,
      progressTotal: 3,
      progressLabel: 'Building campaign foundation'
    });

    const plan = await creativeFlow.planCreativeFlow(userId, {
      productName: projectProductName(project),
      prompt: projectStrategyPrompt(project),
      platforms: setup.platforms,
      creativeCount: setup.creativeCount,
      goal: setup.goal,
      style: setup.style,
      audience: setup.audience,
      sourceAnalysis: analysis.sourceAnalysis
    });

    await projects.updateActiveJob(userId, projectId, {
      progressCurrent: 2,
      progressTotal: 3,
      progressLabel: `Planning ${plan.concepts.length} distinct creative concepts`
    });
    await projects.saveStrategyPlan(userId, projectId, plan);
    await projects.releaseActiveJob(userId, projectId, {
      status: 'WAITING',
      currentStage: 'STRATEGY_READY',
      progressCurrent: 3,
      progressTotal: 3,
      progressLabel: `${plan.concepts.length} creative concepts ready`
    });
  } catch (error) {
    console.error('[CREATIVE FLOW STRATEGY]', projectId, clean(error?.message, 800));
    await projects.releaseActiveJob(userId, projectId, {
      status: 'FAILED',
      currentStage: 'STRATEGY_FAILED',
      progressLabel: 'Creative strategy needs attention',
      lastError: error?.publicMessage || error?.message || 'Creative strategy failed.'
    }).catch(() => {});
  }
}

function queueStrategyPlanning(userId, projectId) {
  const key = String(projectId);
  if (activeStrategyPlans.has(key)) return;
  activeStrategyPlans.add(key);
  setImmediate(() => {
    void processStrategyPlanning(userId, projectId)
      .catch(error => console.error('[CREATIVE FLOW STRATEGY QUEUE]', key, clean(error?.message, 800)))
      .finally(() => activeStrategyPlans.delete(key));
  });
}

async function startStrategyPlanning(userId, projectId) {
  const project = await projects.getProject(userId, projectId);
  if (project.renderCampaignId) {
    throw projects.publicError(
      'Strategy is locked after creative generation starts.',
      'CREATIVE_FLOW_UPSTREAM_LOCKED',
      409
    );
  }
  if (!project.workflow?.analysis || !project.workflow?.campaignSetup?.platforms?.length) {
    throw projects.publicError(
      'Complete Product Intelligence and Campaign Setup before building strategy.',
      'CREATIVE_FLOW_CAMPAIGN_SETUP_REQUIRED',
      409
    );
  }

  const claimed = await projects.claimActiveJob(userId, projectId, {
    jobType: 'STRATEGY_PLANNING',
    currentStage: 'STRATEGY_PLANNING',
    progressCurrent: 0,
    progressTotal: 3,
    progressLabel: 'Preparing campaign strategy'
  });
  queueStrategyPlanning(userId, projectId);
  return claimed;
}

async function generationEstimate(userId, projectId) {
  const project = await projects.getProject(userId, projectId);
  const concepts = Array.isArray(project.workflow?.strategyPlan?.concepts)
    ? project.workflow.strategyPlan.concepts
    : [];
  const selected = new Set(project.workflow?.selectedConceptSequences || []);
  const count = concepts.filter(concept => selected.has(Number(concept.sequence))).length;
  if (!count) {
    throw projects.publicError(
      'Keep at least one strategy concept before generation.',
      'CREATIVE_FLOW_CONCEPT_SELECTION_REQUIRED',
      400
    );
  }
  return creativeFlow.estimateCreativeFlowRender(userId, count);
}

async function recoverLinkedCampaign(userId, projectId) {
  return prisma.aiPostCampaign.findFirst({
    where: {
      userId,
      analysisJson: { contains: `"projectId":"${String(projectId)}"` }
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true }
  });
}

async function processRenderStart(userId, projectId) {
  const project = await projects.getProject(userId, projectId);
  if (!project || project.activeJobType !== 'CREATIVE_RENDER') return;

  try {
    if (project.renderCampaignId) {
      queueRenderMonitor(userId, projectId, project.renderCampaignId, 300);
      return;
    }

    const recovered = await recoverLinkedCampaign(userId, projectId);
    if (recovered?.id) {
      await projects.linkRenderCampaign(userId, projectId, recovered.id, {});
      queueRenderMonitor(userId, projectId, recovered.id, 300);
      return;
    }

    const analysis = project.workflow?.analysis;
    const setup = project.workflow?.campaignSetup;
    const strategyPlan = project.workflow?.strategyPlan;
    const selected = new Set(project.workflow?.selectedConceptSequences || []);
    const concepts = (Array.isArray(strategyPlan?.concepts) ? strategyPlan.concepts : [])
      .filter(concept => selected.has(Number(concept.sequence)));

    if (!analysis || !strategyPlan || !concepts.length) {
      throw projects.publicError(
        'Build and select a creative strategy before generation.',
        'CREATIVE_FLOW_STRATEGY_REQUIRED',
        409
      );
    }

    await projects.updateActiveJob(userId, projectId, {
      currentStage: 'CREATIVE_RENDER_STARTING',
      progressCurrent: 0,
      progressTotal: concepts.length,
      progressLabel: 'Checking credits and preparing the render queue'
    });

    const response = await creativeFlow.startCreativeFlowRender(userId, {
      projectId,
      website: project.workflow?.source?.normalizedUrl || '',
      productName: projectProductName(project),
      prompt: projectStrategyPrompt(project),
      platforms: setup.platforms,
      goal: setup.goal,
      style: setup.style,
      audience: setup.audience,
      referenceAssetIds: project.workflow?.source?.referenceAssetIds || [],
      sourceAnalysis: analysis.sourceAnalysis,
      brandPack: analysis.brandPack,
      strategy: strategyPlan.strategy,
      concepts
    });

    await projects.linkRenderCampaign(userId, projectId, response.campaign.id, {
      plannedCredits: response.plannedCredits,
      creditsPerCreative: response.creditsPerCreative
    });
    await projects.updateActiveJob(userId, projectId, {
      currentStage: 'CREATIVE_RENDER_RUNNING',
      progressCurrent: 0,
      progressTotal: concepts.length,
      progressLabel: 'Creative generation is running in the background'
    });
    queueRenderMonitor(userId, projectId, response.campaign.id, 650);
  } catch (error) {
    console.error('[CREATIVE FLOW RENDER START]', projectId, clean(error?.message, 800));
    await projects.releaseActiveJob(userId, projectId, {
      status: 'FAILED',
      currentStage: 'CREATIVE_RENDER_FAILED',
      progressLabel: 'Creative generation could not start',
      lastError: error?.publicMessage || error?.message || 'Creative generation failed.'
    }).catch(() => {});
  }
}

function queueRenderStart(userId, projectId) {
  const key = String(projectId);
  if (activeRenderStarts.has(key)) return;
  activeRenderStarts.add(key);
  setImmediate(() => {
    void processRenderStart(userId, projectId)
      .catch(error => console.error('[CREATIVE FLOW RENDER QUEUE]', key, clean(error?.message, 800)))
      .finally(() => activeRenderStarts.delete(key));
  });
}

function queueRenderMonitor(userId, projectId, campaignId, delayMs = 1800) {
  const key = String(projectId);
  const existing = renderMonitorTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    renderMonitorTimers.delete(key);
    void monitorRender(userId, projectId, campaignId);
  }, Math.max(250, Number(delayMs || 1800)));
  if (typeof timer.unref === 'function') timer.unref();
  renderMonitorTimers.set(key, timer);
}

async function monitorRender(userId, projectId, campaignId) {
  const project = await projects.getProject(userId, projectId);
  if (!project || project.activeJobType !== 'CREATIVE_RENDER') return;

  try {
    const campaign = await creativeFlow.getCreativeFlowRender(userId, campaignId);
    const posts = Array.isArray(campaign.posts) ? campaign.posts : [];
    const ready = posts.filter(post => Boolean(post.mediaAsset?.url || post.mediaAssetId)).length;
    const total = Math.max(Number(campaign.imagePostCount || 0), posts.length, 1);

    await projects.updateActiveJob(userId, projectId, {
      currentStage: 'CREATIVE_RENDER_RUNNING',
      progressCurrent: ready,
      progressTotal: total,
      progressLabel: `${ready} of ${total} creatives generated`
    });

    if (campaign.status === 'GENERATING_IMAGES') {
      queueRenderMonitor(userId, projectId, campaignId, 1800);
      return;
    }

    if (campaign.status === 'READY' && ready >= total) {
      await projects.releaseActiveJob(userId, projectId, {
        status: 'WAITING',
        currentStage: 'RENDER_READY',
        progressCurrent: ready,
        progressTotal: total,
        progressLabel: `${ready} creatives ready for review`
      });
      return;
    }

    if (campaign.status === 'PARTIAL') {
      await projects.releaseActiveJob(userId, projectId, {
        status: 'WAITING',
        currentStage: 'RENDER_PARTIAL',
        progressCurrent: ready,
        progressTotal: total,
        progressLabel: `${ready} of ${total} creatives ready · some need retry`
      });
      return;
    }

    await projects.releaseActiveJob(userId, projectId, {
      status: 'FAILED',
      currentStage: 'CREATIVE_RENDER_FAILED',
      progressCurrent: ready,
      progressTotal: total,
      progressLabel: 'Creative generation needs attention',
      lastError: 'The render campaign stopped before all creatives were ready.'
    });
  } catch (error) {
    console.error('[CREATIVE FLOW RENDER MONITOR]', projectId, clean(error?.message, 800));
    queueRenderMonitor(userId, projectId, campaignId, 2800);
  }
}

async function startGeneration(userId, projectId) {
  const estimate = await generationEstimate(userId, projectId);
  if (!estimate.canGenerate) {
    throw projects.publicError(
      `This Creative Flow render needs ${estimate.requiredCredits} AI credits, but only ${estimate.creditsRemaining} credits remain.`,
      'CREATIVE_FLOW_CREDITS_INSUFFICIENT',
      402
    );
  }
  const claimed = await projects.claimActiveJob(userId, projectId, {
    jobType: 'CREATIVE_RENDER',
    currentStage: 'CREATIVE_RENDER_STARTING',
    progressCurrent: 0,
    progressTotal: estimate.count,
    progressLabel: 'Preparing creative generation'
  });
  queueRenderStart(userId, projectId);
  return claimed;
}

async function retryMissingGeneration(userId, projectId) {
  const project = await projects.reconcileProjectState(userId, projectId);
  if (!project.renderCampaignId) {
    throw projects.publicError('Generate creatives before retrying missing renders.', 'CREATIVE_FLOW_RENDER_REQUIRED', 409);
  }

  const campaign = await creativeFlow.getCreativeFlowRender(userId, project.renderCampaignId);
  const posts = Array.isArray(campaign.posts) ? campaign.posts : [];
  const missing = posts.filter(post => post.contentType === 'IMAGE' && !post.mediaAssetId);
  if (!missing.length) return project;

  const estimate = await creativeFlow.estimateCreativeFlowRender(userId, missing.length);
  if (!estimate.canGenerate) {
    throw projects.publicError(
      `Retrying ${missing.length} missing creative${missing.length === 1 ? '' : 's'} needs ${estimate.requiredCredits} AI credits, but only ${estimate.creditsRemaining} credits remain.`,
      'CREATIVE_FLOW_CREDITS_INSUFFICIENT',
      402
    );
  }

  const ready = posts.filter(post => post.contentType === 'IMAGE' && Boolean(post.mediaAssetId)).length;
  const claimed = await projects.claimActiveJob(userId, projectId, {
    jobType: 'CREATIVE_RENDER',
    currentStage: 'CREATIVE_RENDER_RUNNING',
    progressCurrent: ready,
    progressTotal: Math.max(posts.filter(post => post.contentType === 'IMAGE').length, 1),
    progressLabel: `Retrying ${missing.length} missing creative${missing.length === 1 ? '' : 's'}`
  });

  try {
    await creativeFlow.retryCreativeFlowRender(userId, project.renderCampaignId);
    queueRenderMonitor(userId, projectId, project.renderCampaignId, 500);
    return claimed;
  } catch (error) {
    await projects.releaseActiveJob(userId, projectId, {
      status: 'FAILED',
      currentStage: 'CREATIVE_RENDER_FAILED',
      progressCurrent: ready,
      progressTotal: Math.max(posts.filter(post => post.contentType === 'IMAGE').length, 1),
      progressLabel: 'Missing creative retry could not start',
      lastError: error?.publicMessage || error?.message || 'Missing creative retry could not start.'
    }).catch(() => {});
    throw error;
  }
}

async function processCreativeRegeneration(userId, projectId) {
  const project = await projects.getProject(userId, projectId);
  if (!project || project.activeJobType !== 'CREATIVE_REGENERATE' || !project.renderCampaignId || !project.activeJobId) return;

  try {
    await projects.updateActiveJob(userId, projectId, {
      currentStage: 'CREATIVE_REGENERATING',
      progressCurrent: 0,
      progressTotal: 1,
      progressLabel: 'Creating a new version of this creative'
    });

    const campaign = await creativeFlow.regenerateCreativeFlowPost(
      userId,
      project.renderCampaignId,
      project.activeJobId
    );
    await projects.clearReviewFailure(userId, projectId, project.activeJobId);
    const ready = (Array.isArray(campaign.posts) ? campaign.posts : [])
      .filter(post => Boolean(post.mediaAsset?.url || post.mediaAssetId)).length;
    const total = Math.max(Number(campaign.imagePostCount || 0), 1);

    await projects.releaseActiveJob(userId, projectId, {
      status: 'WAITING',
      currentStage: campaign.status === 'PARTIAL' ? 'RENDER_PARTIAL' : 'RENDER_READY',
      progressCurrent: ready,
      progressTotal: total,
      progressLabel: 'Creative regenerated and ready for review'
    });
  } catch (error) {
    console.error('[CREATIVE FLOW REGENERATE]', projectId, clean(error?.message, 800));
    await projects.markReviewFailure(
      userId,
      projectId,
      project.activeJobId,
      error?.publicMessage || error?.message || 'Creative regeneration failed.'
    ).catch(() => {});
    await projects.releaseActiveJob(userId, projectId, {
      status: 'FAILED',
      currentStage: 'CREATIVE_REGENERATE_FAILED',
      progressLabel: 'This creative needs another try',
      lastError: error?.publicMessage || error?.message || 'Creative regeneration failed.'
    }).catch(() => {});
  }
}

function queueCreativeRegeneration(userId, projectId) {
  const key = String(projectId);
  if (activeCreativeRegenerations.has(key)) return;
  activeCreativeRegenerations.add(key);
  setImmediate(() => {
    void processCreativeRegeneration(userId, projectId)
      .catch(error => console.error('[CREATIVE FLOW REGENERATE QUEUE]', key, clean(error?.message, 800)))
      .finally(() => activeCreativeRegenerations.delete(key));
  });
}

async function startCreativeRegeneration(userId, projectId, postId, input = {}) {
  const project = await projects.getProject(userId, projectId);
  if (!project.renderCampaignId) {
    throw projects.publicError('Generate creatives before regenerating one.', 'CREATIVE_FLOW_RENDER_REQUIRED', 409);
  }

  const estimate = await creativeFlow.estimateCreativeFlowRender(userId, 1);
  if (!estimate.canGenerate) {
    throw projects.publicError(
      `Regenerating this creative needs ${estimate.requiredCredits} AI credits, but only ${estimate.creditsRemaining} credits remain.`,
      'CREATIVE_FLOW_CREDITS_INSUFFICIENT',
      402
    );
  }

  const claimed = await projects.claimActiveJob(userId, projectId, {
    jobType: 'CREATIVE_REGENERATE',
    jobId: String(postId),
    currentStage: 'CREATIVE_REGENERATING',
    progressCurrent: 0,
    progressTotal: 1,
    progressLabel: 'Preparing a new creative version'
  });

  try {
    await projects.clearReviewFailure(userId, projectId, postId);
    await creativeFlow.editCreativeFlowPost(userId, project.renderCampaignId, postId, {
      caption: input.caption,
      imageBrief: input.imageBrief,
      regenerate: false
    });
  } catch (error) {
    await projects.releaseActiveJob(userId, projectId, {
      status: 'FAILED',
      currentStage: 'CREATIVE_REGENERATE_FAILED',
      progressLabel: 'Creative changes could not be saved',
      lastError: error?.publicMessage || error?.message || 'Creative changes could not be saved.'
    }).catch(() => {});
    throw error;
  }

  queueCreativeRegeneration(userId, projectId);
  return claimed;
}

async function startCreativeFlowProjectRuntime() {
  if (runtimeStarted) return;
  runtimeStarted = true;
  try {
    const pending = await prisma.creativeFlowProject.findMany({
      where: {
        archivedAt: null,
        activeJobType: { in: ['PRODUCT_ANALYSIS', 'STRATEGY_PLANNING', 'CREATIVE_RENDER', 'CREATIVE_REGENERATE'] }
      },
      select: { id: true, userId: true, activeJobType: true, activeJobId: true, renderCampaignId: true },
      orderBy: { activeJobStartedAt: 'asc' },
      take: 100
    });

    pending.forEach(project => {
      if (project.activeJobType === 'PRODUCT_ANALYSIS') {
        queueProductAnalysis(project.userId, project.id);
      } else if (project.activeJobType === 'STRATEGY_PLANNING') {
        queueStrategyPlanning(project.userId, project.id);
      } else if (project.activeJobType === 'CREATIVE_RENDER') {
        if (project.renderCampaignId) queueRenderMonitor(project.userId, project.id, project.renderCampaignId, 500);
        else queueRenderStart(project.userId, project.id);
      } else if (project.activeJobType === 'CREATIVE_REGENERATE') {
        queueCreativeRegeneration(project.userId, project.id);
      }
    });

    if (pending.length) {
      console.info(
        '[CREATIVE FLOW PROJECT RUNTIME]',
        'Resumed ' + pending.length + ' project job' + (pending.length === 1 ? '' : 's') + '.'
      );
    }
  } catch (error) {
    runtimeStarted = false;
    console.error('[CREATIVE FLOW PROJECT RUNTIME]', clean(error?.message, 800));
  }
}

module.exports = {
  startProductAnalysis,
  processProductAnalysis,
  queueProductAnalysis,
  startStrategyPlanning,
  processStrategyPlanning,
  queueStrategyPlanning,
  generationEstimate,
  startGeneration,
  retryMissingGeneration,
  processRenderStart,
  queueRenderStart,
  monitorRender,
  queueRenderMonitor,
  startCreativeRegeneration,
  processCreativeRegeneration,
  queueCreativeRegeneration,
  startCreativeFlowProjectRuntime,
  normalizedWebsite
};
