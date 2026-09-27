'use strict';

const crypto = require('node:crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const objectStorage = require('./mediaObjectStorageService');
const uiStudioAnalysis = require('./uiStudioAnalysisService');
const webResearch = require('./webResearchService');

const GENERATION_VERSION = 'ui-codegen-v1';
const MAX_FILES = 14;
const MAX_FILE_CHARS = 120000;
const MAX_TOTAL_CHARS = 420000;

function error(message, status = 400, code = 'UI_STUDIO_CODEGEN_ERROR') {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  value.publicMessage = message;
  return value;
}

function ready() {
  return Boolean(env.uiStudioCodegen?.apiKey && env.uiStudioCodegen?.baseUrl && env.uiStudioCodegen?.model);
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

function generationSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'version','summary','framework','styling','outputType','entryFile','files',
      'componentTree','assetSlots','responsiveStrategy','usageNotes','warnings'
    ],
    properties: {
      version: { type: 'string' },
      summary: { type: 'string' },
      framework: { type: 'string', enum: ['REACT_TYPESCRIPT','NEXTJS','HTML_CSS'] },
      styling: { type: 'string', enum: ['TAILWIND','CSS_MODULES','PLAIN_CSS'] },
      outputType: { type: 'string', enum: ['SECTION','FULL_PAGE'] },
      entryFile: { type: 'string' },
      files: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_FILES,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['path','language','purpose','content'],
          properties: {
            path: { type: 'string' },
            language: { type: 'string' },
            purpose: { type: 'string' },
            content: { type: 'string' }
          }
        }
      },
      componentTree: { type: 'array', maxItems: 50, items: { type: 'string' } },
      assetSlots: {
        type: 'array',
        maxItems: 30,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name','kind','purpose','recommendedAspectRatio','implementation'],
          properties: {
            name: { type: 'string' },
            kind: { type: 'string', enum: ['IMAGE','VIDEO','ICON','LOGO','BACKGROUND','OTHER'] },
            purpose: { type: 'string' },
            recommendedAspectRatio: { type: 'string' },
            implementation: { type: 'string' }
          }
        }
      },
      responsiveStrategy: {
        type: 'object',
        additionalProperties: false,
        required: ['desktop','tablet','mobile','breakpoints'],
        properties: {
          desktop: { type: 'array', maxItems: 16, items: { type: 'string' } },
          tablet: { type: 'array', maxItems: 16, items: { type: 'string' } },
          mobile: { type: 'array', maxItems: 16, items: { type: 'string' } },
          breakpoints: { type: 'array', maxItems: 12, items: { type: 'string' } }
        }
      },
      usageNotes: { type: 'array', maxItems: 20, items: { type: 'string' } },
      warnings: { type: 'array', maxItems: 20, items: { type: 'string' } }
    }
  };
}

function frameworkInstructions(project) {
  if (project.framework === 'HTML_CSS') {
    return [
      'Generate semantic HTML plus CSS and minimal vanilla JavaScript only where interaction is visible or explicitly inferred.',
      'Do not generate React, JSX, TypeScript, npm configuration or build-tool files.'
    ].join(' ');
  }
  if (project.framework === 'NEXTJS') {
    return [
      'Generate Next.js-compatible React TypeScript components.',
      'Use client components only where interaction requires them.',
      'Do not assume external component libraries unless they are explicitly present in the reference.'
    ].join(' ');
  }
  return [
    'Generate React + TypeScript components.',
    'Prefer data-driven reusable components for repeated cards/items.',
    'Do not assume external component libraries unless they are explicitly present in the reference.'
  ].join(' ');
}

function stylingInstructions(project) {
  if (project.styling === 'TAILWIND') {
    return [
      'Use Tailwind utility classes for layout and ordinary styling.',
      'Use a small companion CSS file only when exact gradients, masks, unusual shadows, pseudo-elements or responsive geometry cannot be expressed cleanly with utilities.',
      'Do not invent Tailwind plugins.'
    ].join(' ');
  }
  if (project.styling === 'CSS_MODULES') {
    return 'Use CSS Modules with explicit class names. Keep the module local to the generated component/page.';
  }
  return 'Use maintainable plain CSS with a scoped root class so the generated design does not leak styles into the host application.';
}

