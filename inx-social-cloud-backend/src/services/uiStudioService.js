'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const objectStorage = require('./mediaObjectStorageService');
const uiStudioAnalysis = require('./uiStudioAnalysisService');
const uiStudioCodegen = require('./uiStudioCodegenService');

const STORAGE_PREFIX = 'ui-studio';
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const VIEWPORTS = new Set(['DESKTOP', 'TABLET', 'MOBILE']);
const FRAMEWORKS = new Set(['REACT_TYPESCRIPT', 'NEXTJS', 'HTML_CSS']);
const STYLING = new Set(['TAILWIND', 'CSS_MODULES', 'PLAIN_CSS']);
const OUTPUT_TYPES = new Set(['SECTION', 'FULL_PAGE']);
const SUPPORTED_FORMATS = new Map([
  ['png', { mimeType: 'image/png', extension: 'png' }],
  ['jpeg', { mimeType: 'image/jpeg', extension: 'jpg' }],
  ['webp', { mimeType: 'image/webp', extension: 'webp' }],
  ['avif', { mimeType: 'image/avif', extension: 'avif' }]
]);

function publicError(message, status = 400, code = 'UI_STUDIO_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function choice(value, allowed, fallback) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return fallback;
  if (!allowed.has(normalized)) throw publicError('Unsupported UI Studio option.');
  return normalized;
}

function normalizeViewport(value) {
  return choice(value, VIEWPORTS, 'DESKTOP');
}

function contentUrl(referenceId) {
  return `/api/admin/ui-studio/references/${encodeURIComponent(referenceId)}/content`;
}

function serializeReference(reference) {
  if (!reference) return null;
  return {
    id: reference.id,
    projectId: reference.projectId,
    viewport: reference.viewport,
    originalName: reference.originalName,
    mimeType: reference.mimeType,
    byteSize: Number(reference.byteSize || 0),
    width: reference.width,
    height: reference.height,
    sha256: reference.sha256,
    storageProvider: reference.storageProvider,
    uploadedByUserId: reference.uploadedByUserId || null,
    createdAt: reference.createdAt,
    contentUrl: contentUrl(reference.id)
  };
}

function serializeProject(project, { fullAnalysis = false, fullGeneration = false } = {}) {
  const references = (project.references || []).map(serializeReference);
  const latestReferences = {};
  for (const reference of references) {
    if (!latestReferences[reference.viewport]) latestReferences[reference.viewport] = reference;
  }
  const currentFingerprint = uiStudioAnalysis.fingerprintReferences(project.references || []);
  const latestAnalysisRow = (project.analyses || [])[0] || null;
  const latestGenerationRow = (project.generations || [])[0] || null;
  return {
    id: project.id,
    name: project.name,
    framework: project.framework,
    styling: project.styling,
    outputType: project.outputType,
    status: project.status,
    createdByUserId: project.createdByUserId || null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    referenceCount: Number(project._count?.references ?? references.length),
    analysisCount: Number(project._count?.analyses ?? (project.analyses || []).length),
    generationCount: Number(project._count?.generations ?? (project.generations || []).length),
    latestReferences,
    latestAnalysis: uiStudioAnalysis.serializeAnalysis(latestAnalysisRow, {
      full: fullAnalysis,
      currentFingerprint
    }),
    latestGeneration: uiStudioCodegen.serializeGeneration(latestGenerationRow, {
      full: fullGeneration,
      currentFingerprint
    })
  };
}

async function inspectUpload(data) {
  if (!Buffer.isBuffer(data) || !data.length) {
    throw publicError('Choose a PNG, JPEG, WebP or AVIF image to upload.', 400, 'UI_STUDIO_EMPTY_UPLOAD');
  }
  if (data.length > MAX_UPLOAD_BYTES) {
    throw publicError('UI reference images must be 50 MB or smaller.', 413, 'UI_STUDIO_TOO_LARGE');
  }

  let metadata;
  try {
    metadata = await sharp(data, { limitInputPixels: 200000000 }).metadata();
  } catch (_) {
    throw publicError('The uploaded file is not a valid supported image.', 415, 'UI_STUDIO_INVALID_IMAGE');
  }

  const format = SUPPORTED_FORMATS.get(String(metadata.format || '').toLowerCase());
  if (!format || !metadata.width || !metadata.height) {
    throw publicError('Upload a PNG, JPEG, WebP or AVIF image.', 415, 'UI_STUDIO_UNSUPPORTED_IMAGE');
  }

  return {
    mimeType: format.mimeType,
    extension: format.extension,
    width: Number(metadata.width),
    height: Number(metadata.height),
    byteSize: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex')
  };
}

function storageFileName(originalName, extension) {
  const raw = path.basename(String(originalName || 'ui-reference')).replace(/[^A-Za-z0-9._ -]+/g, '-').slice(0, 140);
  const withoutExt = raw.replace(/\.[A-Za-z0-9]{1,8}$/, '').trim() || 'ui-reference';
  return `${withoutExt}.${extension}`;
}

