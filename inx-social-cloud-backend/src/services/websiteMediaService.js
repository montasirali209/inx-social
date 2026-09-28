'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const objectStorage = require('./mediaObjectStorageService');

const STORAGE_PREFIX = 'website-media';
const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 120 * 1024 * 1024;
const MAX_UPLOAD_BYTES = MAX_VIDEO_UPLOAD_BYTES;
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
    recommendedMinWidth: 2400,
    recommendedMinHeight: 1350,
    fallbackUrl: '/assets/landing-dashboard-20260919.webp',
    usedOn: ['Homepage hero']
  },
  {
    key: 'landing.dashboard.showcase',
    label: 'Dashboard Showcase',
    section: 'Landing Page',
    altText: 'INXSocial dashboard product preview',
    recommendedMinWidth: 1920,
    recommendedMinHeight: 1080,
    fallbackUrl: '/assets/landing-dashboard-20260919.webp',
    usedOn: ['Homepage dashboard showcase']
  },
  {
    key: 'landing.social.preview',
    label: 'Social Share Preview',
    section: 'Landing Page',
    altText: 'INXSocial social media management and AI content platform',
    recommendedMinWidth: 1200,
    recommendedMinHeight: 630,
    fallbackUrl: '/assets/inxsocial-social-preview-v3.jpg',
    usedOn: ['Homepage Open Graph preview', 'Homepage X / Twitter card']
  },
  {
    key: 'landing.ugc-studio.maya.video',
    label: 'UGC Studio · Maya Main Video',
    section: 'Landing Page',
    mediaType: 'VIDEO',
    altText: 'Maya creator video in the homepage UGC Ad Studio showcase',
    recommendedMinWidth: 720,
    recommendedMinHeight: 1280,
    usedOn: ['Homepage UGC Ad Studio · centre phone']
  },
  {
    key: 'landing.ugc-studio.chloe.video',
    label: 'UGC Studio · Chloe Video',
    section: 'Landing Page',
    mediaType: 'VIDEO',
    altText: 'Chloe creator video in the homepage UGC Ad Studio showcase',
    recommendedMinWidth: 720,
    recommendedMinHeight: 1280,
    usedOn: ['Homepage UGC Ad Studio · creator card']
  },
  {
    key: 'landing.ugc-studio.sofia.video',
    label: 'UGC Studio · Sofia Video',
    section: 'Landing Page',
    mediaType: 'VIDEO',
    altText: 'Sofia creator video in the homepage UGC Ad Studio showcase',
    recommendedMinWidth: 720,
    recommendedMinHeight: 1280,
    usedOn: ['Homepage UGC Ad Studio · creator card']
  },
  {
    key: 'landing.ugc-studio.emma.video',
    label: 'UGC Studio · Emma Video',
    section: 'Landing Page',
    mediaType: 'VIDEO',
    altText: 'Emma creator video in the homepage UGC Ad Studio showcase',
    recommendedMinWidth: 720,
    recommendedMinHeight: 1280,
    usedOn: ['Homepage UGC Ad Studio · creator card']
  },
  {
    key: 'landing.ugc-studio.lily.video',
    label: 'UGC Studio · Lily Video',
    section: 'Landing Page',
    mediaType: 'VIDEO',
    altText: 'Lily creator video in the homepage UGC Ad Studio showcase',
    recommendedMinWidth: 720,
    recommendedMinHeight: 1280,
    usedOn: ['Homepage UGC Ad Studio · creator card']
  },
  {
    key: 'seo.default.dashboard',
    label: 'Default SEO Dashboard Hero',
    section: 'SEO Media',
    altText: 'INXSocial social media management dashboard',
    recommendedMinWidth: 1920,
    recommendedMinHeight: 1080,
    fallbackUrl: '/assets/landing-dashboard-20260919.webp',
    usedOn: ['Default for scheduler, calendar, analytics and pricing SEO pages']
  },
  {
    key: 'seo.default.ai-studio',
    label: 'Default SEO AI Studio Hero',
    section: 'SEO Media',
    altText: 'INXSocial AI Content Studio',
    recommendedMinWidth: 1400,
    recommendedMinHeight: 986,
    fallbackUrl: '/assets/ai-content-studio-seo.webp',
    usedOn: ['Default for AI tools SEO pages']
  },
  {
    key: 'seo.social-media-scheduler.hero',
    label: 'Social Media Scheduler SEO Hero',
    section: 'SEO Page Overrides',
    altText: 'INXSocial social media scheduler dashboard',
    recommendedMinWidth: 1920,
    recommendedMinHeight: 1080,
    fallbackKey: 'seo.default.dashboard',
    usedOn: ['/social-media-scheduler']
  },
  {
    key: 'seo.bulk-social-media-scheduler.hero',
    label: 'Bulk Scheduler SEO Hero',
    section: 'SEO Page Overrides',
    altText: 'INXSocial bulk social media scheduler',
    recommendedMinWidth: 1920,
    recommendedMinHeight: 1080,
    fallbackKey: 'seo.default.dashboard',
    usedOn: ['/bulk-social-media-scheduler']
  },
  {
    key: 'seo.social-media-content-calendar.hero',
    label: 'Content Calendar SEO Hero',
    section: 'SEO Page Overrides',
    altText: 'INXSocial social media content calendar',
    recommendedMinWidth: 1920,
    recommendedMinHeight: 1080,
    fallbackKey: 'seo.default.dashboard',
    usedOn: ['/social-media-content-calendar']
  },
  {
    key: 'seo.social-media-analytics.hero',
    label: 'Analytics SEO Hero',
    section: 'SEO Page Overrides',
    altText: 'INXSocial social media analytics dashboard',
    recommendedMinWidth: 1920,
    recommendedMinHeight: 1080,
    fallbackKey: 'seo.default.dashboard',
    usedOn: ['/social-media-analytics']
  },
  {
    key: 'seo.pricing.hero',
    label: 'Pricing SEO Hero',
    section: 'SEO Page Overrides',
    altText: 'INXSocial social media management dashboard',
    recommendedMinWidth: 1920,
    recommendedMinHeight: 1080,
    fallbackKey: 'seo.default.dashboard',
    usedOn: ['/pricing']
  },
  {
    key: 'seo.ai-social-media-tools.hero',
    label: 'AI Social Media Tools SEO Hero',
    section: 'SEO Page Overrides',
    altText: 'INXSocial AI Content Studio',
    recommendedMinWidth: 1400,
    recommendedMinHeight: 986,
    fallbackKey: 'seo.default.ai-studio',
    usedOn: ['/ai-social-media-tools']
  },
  {
    key: 'seo.ai-social-media-campaign-generator.hero',
    label: 'AI Campaign Generator SEO Hero',
    section: 'SEO Page Overrides',
    altText: 'INXSocial AI Campaign generator',
    recommendedMinWidth: 1400,
    recommendedMinHeight: 986,
    fallbackKey: 'seo.default.ai-studio',
    usedOn: ['/ai-social-media-campaign-generator']
  },
  {
    key: 'seo.ai-social-media-post-generator.hero',
    label: 'AI Post Generator SEO Hero',
    section: 'SEO Page Overrides',
    altText: 'INXSocial AI social media post generator',
    recommendedMinWidth: 1400,
    recommendedMinHeight: 986,
    fallbackKey: 'seo.default.ai-studio',
    usedOn: ['/ai-social-media-post-generator']
  },
  {
    key: 'seo.ai-carousel-post-generator.hero',
    label: 'AI Carousel SEO Hero',
    section: 'SEO Page Overrides',
    altText: 'INXSocial AI carousel post generator',
    recommendedMinWidth: 1400,
    recommendedMinHeight: 986,
    fallbackKey: 'seo.default.ai-studio',
    usedOn: ['/ai-carousel-post-generator']
  },
  {
    key: 'seo.ai-video.hero',
    label: 'AI Video SEO Hero',
    section: 'SEO Page Overrides',
    altText: 'INXSocial AI Video Studio',
    recommendedMinWidth: 1400,
    recommendedMinHeight: 986,
    fallbackKey: 'seo.default.ai-studio',
    usedOn: ['/ai-video-post-generator', '/ai-video-models']
  },
  {
    key: 'seo.ai-ugc-ad-generator.hero',
    label: 'UGC Ad Generator SEO Hero',
    section: 'SEO Page Overrides',
    altText: 'INXSocial UGC Ad Studio',
    recommendedMinWidth: 1400,
    recommendedMinHeight: 986,
    fallbackKey: 'seo.default.ai-studio',
    usedOn: ['/ai-ugc-ad-generator']
  }
])

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
    fallbackKey: definition?.fallbackKey || null,
    fallbackUrl: definition?.fallbackUrl || null,
    mediaType: definition?.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE',
    acceptedMimeTypes: definition?.mediaType === 'VIDEO'
      ? ['video/mp4', 'video/webm']
      : ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
    maxUploadBytes: definition?.mediaType === 'VIDEO' ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES,
    fallbackActive: !current,
    hasMedia: Boolean(current),
    hasImage: Boolean(current),
    currentVersion: current,
    versionCount: Number(asset._count?.versions || options.versionCount || 0),
    publicUrl: current ? publicUrl(asset.key, current.id) : null,
    liveUrl: publicUrl(asset.key),
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

