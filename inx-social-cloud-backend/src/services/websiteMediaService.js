'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const objectStorage = require('./mediaObjectStorageService');

const STORAGE_PREFIX = 'website-media';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const SUPPORTED_FORMATS = new Map([
  ['png', { mimeType: 'image/png', extension: 'png' }],
  ['jpeg', { mimeType: 'image/jpeg', extension: 'jpg' }],
  ['webp', { mimeType: 'image/webp', extension: 'webp' }],
  ['avif', { mimeType: 'image/avif', extension: 'avif' }]
]);

const SLOT_DEFINITIONS = Object.freeze([
  {
    key: 'landing.hero.dashboard',
    label: 'Hero Dashboard',
    section: 'Landing Page',
    altText: 'INXSocial dashboard preview',
    recommendedMinWidth: 2200,
    recommendedMinHeight: 1200,
    usedOn: ['Homepage hero']
  },
  {
    key: 'landing.dashboard.showcase',
    label: 'Dashboard Showcase',
    section: 'Landing Page',
    altText: 'INXSocial dashboard product preview',
    recommendedMinWidth: 1800,
    recommendedMinHeight: 1000,
    usedOn: ['Homepage dashboard showcase']
  },
  {
    key: 'landing.ai-studio.preview',
    label: 'AI Content Studio Preview',
    section: 'Landing Page',
    altText: 'INXSocial AI Content Studio preview',
    recommendedMinWidth: 1800,
    recommendedMinHeight: 1000,
    usedOn: ['Homepage AI Content Studio section']
  },
  {
    key: 'landing.social.preview',
    label: 'Social Share Preview',
    section: 'Landing Page',
    altText: 'INXSocial social media management and AI content platform',
    recommendedMinWidth: 1200,
    recommendedMinHeight: 630,
    usedOn: ['Open Graph preview', 'X / Twitter card']
  },
  {
    key: 'seo.default.dashboard',
    label: 'Default SEO Dashboard Hero',
    section: 'SEO Media',
    altText: 'INXSocial social media management dashboard',
    recommendedMinWidth: 1800,
    recommendedMinHeight: 1000,
    usedOn: ['Scheduler SEO pages', 'Analytics SEO pages', 'Pricing SEO page']
  },
  {
    key: 'seo.default.ai-studio',
    label: 'Default SEO AI Studio Hero',
    section: 'SEO Media',
    altText: 'INXSocial AI Content Studio',
    recommendedMinWidth: 1800,
    recommendedMinHeight: 1000,
    usedOn: ['AI tools SEO pages']
  },
  {
    key: 'seo.ai-video.hero',
    label: 'AI Video SEO Hero',
    section: 'SEO Media',
    altText: 'INXSocial AI Video Studio',
    recommendedMinWidth: 1800,
    recommendedMinHeight: 1000,
    usedOn: ['AI Video Generator SEO page']
  }
]);

function publicError(message, status = 400, code = 'WEBSITE_MEDIA_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function definitionFor(key) {
  const normalized = String(key || '').trim();
  const definition = SLOT_DEFINITIONS.find(item => item.key === normalized);
  if (!definition) throw publicError('Unknown website media slot.', 404, 'WEBSITE_MEDIA_SLOT_NOT_FOUND');
  return definition;
}

function publicUrl(key, versionId = '') {
  const suffix = versionId ? `?v=${encodeURIComponent(versionId)}` : '';
  return `/api/website-media/${encodeURIComponent(key)}/content${suffix}`;
}

function serializeVersion(version, key = '') {
  if (!version) return null;
  return {
    id: version.id,
    originalName: version.originalName,
    mimeType: version.mimeType,
    byteSize: Number(version.byteSize || 0),
    width: version.width,
    height: version.height,
    sha256: version.sha256,
    storageProvider: version.storageProvider,
    createdAt: version.createdAt,
    uploadedByUserId: version.uploadedByUserId || null,
    contentUrl: key ? publicUrl(key, version.id) : null
  };
}

function serializeAsset(asset, definition, options = {}) {
  const current = serializeVersion(asset.currentVersion, asset.key);
  return {
    id: asset.id,
    key: asset.key,
    label: asset.label,
    section: asset.section,
    altText: asset.altText || '',
    recommendedMinWidth: asset.recommendedMinWidth,
    recommendedMinHeight: asset.recommendedMinHeight,
    usedOn: definition?.usedOn || [],
    hasImage: Boolean(current),
    currentVersion: current,
    versionCount: Number(asset._count?.versions || options.versionCount || 0),
    publicUrl: current ? publicUrl(asset.key, current.id) : null,
    updatedAt: asset.updatedAt
  };
}

