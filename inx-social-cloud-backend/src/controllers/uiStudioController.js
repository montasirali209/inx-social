'use strict';

const prisma = require('../db/prisma');
const uiStudio = require('../services/uiStudioService');
const uiStudioAnalysis = require('../services/uiStudioAnalysisService');
const uiStudioCodegen = require('../services/uiStudioCodegenService');
const uiStudioVisual = require('../services/uiStudioVisualService');
const uiStudioConvergence = require('../services/uiStudioConvergenceService');
const uiStudioDelivery = require('../services/uiStudioDeliveryService');
const uiStudioProduction = require('../services/uiStudioProductionService');
const uiStudioAgent = require('../services/uiStudioAgentService');
const uiStudioResponsivePreview = require('../services/uiStudioResponsivePreviewService');

function decodeHeader(req, name, fallback = '') {
  const raw = String(req.headers[name] || fallback);
  try { return decodeURIComponent(raw); } catch (_) { return raw; }
}

async function audit(req, action, entityId, metadata = {}) {
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id || null,
      action,
      entity: 'UiDesignProject',
      entityId: entityId || null,
      metadata: JSON.stringify(metadata),
      ip: req.ip || null,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500) || null
    }
  }).catch(() => {});
}

function capability(req) {
  return req.user?.role === 'SUPER_ADMIN';
}

async function list(req, res, next) {
  try {
    res.json({
      projects: await uiStudio.listProjects(),
      canEdit: capability(req),
      storage: {
        provider: 'CLOUDFLARE_R2',
        originalsPreserved: true,
        maxUploadBytes: uiStudio.MAX_UPLOAD_BYTES
      },
      analysis: {
        configured: uiStudioAnalysis.ready(),
        version: uiStudioAnalysis.ANALYSIS_VERSION
      },
      codegen: {
        configured: uiStudioCodegen.ready(),
        version: uiStudioCodegen.GENERATION_VERSION
      },
      visual: uiStudioVisual.rendererStatus(),
      phase5: {
        version: uiStudioConvergence.CONVERGENCE_VERSION,
        rendererConfigured: uiStudioConvergence.rendererConfigured()
      },
      phase6: uiStudioDelivery.capabilityStatus(),
      agent: {
        configured: uiStudioAgent.ready(),
        version: uiStudioAgent.AGENT_VERSION
      }
    });
  } catch (error) { next(error); }
}

async function create(req, res, next) {
  try {
    const project = await uiStudio.createProject({
      ...req.body,
      createdByUserId: req.user.id
    });
    await audit(req, 'ADMIN_UI_STUDIO_PROJECT_CREATE', project.id, {
      name: project.name,
      framework: project.framework,
      styling: project.styling,
      outputType: project.outputType,
      frameworkTargets: project.frameworkTargets,
      stylingTargets: project.stylingTargets
    });
    res.status(201).json({ project, canEdit: capability(req) });
  } catch (error) { next(error); }
}

async function detail(req, res, next) {
  try {
    res.json({
      project: await uiStudio.projectDetail(req.params.projectId),
      canEdit: capability(req),
      storage: {
        provider: 'CLOUDFLARE_R2',
        originalsPreserved: true,
        maxUploadBytes: uiStudio.MAX_UPLOAD_BYTES
      },
      analysis: {
        configured: uiStudioAnalysis.ready(),
        version: uiStudioAnalysis.ANALYSIS_VERSION
      },
      codegen: {
        configured: uiStudioCodegen.ready(),
        version: uiStudioCodegen.GENERATION_VERSION
      },
      visual: uiStudioVisual.rendererStatus(),
      phase5: {
        version: uiStudioConvergence.CONVERGENCE_VERSION,
        rendererConfigured: uiStudioConvergence.rendererConfigured()
      },
      phase6: uiStudioDelivery.capabilityStatus(),
      agent: {
        configured: uiStudioAgent.ready(),
        version: uiStudioAgent.AGENT_VERSION
      }
    });
  } catch (error) { next(error); }
}

async function upload(req, res, next) {
  try {
    const reference = await uiStudio.uploadReference(req.params.projectId, req.params.viewport, {
      uploadedByUserId: req.user.id,
      originalName: decodeHeader(req, 'x-file-name', 'ui-reference'),
      data: Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    });
    await audit(req, 'ADMIN_UI_STUDIO_REFERENCE_UPLOAD', req.params.projectId, {
      referenceId: reference.id,
      viewport: reference.viewport,
      originalName: reference.originalName,
      mimeType: reference.mimeType,
      width: reference.width,
      height: reference.height,
      byteSize: reference.byteSize
    });
    res.status(201).json({ reference });
  } catch (error) { next(error); }
}

