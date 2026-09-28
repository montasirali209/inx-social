'use strict';

const crypto = require('node:crypto');
const axios = require('axios');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const env = require('../config/env');
const objectStorage = require('./mediaObjectStorageService');
const uiStudioAnalysis = require('./uiStudioAnalysisService');
const uiStudioCodegen = require('./uiStudioCodegenService');
const previewBuild = require('./uiStudioPreviewBuildService');
const webResearch = require('./webResearchService');

const CONVERGENCE_VERSION = 'ui-convergence-v1';
const MAX_ASSET_BYTES = 30 * 1024 * 1024;
const MAX_BOUND_ASSET_TOTAL_BYTES = 48 * 1024 * 1024;
const MAX_CAPTURE_BYTES = 30 * 1024 * 1024;
const MAX_RENDER_PIXELS = 16_000_000;
const COMPARE_MAX_DIMENSION = 1600;
const VIEWPORT_ORDER = ['DESKTOP','TABLET','MOBILE'];
const ASSET_KINDS = new Set(['IMAGE','VIDEO','ICON','LOGO','POSTER','AVATAR','OTHER']);
const MEDIA_MASK_RE = /\b(video|avatar|carousel|animation|animated|dynamic media|live media)\b/i;

function publicError(message, status = 400, code = 'UI_STUDIO_CONVERGENCE_ERROR') {
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

function parseJsonObject(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(clean); } catch (_) {}
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function fitViewport(widthValue, heightValue) {
  const width = Math.max(1, Math.round(Number(widthValue || 1)));
  const height = Math.max(1, Math.round(Number(heightValue || 1)));
  const pixels = width * height;
  if (pixels <= MAX_RENDER_PIXELS) return { width, height, scale: 1 };
  const scale = Math.sqrt(MAX_RENDER_PIXELS / pixels);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  };
}

function rendererConfigured() {
  return Boolean(env.uiStudioConvergence?.rendererUrl && env.uiStudioConvergence?.rendererToken);
}

function serializeAssetBinding(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    slotName: row.slotName,
    kind: row.kind,
    viewport: row.viewport,
    originalName: row.originalName,
    mimeType: row.mimeType,
    byteSize: Number(row.byteSize || 0),
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function serializeMask(row) {
  if (!row) return null;
  return {
    id: row.id,
    source: 'MANUAL',
    projectId: row.projectId,
    viewport: row.viewport,
    label: row.label,
    xPct: row.xPct,
    yPct: row.yPct,
    widthPct: row.widthPct,
    heightPct: row.heightPct,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function autoMasksFromAnalysis(analysisRow, viewport) {
  const result = safeParse(analysisRow?.analysisJson, null);
  const view = result?.viewportAnalyses?.find(item => item.viewport === viewport);
  if (!view) return [];
  return (view.components || [])
    .filter(component => {
      const haystack = [component.type, component.label, component.visualDetails, component.behavior].filter(Boolean).join(' ');
      return MEDIA_MASK_RE.test(haystack);
    })
    .map((component, index) => {
      const bounds = component.boundsPct || {};
      const x = clamp(bounds.x || 0, 0, 100);
      const y = clamp(bounds.y || 0, 0, 100);
      const width = clamp(bounds.width || 0, 0, 100);
      const height = clamp(bounds.height || 0, 0, 100);
      const insetX = Math.min(0.6, width * 0.025);
      const insetY = Math.min(0.6, height * 0.025);
      return {
        id: 'auto-' + viewport.toLowerCase() + '-' + String(component.id || index),
        source: 'AUTO',
        viewport,
        label: component.label || component.type || 'Dynamic media',
        xPct: clamp(x + insetX, 0, 100),
        yPct: clamp(y + insetY, 0, 100),
        widthPct: clamp(width - insetX * 2, 0, 100),
        heightPct: clamp(height - insetY * 2, 0, 100),
        enabled: true
      };
    })
    .filter(mask => mask.widthPct > 0 && mask.heightPct > 0)
    .slice(0, 30);
}

function generationSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    parentGenerationId: row.parentGenerationId || null,
    repairDepth: row.repairDepth || 0,
    aggregateScore: row.aggregateScore,
    viewportScores: safeParse(row.viewportScoresJson, null),
    qualityStatus: row.qualityStatus || null,
    createdAt: row.createdAt,
    completedAt: row.completedAt
  };
}

async function phase5Status(projectId) {
  const project = await prisma.uiDesignProject.findUnique({
    where: { id: normalizedProjectId },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 100 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
      generations: { orderBy: { createdAt: 'desc' }, take: 20 },
      renders: { orderBy: { createdAt: 'desc' }, take: 40 },
      assetBindings: { orderBy: { updatedAt: 'desc' } },
      ignoreMasks: { orderBy: { createdAt: 'asc' } }
    }
  });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');
  const analysis = project.analyses[0] || null;
  const latestGeneration = project.generations[0] || null;
  const generationResult = safeParse(latestGeneration?.generationJson, null);
  const slots = (generationResult?.assetSlots || []).map(slot => ({
    name: String(slot.name || ''),
    kind: String(slot.kind || 'OTHER'),
    purpose: String(slot.purpose || ''),
    recommendedAspectRatio: String(slot.recommendedAspectRatio || ''),
    implementation: String(slot.implementation || '')
  }));
  const masks = {};
  for (const viewport of VIEWPORT_ORDER) {
    masks[viewport] = [
      ...autoMasksFromAnalysis(analysis, viewport),
      ...project.ignoreMasks.filter(mask => mask.viewport === viewport && mask.enabled).map(serializeMask)
    ];
  }
  const activeBatch = project.renders.find(render => ['QUEUED','CLAIMED','BUILDING','RENDERING','COMPARING'].includes(render.status));
  return {
    version: CONVERGENCE_VERSION,
    rendererConfigured: rendererConfigured(),
    targetScore: Number(env.uiStudioVisual?.targetScore || 90),
    minimumViewportScore: Number(env.uiStudioConvergence?.minimumViewportScore || 78),
    regressionTolerance: Number(env.uiStudioConvergence?.regressionTolerance || 3),
    maxRepairPasses: Number(env.uiStudioVisual?.maxRepairPasses || 3),
    bestGenerationId: project.bestGenerationId || null,
    acceptedGenerationId: project.acceptedGenerationId || null,
    bestAggregateScore: project.bestAggregateScore,
    acceptedAt: project.acceptedAt,
    latestGeneration: generationSummary(latestGeneration),
    bestGeneration: generationSummary(project.generations.find(item => item.id === project.bestGenerationId)),
    acceptedGeneration: generationSummary(project.generations.find(item => item.id === project.acceptedGenerationId)),
    assetSlots: slots,
    assetBindings: project.assetBindings.map(serializeAssetBinding),
    masks,
    activeBatchId: activeBatch?.batchId || null
  };
}