async function ensureSlots() {
  await prisma.$transaction(SLOT_DEFINITIONS.map(definition => prisma.websiteMediaAsset.upsert({
    where: { key: definition.key },
    create: {
      key: definition.key,
      label: definition.label,
      section: definition.section,
      altText: definition.altText,
      recommendedMinWidth: definition.recommendedMinWidth,
      recommendedMinHeight: definition.recommendedMinHeight
    },
    update: {
      label: definition.label,
      section: definition.section,
      recommendedMinWidth: definition.recommendedMinWidth,
      recommendedMinHeight: definition.recommendedMinHeight
    }
  })));
}

async function ensureSlot(key) {
  const definition = definitionFor(key);
  return prisma.websiteMediaAsset.upsert({
    where: { key: definition.key },
    create: {
      key: definition.key,
      label: definition.label,
      section: definition.section,
      altText: definition.altText,
      recommendedMinWidth: definition.recommendedMinWidth,
      recommendedMinHeight: definition.recommendedMinHeight
    },
    update: {
      label: definition.label,
      section: definition.section,
      recommendedMinWidth: definition.recommendedMinWidth,
      recommendedMinHeight: definition.recommendedMinHeight
    }
  });
}

async function inspectUpload(data) {
  if (!Buffer.isBuffer(data) || !data.length) {
    throw publicError('Choose a PNG, JPEG, WebP or AVIF image to upload.', 400, 'WEBSITE_MEDIA_EMPTY_UPLOAD');
  }
  if (data.length > MAX_UPLOAD_BYTES) {
    throw publicError('Website images must be 25 MB or smaller.', 413, 'WEBSITE_MEDIA_TOO_LARGE');
  }

  let metadata;
  try {
    metadata = await sharp(data, { limitInputPixels: 120000000 }).metadata();
  } catch (_) {
    throw publicError('The uploaded file is not a valid supported image.', 415, 'WEBSITE_MEDIA_INVALID_IMAGE');
  }

  const format = SUPPORTED_FORMATS.get(String(metadata.format || '').toLowerCase());
  if (!format || !metadata.width || !metadata.height) {
    throw publicError('Upload a PNG, JPEG, WebP or AVIF image.', 415, 'WEBSITE_MEDIA_UNSUPPORTED_IMAGE');
  }

  return {
    format: String(metadata.format).toLowerCase(),
    mimeType: format.mimeType,
    extension: format.extension,
    width: Number(metadata.width),
    height: Number(metadata.height),
    byteSize: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex')
  };
}

function storageFileName(originalName, extension) {
  const raw = path.basename(String(originalName || 'website-image')).replace(/[^A-Za-z0-9._ -]+/g, '-').slice(0, 120);
  const withoutExt = raw.replace(/.[A-Za-z0-9]{1,8}$/, '').trim() || 'website-image';
  return `${withoutExt}.${extension}`;
}

function qualityWarnings(definition, metadata) {
  const warnings = [];
  if (definition.recommendedMinWidth && metadata.width < definition.recommendedMinWidth) {
    warnings.push(`Image width is ${metadata.width}px; ${definition.recommendedMinWidth}px or wider is recommended for this placement.`);
  }
  if (definition.recommendedMinHeight && metadata.height < definition.recommendedMinHeight) {
    warnings.push(`Image height is ${metadata.height}px; ${definition.recommendedMinHeight}px or taller is recommended for this placement.`);
  }
  return warnings;
}

async function list() {
  await ensureSlots();
  const assets = await prisma.websiteMediaAsset.findMany({
    where: { key: { in: SLOT_DEFINITIONS.map(item => item.key) } },
    include: { currentVersion: true, _count: { select: { versions: true } } },
    orderBy: [{ section: 'asc' }, { label: 'asc' }]
  });
  const byKey = new Map(assets.map(asset => [asset.key, asset]));
  return SLOT_DEFINITIONS.map(definition => serializeAsset(byKey.get(definition.key), definition));
}

async function detail(key) {
  const definition = definitionFor(key);
  await ensureSlot(key);
  const asset = await prisma.websiteMediaAsset.findUnique({
    where: { key: definition.key },
    include: {
      currentVersion: true,
      versions: { orderBy: { createdAt: 'desc' }, take: 20 },
      _count: { select: { versions: true } }
    }
  });
  return {
    ...serializeAsset(asset, definition),
    versions: asset.versions.map(version => serializeVersion(version, asset.key))
  };
}

