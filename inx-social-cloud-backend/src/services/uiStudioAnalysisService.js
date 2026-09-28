'use strict';

const crypto = require('node:crypto');
const axios = require('axios');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const env = require('../config/env');
const objectStorage = require('./mediaObjectStorageService');
const webResearch = require('./webResearchService');

const ANALYSIS_VERSION = 'ui-analysis-v1';
const VIEWPORT_ORDER = ['DESKTOP', 'TABLET', 'MOBILE'];
const MAX_INPUT_IMAGES = 12;
const FULL_PREVIEW_MAX = 2200;
const TILE_MAX = 1600;

function error(message, status = 400, code = 'UI_STUDIO_ANALYSIS_ERROR') {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  value.publicMessage = message;
  return value;
}

function ready() {
  return Boolean(env.uiStudioAnalysis?.apiKey && env.uiStudioAnalysis?.baseUrl && env.uiStudioAnalysis?.model);
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

function latestReferences(references = []) {
  const latest = {};
  for (const reference of references) {
    if (!reference?.viewport || latest[reference.viewport]) continue;
    latest[reference.viewport] = reference;
  }
  return VIEWPORT_ORDER.map(viewport => latest[viewport]).filter(Boolean);
}

function fingerprintReferences(references = []) {
  const normalized = latestReferences(references)
    .map(reference => [reference.viewport, reference.id, reference.sha256, reference.width, reference.height].join(':'))
    .join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function sourceReferenceDescriptor(reference) {
  return {
    id: reference.id,
    viewport: reference.viewport,
    originalName: reference.originalName,
    width: reference.width,
    height: reference.height,
    sha256: reference.sha256
  };
}

function gridFor(width, height, maxTiles) {
  const aspect = Math.max(0.05, Number(width || 1) / Math.max(1, Number(height || 1)));
  let best = { cols: 1, rows: 1, score: Infinity, count: 1 };
  for (let cols = 1; cols <= maxTiles; cols += 1) {
    for (let rows = 1; rows <= maxTiles; rows += 1) {
      const count = cols * rows;
      if (count > maxTiles) continue;
      const cellAspect = aspect * rows / cols;
      const shapePenalty = Math.abs(Math.log(Math.max(0.05, cellAspect)));
      const utilizationPenalty = (maxTiles - count) * 0.11;
      const score = shapePenalty + utilizationPenalty;
      if (score < best.score) best = { cols, rows, score, count };
    }
  }
  return { cols: best.cols, rows: best.rows };
}

async function jpegDataUrl(pipeline) {
  const data = await pipeline
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer();
  return 'data:image/jpeg;base64,' + data.toString('base64');
}

async function prepareReferenceImages(reference, buffer, maxTiles = 6) {
  const metadata = await sharp(buffer, { limitInputPixels: 200000000 }).metadata();
  const width = Number(metadata.width || reference.width || 0);
  const height = Number(metadata.height || reference.height || 0);
  if (!width || !height) throw error('UI reference dimensions could not be read.', 422, 'UI_STUDIO_ANALYSIS_IMAGE_INVALID');

  const full = await jpegDataUrl(
    sharp(buffer, { limitInputPixels: 200000000 })
      .rotate()
      .resize({ width: FULL_PREVIEW_MAX, height: FULL_PREVIEW_MAX, fit: 'inside', withoutEnlargement: true })
  );

  const images = [{
    kind: 'FULL',
    label: reference.viewport + ' full reference',
    imageUrl: full,
    crop: { x: 0, y: 0, width, height }
  }];

  const needsTiles = width > FULL_PREVIEW_MAX || height > FULL_PREVIEW_MAX || Math.max(width / height, height / width) > 2.4;
  if (!needsTiles || maxTiles < 2) return images;

  const { cols, rows } = gridFor(width, height, maxTiles);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (images.length - 1 >= maxTiles) break;
      const left = Math.floor(width * col / cols);
      const top = Math.floor(height * row / rows);
      const right = Math.floor(width * (col + 1) / cols);
      const bottom = Math.floor(height * (row + 1) / rows);
      const cropWidth = Math.max(1, right - left);
      const cropHeight = Math.max(1, bottom - top);
      const imageUrl = await jpegDataUrl(
        sharp(buffer, { limitInputPixels: 200000000 })
          .rotate()
          .extract({ left, top, width: cropWidth, height: cropHeight })
          .resize({ width: TILE_MAX, height: TILE_MAX, fit: 'inside', withoutEnlargement: true })
      );
      images.push({
        kind: 'TILE',
        label: `${reference.viewport} detail tile ${row * cols + col + 1}/${cols * rows}`,
        imageUrl,
        crop: { x: left, y: top, width: cropWidth, height: cropHeight }
      });
    }
  }

  return images;
}

function percentBoundsSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['x', 'y', 'width', 'height'],
    properties: {
      x: { type: 'number', minimum: 0, maximum: 100 },
      y: { type: 'number', minimum: 0, maximum: 100 },
      width: { type: 'number', minimum: 0, maximum: 100 },
      height: { type: 'number', minimum: 0, maximum: 100 }
    }
  };
}

function analysisSchema() {
  const bounds = percentBoundsSchema();
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'version','summary','confidence','observations','inferences','colorTokens','typography',
      'spacingScalePx','radiusScalePx','effects','viewportAnalyses','responsivePlan',
      'implementationPlan','warnings'
    ],
    properties: {
      version: { type: 'string' },
      summary: { type: 'string' },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
      observations: { type: 'array', maxItems: 14, items: { type: 'string' } },
      inferences: { type: 'array', maxItems: 12, items: { type: 'string' } },
      colorTokens: {
        type: 'array', maxItems: 18,
        items: {
          type: 'object', additionalProperties: false,
          required: ['name','value','usage'],
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
            usage: { type: 'string' }
          }
        }
      },
      typography: {
        type: 'array', maxItems: 16,
        items: {
          type: 'object', additionalProperties: false,
          required: ['role','familyGuess','sizePx','weight','lineHeightPx','letterSpacing','color','notes'],
          properties: {
            role: { type: 'string' },
            familyGuess: { type: 'string' },
            sizePx: { type: 'number', minimum: 0, maximum: 300 },
            weight: { type: 'integer', minimum: 100, maximum: 900 },
            lineHeightPx: { type: 'number', minimum: 0, maximum: 400 },
            letterSpacing: { type: 'string' },
            color: { type: 'string' },
            notes: { type: 'string' }
          }
        }
      },
      spacingScalePx: { type: 'array', maxItems: 20, items: { type: 'integer', minimum: 0, maximum: 500 } },
      radiusScalePx: { type: 'array', maxItems: 14, items: { type: 'integer', minimum: 0, maximum: 300 } },
      effects: { type: 'array', maxItems: 16, items: { type: 'string' } },
      viewportAnalyses: {
        type: 'array', minItems: 1, maxItems: 3,
        items: {
          type: 'object', additionalProperties: false,
          required: ['viewport','sourceWidth','sourceHeight','layoutMode','columns','contentBoundsPct','majorSpacingPx','sections','components','notes'],
          properties: {
            viewport: { type: 'string', enum: VIEWPORT_ORDER },
            sourceWidth: { type: 'integer', minimum: 1 },
            sourceHeight: { type: 'integer', minimum: 1 },
            layoutMode: { type: 'string' },
            columns: { type: 'integer', minimum: 1, maximum: 24 },
            contentBoundsPct: bounds,
            majorSpacingPx: { type: 'array', maxItems: 14, items: { type: 'integer', minimum: 0, maximum: 1000 } },
            sections: {
              type: 'array', maxItems: 24,
              items: {
                type: 'object', additionalProperties: false,
                required: ['id','label','type','boundsPct','notes'],
                properties: {
                  id: { type: 'string' },
                  label: { type: 'string' },
                  type: { type: 'string' },
                  boundsPct: bounds,
                  notes: { type: 'string' }
                }
              }
            },
            components: {
              type: 'array', maxItems: 70,
              items: {
                type: 'object', additionalProperties: false,
                required: ['id','sectionId','label','type','boundsPct','reusable','visibleText','visualDetails','behavior','responsiveNotes','confidence'],
                properties: {
                  id: { type: 'string' },
                  sectionId: { type: ['string','null'] },
                  label: { type: 'string' },
                  type: { type: 'string' },
                  boundsPct: bounds,
                  reusable: { type: 'boolean' },
                  visibleText: { type: 'string' },
                  visualDetails: { type: 'string' },
                  behavior: { type: 'string' },
                  responsiveNotes: { type: 'string' },
                  confidence: { type: 'integer', minimum: 0, maximum: 100 }
                }
              }
            },
            notes: { type: 'array', maxItems: 12, items: { type: 'string' } }
          }
        }
      },
      responsivePlan: {
        type: 'object', additionalProperties: false,
        required: ['basis','tablet','mobile','breakpointNotes'],
        properties: {
          basis: { type: 'string', enum: ['OBSERVED','INFERRED','MIXED'] },
          tablet: { type: 'array', maxItems: 14, items: { type: 'string' } },
          mobile: { type: 'array', maxItems: 14, items: { type: 'string' } },
          breakpointNotes: { type: 'array', maxItems: 12, items: { type: 'string' } }
        }
      },
      implementationPlan: {
        type: 'object', additionalProperties: false,
        required: ['componentTree','dataDrivenComponents','mediaSlots','accessibilityNotes','productionRisks'],
        properties: {
          componentTree: { type: 'array', maxItems: 40, items: { type: 'string' } },
          dataDrivenComponents: { type: 'array', maxItems: 20, items: { type: 'string' } },
          mediaSlots: { type: 'array', maxItems: 20, items: { type: 'string' } },
          accessibilityNotes: { type: 'array', maxItems: 16, items: { type: 'string' } },
          productionRisks: { type: 'array', maxItems: 16, items: { type: 'string' } }
        }
      },
      warnings: { type: 'array', maxItems: 16, items: { type: 'string' } }
    }
  };
}