async function inspectAsset(data, mimeType) {
  if (!Buffer.isBuffer(data) || !data.length) throw publicError('Choose an image or video asset to bind.', 400, 'UI_STUDIO_ASSET_EMPTY');
  if (data.length > MAX_ASSET_BYTES) throw publicError('Bound assets must be 30 MB or smaller.', 413, 'UI_STUDIO_ASSET_TOO_LARGE');
  const mime = String(mimeType || '').toLowerCase();
  if (!/^(image\/(?:png|jpeg|webp|avif)|video\/(?:mp4|webm|quicktime))$/.test(mime)) {
    throw publicError('Asset binding supports PNG, JPEG, WebP, AVIF, MP4, WebM or MOV.', 415, 'UI_STUDIO_ASSET_UNSUPPORTED');
  }
  let width = null;
  let height = null;
  if (mime.startsWith('image/')) {
    try {
      const meta = await sharp(data, { limitInputPixels: 200000000 }).metadata();
      width = meta.width || null;
      height = meta.height || null;
    } catch (_) {
      throw publicError('The bound image is invalid.', 415, 'UI_STUDIO_ASSET_INVALID');
    }
  }
  return {
    mimeType: mime,
    byteSize: data.length,
    width,
    height,
    sha256: crypto.createHash('sha256').update(data).digest('hex')
  };
}

async function uploadAssetBinding(projectId, input = {}) {
  const project = await prisma.uiDesignProject.findUnique({ where: { id: String(projectId || '').trim() } });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');
  const slotName = String(input.slotName || '').trim().slice(0, 180);
  if (!slotName || !/^[A-Za-z0-9_.\[\]-]+$/.test(slotName)) {
    throw publicError('Choose a valid generated media slot.', 400, 'UI_STUDIO_ASSET_SLOT_INVALID');
  }
  const kind = String(input.kind || 'OTHER').trim().toUpperCase();
  if (!ASSET_KINDS.has(kind)) throw publicError('Unsupported asset-binding kind.', 400, 'UI_STUDIO_ASSET_KIND_INVALID');
  const viewport = String(input.viewport || 'ALL').trim().toUpperCase();
  if (viewport !== 'ALL' && !VIEWPORT_ORDER.includes(viewport)) throw publicError('Unsupported asset viewport.', 400, 'UI_STUDIO_ASSET_VIEWPORT_INVALID');

  const data = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data || '');
  const inspected = await inspectAsset(data, input.mimeType);
  const storageStatus = objectStorage.providerStatus();
  if (!storageStatus.cloudflareR2Configured) throw publicError('Cloudflare R2 is required for UI Studio assets.', 503, 'UI_STUDIO_ASSET_R2_REQUIRED');

  const originalName = String(input.originalName || 'bound-asset').replace(/[^A-Za-z0-9._ -]+/g, '-').slice(0, 180);
  const stored = await objectStorage.persistBuffer({
    userId: project.id,
    data,
    mimeType: inspected.mimeType,
    originalName,
    prefix: 'ui-studio'
  });
  if (stored.storageProvider !== objectStorage.PROVIDERS.CLOUDFLARE_R2 || !stored.storageKey) {
    if (stored.storageKey) await objectStorage.deleteObject(stored.storageKey, stored.storageProvider).catch(() => {});
    throw publicError('Bound asset could not be stored in Cloudflare R2.', 503, 'UI_STUDIO_ASSET_R2_REQUIRED');
  }

  const existing = await prisma.uiDesignAssetBinding.findUnique({
    where: { projectId_slotName_viewport: { projectId: project.id, slotName, viewport } }
  });
  try {
    const row = await prisma.uiDesignAssetBinding.upsert({
      where: { projectId_slotName_viewport: { projectId: project.id, slotName, viewport } },
      create: {
        projectId: project.id,
        slotName,
        kind,
        viewport,
        storageProvider: stored.storageProvider,
        storageKey: stored.storageKey,
        originalName,
        mimeType: inspected.mimeType,
        byteSize: BigInt(inspected.byteSize),
        width: inspected.width,
        height: inspected.height,
        sha256: inspected.sha256,
        uploadedByUserId: input.uploadedByUserId ? String(input.uploadedByUserId) : null
      },
      update: {
        kind,
        storageProvider: stored.storageProvider,
        storageKey: stored.storageKey,
        originalName,
        mimeType: inspected.mimeType,
        byteSize: BigInt(inspected.byteSize),
        width: inspected.width,
        height: inspected.height,
        sha256: inspected.sha256,
        uploadedByUserId: input.uploadedByUserId ? String(input.uploadedByUserId) : null
      }
    });
    if (existing?.storageKey && existing.storageKey !== stored.storageKey) {
      await objectStorage.deleteObject(existing.storageKey, existing.storageProvider).catch(() => {});
    }
    return serializeAssetBinding(row);
  } catch (caught) {
    await objectStorage.deleteObject(stored.storageKey, stored.storageProvider).catch(() => {});
    throw caught;
  }
}

async function deleteAssetBinding(projectId, bindingId) {
  const row = await prisma.uiDesignAssetBinding.findFirst({
    where: { id: String(bindingId || '').trim(), projectId: String(projectId || '').trim() }
  });
  if (!row) throw publicError('Asset binding was not found.', 404, 'UI_STUDIO_ASSET_NOT_FOUND');
  await prisma.uiDesignAssetBinding.delete({ where: { id: row.id } });
  await objectStorage.deleteObject(row.storageKey, row.storageProvider).catch(() => {});
  return { id: row.id };
}

async function createIgnoreMask(projectId, input = {}) {
  const project = await prisma.uiDesignProject.findUnique({ where: { id: String(projectId || '').trim() } });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');
  const viewport = String(input.viewport || '').trim().toUpperCase();
  if (!VIEWPORT_ORDER.includes(viewport)) throw publicError('Choose Desktop, Tablet or Mobile.', 400, 'UI_STUDIO_MASK_VIEWPORT_INVALID');
  const xPct = clamp(input.xPct, 0, 100);
  const yPct = clamp(input.yPct, 0, 100);
  const widthPct = clamp(input.widthPct, 0, 100);
  const heightPct = clamp(input.heightPct, 0, 100);
  if (widthPct <= 0 || heightPct <= 0 || xPct + widthPct > 100.001 || yPct + heightPct > 100.001) {
    throw publicError('Mask bounds must stay inside the source image.', 400, 'UI_STUDIO_MASK_BOUNDS_INVALID');
  }
  const row = await prisma.uiDesignIgnoreMask.create({
    data: {
      projectId: project.id,
      viewport,
      label: String(input.label || 'Dynamic media').trim().slice(0, 120),
      xPct,
      yPct,
      widthPct,
      heightPct,
      createdByUserId: input.createdByUserId ? String(input.createdByUserId) : null
    }
  });
  return serializeMask(row);
}

async function deleteIgnoreMask(projectId, maskId) {
  const row = await prisma.uiDesignIgnoreMask.findFirst({
    where: { id: String(maskId || '').trim(), projectId: String(projectId || '').trim() }
  });
  if (!row) throw publicError('Ignore mask was not found.', 404, 'UI_STUDIO_MASK_NOT_FOUND');
  await prisma.uiDesignIgnoreMask.delete({ where: { id: row.id } });
  return { id: row.id };
}