async function upload(key, input = {}) {
  const definition = definitionFor(key);
  const asset = await ensureSlot(key);
  const data = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data || '');
  const metadata = await inspectUpload(data);

  const storageStatus = objectStorage.providerStatus();
  if (!storageStatus.cloudflareR2Configured) {
    throw publicError('Cloudflare R2 must be configured before website media can be uploaded.', 503, 'WEBSITE_MEDIA_R2_REQUIRED');
  }

  const originalName = path.basename(String(input.originalName || `website-image.${metadata.extension}`)).slice(0, 180);
  const stored = await objectStorage.persistBuffer({
    userId: String(input.userId || 'admin'),
    data,
    mimeType: metadata.mimeType,
    originalName: storageFileName(originalName, metadata.extension),
    prefix: STORAGE_PREFIX
  });

  if (stored.storageProvider !== objectStorage.PROVIDERS.CLOUDFLARE_R2 || !stored.storageKey) {
    if (stored.storageKey) await objectStorage.deleteObject(stored.storageKey, stored.storageProvider).catch(() => {});
    throw publicError('Website media could not be stored in Cloudflare R2.', 503, 'WEBSITE_MEDIA_R2_REQUIRED');
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const version = await tx.websiteMediaVersion.create({
        data: {
          assetId: asset.id,
          storageProvider: stored.storageProvider,
          storageKey: stored.storageKey,
          originalName,
          mimeType: metadata.mimeType,
          byteSize: BigInt(metadata.byteSize),
          width: metadata.width,
          height: metadata.height,
          sha256: metadata.sha256,
          uploadedByUserId: input.userId ? String(input.userId) : null
        }
      });

      const updated = await tx.websiteMediaAsset.update({
        where: { id: asset.id },
        data: {
          currentVersionId: version.id,
          ...(input.altText !== undefined ? { altText: String(input.altText || '').trim().slice(0, 500) } : {})
        },
        include: { currentVersion: true, _count: { select: { versions: true } } }
      });

      return { updated, version };
    });

    return {
      asset: serializeAsset(result.updated, definition),
      version: serializeVersion(result.version, definition.key),
      warnings: qualityWarnings(definition, metadata),
      originalPreserved: true
    };
  } catch (error) {
    await objectStorage.deleteObject(stored.storageKey, stored.storageProvider).catch(() => {});
    throw error;
  }
}

async function updateMetadata(key, input = {}) {
  const definition = definitionFor(key);
  await ensureSlot(key);
  const asset = await prisma.websiteMediaAsset.update({
    where: { key: definition.key },
    data: {
      ...(input.altText !== undefined ? { altText: String(input.altText || '').trim().slice(0, 500) } : {})
    },
    include: { currentVersion: true, _count: { select: { versions: true } } }
  });
  return serializeAsset(asset, definition);
}

async function restore(key, versionId) {
  const definition = definitionFor(key);
  const asset = await ensureSlot(key);
  const version = await prisma.websiteMediaVersion.findFirst({
    where: { id: String(versionId || ''), assetId: asset.id }
  });
  if (!version) throw publicError('That website image version does not belong to this slot.', 404, 'WEBSITE_MEDIA_VERSION_NOT_FOUND');

  const updated = await prisma.websiteMediaAsset.update({
    where: { id: asset.id },
    data: { currentVersionId: version.id },
    include: { currentVersion: true, _count: { select: { versions: true } } }
  });
  return serializeAsset(updated, definition);
}

async function publicMetadata(key) {
  const definition = definitionFor(key);
  const asset = await prisma.websiteMediaAsset.findUnique({
    where: { key: definition.key },
    include: { currentVersion: true }
  });
  if (!asset?.currentVersion) throw publicError('Website image is not configured yet.', 404, 'WEBSITE_MEDIA_NOT_CONFIGURED');
  return {
    key: asset.key,
    altText: asset.altText || definition.altText || '',
    width: asset.currentVersion.width,
    height: asset.currentVersion.height,
    mimeType: asset.currentVersion.mimeType,
    byteSize: Number(asset.currentVersion.byteSize || 0),
    versionId: asset.currentVersion.id,
    updatedAt: asset.updatedAt,
    contentUrl: publicUrl(asset.key, asset.currentVersion.id)
  };
}

async function content(key) {
  const definition = definitionFor(key);
  const asset = await prisma.websiteMediaAsset.findUnique({
    where: { key: definition.key },
    include: { currentVersion: true }
  });
  const version = asset?.currentVersion;
  if (!version) throw publicError('Website image is not configured yet.', 404, 'WEBSITE_MEDIA_NOT_CONFIGURED');
  const data = await objectStorage.getBuffer(version.storageKey, null, version.storageProvider);
  return {
    data,
    mimeType: version.mimeType,
    byteSize: Number(version.byteSize || data.length),
    etag: `"${version.sha256}"`,
    versionId: version.id,
    updatedAt: asset.updatedAt
  };
}

module.exports = {
  STORAGE_PREFIX,
  MAX_UPLOAD_BYTES,
  SLOT_DEFINITIONS,
  definitionFor,
  inspectUpload,
  qualityWarnings,
  publicUrl,
  ensureSlots,
  list,
  detail,
  upload,
  updateMetadata,
  restore,
  publicMetadata,
  content
};