function generationInstructions(project) {
  return [
    'You are INXSocial UI Studio Phase 3, a senior frontend reconstruction engineer.',
    'This is pixel-faithful reconstruction, not redesign. The supplied screenshots and Phase 2 analysis are the source of truth.',
    'Do not improve, simplify, modernise, restyle, add sections or change hierarchy.',
    'Generate production-oriented responsive code, not a screenshot background and not a giant absolute-positioned canvas.',
    frameworkInstructions(project),
    stylingInstructions(project),
    project.outputType === 'SECTION'
      ? 'Generate a reusable self-contained section that can be inserted into an existing application.'
      : 'Generate the visible full page structure represented by the references.',
    'Preserve the visible wording from the analysis/reference when legible. Never invent marketing copy for unreadable text.',
    'Repeated visual items must be represented as reusable/data-driven components.',
    'If a visible region is an image or video, implement a semantic media slot/prop rather than embedding the screenshot itself.',
    'For a video-shaped media area, use a real HTML5 video element with playsInline and sensible props; do not convert it to a static image.',
    'Buttons, tabs, carousels or selectors that are visibly interactive should have lightweight functional behaviour when the reference supports that inference.',
    'Use fluid grids/flexbox, clamp(), minmax(), aspect-ratio and explicit breakpoints. Absolute positioning is allowed only for genuine overlays or decorative layers.',
    'Do not include remote tracking, analytics, external scripts, API keys, secrets, iframes or arbitrary network calls.',
    'Do not include package-lock files, node_modules, generated build output or binary assets.',
    'All code must be contained in the returned file list and be internally consistent.',
    'Return only JSON matching the schema.'
  ].join(' ');
}

function safeFilePath(value) {
  const path = String(value || '').trim().replace(/\\/g, '/');
  if (!path || path.startsWith('/') || path.includes('..') || !/^[A-Za-z0-9._/@+-]+(?:\/[A-Za-z0-9._@+-]+)*$/.test(path)) {
    return null;
  }
  return path.slice(0, 220);
}

function normalizeGeneration(result, project) {
  const files = [];
  const seen = new Set();
  let totalChars = 0;

  for (const candidate of Array.isArray(result.files) ? result.files : []) {
    if (files.length >= MAX_FILES) break;
    const filePath = safeFilePath(candidate.path);
    if (!filePath || seen.has(filePath)) continue;
    let content = String(candidate.content || '').replace(/^```[A-Za-z0-9_-]*\s*/i, '').replace(/\s*```$/i, '');
    if (!content.trim()) continue;
    if (content.length > MAX_FILE_CHARS) content = content.slice(0, MAX_FILE_CHARS);
    if (totalChars + content.length > MAX_TOTAL_CHARS) {
      content = content.slice(0, Math.max(0, MAX_TOTAL_CHARS - totalChars));
    }
    if (!content.trim()) break;
    totalChars += content.length;
    seen.add(filePath);
    files.push({
      path: filePath,
      language: String(candidate.language || '').trim().slice(0, 40) || 'text',
      purpose: String(candidate.purpose || '').trim().slice(0, 400),
      content
    });
    if (totalChars >= MAX_TOTAL_CHARS) break;
  }

  if (!files.length) throw error('Code generation did not return any valid files.', 502, 'UI_STUDIO_CODEGEN_FILES_EMPTY');

  let entryFile = safeFilePath(result.entryFile);
  if (!entryFile || !seen.has(entryFile)) entryFile = files[0].path;

  return {
    version: GENERATION_VERSION,
    summary: String(result.summary || '').trim().slice(0, 2000),
    framework: project.framework,
    styling: project.styling,
    outputType: project.outputType,
    entryFile,
    files,
    componentTree: (result.componentTree || []).map(String).slice(0, 50),
    assetSlots: (result.assetSlots || []).slice(0, 30).map(slot => ({
      name: String(slot.name || '').slice(0, 120),
      kind: ['IMAGE','VIDEO','ICON','LOGO','BACKGROUND','OTHER'].includes(slot.kind) ? slot.kind : 'OTHER',
      purpose: String(slot.purpose || '').slice(0, 500),
      recommendedAspectRatio: String(slot.recommendedAspectRatio || '').slice(0, 60),
      implementation: String(slot.implementation || '').slice(0, 1000)
    })),
    responsiveStrategy: result.responsiveStrategy || { desktop: [], tablet: [], mobile: [], breakpoints: [] },
    usageNotes: (result.usageNotes || []).map(String).slice(0, 20),
    warnings: (result.warnings || []).map(String).slice(0, 20)
  };
}