function setNested(target, pathValue, value) {
  const path = String(pathValue || '').replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  if (!path.length) return;
  let cursor = target;
  for (let i = 0; i < path.length; i += 1) {
    const key = path[i];
    const last = i === path.length - 1;
    const nextNumeric = /^\d+$/.test(path[i + 1] || '');
    if (last) {
      cursor[key] = value;
      return;
    }
    if (cursor[key] == null || typeof cursor[key] !== 'object') cursor[key] = nextNumeric ? [] : {};
    cursor = cursor[key];
  }
}

async function boundPropsForProject(projectId, viewport) {
  const rows = await prisma.uiDesignAssetBinding.findMany({
    where: {
      projectId,
      viewport: { in: ['ALL', viewport] }
    },
    orderBy: [{ viewport: 'asc' }, { updatedAt: 'asc' }]
  });
  const props = {};
  let total = 0;
  for (const row of rows) {
    const data = await objectStorage.getBuffer(row.storageKey, null, row.storageProvider);
    total += data.length;
    if (total > MAX_BOUND_ASSET_TOTAL_BYTES) {
      throw publicError('Bound preview assets exceed 48 MB. Reduce media size or use ignore masks for dynamic video.', 413, 'UI_STUDIO_BOUND_ASSETS_TOO_LARGE');
    }
    const dataUrl = 'data:' + row.mimeType + ';base64,' + data.toString('base64');
    setNested(props, row.slotName, dataUrl);
  }
  return props;
}

async function masksForProject(project, analysis, viewport) {
  const manual = await prisma.uiDesignIgnoreMask.findMany({
    where: { projectId: project.id, viewport, enabled: true },
    orderBy: { createdAt: 'asc' }
  });
  return [...autoMasksFromAnalysis(analysis, viewport), ...manual.map(serializeMask)];
}

function maskRects(masks, width, height) {
  return (masks || []).filter(mask => mask.enabled !== false).map(mask => ({
    x1: Math.floor(width * clamp(mask.xPct, 0, 100) / 100),
    y1: Math.floor(height * clamp(mask.yPct, 0, 100) / 100),
    x2: Math.ceil(width * clamp(Number(mask.xPct) + Number(mask.widthPct), 0, 100) / 100),
    y2: Math.ceil(height * clamp(Number(mask.yPct) + Number(mask.heightPct), 0, 100) / 100)
  }));
}

function maskedAt(x, y, rects) {
  return rects.some(rect => x >= rect.x1 && x < rect.x2 && y >= rect.y1 && y < rect.y2);
}

function imageMetrics(referenceRaw, renderedRaw, width, height, masks = []) {
  const rects = maskRects(masks, width, height);
  const totalPixels = width * height;
  let includedPixels = 0;
  let ignoredPixels = 0;
  let absSum = 0;
  let mismatch = 0;
  let edgeDiff = 0;
  let edgeCount = 0;
  const diff = Buffer.alloc(totalPixels * 4);

  function gray(buffer, offset) {
    return (buffer[offset] * 0.299) + (buffer[offset + 1] * 0.587) + (buffer[offset + 2] * 0.114);
  }

  for (let index = 0; index < totalPixels; index += 1) {
    const offset = index * 4;
    const x = index % width;
    const y = Math.floor(index / width);
    if (maskedAt(x, y, rects)) {
      ignoredPixels += 1;
      diff[offset] = 226;
      diff[offset + 1] = 232;
      diff[offset + 2] = 240;
      diff[offset + 3] = 255;
      continue;
    }

    includedPixels += 1;
    const dr = Math.abs(referenceRaw[offset] - renderedRaw[offset]);
    const dg = Math.abs(referenceRaw[offset + 1] - renderedRaw[offset + 1]);
    const db = Math.abs(referenceRaw[offset + 2] - renderedRaw[offset + 2]);
    const normalized = (dr + dg + db) / (3 * 255);
    absSum += normalized;
    if (normalized > 0.08) mismatch += 1;

    const intensity = Math.max(0, Math.min(255, Math.round(normalized * 510)));
    diff[offset] = 255;
    diff[offset + 1] = Math.max(0, 255 - intensity);
    diff[offset + 2] = Math.max(0, 255 - intensity);
    diff[offset + 3] = 255;

    if (x > 0 && y > 0 && !maskedAt(x - 1, y, rects) && !maskedAt(x, y - 1, rects)) {
      const left = offset - 4;
      const up = offset - (width * 4);
      const refEdge = Math.abs(gray(referenceRaw, offset) - gray(referenceRaw, left))
        + Math.abs(gray(referenceRaw, offset) - gray(referenceRaw, up));
      const outEdge = Math.abs(gray(renderedRaw, offset) - gray(renderedRaw, left))
        + Math.abs(gray(renderedRaw, offset) - gray(renderedRaw, up));
      edgeDiff += Math.min(1, Math.abs(refEdge - outEdge) / 510);
      edgeCount += 1;
    }
  }

  const divisor = Math.max(1, includedPixels);
  const mae = absSum / divisor;
  const mismatchPct = mismatch / divisor;
  const edgeMae = edgeCount ? edgeDiff / edgeCount : 0;
  const pixelScore = Math.max(0, Math.min(100, Math.round(100 * (1 - (0.55 * mae + 0.30 * mismatchPct + 0.15 * edgeMae)))));
  const colorScore = Math.max(0, Math.min(100, Math.round(100 * (1 - mae))));
  const structuralScore = Math.max(0, Math.min(100, Math.round(100 * (1 - edgeMae))));

  return {
    diff,
    metrics: {
      pixelScore,
      colorScore,
      structuralScore,
      meanAbsoluteError: Number(mae.toFixed(5)),
      mismatchPercent: Number((mismatchPct * 100).toFixed(2)),
      edgeError: Number(edgeMae.toFixed(5)),
      ignoredPercent: Number((ignoredPixels * 100 / Math.max(1, totalPixels)).toFixed(2)),
      compareWidth: width,
      compareHeight: height
    }
  };
}

async function rawComparable(buffer, width, height) {
  return sharp(buffer, { limitInputPixels: 200000000 })
    .rotate()
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

async function imageDataUrl(buffer) {
  const data = await sharp(buffer, { limitInputPixels: 200000000 })
    .rotate()
    .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return 'data:image/jpeg;base64,' + data.toString('base64');
}

function critiqueSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary','layoutScore','typographyScore','colorScore','spacingScore','mediaScore','issues','strengths','repairPriority'],
    properties: {
      summary: { type: 'string' },
      layoutScore: { type: 'integer', minimum: 0, maximum: 100 },
      typographyScore: { type: 'integer', minimum: 0, maximum: 100 },
      colorScore: { type: 'integer', minimum: 0, maximum: 100 },
      spacingScore: { type: 'integer', minimum: 0, maximum: 100 },
      mediaScore: { type: 'integer', minimum: 0, maximum: 100 },
      issues: {
        type: 'array',
        maxItems: 18,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['severity','category','description','repairInstruction'],
          properties: {
            severity: { type: 'string', enum: ['CRITICAL','HIGH','MEDIUM','LOW'] },
            category: { type: 'string', enum: ['LAYOUT','TYPOGRAPHY','COLOR','SPACING','MEDIA','CONTENT','RESPONSIVE','OTHER'] },
            description: { type: 'string' },
            repairInstruction: { type: 'string' }
          }
        }
      },
      strengths: { type: 'array', maxItems: 10, items: { type: 'string' } },
      repairPriority: { type: 'array', maxItems: 12, items: { type: 'string' } }
    }
  };
}