function analysisInstructions() {
  return [
    'You are INXSocial UI Studio, a senior interface reconstruction analyst.',
    'This is a reconstruction task, not a redesign task. Analyse the supplied reference pixels faithfully.',
    'Your job is to describe the visible design so a later code-generation stage can reproduce it accurately and responsively.',
    'Do not improve, modernise, simplify or invent visual choices.',
    'Distinguish OBSERVED facts from INFERRED responsive or behavioural assumptions. Put uncertain assumptions in inferences/warnings.',
    'Component bounds are percentages of the complete source image: x/y from the top-left; width/height as percentages of source dimensions.',
    'Use the source metadata in the prompt as authoritative for viewport names and source dimensions.',
    'Transcribe visible UI text only when legible. Never fabricate unreadable copy.',
    'Estimate typography, spacing, radius, colours, gradients, shadows and hierarchy conservatively.',
    'Identify image/video/carousel/media slots separately from surrounding containers.',
    'When multiple viewport references are supplied, compare their actual differences. When only desktop is supplied, responsive rules are inferred and must be labelled INFERRED.',
    'Return only structured JSON matching the supplied schema.'
  ].join(' ');
}

function normalizeResult(result, references) {
  result.version = ANALYSIS_VERSION;
  const byViewport = Object.fromEntries(references.map(reference => [reference.viewport, reference]));
  result.viewportAnalyses = (result.viewportAnalyses || [])
    .filter(item => byViewport[item.viewport])
    .map(item => ({
      ...item,
      sourceWidth: Number(byViewport[item.viewport].width),
      sourceHeight: Number(byViewport[item.viewport].height)
    }));
  result.spacingScalePx = [...new Set((result.spacingScalePx || []).map(Number).filter(Number.isFinite))].sort((a,b) => a-b);
  result.radiusScalePx = [...new Set((result.radiusScalePx || []).map(Number).filter(Number.isFinite))].sort((a,b) => a-b);
  return result;
}