function validateGeneration(result) {
  const checks = [];
  const files = Array.isArray(result?.files) ? result.files : [];
  const paths = files.map(file => file.path);
  checks.push({ key: 'FILES_PRESENT', ok: files.length > 0, message: files.length ? `${files.length} implementation file(s) generated.` : 'No implementation files were generated.' });
  checks.push({ key: 'ENTRY_PRESENT', ok: paths.includes(result?.entryFile), message: paths.includes(result?.entryFile) ? 'Entry file exists in the generated bundle.' : 'Entry file is missing.' });
  checks.push({ key: 'PATHS_UNIQUE', ok: new Set(paths).size === paths.length, message: 'Generated file paths are unique.' });
  checks.push({ key: 'NO_MARKDOWN_FENCES', ok: files.every(file => !/^s*```/.test(file.content)), message: 'Generated files contain raw source rather than Markdown code fences.' });
  checks.push({ key: 'NO_SCREENSHOT_EMBED', ok: files.every(file => !/data:image\/(?:png|jpeg|webp);base64/i.test(file.content)), message: 'Generated code does not embed the reference screenshot.' });
  checks.push({ key: 'NO_REMOTE_SCRIPTS', ok: files.every(file => !/<script[^>]+src=["']https?:/i.test(file.content)), message: 'Generated code does not inject remote scripts.' });

  const combined = files.map(file => file.content).join('\n');
  const responsiveSignal = /@media|clamp\(|minmax\(|grid-template|flex-wrap|sm:|md:|lg:|xl:/i.test(combined);
  checks.push({ key: 'RESPONSIVE_SIGNAL', ok: responsiveSignal, message: responsiveSignal ? 'Responsive layout primitives were detected.' : 'No clear responsive layout primitive was detected.' });

  const passed = checks.filter(check => check.ok).length;
  return {
    passed,
    total: checks.length,
    ok: checks.every(check => check.ok),
    checks,
    totalChars: files.reduce((sum, file) => sum + file.content.length, 0)
  };
}

async function buildVisualContent(references) {
  const content = [];
  let imageCount = 0;
  for (const reference of references) {
    const buffer = await objectStorage.getBuffer(reference.storageKey, null, reference.storageProvider);
    const images = await uiStudioAnalysis.prepareReferenceImages(reference, buffer, 2);
    for (const image of images) {
      if (imageCount >= 9) break;
      content.push({
        type: 'input_text',
        text: `${image.label}. Crop in original pixels: x=${image.crop.x}, y=${image.crop.y}, width=${image.crop.width}, height=${image.crop.height}.`
      });
      content.push({ type: 'input_image', image_url: image.imageUrl, detail: 'high' });
      imageCount += 1;
    }
  }
  return { content, imageCount };
}

async function requestGeneration(project, analysis, references) {
  if (!ready()) throw error('UI Studio code generation model is not configured.', 503, 'UI_STUDIO_CODEGEN_NOT_CONFIGURED');
  const analysisResult = safeParse(analysis.analysisJson, null);
  if (!analysisResult) throw error('The selected design analysis has no structured result.', 422, 'UI_STUDIO_CODEGEN_ANALYSIS_EMPTY');

  const visual = await buildVisualContent(references);
  const content = [
    {
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
        'PHASE 2 STRUCTURED ANALYSIS',
        JSON.stringify(analysisResult),
        '',
        'REFERENCE METADATA',
        JSON.stringify(references.map(uiStudioAnalysis.sourceReferenceDescriptor)),
        '',
        'Generate the implementation from the analysis and visual references below.'
      ].join('\n')
    },
    ...visual.content
  ];

  const base = {
    model: env.uiStudioCodegen.model,
    instructions: generationInstructions(project),
    input: [{ role: 'user', content }],
    text: {
      format: {
        type: 'json_schema',
        name: 'inx_ui_responsive_code',
        strict: true,
        schema: generationSchema()
      }
    }
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const payload = {
      ...base,
      max_output_tokens: attempt === 1 ? 22000 : 28000
    };
    if (/^gpt-5(?:\.|-)/i.test(String(payload.model || ''))) {
      payload.reasoning = { effort: attempt === 1 ? (env.uiStudioCodegen.reasoningEffort || 'high') : 'medium' };
    }
    if (attempt > 1) {
      payload.instructions += ' Retry: return a complete but compact implementation. Prefer fewer complete files over many partial files.';
    }

    let response;
    try {
      response = await axios.post(env.uiStudioCodegen.baseUrl + '/responses', payload, {
        timeout: env.uiStudioCodegen.timeoutMs,
        maxBodyLength: 45 * 1024 * 1024,
        maxContentLength: 45 * 1024 * 1024,
        headers: {
          Authorization: 'Bearer ' + env.uiStudioCodegen.apiKey,
          'Content-Type': 'application/json'
        }
      });
    } catch (caught) {
      const status = Number(caught?.response?.status || 0);
      if (status >= 400 && status < 500) {
        console.error('[ui-studio] codegen provider rejected request', {
          status,
          detail: String(caught?.response?.data?.error?.message || caught.message || '').slice(0, 500)
        });
        throw error('The responsive-code model rejected the generation request.', 502, 'UI_STUDIO_CODEGEN_PROVIDER_REJECTED');
      }
      if (attempt === 2) throw error('The responsive-code model did not respond in time.', 504, 'UI_STUDIO_CODEGEN_TIMEOUT');
      continue;
    }

    const parsed = parseJsonObject(webResearch.extractResponseText(response.data));
    if (parsed && typeof parsed === 'object') {
      const result = normalizeGeneration(parsed, project);
      return {
        result,
        validation: validateGeneration(result),
        model: env.uiStudioCodegen.model,
        imageCount: visual.imageCount
      };
    }

    console.warn('[ui-studio] structured code generation parse failed', {
      attempt,
      status: response.data?.status || null,
      incompleteReason: response.data?.incomplete_details?.reason || null
    });
  }

  throw error('The responsive-code model returned an incomplete structured result.', 502, 'UI_STUDIO_CODEGEN_PARSE_ERROR');
}

function serializeGeneration(row, { full = false, currentFingerprint = null, currentAnalysisId = null } = {}) {
  if (!row) return null;
  const result = safeParse(row.generationJson, null);
  const validation = safeParse(row.validationJson, null);
  const base = {
    id: row.id,
    projectId: row.projectId,
    sourceAnalysisId: row.sourceAnalysisId,
    status: row.status,
    version: row.version || GENERATION_VERSION,
    model: row.model || null,
    framework: row.framework,
    styling: row.styling,
    outputType: row.outputType,
    sourceFingerprint: row.sourceFingerprint,
    summary: result?.summary || null,
    entryFile: result?.entryFile || null,
    fileCount: Array.isArray(result?.files) ? result.files.length : 0,
    validation,
    errorMessage: row.errorMessage || null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    stale: Boolean(
      (currentFingerprint && row.sourceFingerprint !== currentFingerprint)
      || (currentAnalysisId && row.sourceAnalysisId !== currentAnalysisId)
    )
  };
  if (full) base.result = result;
  return base;
}

async function generateProject(projectId, createdByUserId = null) {
  const id = String(projectId || '').trim();
  const project = await prisma.uiDesignProject.findUnique({
    where: { id },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 100 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 20 }
    }
  });
  if (!project) throw error('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');

  const references = uiStudioAnalysis.latestReferences(project.references);
  if (!references.length) throw error('Upload at least one UI reference before generating code.', 422, 'UI_STUDIO_CODEGEN_REFERENCE_REQUIRED');

  const fingerprint = uiStudioAnalysis.fingerprintReferences(references);
  const analysis = project.analyses.find(item => item.status === 'COMPLETED' && item.sourceFingerprint === fingerprint && item.analysisJson);
  if (!analysis) {
    throw error('Run Phase 2 analysis on the latest references before generating code.', 422, 'UI_STUDIO_CODEGEN_CURRENT_ANALYSIS_REQUIRED');
  }
  if (!ready()) throw error('UI Studio code generation is not configured.', 503, 'UI_STUDIO_CODEGEN_NOT_CONFIGURED');

  const row = await prisma.uiDesignGeneration.create({
    data: {
      projectId: id,
      sourceAnalysisId: analysis.id,
      status: 'RUNNING',
      version: GENERATION_VERSION,
      model: env.uiStudioCodegen.model,
      framework: project.framework,
      styling: project.styling,
      outputType: project.outputType,
      sourceFingerprint: fingerprint,
      createdByUserId: createdByUserId ? String(createdByUserId) : null
    }
  });
  await prisma.uiDesignProject.update({ where: { id }, data: { status: 'GENERATING_CODE' } });

  try {
    const generated = await requestGeneration(project, analysis, references);
    const status = generated.validation.ok ? 'READY' : 'READY_WITH_WARNINGS';
    const completed = await prisma.uiDesignGeneration.update({
      where: { id: row.id },
      data: {
        status,
        generationJson: JSON.stringify(generated.result),
        validationJson: JSON.stringify(generated.validation),
        completedAt: new Date(),
        errorMessage: null
      }
    });
    await prisma.uiDesignProject.update({ where: { id }, data: { status: status === 'READY' ? 'CODE_READY' : 'CODE_READY_WITH_WARNINGS' } });
    return {
      generation: serializeGeneration(completed, { full: true, currentFingerprint: fingerprint }),
      imageCount: generated.imageCount
    };
  } catch (caught) {
    const message = String(caught.publicMessage || caught.message || 'Responsive code generation failed.').slice(0, 1000);
    await prisma.uiDesignGeneration.update({
      where: { id: row.id },
      data: { status: 'FAILED', errorMessage: message, completedAt: new Date() }
    }).catch(() => {});
    await prisma.uiDesignProject.update({ where: { id }, data: { status: 'CODEGEN_FAILED' } }).catch(() => {});
    throw caught;
  }
}

async function generationDetail(generationId) {
  const row = await prisma.uiDesignGeneration.findUnique({
    where: { id: String(generationId || '').trim() },
    include: {
      project: {
        include: {
          references: { orderBy: { createdAt: 'desc' }, take: 100 },
          analyses: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      }
    }
  });
  if (!row) throw error('UI Studio generation was not found.', 404, 'UI_STUDIO_GENERATION_NOT_FOUND');
  const fingerprint = uiStudioAnalysis.fingerprintReferences(row.project.references || []);
  const currentAnalysisId = row.project.analyses?.[0]?.id || null;
  return serializeGeneration(row, { full: true, currentFingerprint: fingerprint, currentAnalysisId });
}

module.exports = {
  GENERATION_VERSION,
  MAX_FILES,
  MAX_FILE_CHARS,
  MAX_TOTAL_CHARS,
  ready,
  generationSchema,
  normalizeGeneration,
  validateGeneration,
  serializeGeneration,
  generateProject,
  generationDetail
};