async function visualCritique(referenceBuffer, renderedBuffer, metrics, viewport, masks) {
  if (!env.uiStudioVisual?.apiKey) return null;
  const [original, rendered] = await Promise.all([imageDataUrl(referenceBuffer), imageDataUrl(renderedBuffer)]);
  const payload = {
    model: env.uiStudioVisual.model,
    instructions: [
      'You are INXSocial UI Studio Phase 5 visual QA.',
      'Compare ORIGINAL against RENDERED as a reconstruction, not a redesign.',
      'Ignore the pixel content inside explicitly masked dynamic-media regions; still judge the geometry, border, radius, placement and surrounding spacing of those regions.',
      'Focus on responsive geometry, alignment, typography, colour/gradient, spacing, radii/shadows and media-container placement.',
      'Every repair instruction must be concrete and code-actionable. Do not request new features.',
      'Return only JSON matching the schema.'
    ].join(' '),
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Viewport: ' + viewport + '\nPixel metrics: ' + JSON.stringify(metrics) + '\nIgnore masks: ' + JSON.stringify(masks || []) + '\nImage 1 is ORIGINAL. Image 2 is RENDERED.' },
        { type: 'input_text', text: 'ORIGINAL' },
        { type: 'input_image', image_url: original, detail: 'high' },
        { type: 'input_text', text: 'RENDERED' },
        { type: 'input_image', image_url: rendered, detail: 'high' }
      ]
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'inx_ui_visual_critique_v2',
        strict: true,
        schema: critiqueSchema()
      }
    },
    max_output_tokens: 7000
  };
  if (/^gpt-5(?:\.|-)/i.test(String(payload.model || ''))) payload.reasoning = { effort: env.uiStudioVisual.reasoningEffort || 'high' };
  try {
    const response = await axios.post(env.uiStudioVisual.baseUrl + '/responses', payload, {
      timeout: env.uiStudioVisual.timeoutMs,
      maxBodyLength: 30 * 1024 * 1024,
      maxContentLength: 30 * 1024 * 1024,
      headers: { Authorization: 'Bearer ' + env.uiStudioVisual.apiKey, 'Content-Type': 'application/json' }
    });
    return parseJsonObject(webResearch.extractResponseText(response.data));
  } catch (caught) {
    console.warn('[ui-studio-phase5] visual critique failed', {
      status: Number(caught?.response?.status || 0),
      detail: String(caught?.response?.data?.error?.message || caught.message || '').slice(0, 500)
    });
    return null;
  }
}

function combinedScore(metrics, critique) {
  if (!critique) return metrics.pixelScore;
  const ai = [critique.layoutScore, critique.typographyScore, critique.colorScore, critique.spacingScore, critique.mediaScore]
    .map(Number).filter(Number.isFinite);
  const aiAverage = ai.length ? ai.reduce((sum, value) => sum + value, 0) / ai.length : metrics.pixelScore;
  return Math.max(0, Math.min(100, Math.round((metrics.pixelScore * 0.55) + (aiAverage * 0.45))));
}

async function persistArtifact(renderId, data, mimeType, originalName) {
  const status = objectStorage.providerStatus();
  if (!status.cloudflareR2Configured) throw publicError('Cloudflare R2 is required for render artifacts.', 503, 'UI_STUDIO_PHASE5_R2_REQUIRED');
  const stored = await objectStorage.persistBuffer({
    userId: 'render-' + renderId,
    data,
    mimeType,
    originalName,
    prefix: 'ui-studio'
  });
  if (stored.storageProvider !== objectStorage.PROVIDERS.CLOUDFLARE_R2 || !stored.storageKey) {
    if (stored.storageKey) await objectStorage.deleteObject(stored.storageKey, stored.storageProvider).catch(() => {});
    throw publicError('Render artifact could not be stored in Cloudflare R2.', 503, 'UI_STUDIO_PHASE5_R2_REQUIRED');
  }
  return stored;
}

async function renderWithChromium(html, width, height) {
  if (!rendererConfigured()) throw publicError('The Phase 5 Chromium renderer is not configured.', 503, 'UI_STUDIO_RENDERER_NOT_CONFIGURED');
  const url = env.uiStudioConvergence.rendererUrl + '/chromium/function?token=' + encodeURIComponent(env.uiStudioConvergence.rendererToken);
  const code = `export default async ({ page, context }) => {
    await page.setViewport({ width: context.width, height: context.height, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = request.url();
      if (url === 'about:blank' || url.startsWith('data:') || url.startsWith('blob:')) return request.continue();
      return request.abort();
    });
    await page.setContent(context.html, { waitUntil: 'load', timeout: 30000 });
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}' });
    await page.waitForFunction(() => {
      const root = document.querySelector('#root');
      return !root || root.childElementCount > 0 || document.body.children.length > 1;
    }, { timeout: 10000 }).catch(() => {});
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
      const media = [...document.images, ...document.querySelectorAll('video')];
      await Promise.race([
        Promise.all(media.map(element => new Promise(resolve => {
          if (element instanceof HTMLImageElement && element.complete) return resolve();
          if (element instanceof HTMLVideoElement && element.readyState >= 2) return resolve();
          const done = () => resolve();
          element.addEventListener('load', done, { once: true });
          element.addEventListener('loadeddata', done, { once: true });
          element.addEventListener('error', done, { once: true });
        }))),
        new Promise(resolve => setTimeout(resolve, 2200))
      ]);
      for (const video of document.querySelectorAll('video')) {
        try { video.pause(); video.currentTime = 0; } catch (_) {}
      }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await new Promise(resolve => setTimeout(resolve, 180));
    const data = await page.screenshot({
      type: 'png',
      fullPage: false,
      captureBeyondViewport: false,
      clip: { x: 0, y: 0, width: context.width, height: context.height }
    });
    return { data, type: 'image/png' };
  };`;
  let response;
  try {
    response = await axios.post(url, { code, context: { html, width, height } }, {
      timeout: 90000,
      responseType: 'arraybuffer',
      maxBodyLength: 70 * 1024 * 1024,
      maxContentLength: MAX_CAPTURE_BYTES,
      headers: { 'Content-Type': 'application/json', Accept: 'image/png' }
    });
  } catch (caught) {
    const status = Number(caught?.response?.status || 0);
    throw publicError(
      'Chromium render failed' + (status ? ' (' + status + ')' : '') + ': ' + String(caught?.message || 'renderer unavailable').slice(0, 500),
      status === 429 ? 503 : 502,
      'UI_STUDIO_CHROMIUM_RENDER_FAILED'
    );
  }
  const data = Buffer.from(response.data || []);
  if (!data.length || data.length > MAX_CAPTURE_BYTES) throw publicError('Chromium returned an invalid screenshot.', 502, 'UI_STUDIO_CHROMIUM_CAPTURE_INVALID');
  let metadata;
  try { metadata = await sharp(data, { limitInputPixels: 200000000 }).metadata(); } catch (_) {}
  if (metadata?.format !== 'png') throw publicError('Chromium did not return PNG output.', 502, 'UI_STUDIO_CHROMIUM_CAPTURE_INVALID');
  return data;
}