async function analyse(req, res, next) {
  try {
    const startedAt = Date.now();
    const result = await uiStudioAnalysis.analyseProject(req.params.projectId, req.user.id);
    await audit(req, 'ADMIN_UI_STUDIO_ANALYSE', req.params.projectId, {
      analysisId: result.analysis.id,
      model: result.analysis.model,
      confidence: result.analysis.confidence,
      viewportCount: result.analysis.viewportCount,
      imageCount: result.imageCount,
      durationMs: Date.now() - startedAt
    });
    res.status(result.alreadyRunning ? 202 : 201).json({
      analysis: result.analysis,
      alreadyRunning: Boolean(result.alreadyRunning),
      project: await uiStudio.projectDetail(req.params.projectId)
    });
  } catch (error) { next(error); }
}

async function generate(req, res, next) {
  try {
    const startedAt = Date.now();
    const result = await uiStudioCodegen.generateProject(req.params.projectId, req.user.id);
    await audit(req, 'ADMIN_UI_STUDIO_CODE_GENERATE', req.params.projectId, {
      generationId: result.generation.id,
      sourceAnalysisId: result.generation.sourceAnalysisId,
      model: result.generation.model,
      framework: result.generation.framework,
      styling: result.generation.styling,
      outputType: result.generation.outputType,
      fileCount: result.generation.fileCount,
      validationPassed: result.generation.validation?.passed || 0,
      validationTotal: result.generation.validation?.total || 0,
      imageCount: result.imageCount,
      durationMs: Date.now() - startedAt
    });
    res.status(result.alreadyRunning ? 202 : 201).json({
      generation: result.generation,
      alreadyRunning: Boolean(result.alreadyRunning),
      project: await uiStudio.projectDetail(req.params.projectId)
    });
  } catch (error) { next(error); }
}

async function finalizeProductionCode(req, res, next) {
  try {
    const result = await uiStudioProduction.finalizeProductionCode(req.params.projectId);
    await audit(req, 'ADMIN_UI_STUDIO_PRODUCTION_CODE_FINALIZE', req.params.projectId, {
      generationId: result.productionGenerationId,
      frameworkTargets: result.frameworkTargets,
      stylingTargets: result.stylingTargets
    });
    res.json({
      production: result,
      project: await uiStudio.projectDetail(req.params.projectId)
    });
  } catch (error) { next(error); }
}

async function agentMessages(req, res, next) {
  try {
    res.json({
      configured: uiStudioAgent.ready(),
      version: uiStudioAgent.AGENT_VERSION,
      messages: await uiStudioAgent.listMessages(req.params.projectId)
    });
  } catch (error) { next(error); }
}

