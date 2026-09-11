const { z } = require('zod');
const prisma = require('../db/prisma');
const { decryptToken } = require('../utils/tokenCrypto');
const { getLicenseStatus } = require('../services/licenseService');
const mediaLibrary = require('../services/mediaLibraryService');
const metaPublisher = require('../services/cloudMetaPublisher');

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ACTIVE_JOB_STATUSES = ['DRAFT', 'AWAITING_UPLOAD', 'READY', 'QUEUED', 'PROCESSING'];

const carouselPostSchema = z.object({
  connectedPageIds: z.array(z.string().min(1)).min(1, 'Choose at least one connected Page.').max(50),
  clientRequestId: z.string().trim().min(8).max(80),
  title: z.string().trim().max(200).nullish(),
  caption: z.string().trim().min(1, 'Write a caption before continuing.').max(5000),
  mediaLibraryAssetIds: z.array(z.string().trim().min(1).max(100)).min(2, 'Carousel posts need at least two slides.').max(10, 'Carousel posts can contain up to ten slides.'),
  scheduledAt: z.string().datetime().nullish(),
  publishMode: z.enum(['SCHEDULED', 'NOW'])
});

function publicPage(page) {
  if (!page) return null;
  return {
    id: page.id,
    facebookPageId: page.facebookPageId,
    facebookPageName: page.facebookPageName,
    facebookPageUsername: page.facebookPageUsername || null,
    facebookPagePicture: page.facebookPagePicture || null,
    facebookCategory: page.facebookCategory || null,
    status: page.status,
    isSelected: Boolean(page.isSelected),
    connectedAt: page.connectedAt,
    lastCheckedAt: page.lastCheckedAt || null,
    lastSyncAt: page.lastSyncAt || null,
    lastError: page.lastError || null
  };
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    uploadStatus: job.uploadStatus || null,
    publishMode: job.publishMode,
    contentType: job.contentType,
    title: job.title || null,
    caption: job.caption || null,
    localFileName: job.localFileName || null,
    scheduledAt: job.scheduledAt || null,
    completedAt: job.completedAt || null,
    errorMessage: job.errorMessage || null,
    mediaLibraryAssetId: job.mediaLibraryAssetId || null,
    metaPostId: job.metaPostId || null,
    metaVideoId: job.metaVideoId || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    page: publicPage(job.connectedPage),
    asset: null
  };
}

async function requireLicense(userId) {
  const license = await getLicenseStatus(userId);
  if (!license.allowed) {
    const error = new Error('An active trial or subscription is required to use INX Social.');
    error.status = 403;
    error.publicMessage = error.message;
    throw error;
  }
  return license;
}

async function resolvePages(userId, connectedPageIds) {
  const ids = [...new Set((connectedPageIds || []).map(String).filter(Boolean))];
  const pages = await prisma.connectedPage.findMany({ where: { id: { in: ids }, userId, status: 'ACTIVE' } });
  const byId = new Map(pages.map(page => [page.id, page]));
  if (!ids.length || ids.some(id => !byId.has(id))) {
    const error = new Error('One or more selected Pages are no longer connected to this account.');
    error.status = 400;
    error.publicMessage = error.message;
    throw error;
  }
  const ordered = ids.map(id => byId.get(id));
  if (ordered.some(page => !page.encryptedAccessToken)) {
    const error = new Error('One or more selected Pages must be reconnected before publishing.');
    error.status = 409;
    error.publicMessage = error.message;
    throw error;
  }
  return ordered;
}

function validateSchedule(input) {
  if (input.publishMode === 'NOW') return null;
  if (!input.scheduledAt) {
    const error = new Error('Choose a future date and time before scheduling this carousel.');
    error.status = 400;
    error.publicMessage = error.message;
    throw error;
  }
  const value = new Date(input.scheduledAt);
  if (!Number.isFinite(value.getTime()) || value.getTime() < Date.now() + (10 * 60 * 1000)) {
    const error = new Error('Facebook scheduled posts must be at least 10 minutes in the future.');
    error.status = 400;
    error.publicMessage = error.message;
    throw error;
  }
  return value;
}

