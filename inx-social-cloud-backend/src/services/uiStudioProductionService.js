'use strict';

const prisma = require('../db/prisma');
const uiStudioAnalysis = require('./uiStudioAnalysisService');
const uiStudioCodegen = require('./uiStudioCodegenService');

function publicError(message, status = 400, code = 'UI_STUDIO_PRODUCTION_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function safeParse(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (_) { return fallback; }
}

async function finalizeProductionCode(projectId) {
  const id = String(projectId || '').trim();
  const project = await prisma.uiDesignProject.findUnique({
    where: { id },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 100 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 }
    }
  });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');
  if (!project.acceptedGenerationId) {
    throw publicError('Approve the best visual match before generating production code.', 409, 'UI_STUDIO_PRODUCTION_APPROVAL_REQUIRED');
  }
  if (project.bestGenerationId && project.acceptedGenerationId !== project.bestGenerationId) {
    throw publicError('A newer best visual match is ready. Approve it before generating production code.', 409, 'UI_STUDIO_PRODUCTION_CURRENT_BEST_REQUIRED');
  }

  const generation = await prisma.uiDesignGeneration.findFirst({
    where: { id: project.acceptedGenerationId, projectId: project.id }
  });
  if (!generation) throw publicError('The approved generation could not be found.', 404, 'UI_STUDIO_GENERATION_NOT_FOUND');

  const references = uiStudioAnalysis.latestReferences(project.references || []);
  const fingerprint = uiStudioAnalysis.fingerprintReferences(references);
  const analysis = project.analyses[0] || null;
  if (!analysis || analysis.status !== 'COMPLETED' || analysis.sourceFingerprint !== fingerprint) {
    throw publicError('The current design analysis is stale. Re-analyse before generating production code.', 422, 'UI_STUDIO_PRODUCTION_ANALYSIS_STALE');
  }
  if (generation.sourceFingerprint !== fingerprint || generation.sourceAnalysisId !== analysis.id) {
    throw publicError('The approved visual version is stale against the current references.', 422, 'UI_STUDIO_PRODUCTION_GENERATION_STALE');
  }
  const validation = safeParse(generation.validationJson, {});
  const buildCheck = Array.isArray(validation.checks)
    ? validation.checks.find(item => item.key === 'BUILD_COMPILE')
    : null;
  if (!validation.compileVerified || !buildCheck?.ok) {
    throw publicError('The approved implementation must pass the compile gate before final code can be prepared.', 422, 'UI_STUDIO_PRODUCTION_COMPILE_REQUIRED');
  }

  const updated = await prisma.uiDesignProject.update({
    where: { id: project.id },
    data: {
      productionGenerationId: generation.id,
      productionGeneratedAt: new Date(),
      status: 'PRODUCTION_CODE_READY'
    }
  });

  return {
    projectId: updated.id,
    generation: uiStudioCodegen.serializeGeneration(generation, {
      full: true,
      currentFingerprint: fingerprint,
      currentAnalysisId: analysis.id
    }),
    productionGenerationId: updated.productionGenerationId,
    productionGeneratedAt: updated.productionGeneratedAt,
    frameworkTargets: safeParse(updated.frameworkTargetsJson, [updated.framework]),
    stylingTargets: safeParse(updated.stylingTargetsJson, [updated.styling])
  };
}

module.exports = {
  finalizeProductionCode
};