function renderAssetUrl(renderId, kind) {
  return '/api/admin/ui-studio/renders/' + encodeURIComponent(renderId) + '/assets/' + encodeURIComponent(kind);
}

function previewUrl(renderId) {
  return '/api/admin/ui-studio/renders/' + encodeURIComponent(renderId) + '/preview';
}

function serializeRender(row, { full = true } = {}) {
  if (!row) return null;
  const metrics = safeParse(row.metricsJson, null);
  const critique = safeParse(row.critiqueJson, null);
  return {
    id: row.id,
    projectId: row.projectId,
    generationId: row.generationId,
    referenceId: row.referenceId,
    parentRenderId: row.parentRenderId || null,
    batchId: row.batchId || null,
    viewport: row.viewport,
    status: row.status,
    version: row.version || CONVERGENCE_VERSION,
    width: row.width,
    height: row.height,
    sourceWidth: row.sourceWidth,
    sourceHeight: row.sourceHeight,
    sourceScale: Number(row.sourceScale || 1),
    repairDepth: row.repairDepth || 0,
    attempts: row.attempts || 0,
    score: metrics?.combinedScore ?? metrics?.pixelScore ?? null,
    pixelScore: metrics?.pixelScore ?? null,
    metrics,
    critique: full ? critique : null,
    errorMessage: row.errorMessage || null,
    previewUrl: row.previewStorageKey ? previewUrl(row.id) : null,
    renderedUrl: row.renderedStorageKey ? renderAssetUrl(row.id, 'rendered') : null,
    diffUrl: row.diffStorageKey ? renderAssetUrl(row.id, 'diff') : null,
    originalUrl: row.referenceId ? '/api/admin/ui-studio/references/' + encodeURIComponent(row.referenceId) + '/content' : null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function enqueueRenderBatch(project, generation, references, options = {}) {
  const batchId = options.batchId || crypto.randomUUID();
  const autoRepair = options.autoRepair !== false;
  const data = references.map(reference => {
    const size = fitViewport(reference.width, reference.height);
    return {
      id: crypto.randomUUID(),
      projectId: project.id,
      generationId: generation.id,
      referenceId: reference.id,
      parentRenderId: options.parentRenderId || null,
      batchId,
      viewport: reference.viewport,
      status: 'QUEUED',
      version: CONVERGENCE_VERSION,
      width: size.width,
      height: size.height,
      sourceWidth: reference.width,
      sourceHeight: reference.height,
      sourceScale: size.scale,
      repairDepth: generation.repairDepth || 0,
      autoRepair,
      createdByUserId: options.createdByUserId ? String(options.createdByUserId) : null
    };
  });
  await prisma.$transaction([
    prisma.uiDesignRender.createMany({ data }),
    prisma.uiDesignProject.update({ where: { id: project.id }, data: { status: 'CONVERGENCE_QUEUED' } })
  ]);
  const rows = await prisma.uiDesignRender.findMany({ where: { batchId }, orderBy: { createdAt: 'asc' } });
  return { batchId, renders: rows.map(row => serializeRender(row, { full: false })) };
}

async function startRenderBatch(projectId, input = {}, createdByUserId = null) {
  const normalizedProjectId = String(projectId || '').trim();
  const active = await prisma.uiDesignRender.findFirst({
    where: {
      projectId: normalizedProjectId,
      status: { in: ['QUEUED','CLAIMED','BUILDING','RENDERING','COMPARING'] }
    },
    orderBy: { createdAt: 'desc' }
  });
  if (active?.batchId) {
    const existing = await batchDetail(normalizedProjectId, active.batchId);
    return { batchId: active.batchId, renders: existing.renders, reused: true };
  }

  const project = await prisma.uiDesignProject.findUnique({
    where: { id: String(projectId || '').trim() },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 100 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
      generations: { orderBy: { createdAt: 'desc' }, take: 50 }
    }
  });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');
  const references = uiStudioAnalysis.latestReferences(project.references);
  if (!references.length) throw publicError('Upload at least one UI reference first.', 422, 'UI_STUDIO_PHASE5_REFERENCE_REQUIRED');
  const fingerprint = uiStudioAnalysis.fingerprintReferences(references);
  const analysis = project.analyses[0] || null;
  if (!analysis || analysis.status !== 'COMPLETED' || analysis.sourceFingerprint !== fingerprint) {
    throw publicError('Run Phase 2 analysis on the latest references before Phase 5.', 422, 'UI_STUDIO_PHASE5_ANALYSIS_REQUIRED');
  }
  const generationId = String(input.generationId || project.bestGenerationId || '').trim();
  const generation = generationId
    ? project.generations.find(item => item.id === generationId)
    : project.generations[0];
  if (!generation || !['READY','READY_WITH_WARNINGS'].includes(generation.status) || !generation.generationJson) {
    throw publicError('Generate responsive code in Phase 3 before Phase 5.', 422, 'UI_STUDIO_PHASE5_GENERATION_REQUIRED');
  }
  if (generation.sourceFingerprint !== fingerprint || generation.sourceAnalysisId !== analysis.id) {
    throw publicError('The selected code version is stale. Regenerate it before Phase 5.', 422, 'UI_STUDIO_PHASE5_GENERATION_STALE');
  }
  return enqueueRenderBatch(project, generation, references, {
    autoRepair: input.autoRepair !== false,
    createdByUserId
  });
}

async function batchDetail(projectId, batchId) {
  const rows = await prisma.uiDesignRender.findMany({
    where: { projectId: String(projectId || '').trim(), batchId: String(batchId || '').trim() },
    orderBy: { createdAt: 'asc' }
  });
  if (!rows.length) throw publicError('Render batch was not found.', 404, 'UI_STUDIO_BATCH_NOT_FOUND');
  const generation = await prisma.uiDesignGeneration.findUnique({ where: { id: rows[0].generationId } });
  return {
    batchId: rows[0].batchId,
    status: rows.every(row => row.status === 'COMPLETED') ? 'COMPLETED'
      : rows.some(row => row.status === 'FAILED') ? 'FAILED'
      : rows.some(row => ['CLAIMED','BUILDING','RENDERING','COMPARING'].includes(row.status)) ? 'RUNNING'
      : 'QUEUED',
    generation: generationSummary(generation),
    renders: rows.map(row => serializeRender(row))
  };
}

async function acceptGeneration(projectId, generationId) {
  const generation = await prisma.uiDesignGeneration.findFirst({
    where: { id: String(generationId || '').trim(), projectId: String(projectId || '').trim() }
  });
  if (!generation) throw publicError('Generated version was not found.', 404, 'UI_STUDIO_GENERATION_NOT_FOUND');
  if (!Number.isFinite(Number(generation.aggregateScore))) throw publicError('Run Phase 5 across all available viewports before accepting this version.', 422, 'UI_STUDIO_ACCEPT_SCORE_REQUIRED');
  await prisma.uiDesignProject.update({
    where: { id: generation.projectId },
    data: {
      acceptedGenerationId: generation.id,
      acceptedAt: new Date(),
      status: 'ACCEPTED'
    }
  });
  return generationSummary(generation);
}

async function recoverStaleJobs() {
  const now = new Date();
  const maxAttempts = Number(env.uiStudioConvergence?.maxAttempts || 3);
  const terminal = await prisma.uiDesignRender.findMany({
    where: {
      status: { in: ['CLAIMED','BUILDING','RENDERING','COMPARING'] },
      leaseExpiresAt: { lt: now },
      attempts: { gte: maxAttempts }
    },
    select: { batchId: true }
  });
  await prisma.uiDesignRender.updateMany({
    where: {
      status: { in: ['CLAIMED','BUILDING','RENDERING','COMPARING'] },
      leaseExpiresAt: { lt: now },
      attempts: { lt: maxAttempts }
    },
    data: {
      status: 'QUEUED',
      workerId: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      errorMessage: 'Recovered after an expired render-worker lease.'
    }
  });
  await prisma.uiDesignRender.updateMany({
    where: {
      status: { in: ['CLAIMED','BUILDING','RENDERING','COMPARING'] },
      leaseExpiresAt: { lt: now },
      attempts: { gte: maxAttempts }
    },
    data: {
      status: 'FAILED',
      workerId: null,
      leaseExpiresAt: null,
      completedAt: now,
      errorMessage: 'Render worker retry limit reached.'
    }
  });
  for (const batchId of [...new Set(terminal.map(item => item.batchId).filter(Boolean))]) {
    await finalizeBatch(batchId).catch(() => {});
  }
}

async function claimNextRender(workerId) {
  await recoverStaleJobs();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidate = await prisma.uiDesignRender.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' }
    });
    if (!candidate) return null;
    const lease = new Date(Date.now() + Number(env.uiStudioConvergence?.leaseMs || 180000));
    const claimed = await prisma.uiDesignRender.updateMany({
      where: { id: candidate.id, status: 'QUEUED' },
      data: {
        status: 'CLAIMED',
        workerId,
        leaseExpiresAt: lease,
        heartbeatAt: new Date(),
        startedAt: candidate.startedAt || new Date(),
        attempts: { increment: 1 },
        errorMessage: null
      }
    });
    if (claimed.count === 1) {
      return prisma.uiDesignRender.findUnique({
        where: { id: candidate.id },
        include: {
          project: true,
          generation: true,
          reference: true
        }
      });
    }
  }
  return null;
}