async function resolveSlides(userId, ids) {
  const orderedIds = [...new Set(ids.map(String))];
  if (orderedIds.length !== ids.length) {
    const error = new Error('Each carousel slide must be a unique Media Library asset.');
    error.status = 400;
    error.publicMessage = error.message;
    throw error;
  }
  const slides = [];
  for (const id of orderedIds) {
    const asset = await mediaLibrary.findContent(userId, id);
    if (!asset) {
      const error = new Error('One or more carousel slides are unavailable. Restore them from Media Library or regenerate the carousel.');
      error.status = 404;
      error.publicMessage = error.message;
      throw error;
    }
    if (!/^image\/(png|jpeg|webp)$/i.test(String(asset.mimeType || ''))) {
      const error = new Error('Carousel slides must be PNG, JPEG or WebP images.');
      error.status = 400;
      error.publicMessage = error.message;
      throw error;
    }
    if (asset.data.length > MAX_IMAGE_BYTES) {
      const error = new Error('Each carousel slide must be no larger than 15 MB.');
      error.status = 413;
      error.publicMessage = error.message;
      throw error;
    }
    slides.push({ id, ...asset });
  }
  return slides;
}

async function createCarouselPosts(req, res, next) {
  try {
    const input = carouselPostSchema.parse(req.body || {});
    const [license, pages, slides] = await Promise.all([
      requireLicense(req.user.id),
      resolvePages(req.user.id, input.connectedPageIds),
      resolveSlides(req.user.id, input.mediaLibraryAssetIds)
    ]);
    const scheduledAt = validateSchedule(input);
    const immediate = input.publishMode === 'NOW';

    const currentBatchSize = await prisma.scheduleJob.count({
      where: { userId: req.user.id, origin: 'CLOUD', status: { in: ACTIVE_JOB_STATUSES } }
    });
    if (license.limits.batchPosts !== null && currentBatchSize + pages.length > license.limits.batchPosts) {
      const error = new Error(`This carousel would exceed the ${license.limits.batchPosts}-item active publishing limit for your ${license.plan} plan.`);
      error.status = 403;
      error.publicMessage = error.message;
      throw error;
    }

    const jobs = [];
    const failures = [];
    for (const page of pages) {
      const clientRequestId = `${input.clientRequestId}:${page.id}`.slice(0, 100);
      const existing = await prisma.scheduleJob.findUnique({
        where: { userId_clientRequestId: { userId: req.user.id, clientRequestId } },
        include: { connectedPage: true }
      });
      if (existing) {
        jobs.push(publicJob(existing));
        continue;
      }

      let job = await prisma.scheduleJob.create({
        data: {
          userId: req.user.id,
          connectedPageId: page.id,
          status: 'PROCESSING',
          origin: 'CLOUD',
          uploadStatus: 'NOT_REQUIRED',
          publishMode: input.publishMode,
          clientRequestId,
          contentType: 'CAROUSEL',
          title: input.title || null,
          caption: input.caption,
          localFileName: `${slides.length}-slide carousel`,
          mediaLibraryAssetId: slides[0].id,
          scheduledAt,
          attemptCount: 1,
          claimedAt: new Date()
        },
        include: { connectedPage: true }
      });

      try {
        const published = await metaPublisher.publishCarouselPost({
          pageId: page.facebookPageId,
          pageAccessToken: decryptToken(page.encryptedAccessToken),
          caption: input.caption,
          scheduledAt,
          publishMode: input.publishMode,
          assets: slides.map(slide => ({ data: slide.data, mimeType: slide.mimeType, originalName: slide.originalName }))
        });
        job = await prisma.scheduleJob.update({
          where: { id: job.id },
          data: {
            status: immediate ? 'PUBLISHED' : 'SCHEDULED',
            completedAt: new Date(),
            claimedAt: null,
            metaPostId: published.postId,
            rawMetaResponse: JSON.stringify({
              ...(published.response || {}),
              carouselAssetIds: slides.map(slide => slide.id),
              slideCount: slides.length,
              photoIds: published.photoIds || [],
              verification: {
                state: immediate ? 'PUBLISHED' : 'SCHEDULED',
                confirmedAt: new Date().toISOString(),
                mediaSource: 'MEDIA_LIBRARY'
              }
            })
          },
          include: { connectedPage: true }
        });
      } catch (error) {
        const message = String(error.publicMessage || error.message || 'Facebook carousel publishing failed.').slice(0, 1000);
        job = await prisma.scheduleJob.update({
          where: { id: job.id },
          data: { status: 'FAILED', claimedAt: null, errorMessage: message },
          include: { connectedPage: true }
        });
        failures.push({ pageId: page.id, pageName: page.facebookPageName, error: message });
      }
      jobs.push(publicJob(job));
    }

    res.status(failures.length ? 207 : 201).json({ jobs, failures, uploadRequired: false });
  } catch (error) {
    next(error);
  }
}

module.exports = { createCarouselPosts };