async function buildInputContent(references) {
  const content = [{
    type: 'input_text',
    text: [
      'PROJECT REFERENCE SET',
      JSON.stringify(references.map(sourceReferenceDescriptor)),
      '',
      'Analyse each supplied viewport independently first, then produce one shared token/typography system and a responsive plan.',
      'The full image is supplied first. High-resolution detail tiles may follow and refer to exact crop coordinates in the original source.'
    ].join('\n')
  }];

  const maxTilesPerReference = references.length >= 3 ? 3 : references.length === 2 ? 4 : 6;
  let imageCount = 0;
  for (const reference of references) {
    const buffer = await objectStorage.getBuffer(reference.storageKey, null, reference.storageProvider);
    const images = await prepareReferenceImages(reference, buffer, maxTilesPerReference);
    for (const image of images) {
      if (imageCount >= MAX_INPUT_IMAGES) break;
      content.push({
        type: 'input_text',
        text: `${image.label}. Original crop pixels: x=${image.crop.x}, y=${image.crop.y}, width=${image.crop.width}, height=${image.crop.height}.`
      });
      content.push({ type: 'input_image', image_url: image.imageUrl, detail: 'high' });
      imageCount += 1;
    }
  }
  return { content, imageCount };
}

async function requestAnalysis(references) {
  if (!ready()) throw error('UI Studio analysis model is not configured.', 503, 'UI_STUDIO_ANALYSIS_NOT_CONFIGURED');

  const { content, imageCount } = await buildInputContent(references);
  const base = {
    model: env.uiStudioAnalysis.model,
    instructions: analysisInstructions(),
    input: [{ role: 'user', content }],
    text: {
      format: {
        type: 'json_schema',
        name: 'inx_ui_design_analysis',
        strict: true,
        schema: analysisSchema()
      }
    }
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const payload = {
      ...base,
      max_output_tokens: attempt === 1 ? 9000 : 12000
    };
    if (/^gpt-5(?:\.|-)/i.test(String(payload.model || ''))) {
      payload.reasoning = { effort: attempt === 1 ? (env.uiStudioAnalysis.reasoningEffort || 'high') : 'medium' };
    }
    if (attempt > 1) {
      payload.instructions += ' Retry: return one complete JSON object only. Reduce prose length but preserve all required fields.';
    }

    let response;
    try {
      response = await axios.post(env.uiStudioAnalysis.baseUrl + '/responses', payload, {
        timeout: env.uiStudioAnalysis.timeoutMs,
        maxBodyLength: 35 * 1024 * 1024,
        maxContentLength: 35 * 1024 * 1024,
        headers: {
          Authorization: 'Bearer ' + env.uiStudioAnalysis.apiKey,
          'Content-Type': 'application/json'
        }
      });
    } catch (caught) {
      const status = Number(caught?.response?.status || 0);
      if (status >= 400 && status < 500) {
        console.error('[ui-studio] analysis provider rejected request', {
          status,
          detail: String(caught?.response?.data?.error?.message || caught.message || '').slice(0, 500)
        });
        throw error('The design-analysis model rejected the reference request.', 502, 'UI_STUDIO_ANALYSIS_PROVIDER_REJECTED');
      }
      if (attempt === 2) throw error('The design-analysis model did not respond in time.', 504, 'UI_STUDIO_ANALYSIS_TIMEOUT');
      continue;
    }

    const parsed = parseJsonObject(webResearch.extractResponseText(response.data));
    if (parsed && typeof parsed === 'object') {
      return {
        result: normalizeResult(parsed, references),
        model: env.uiStudioAnalysis.model,
        imageCount,
        providerStatus: response.data?.status || null
      };
    }

    console.warn('[ui-studio] structured design analysis parse failed', {
      attempt,
      status: response.data?.status || null,
      incompleteReason: response.data?.incomplete_details?.reason || null
    });
  }

  throw error('The design-analysis model returned an incomplete structured result.', 502, 'UI_STUDIO_ANALYSIS_PARSE_ERROR');
}

function serializeAnalysis(row, { full = false, currentFingerprint = null } = {}) {
  if (!row) return null;
  const sourceReferences = safeParse(row.sourceReferencesJson, []);
  const result = safeParse(row.analysisJson, null);
  const base = {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    model: row.model || null,
    version: row.version || ANALYSIS_VERSION,
    sourceFingerprint: row.sourceFingerprint,
    sourceReferences,
    summary: result?.summary || null,
    confidence: Number(result?.confidence || 0),
    viewportCount: Array.isArray(result?.viewportAnalyses) ? result.viewportAnalyses.length : 0,
    errorMessage: row.errorMessage || null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    stale: Boolean(currentFingerprint && row.sourceFingerprint !== currentFingerprint)
  };
  if (full) base.result = result;
  return base;
}