async function heartbeat(renderId, workerId, status) {
  await prisma.uiDesignRender.updateMany({
    where: { id: renderId, workerId },
    data: {
      status,
      heartbeatAt: new Date(),
      leaseExpiresAt: new Date(Date.now() + Number(env.uiStudioConvergence?.leaseMs || 180000))
    }
  });
}

async function processClaimedRender(render, workerId) {
  try {
    const analysis = await prisma.uiDesignAnalysis.findUnique({ where: { id: render.generation.sourceAnalysisId } });
    const generationResult = safeParse(render.generation.generationJson, null);
    if (!generationResult) throw publicError('Generated code bundle is missing.', 422, 'UI_STUDIO_PHASE5_GENERATION_INVALID');

    await heartbeat(render.id, workerId, 'BUILDING');
    const boundProps = await boundPropsForProject(render.projectId, render.viewport);
    const masks = await masksForProject(render.project, analysis, render.viewport);
    const html = await previewBuild.buildPreviewHtml(generationResult, render.project, render.width, render.height, boundProps);
    const previewStored = await persistArtifact(render.id, Buffer.from(html, 'utf8'), 'text/html; charset=utf-8', render.viewport.toLowerCase() + '-phase5-preview.html');

    await heartbeat(render.id, workerId, 'RENDERING');
    const renderedBuffer = await renderWithChromium(html, render.width, render.height);

    await heartbeat(render.id, workerId, 'COMPARING');
    const referenceBuffer = await objectStorage.getBuffer(render.reference.storageKey, null, render.reference.storageProvider);
    const compareScale = Math.min(1, COMPARE_MAX_DIMENSION / Math.max(render.width, render.height));
    const compareWidth = Math.max(1, Math.round(render.width * compareScale));
    const compareHeight = Math.max(1, Math.round(render.height * compareScale));
    const [referenceRaw, renderedRaw] = await Promise.all([
      rawComparable(referenceBuffer, compareWidth, compareHeight),
      rawComparable(renderedBuffer, compareWidth, compareHeight)
    ]);
    const measured = imageMetrics(referenceRaw, renderedRaw, compareWidth, compareHeight, masks);
    const diffBuffer = await sharp(measured.diff, {
      raw: { width: compareWidth, height: compareHeight, channels: 4 }
    }).png({ compressionLevel: 9 }).toBuffer();

    const critique = await visualCritique(referenceBuffer, renderedBuffer, measured.metrics, render.viewport, masks);
    const metrics = {
      ...measured.metrics,
      combinedScore: combinedScore(measured.metrics, critique),
      targetScore: Number(env.uiStudioVisual?.targetScore || 90),
      masks: masks.map(mask => ({
        id: mask.id,
        source: mask.source,
        label: mask.label,
        xPct: mask.xPct,
        yPct: mask.yPct,
        widthPct: mask.widthPct,
        heightPct: mask.heightPct
      })),
      renderer: 'browserless-chromium',
      deterministic: true
    };

    const [renderedStored, diffStored] = await Promise.all([
      persistArtifact(render.id, renderedBuffer, 'image/png', render.viewport.toLowerCase() + '-phase5-rendered.png'),
      persistArtifact(render.id, diffBuffer, 'image/png', render.viewport.toLowerCase() + '-phase5-diff.png')
    ]);

    await prisma.uiDesignRender.update({
      where: { id: render.id },
      data: {
        status: 'COMPLETED',
        workerId: null,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
        previewStorageProvider: previewStored.storageProvider,
        previewStorageKey: previewStored.storageKey,
        previewSha256: crypto.createHash('sha256').update(html).digest('hex'),
        renderedStorageProvider: renderedStored.storageProvider,
        renderedStorageKey: renderedStored.storageKey,
        diffStorageProvider: diffStored.storageProvider,
        diffStorageKey: diffStored.storageKey,
        metricsJson: JSON.stringify(metrics),
        critiqueJson: critique ? JSON.stringify(critique) : null,
        completedAt: new Date(),
        errorMessage: null
      }
    });

    await finalizeBatch(render.batchId);
  } catch (caught) {
    const message = String(caught.publicMessage || caught.message || 'Phase 5 render failed.').slice(0, 1500);
    const current = await prisma.uiDesignRender.findUnique({ where: { id: render.id } }).catch(() => null);
    const retry = Number(current?.attempts || 0) < Number(env.uiStudioConvergence?.maxAttempts || 3);
    await prisma.uiDesignRender.update({
      where: { id: render.id },
      data: {
        status: retry ? 'QUEUED' : 'FAILED',
        workerId: null,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
        completedAt: retry ? null : new Date(),
        errorMessage: message
      }
    }).catch(() => {});
    if (!retry) await finalizeBatch(render.batchId).catch(() => {});
    throw caught;
  }
}

