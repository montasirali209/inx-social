'use strict';

const crypto = require('node:crypto');
const prisma = require('../db/prisma');
const uiStudioAnalysis = require('./uiStudioAnalysisService');
const previewBuild = require('./uiStudioPreviewBuildService');

const VIEWPORTS = Object.freeze({
  DESKTOP: { width: 1440, height: 900 },
  TABLET: { width: 834, height: 1112 },
  MOBILE: { width: 390, height: 844 }
});

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ITEMS = 24;
const cache = new Map();

function publicError(message, status = 400, code = 'UI_STUDIO_RESPONSIVE_PREVIEW_ERROR') {
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

function normalizeViewport(value) {
  const viewport = String(value || '').trim().toUpperCase();
  if (!VIEWPORTS[viewport]) throw publicError('Unsupported responsive preview size.', 422, 'UI_STUDIO_RESPONSIVE_PREVIEW_VIEWPORT');
  return viewport;
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function cacheSet(key, value) {
  cache.set(key, { ...value, createdAt: Date.now() });
  while (cache.size > MAX_CACHE_ITEMS) {
    cache.delete(cache.keys().next().value);
  }
}

async function previewContent(projectId, viewportValue) {
  const id = String(projectId || '').trim();
  const viewport = normalizeViewport(viewportValue);

  const project = await prisma.uiDesignProject.findUnique({
    where: { id },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 100 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 20 },
      generations: { orderBy: { createdAt: 'desc' }, take: 20 }
    }
  });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');

  const references = uiStudioAnalysis.latestReferences(project.references || []);
  const fingerprint = uiStudioAnalysis.fingerprintReferences(references);
  const analysis = (project.analyses || []).find(item =>
    item.status === 'COMPLETED' &&
    item.sourceFingerprint === fingerprint &&
    item.analysisJson
  );
  if (!analysis) {
    throw publicError('Design analysis is not ready yet.', 409, 'UI_STUDIO_RESPONSIVE_PREVIEW_ANALYSIS_REQUIRED');
  }

  const generation = (project.generations || []).find(item =>
    ['READY','READY_WITH_WARNINGS'].includes(item.status) &&
    item.sourceFingerprint === fingerprint &&
    item.sourceAnalysisId === analysis.id &&
    item.generationJson
  );
  if (!generation) {
    const running = (project.generations || []).find(item =>
      item.status === 'RUNNING' &&
      item.sourceFingerprint === fingerprint &&
      item.sourceAnalysisId === analysis.id
    );
    if (running) throw publicError('Responsive preview is still being prepared.', 409, 'UI_STUDIO_RESPONSIVE_PREVIEW_RUNNING');
    throw publicError('Responsive preview has not been generated yet.', 409, 'UI_STUDIO_RESPONSIVE_PREVIEW_GENERATION_REQUIRED');
  }

  const dims = VIEWPORTS[viewport];
  const cacheKey = [generation.id, generation.updatedAt?.toISOString?.() || String(generation.updatedAt), viewport].join(':');
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const result = safeParse(generation.generationJson, null);
  if (!result) throw publicError('Responsive preview source is missing.', 422, 'UI_STUDIO_RESPONSIVE_PREVIEW_SOURCE_MISSING');

  const html = await previewBuild.buildPreviewHtml(result, project, dims.width, dims.height, {});
  const data = Buffer.from(html, 'utf8');
  const etag = '"' + crypto.createHash('sha256').update(data).digest('hex') + '"';
  const response = {
    data,
    etag,
    width: dims.width,
    height: dims.height,
    viewport,
    generationId: generation.id
  };
  cacheSet(cacheKey, response);
  return response;
}

module.exports = {
  VIEWPORTS,
  previewContent
};