async function analyseProject(projectId, createdByUserId = null) {
  const id = String(projectId || '').trim();
  const project = await prisma.uiDesignProject.findUnique({
    where: { id },
    include: { references: { orderBy: { createdAt: 'desc' }, take: 100 } }
  });
  if (!project) throw error('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');

  const references = latestReferences(project.references);
  if (!references.length) {
    throw error('Upload at least one UI reference before running design analysis.', 422, 'UI_STUDIO_ANALYSIS_REFERENCE_REQUIRED');
  }
  if (!ready()) throw error('UI Studio analysis is not configured.', 503, 'UI_STUDIO_ANALYSIS_NOT_CONFIGURED');

  const sourceFingerprint = fingerprintReferences(references);
  const sourceReferencesJson = JSON.stringify(references.map(sourceReferenceDescriptor));
  const staleBefore = new Date(Date.now() - 20 * 60 * 1000);
  await prisma.uiDesignAnalysis.updateMany({
    where: { projectId: id, status: 'RUNNING', startedAt: { lt: staleBefore } },
    data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'Recovered stale analysis job.' }
  });
  const running = await prisma.uiDesignAnalysis.findFirst({
    where: { projectId: id, status: 'RUNNING' },
    orderBy: { startedAt: 'desc' }
  });
  if (running) throw error('A design analysis is already running for this project.', 409, 'UI_STUDIO_ANALYSIS_ALREADY_RUNNING');
  const row = await prisma.uiDesignAnalysis.create({
    data: {
      projectId: id,
      status: 'RUNNING',
      version: ANALYSIS_VERSION,
      model: env.uiStudioAnalysis.model,
      sourceFingerprint,
      sourceReferencesJson,
      createdByUserId: createdByUserId ? String(createdByUserId) : null
    }
  });
  await prisma.uiDesignProject.update({ where: { id }, data: { status: 'ANALYZING' } });

  try {
    const analysed = await requestAnalysis(references);
    const completed = await prisma.uiDesignAnalysis.update({
      where: { id: row.id },
      data: {
        status: 'COMPLETED',
        model: analysed.model,
        analysisJson: JSON.stringify(analysed.result),
        completedAt: new Date(),
        errorMessage: null
      }
    });
    await prisma.uiDesignProject.update({
      where: { id },
      data: {
        status: 'ANALYZED',
        bestGenerationId: null,
        acceptedGenerationId: null,
        bestAggregateScore: null,
        acceptedAt: null
      }
    });
    return {
      analysis: serializeAnalysis(completed, { full: true, currentFingerprint: sourceFingerprint }),
      imageCount: analysed.imageCount
    };
  } catch (caught) {
    const message = String(caught.publicMessage || caught.message || 'Design analysis failed.').slice(0, 1000);
    await prisma.uiDesignAnalysis.update({
      where: { id: row.id },
      data: { status: 'FAILED', errorMessage: message, completedAt: new Date() }
    }).catch(() => {});
    await prisma.uiDesignProject.update({ where: { id }, data: { status: 'ANALYSIS_FAILED' } }).catch(() => {});
    throw caught;
  }
}

async function latestProjectAnalysis(projectId) {
  const project = await prisma.uiDesignProject.findUnique({
    where: { id: String(projectId || '').trim() },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 100 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 }
    }
  });
  if (!project) throw error('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');
  const fingerprint = fingerprintReferences(latestReferences(project.references));
  return serializeAnalysis(project.analyses[0], { full: true, currentFingerprint: fingerprint });
}

module.exports = {
  ANALYSIS_VERSION,
  VIEWPORT_ORDER,
  MAX_INPUT_IMAGES,
  FULL_PREVIEW_MAX,
  TILE_MAX,
  ready,
  latestReferences,
  fingerprintReferences,
  sourceReferenceDescriptor,
  gridFor,
  prepareReferenceImages,
  analysisSchema,
  serializeAnalysis,
  analyseProject,
  latestProjectAnalysis
};