function viewportRegression(childScores, parentScores, tolerance) {
  const regressions = [];
  for (const viewport of VIEWPORT_ORDER) {
    if (!Number.isFinite(Number(childScores?.[viewport])) || !Number.isFinite(Number(parentScores?.[viewport]))) continue;
    const delta = Number(childScores[viewport]) - Number(parentScores[viewport]);
    if (delta < -Math.abs(tolerance)) regressions.push({ viewport, delta });
  }
  return regressions;
}

async function repairGenerationFromBatch(project, generation, batchRows, aggregateScore, viewportScores) {
  if (!env.uiStudioVisual?.apiKey) return null;
  if ((generation.repairDepth || 0) >= Number(env.uiStudioVisual?.maxRepairPasses || 3)) return null;

  const analysis = await prisma.uiDesignAnalysis.findUnique({ where: { id: generation.sourceAnalysisId } });
  const analysisResult = safeParse(analysis?.analysisJson, null);
  const currentResult = safeParse(generation.generationJson, null);
  if (!analysisResult || !currentResult) return null;

  const content = [{
    type: 'input_text',
    text: [
      'PROJECT TARGET',
      JSON.stringify({
        name: project.name,
        framework: project.framework,
        styling: project.styling,
        outputType: project.outputType
      }),
      '',
      'CURRENT RESPONSIVE GENERATION',
      JSON.stringify(currentResult),
      '',
      'PHASE 2 ANALYSIS',
      JSON.stringify(analysisResult),
      '',
      'AGGREGATE SCORE',
      String(aggregateScore),
      '',
      'VIEWPORT SCORES',
      JSON.stringify(viewportScores),
      '',
      'Repair all supplied viewports together. Never improve one viewport by materially regressing another.'
    ].join('\n')
  }];

  const ordered = [...batchRows].sort((a,b) => VIEWPORT_ORDER.indexOf(a.viewport) - VIEWPORT_ORDER.indexOf(b.viewport));
  for (const row of ordered) {
    if (!row.renderedStorageKey) continue;
    const reference = await prisma.uiDesignReference.findUnique({ where: { id: row.referenceId } });
    if (!reference) continue;
    const [originalBuffer, renderedBuffer] = await Promise.all([
      objectStorage.getBuffer(reference.storageKey, null, reference.storageProvider),
      objectStorage.getBuffer(row.renderedStorageKey, null, row.renderedStorageProvider)
    ]);
    const [originalImage, renderedImage] = await Promise.all([imageDataUrl(originalBuffer), imageDataUrl(renderedBuffer)]);
    content.push({
      type: 'input_text',
      text: row.viewport + ' metrics: ' + String(row.metricsJson || '{}') + '\ncritique: ' + String(row.critiqueJson || '{}') + '\nNext two images are ORIGINAL then RENDERED.'
    });
    content.push({ type: 'input_image', image_url: originalImage, detail: 'high' });
    content.push({ type: 'input_image', image_url: renderedImage, detail: 'high' });
  }

  const payload = {
    model: env.uiStudioVisual.model,
    instructions: [
      'You are INXSocial UI Studio Phase 5 convergence engineer.',
      'Repair the EXISTING responsive code to improve the aggregate visual match across every supplied viewport.',
      'This is reconstruction, not redesign. Preserve all already-correct regions.',
      'Use responsive CSS rather than viewport-specific hardcoded screenshots.',
      'Dynamic-media pixels may be masked in scoring; preserve their container geometry without trying to imitate image content.',
      'Do not add remote scripts, network calls, tracking, iframes, Node APIs or screenshot embeddings.',
      'Return a complete code bundle matching the generation schema.'
    ].join(' '),
    input: [{ role: 'user', content }],
    text: {
      format: {
        type: 'json_schema',
        name: 'inx_ui_converged_code',
        strict: true,
        schema: uiStudioCodegen.generationSchema()
      }
    },
    max_output_tokens: 28000
  };
  if (/^gpt-5(?:\.|-)/i.test(String(payload.model || ''))) payload.reasoning = { effort: env.uiStudioVisual.reasoningEffort || 'high' };

  let response;
  try {
    response = await axios.post(env.uiStudioVisual.baseUrl + '/responses', payload, {
      timeout: env.uiStudioVisual.timeoutMs,
      maxBodyLength: 55 * 1024 * 1024,
      maxContentLength: 55 * 1024 * 1024,
      headers: { Authorization: 'Bearer ' + env.uiStudioVisual.apiKey, 'Content-Type': 'application/json' }
    });
  } catch (caught) {
    console.error('[ui-studio-phase5] responsive repair failed', {
      status: Number(caught?.response?.status || 0),
      detail: String(caught?.response?.data?.error?.message || caught.message || '').slice(0, 500)
    });
    return null;
  }

  const parsed = parseJsonObject(webResearch.extractResponseText(response.data));
  if (!parsed) return null;
  const repaired = uiStudioCodegen.normalizeGeneration(parsed, project);
  previewBuild.validateGeneratedSources(repaired);
  const validation = await uiStudioCodegen.validateGenerationBuild(repaired, project);
  const child = await prisma.uiDesignGeneration.create({
    data: {
      projectId: project.id,
      sourceAnalysisId: generation.sourceAnalysisId,
      status: validation.ok ? 'READY' : 'READY_WITH_WARNINGS',
      version: uiStudioCodegen.GENERATION_VERSION,
      model: env.uiStudioVisual.model,
      framework: project.framework,
      styling: project.styling,
      outputType: project.outputType,
      sourceFingerprint: generation.sourceFingerprint,
      generationJson: JSON.stringify(repaired),
      validationJson: JSON.stringify(validation),
      parentGenerationId: generation.id,
      repairDepth: (generation.repairDepth || 0) + 1,
      qualityStatus: 'PENDING_RETEST',
      createdByUserId: generation.createdByUserId || null,
      completedAt: new Date()
    }
  });
  const worst = [...batchRows].sort((a,b) => {
    const as = safeParse(a.metricsJson, {})?.combinedScore ?? 0;
    const bs = safeParse(b.metricsJson, {})?.combinedScore ?? 0;
    return as - bs;
  })[0];
  await prisma.uiDesignRepairAttempt.create({
    data: {
      projectId: project.id,
      renderId: worst.id,
      inputGenerationId: generation.id,
      outputGenerationId: child.id,
      attemptNumber: child.repairDepth,
      status: 'PENDING_RETEST',
      scoreBefore: aggregateScore,
      instructionsJson: JSON.stringify({
        aggregateScore,
        viewportScores,
        sourceBatchId: worst.batchId,
        allViewportRepair: true
      }),
      createdByUserId: generation.createdByUserId || null
    }
  });
  const references = await prisma.uiDesignReference.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  return enqueueRenderBatch(project, child, uiStudioAnalysis.latestReferences(references), {
    autoRepair: true,
    parentRenderId: worst.id,
    createdByUserId: generation.createdByUserId || null
  });
}

