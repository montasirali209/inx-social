'use strict';

const prisma = require('../db/prisma');
const uiStudio = require('../services/uiStudioService');
const uiStudioAnalysis = require('../services/uiStudioAnalysisService');

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
      outputType: project.outputType
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
    res.status(201).json({
      analysis: result.analysis,
      project: await uiStudio.projectDetail(req.params.projectId)
    });
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

module.exports = { list, create, detail, upload, analyse, content };