async function askAgent(req, res, next) {
  try {
    const result = await uiStudioAgent.ask(req.params.projectId, req.body?.message, req.user.id);
    await audit(req, 'ADMIN_UI_STUDIO_AGENT_MESSAGE', req.params.projectId, {
      assistantMessageId: result.assistant.id,
      recommendedAction: result.assistant.action?.type || 'NONE'
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
}

async function generation(req, res, next) {
  try {
    res.json({ generation: await uiStudioCodegen.generationDetail(req.params.generationId) });
  } catch (error) { next(error); }
}

async function prepareRender(req, res, next) {
  try {
    const startedAt = Date.now();
    const render = await uiStudioVisual.prepareRender(req.params.projectId, req.body || {}, req.user.id);
    await audit(req, 'ADMIN_UI_STUDIO_RENDER_PREPARE', req.params.projectId, {
      renderId: render.id,
      generationId: render.generationId,
      referenceId: render.referenceId,
      viewport: render.viewport,
      width: render.width,
      height: render.height,
      repairDepth: render.repairDepth,
      durationMs: Date.now() - startedAt
    });
    res.status(201).json({
      render,
      project: await uiStudio.projectDetail(req.params.projectId)
    });
  } catch (error) { next(error); }
}

async function responsivePreview(req, res, next) {
  try {
    const result = await uiStudioResponsivePreview.previewContent(req.params.projectId, req.params.viewport);
    if (String(req.headers['if-none-match'] || '') === result.etag) return res.status(304).end();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('ETag', result.etag);
    res.setHeader('X-UI-Studio-Viewport', result.viewport);
    res.setHeader('X-UI-Studio-Width', String(result.width));
    res.setHeader('X-UI-Studio-Height', String(result.height));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'");
    res.send(result.data);
  } catch (error) { next(error); }
}

async function renderDetail(req, res, next) {
  try {
    res.json({ render: await uiStudioVisual.renderDetail(req.params.renderId) });
  } catch (error) { next(error); }
}

async function renderPreview(req, res, next) {
  try {
    const result = await uiStudioVisual.previewContent(req.params.renderId);
    if (String(req.headers['if-none-match'] || '') === result.etag) return res.status(304).end();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('ETag', result.etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'");
    res.send(result.data);
  } catch (error) { next(error); }
}

async function renderAsset(req, res, next) {
  try {
    const result = await uiStudioVisual.assetContent(req.params.renderId, req.params.kind);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', String(result.data.length));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(result.data);
  } catch (error) { next(error); }
}

async function captureRender(req, res, next) {
  try {
    const startedAt = Date.now();
    const render = await uiStudioVisual.compareCapture(
      req.params.renderId,
      Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    );
    await audit(req, 'ADMIN_UI_STUDIO_RENDER_COMPARE', render.projectId, {
      renderId: render.id,
      generationId: render.generationId,
      viewport: render.viewport,
      score: render.score,
      pixelScore: render.pixelScore,
      durationMs: Date.now() - startedAt
    });
    res.json({
      render,
      project: await uiStudio.projectDetail(render.projectId)
    });
  } catch (error) { next(error); }
}

async function repairRender(req, res, next) {
  try {
    const startedAt = Date.now();
    const repaired = await uiStudioVisual.repairGeneration(req.params.renderId, req.user.id);
    const render = await uiStudioVisual.renderDetail(req.params.renderId);
    await audit(req, 'ADMIN_UI_STUDIO_VISUAL_REPAIR', render.projectId, {
      renderId: render.id,
      inputGenerationId: render.generationId,
      outputGenerationId: repaired.generation.id,
      attemptNumber: repaired.attemptNumber,
      durationMs: Date.now() - startedAt
    });
    res.status(201).json({
      generation: repaired.generation,
      attemptNumber: repaired.attemptNumber,
      project: await uiStudio.projectDetail(render.projectId)
    });
  } catch (error) { next(error); }
}

async function phase5Status(req, res, next) {
  try {
    res.json({ phase5: await uiStudioConvergence.phase5Status(req.params.projectId) });
  } catch (error) { next(error); }
}

async function startConvergence(req, res, next) {
  try {
    const result = await uiStudioConvergence.startRenderBatch(req.params.projectId, req.body || {}, req.user.id);
    await audit(req, 'ADMIN_UI_STUDIO_CONVERGENCE_START', req.params.projectId, {
      batchId: result.batchId,
      renderCount: result.renders.length,
      generationId: result.renders[0]?.generationId || null,
      autoRepair: req.body?.autoRepair !== false
    });
    res.status(202).json({ batch: result, project: await uiStudio.projectDetail(req.params.projectId) });
  } catch (error) { next(error); }
}

async function convergenceBatch(req, res, next) {
  try {
    res.json({ batch: await uiStudioConvergence.batchDetail(req.params.projectId, req.params.batchId) });
  } catch (error) { next(error); }
}

async function uploadAssetBinding(req, res, next) {
  try {
    const binding = await uiStudioConvergence.uploadAssetBinding(req.params.projectId, {
      uploadedByUserId: req.user.id,
      slotName: decodeHeader(req, 'x-slot-name'),
      kind: decodeHeader(req, 'x-asset-kind', 'OTHER'),
      viewport: decodeHeader(req, 'x-asset-viewport', 'ALL'),
      originalName: decodeHeader(req, 'x-file-name', 'bound-asset'),
      mimeType: String(req.headers['content-type'] || '').split(';')[0],
      data: Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    });
    await audit(req, 'ADMIN_UI_STUDIO_ASSET_BIND', req.params.projectId, {
      bindingId: binding.id,
      slotName: binding.slotName,
      kind: binding.kind,
      viewport: binding.viewport,
      byteSize: binding.byteSize
    });
    res.status(201).json({ binding, phase5: await uiStudioConvergence.phase5Status(req.params.projectId) });
  } catch (error) { next(error); }
}

async function deleteAssetBinding(req, res, next) {
  try {
    const result = await uiStudioConvergence.deleteAssetBinding(req.params.projectId, req.params.bindingId);
    await audit(req, 'ADMIN_UI_STUDIO_ASSET_UNBIND', req.params.projectId, { bindingId: result.id });
    res.json({ ok: true, phase5: await uiStudioConvergence.phase5Status(req.params.projectId) });
  } catch (error) { next(error); }
}

async function createIgnoreMask(req, res, next) {
  try {
    const mask = await uiStudioConvergence.createIgnoreMask(req.params.projectId, {
      ...(req.body || {}),
      createdByUserId: req.user.id
    });
    await audit(req, 'ADMIN_UI_STUDIO_MASK_CREATE', req.params.projectId, {
      maskId: mask.id,
      viewport: mask.viewport,
      label: mask.label
    });
    res.status(201).json({ mask, phase5: await uiStudioConvergence.phase5Status(req.params.projectId) });
  } catch (error) { next(error); }
}

async function deleteIgnoreMask(req, res, next) {
  try {
    const result = await uiStudioConvergence.deleteIgnoreMask(req.params.projectId, req.params.maskId);
    await audit(req, 'ADMIN_UI_STUDIO_MASK_DELETE', req.params.projectId, { maskId: result.id });
    res.json({ ok: true, phase5: await uiStudioConvergence.phase5Status(req.params.projectId) });
  } catch (error) { next(error); }
}

async function acceptGeneration(req, res, next) {
  try {
    const generation = await uiStudioConvergence.acceptGeneration(req.params.projectId, req.params.generationId);
    await audit(req, 'ADMIN_UI_STUDIO_GENERATION_ACCEPT', req.params.projectId, {
      generationId: generation.id,
      aggregateScore: generation.aggregateScore,
      viewportScores: generation.viewportScores
    });
    res.json({
      generation,
      project: await uiStudio.projectDetail(req.params.projectId),
      phase5: await uiStudioConvergence.phase5Status(req.params.projectId)
    });
  } catch (error) { next(error); }
}

async function phase6Status(req, res, next) {
  try {
    res.json({ phase6: await uiStudioDelivery.phase6Status(req.params.projectId) });
  } catch (error) { next(error); }
}

async function createDelivery(req, res, next) {
  try {
    const result = await uiStudioDelivery.createDelivery(req.params.projectId, req.body || {}, req.user.id);
    await audit(req, 'ADMIN_UI_STUDIO_DELIVERY_CREATE', req.params.projectId, {
      deliveryId: result.delivery.id,
      generationId: result.delivery.generationId,
      targetMode: result.delivery.targetMode,
      repository: result.delivery.repository,
      baseBranch: result.delivery.baseBranch,
      targetDirectory: result.delivery.targetDirectory,
      fileCount: result.fileCount
    });
    res.status(201).json({ ...result, phase6: await uiStudioDelivery.phase6Status(req.params.projectId) });
  } catch (error) { next(error); }
}

async function deliveryExport(req, res, next) {
  try {
    const result = await uiStudioDelivery.deliveryExport(req.params.projectId, req.params.deliveryId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', String(result.data.length));
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (result.sha256) res.setHeader('ETag', `"${result.sha256}"`);
    res.send(result.data);
  } catch (error) { next(error); }
}

async function createDeliveryPullRequest(req, res, next) {
  try {
    const delivery = await uiStudioDelivery.createPullRequest(req.params.projectId, req.params.deliveryId);
    await audit(req, 'ADMIN_UI_STUDIO_DELIVERY_PR_CREATE', req.params.projectId, {
      deliveryId: delivery.id,
      pullRequestNumber: delivery.pullRequestNumber,
      pullRequestUrl: delivery.pullRequestUrl
    });
    res.json({ delivery, phase6: await uiStudioDelivery.phase6Status(req.params.projectId) });
  } catch (error) { next(error); }
}

async function approveDelivery(req, res, next) {
  try {
    const delivery = await uiStudioDelivery.approveDelivery(req.params.projectId, req.params.deliveryId, req.user.id);
    await audit(req, 'ADMIN_UI_STUDIO_DELIVERY_APPROVE', req.params.projectId, {
      deliveryId: delivery.id,
      pullRequestNumber: delivery.pullRequestNumber
    });
    res.json({ delivery, phase6: await uiStudioDelivery.phase6Status(req.params.projectId) });
  } catch (error) { next(error); }
}

async function deployDelivery(req, res, next) {
  try {
    const delivery = await uiStudioDelivery.deployDelivery(req.params.projectId, req.params.deliveryId);
    await audit(req, 'ADMIN_UI_STUDIO_DELIVERY_DEPLOY_TRIGGER', req.params.projectId, {
      deliveryId: delivery.id,
      pullRequestNumber: delivery.pullRequestNumber,
      mergeSha: delivery.mergeSha
    });
    res.json({ delivery, phase6: await uiStudioDelivery.phase6Status(req.params.projectId) });
  } catch (error) { next(error); }
}

async function content(req, res, next) {
  try {
    const result = await uiStudio.referenceContent(req.params.referenceId);
    if (String(req.headers['if-none-match'] || '') === result.etag) return res.status(304).end();
    const safeName = encodeURIComponent(result.originalName || 'ui-reference');
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', String(result.byteSize));
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${safeName}`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('ETag', result.etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(result.data);
  } catch (error) { next(error); }
}

module.exports = {
  list, create, detail, upload, analyse, generate, generation,
  prepareRender, responsivePreview, renderDetail, renderPreview, renderAsset, captureRender, repairRender,
  phase5Status, startConvergence, convergenceBatch, uploadAssetBinding, deleteAssetBinding,
  createIgnoreMask, deleteIgnoreMask, acceptGeneration,
  finalizeProductionCode, agentMessages, askAgent,
  phase6Status, createDelivery, deliveryExport, createDeliveryPullRequest, approveDelivery, deployDelivery,
  content
};