async function finalizeBatch(batchId) {
  if (!batchId) return null;
  const rows = await prisma.uiDesignRender.findMany({
    where: { batchId },
    orderBy: { createdAt: 'asc' }
  });
  if (!rows.length) return null;
  if (rows.some(row => ['QUEUED','CLAIMED','BUILDING','RENDERING','COMPARING'].includes(row.status))) return null;

  const project = await prisma.uiDesignProject.findUnique({ where: { id: rows[0].projectId } });
  const generation = await prisma.uiDesignGeneration.findUnique({ where: { id: rows[0].generationId } });
  if (!project || !generation) return null;

  if (rows.some(row => row.status === 'FAILED')) {
    await prisma.uiDesignProject.update({ where: { id: project.id }, data: { status: 'CONVERGENCE_FAILED' } });
    return { status: 'FAILED' };
  }

  const viewportScores = {};
  for (const row of rows) {
    const metrics = safeParse(row.metricsJson, {});
    viewportScores[row.viewport] = Number(metrics.combinedScore ?? metrics.pixelScore ?? 0);
  }
  const values = Object.values(viewportScores).filter(Number.isFinite);
  const aggregateScore = values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
  const minViewportScore = values.length ? Math.min(...values) : 0;
  const target = Number(env.uiStudioVisual?.targetScore || 90);
  const floor = Number(env.uiStudioConvergence?.minimumViewportScore || 78);
  const tolerance = Number(env.uiStudioConvergence?.regressionTolerance || 3);

  let qualityStatus = aggregateScore >= target && minViewportScore >= floor ? 'CONVERGED' : 'NEEDS_REPAIR';
  let regressions = [];
  let parent = null;
  if (generation.parentGenerationId) {
    parent = await prisma.uiDesignGeneration.findUnique({ where: { id: generation.parentGenerationId } });
    const parentScores = safeParse(parent?.viewportScoresJson, {});
    regressions = viewportRegression(viewportScores, parentScores, tolerance);
    if (Number.isFinite(Number(parent?.aggregateScore)) && (aggregateScore <= Number(parent.aggregateScore) || regressions.length)) {
      qualityStatus = 'REJECTED_REGRESSION';
    }
  }

  await prisma.uiDesignGeneration.update({
    where: { id: generation.id },
    data: {
      aggregateScore,
      viewportScoresJson: JSON.stringify(viewportScores),
      qualityStatus
    }
  });

  if (generation.parentGenerationId) {
    await prisma.uiDesignRepairAttempt.updateMany({
      where: { outputGenerationId: generation.id },
      data: {
        scoreAfter: aggregateScore,
        status: qualityStatus === 'REJECTED_REGRESSION' ? 'REJECTED_REGRESSION' : 'COMPLETED',
        completedAt: new Date()
      }
    });
  }

  let best = project.bestGenerationId
    ? await prisma.uiDesignGeneration.findUnique({ where: { id: project.bestGenerationId } })
    : null;
  let bestScores = safeParse(best?.viewportScoresJson, {});
  const bestRegressions = best ? viewportRegression(viewportScores, bestScores, tolerance) : [];
  const shouldBecomeBest = qualityStatus !== 'REJECTED_REGRESSION'
    && (!best || aggregateScore > Number(project.bestAggregateScore ?? best.aggregateScore ?? -1))
    && (!best || bestRegressions.length === 0);

  if (shouldBecomeBest) {
    best = { ...generation, aggregateScore, viewportScoresJson: JSON.stringify(viewportScores), qualityStatus };
    bestScores = viewportScores;
    await prisma.uiDesignProject.update({
      where: { id: project.id },
      data: {
        bestGenerationId: generation.id,
        bestAggregateScore: aggregateScore,
        status: qualityStatus === 'CONVERGED' ? 'CONVERGED' : 'CONVERGENCE_REVIEW'
      }
    });
  } else {
    await prisma.uiDesignProject.update({
      where: { id: project.id },
      data: {
        status: qualityStatus === 'REJECTED_REGRESSION'
          ? 'REGRESSION_REJECTED'
          : qualityStatus === 'CONVERGED'
            ? 'CONVERGED'
            : 'CONVERGENCE_REVIEW'
      }
    });
  }

  if (
    qualityStatus === 'NEEDS_REPAIR'
    && rows[0].autoRepair
    && (generation.repairDepth || 0) < Number(env.uiStudioVisual?.maxRepairPasses || 3)
  ) {
    return repairGenerationFromBatch(project, generation, rows, aggregateScore, viewportScores);
  }

  return {
    status: qualityStatus,
    aggregateScore,
    viewportScores,
    bestGenerationId: shouldBecomeBest ? generation.id : project.bestGenerationId,
    regressions
  };
}

async function cleanupExpiredArtifacts(limit = 100) {
  const days = Number(env.uiStudioConvergence?.artifactRetentionDays || 30);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.uiDesignRender.findMany({
    where: {
      completedAt: { lt: cutoff },
      OR: [
        { previewStorageKey: { not: null } },
        { renderedStorageKey: { not: null } },
        { diffStorageKey: { not: null } }
      ]
    },
    include: { project: true },
    orderBy: { completedAt: 'asc' },
    take: Math.max(1, Math.min(250, Number(limit || 100)))
  });

  let cleaned = 0;
  for (const row of rows) {
    if (row.generationId === row.project.bestGenerationId || row.generationId === row.project.acceptedGenerationId) continue;
    const objects = [
      [row.previewStorageKey, row.previewStorageProvider],
      [row.renderedStorageKey, row.renderedStorageProvider],
      [row.diffStorageKey, row.diffStorageProvider]
    ].filter(([key]) => Boolean(key));
    for (const [key, provider] of objects) {
      await objectStorage.deleteObject(key, provider).catch(error => {
        console.warn('[ui-studio-phase5] artifact cleanup delete failed', {
          renderId: row.id,
          key,
          error: error?.message
        });
      });
    }
    await prisma.uiDesignRender.update({
      where: { id: row.id },
      data: {
        previewStorageProvider: null,
        previewStorageKey: null,
        previewSha256: null,
        renderedStorageProvider: null,
        renderedStorageKey: null,
        diffStorageProvider: null,
        diffStorageKey: null
      }
    });
    cleaned += 1;
  }
  return { cleaned, retentionDays: days };
}

async function processNextQueuedRender(workerId) {
  const render = await claimNextRender(workerId);
  if (!render) return { processed: false };
  await processClaimedRender(render, workerId);
  return { processed: true, renderId: render.id, batchId: render.batchId };
}

module.exports = {
  CONVERGENCE_VERSION,
  MAX_ASSET_BYTES,
  rendererConfigured,
  phase5Status,
  uploadAssetBinding,
  deleteAssetBinding,
  createIgnoreMask,
  deleteIgnoreMask,
  imageMetrics,
  renderWithChromium,
  serializeRender,
  startRenderBatch,
  batchDetail,
  acceptGeneration,
  recoverStaleJobs,
  cleanupExpiredArtifacts,
  processNextQueuedRender,
  finalizeBatch
};