function videoFormat(data) {
  if (!Buffer.isBuffer(data) || data.length < 12) return null;
  if (data.subarray(4, 8).toString('ascii') === 'ftyp') {
    return { format: 'mp4', mimeType: 'video/mp4', extension: 'mp4' };
  }
  if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) {
    return { format: 'webm', mimeType: 'video/webm', extension: 'webm' };
  }
  return null;
}

async function inspectVideoUpload(data) {
  if (data.length > MAX_VIDEO_UPLOAD_BYTES) {
    throw publicError('Website videos must be 120 MB or smaller.', 413, 'WEBSITE_MEDIA_TOO_LARGE');
  }
  const format = videoFormat(data);
  if (!format) {
    throw publicError('Upload an MP4 or WebM video.', 415, 'WEBSITE_MEDIA_UNSUPPORTED_VIDEO');
  }
  if (!ffmpegPath) {
    throw publicError('Video inspection is not available on this server.', 503, 'WEBSITE_MEDIA_VIDEO_INSPECTOR_UNAVAILABLE');
  }

  const tempPath = path.join(os.tmpdir(), 'inx-website-media-' + crypto.randomUUID() + '.' + format.extension);
  await fs.writeFile(tempPath, data, { mode: 0o600 });
  try {
    const stderr = await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, [
        '-hide_banner',
        '-loglevel', 'info',
        '-i', tempPath,
        '-map', '0:v:0',
        '-frames:v', '1',
        '-an',
        '-f', 'null',
        '-'
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      let output = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(publicError('Video inspection timed out.', 408, 'WEBSITE_MEDIA_VIDEO_INSPECTION_TIMEOUT'));
      }, 20000);
      child.stderr.on('data', chunk => {
        if (output.length < 250000) output += chunk.toString('utf8');
      });
      child.on('error', error => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', () => {
        clearTimeout(timer);
        resolve(output);
      });
    });

    const streamLine = String(stderr || '').split('\n').find(line => /Video:/.test(line)) || '';
    const dimensions = streamLine.match(/(?:^|[\s,])(\d{2,5})x(\d{2,5})(?:[\s,\[]|$)/);
    if (!dimensions) {
      throw publicError('The uploaded file does not contain a readable video track.', 415, 'WEBSITE_MEDIA_INVALID_VIDEO');
    }
    const width = Number(dimensions[1]);
    const height = Number(dimensions[2]);
    if (!width || !height || width > 16384 || height > 16384) {
      throw publicError('The uploaded video dimensions are invalid.', 415, 'WEBSITE_MEDIA_INVALID_VIDEO');
    }

    return {
      ...format,
      width,
      height,
      byteSize: data.length,
      sha256: crypto.createHash('sha256').update(data).digest('hex')
    };
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

async function inspectUpload(data, definition = {}, originalName = '') {
  const mediaType = definition?.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE';
  if (!Buffer.isBuffer(data) || !data.length) {
    throw publicError(
      mediaType === 'VIDEO' ? 'Choose an MP4 or WebM video to upload.' : 'Choose a PNG, JPEG, WebP or AVIF image to upload.',
      400,
      'WEBSITE_MEDIA_EMPTY_UPLOAD'
    );
  }

  if (mediaType === 'VIDEO') return inspectVideoUpload(data, originalName);

  if (data.length > MAX_IMAGE_UPLOAD_BYTES) {
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
  const label = definition?.mediaType === 'VIDEO' ? 'Video' : 'Image';
  if (definition.recommendedMinWidth && metadata.width < definition.recommendedMinWidth) {
    warnings.push(`${label} width is ${metadata.width}px; ${definition.recommendedMinWidth}px or wider is recommended for this placement.`);
  }
  if (definition.recommendedMinHeight && metadata.height < definition.recommendedMinHeight) {
    warnings.push(`${label} height is ${metadata.height}px; ${definition.recommendedMinHeight}px or taller is recommended for this placement.`);
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
  const requestedOriginalName = path.basename(String(input.originalName || 'website-media')).slice(0, 180);
  const metadata = await inspectUpload(data, definition, requestedOriginalName);

  const storageStatus = objectStorage.providerStatus();
  if (!storageStatus.cloudflareR2Configured) {
    throw publicError('Cloudflare R2 must be configured before website media can be uploaded.', 503, 'WEBSITE_MEDIA_R2_REQUIRED');
  }

  const originalName = requestedOriginalName || `website-media.${metadata.extension}`;
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

async function useFallback(key) {
  const definition = definitionFor(key);
  const asset = await ensureSlot(key);
  const updated = await prisma.websiteMediaAsset.update({
    where: { id: asset.id },
    data: { currentVersionId: null },
    include: { currentVersion: true, _count: { select: { versions: true } } }
  });
  return serializeAsset(updated, definition);
}

async function configuredSource(key) {
  const definition = definitionFor(key);
  const asset = await prisma.websiteMediaAsset.findUnique({
    where: { key: definition.key },
    include: { currentVersion: true }
  });
  if (!asset?.currentVersion) return null;
  return { definition, asset, version: asset.currentVersion };
}

async function resolveEffectiveSource(key, seen = new Set()) {
  const definition = definitionFor(key);
  if (seen.has(definition.key)) {
    throw publicError('Website media fallback cycle detected.', 500, 'WEBSITE_MEDIA_FALLBACK_CYCLE');
  }
  seen.add(definition.key);

  const configured = await configuredSource(definition.key);
  if (configured) {
    return { ...configured, requestedKey: key, inherited: definition.key !== key };
  }

  if (definition.fallbackKey) {
    const resolved = await resolveEffectiveSource(definition.fallbackKey, seen);
    return { ...resolved, requestedKey: key, inherited: true };
  }

  if (definition.fallbackUrl) {
    return {
      requestedKey: key,
      definition,
      fallbackUrl: definition.fallbackUrl,
      inherited: definition.key !== key
    };
  }

  throw publicError('Website media is not configured yet.', 404, 'WEBSITE_MEDIA_NOT_CONFIGURED');
}

async function publicMetadata(key) {
  const definition = definitionFor(key);
  const source = await resolveEffectiveSource(definition.key);
  if (source.version) {
    return {
      key: definition.key,
      effectiveKey: source.definition.key,
      inherited: Boolean(source.inherited),
      fallback: false,
      altText: source.asset.altText || definition.altText || source.definition.altText || '',
      width: source.version.width,
      height: source.version.height,
      mimeType: source.version.mimeType,
      byteSize: Number(source.version.byteSize || 0),
      versionId: source.version.id,
      updatedAt: source.asset.updatedAt,
      contentUrl: publicUrl(definition.key)
    };
  }
  return {
    key: definition.key,
    effectiveKey: source.definition.key,
    inherited: Boolean(source.inherited),
    fallback: true,
    altText: definition.altText || source.definition.altText || '',
    width: definition.recommendedMinWidth || null,
    height: definition.recommendedMinHeight || null,
    mimeType: null,
    byteSize: null,
    versionId: null,
    updatedAt: null,
    contentUrl: publicUrl(definition.key),
    fallbackUrl: source.fallbackUrl
  };
}

function parseByteRange(value, totalBytes) {
  const total = Number(totalBytes || 0);
  const raw = String(value || '').trim();
  if (!raw || !total) return null;
  const match = raw.match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) throw publicError('Invalid media range.', 416, 'WEBSITE_MEDIA_INVALID_RANGE');

  let start;
  let end;
  if (match[1]) {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : total - 1;
  } else if (match[2]) {
    const suffix = Number(match[2]);
    if (!suffix) throw publicError('Invalid media range.', 416, 'WEBSITE_MEDIA_INVALID_RANGE');
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    throw publicError('Invalid media range.', 416, 'WEBSITE_MEDIA_INVALID_RANGE');
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= total || end < start) {
    throw publicError('Requested media range is not satisfiable.', 416, 'WEBSITE_MEDIA_RANGE_NOT_SATISFIABLE');
  }
  end = Math.min(end, total - 1);
  return { start, end, header: `bytes=${start}-${end}`, total };
}

async function content(key, versionId = '', rangeHeader = '') {
  const definition = definitionFor(key);
  const requestedVersionId = String(versionId || '').trim();

  if (requestedVersionId) {
    const asset = await prisma.websiteMediaAsset.findUnique({ where: { key: definition.key } });
    if (!asset) throw publicError('Website media version was not found.', 404, 'WEBSITE_MEDIA_VERSION_NOT_FOUND');
    const version = await prisma.websiteMediaVersion.findFirst({
      where: { id: requestedVersionId, assetId: asset.id }
    });
    if (!version) throw publicError('Website media version was not found.', 404, 'WEBSITE_MEDIA_VERSION_NOT_FOUND');
    const totalBytes = Number(version.byteSize || 0);
    const range = String(version.mimeType || '').startsWith('video/') ? parseByteRange(rangeHeader, totalBytes) : null;
    const data = await objectStorage.getBuffer(version.storageKey, range?.header || null, version.storageProvider);
    return {
      data,
      mimeType: version.mimeType,
      byteSize: Number(data.length),
      totalByteSize: totalBytes || Number(data.length),
      range,
      etag: `"${version.sha256}"`,
      versionId: version.id,
      updatedAt: version.createdAt,
      inherited: false
    };
  }

  const source = await resolveEffectiveSource(definition.key);
  if (source.fallbackUrl) {
    return {
      redirectUrl: source.fallbackUrl,
      inherited: Boolean(source.inherited)
    };
  }

  const totalBytes = Number(source.version.byteSize || 0);
  const range = String(source.version.mimeType || '').startsWith('video/') ? parseByteRange(rangeHeader, totalBytes) : null;
  const data = await objectStorage.getBuffer(source.version.storageKey, range?.header || null, source.version.storageProvider);
  return {
    data,
    mimeType: source.version.mimeType,
    byteSize: Number(data.length),
    totalByteSize: totalBytes || Number(data.length),
    range,
    etag: `"${source.version.sha256}"`,
    versionId: source.version.id,
    updatedAt: source.asset.updatedAt,
    inherited: Boolean(source.inherited),
    effectiveKey: source.definition.key
  };
}

module.exports = {
  STORAGE_PREFIX,
  MAX_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  SLOT_DEFINITIONS,
  definitionFor,
  videoFormat,
  inspectUpload,
  qualityWarnings,
  publicUrl,
  ensureSlots,
  list,
  detail,
  upload,
  updateMetadata,
  restore,
  useFallback,
  resolveEffectiveSource,
  publicMetadata,
  parseByteRange,
  content
};
