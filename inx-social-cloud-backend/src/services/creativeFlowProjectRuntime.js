const prisma = require('../db/prisma');
const postStudio = require('./aiPostStudioService');
const creativeFlow = require('./creativeFlowService');
const projects = require('./creativeFlowProjectService');

const activeProductAnalyses = new Set();
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

async function processProductAnalysis(userId, projectId) {
  const project = await projects.getProject(userId, projectId);
  if (!project || project.activeJobType !== 'PRODUCT_ANALYSIS') return;

  const source = project.workflow?.source || {};
  try {
    await projects.updateActiveJob(userId, projectId, {
      currentStage: 'PRODUCT_ANALYSIS_RUNNING',
      progressCurrent: 1,
      progressTotal: 3,
      progressLabel: source.normalizedUrl
        ? 'Reading the product website and supplied references'
        : 'Reading the supplied product references'
    });

    const analysis = await creativeFlow.analyzeCreativeFlow(userId, {
      website: source.normalizedUrl || source.websiteInput || '',
      productName: '',
      prompt: 'Understand this product and brand for a future Creative Flow campaign. Extract only evidence supported by the supplied website and product references.',
      audience: '',
      referenceAssetIds: source.referenceAssetIds || []
    });

    await projects.updateActiveJob(userId, projectId, {
      progressCurrent: 2,
      progressTotal: 3,
      progressLabel: 'Building Product Intelligence'
    });
    await projects.saveProductAnalysis(userId, projectId, analysis);
    await projects.releaseActiveJob(userId, projectId, {
      status: 'WAITING',
      currentStage: 'PRODUCT_READY',
      progressCurrent: 3,
      progressTotal: 3,
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
    progressTotal: 3,
    progressLabel: 'Preparing product sources'
  });

  queueProductAnalysis(userId, projectId);
  return claimed;
}

async function startCreativeFlowProjectRuntime() {
  if (runtimeStarted) return;
  runtimeStarted = true;
  try {
    const pending = await prisma.creativeFlowProject.findMany({
      where: {
        archivedAt: null,
        activeJobType: 'PRODUCT_ANALYSIS'
      },
      select: { id: true, userId: true },
      orderBy: { activeJobStartedAt: 'asc' },
      take: 100
    });
    pending.forEach(project => queueProductAnalysis(project.userId, project.id));
    if (pending.length) {
      console.info(
        '[CREATIVE FLOW PROJECT RUNTIME]',
        'Resumed ' + pending.length + ' product analysis job' + (pending.length === 1 ? '' : 's') + '.'
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
  startCreativeFlowProjectRuntime,
  normalizedWebsite
};