async function listProjects() {
  const projects = await prisma.uiDesignProject.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 12 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
      generations: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { references: true, analyses: true, generations: true } }
    }
  });
  return projects.map(serializeProject);
}

async function createProject(input = {}) {
  const name = String(input.name || '').trim();
  if (name.length < 2 || name.length > 120) {
    throw publicError('Project name must be between 2 and 120 characters.', 400, 'UI_STUDIO_INVALID_NAME');
  }

  const project = await prisma.uiDesignProject.create({
    data: {
      name,
      framework: choice(input.framework, FRAMEWORKS, 'REACT_TYPESCRIPT'),
      styling: choice(input.styling, STYLING, 'TAILWIND'),
      outputType: choice(input.outputType, OUTPUT_TYPES, 'SECTION'),
      createdByUserId: input.createdByUserId ? String(input.createdByUserId) : null
    },
    include: {
      references: true,
      analyses: true,
      generations: true,
      _count: { select: { references: true, analyses: true, generations: true } }
    }
  });
  return serializeProject(project);
}

async function projectDetail(projectId) {
  const id = String(projectId || '').trim();
  const project = await prisma.uiDesignProject.findUnique({
    where: { id },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 100 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 12 },
      generations: { orderBy: { createdAt: 'desc' }, take: 12 },
      _count: { select: { references: true, analyses: true, generations: true } }
    }
  });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');
  const currentFingerprint = uiStudioAnalysis.fingerprintReferences(project.references || []);
  return {
    ...serializeProject(project, { fullAnalysis: true, fullGeneration: false }),
    references: project.references.map(serializeReference),
    analyses: (project.analyses || []).map((analysis, index) => uiStudioAnalysis.serializeAnalysis(analysis, {
      full: index === 0,
      currentFingerprint
    })),
    generations: (project.generations || []).map(generation => uiStudioCodegen.serializeGeneration(generation, {
      full: false,
      currentFingerprint
    }))
  };
}

async function uploadReference(projectId, viewportValue, input = {}) {
  const project = await prisma.uiDesignProject.findUnique({ where: { id: String(projectId || '').trim() } });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');

  const viewport = normalizeViewport(viewportValue);
  const data = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data || '');
  const metadata = await inspectUpload(data);
  const storageStatus = objectStorage.providerStatus();
  if (!storageStatus.cloudflareR2Configured) {
    throw publicError('Cloudflare R2 must be configured before UI Studio references can be uploaded.', 503, 'UI_STUDIO_R2_REQUIRED');
  }

  const originalName = path.basename(String(input.originalName || `ui-reference.${metadata.extension}`)).slice(0, 180);
  const stored = await objectStorage.persistBuffer({
    userId: project.id,
    data,
    mimeType: metadata.mimeType,
    originalName: storageFileName(originalName, metadata.extension),
    prefix: STORAGE_PREFIX
  });

  if (stored.storageProvider !== objectStorage.PROVIDERS.CLOUDFLARE_R2 || !stored.storageKey) {
    if (stored.storageKey) await objectStorage.deleteObject(stored.storageKey, stored.storageProvider).catch(() => {});
    throw publicError('UI Studio reference could not be stored in Cloudflare R2.', 503, 'UI_STUDIO_R2_REQUIRED');
  }

  try {
    const reference = await prisma.uiDesignReference.create({
      data: {
        projectId: project.id,
        viewport,
        storageProvider: stored.storageProvider,
        storageKey: stored.storageKey,
        originalName,
        mimeType: metadata.mimeType,
        byteSize: BigInt(metadata.byteSize),
        width: metadata.width,
        height: metadata.height,
        sha256: metadata.sha256,
        uploadedByUserId: input.uploadedByUserId ? String(input.uploadedByUserId) : null
      }
    });
    await prisma.uiDesignProject.update({
      where: { id: project.id },
      data: { status: 'ACTIVE' }
    });
    return serializeReference(reference);
  } catch (error) {
    await objectStorage.deleteObject(stored.storageKey, stored.storageProvider).catch(() => {});
    throw error;
  }
}

async function referenceContent(referenceId) {
  const reference = await prisma.uiDesignReference.findUnique({
    where: { id: String(referenceId || '').trim() }
  });
  if (!reference) throw publicError('UI Studio reference was not found.', 404, 'UI_STUDIO_REFERENCE_NOT_FOUND');
  const data = await objectStorage.getBuffer(reference.storageKey, null, reference.storageProvider);
  return {
    data,
    mimeType: reference.mimeType,
    byteSize: Number(reference.byteSize || data.length),
    etag: `"${reference.sha256}"`,
    originalName: reference.originalName,
    createdAt: reference.createdAt
  };
}

module.exports = {
  STORAGE_PREFIX,
  MAX_UPLOAD_BYTES,
  VIEWPORTS,
  inspectUpload,
  normalizeViewport,
  contentUrl,
  listProjects,
  createProject,
  projectDetail,
  uploadReference,
  referenceContent
};
