const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { z } = require('zod');
const prisma = require('../db/prisma');
const { decryptToken } = require('../utils/tokenCrypto');
const { getLicenseStatus } = require('../services/licenseService');
const agentAccess = require('../services/agentAccessService');
const metaPublisher = require('../services/cloudMetaPublisher');
const { getFacebookAnalytics } = require('../services/facebookAnalyticsService');
const postEnhancement = require('../services/postEnhancementService');
const mediaLibrary = require('../services/mediaLibraryService');
const {
  JOB_STATUS,
  ASSET_STATUS,
  TERMINAL_STATUSES,
  EDITABLE_STATUSES,
  MAX_CLOUD_FILE_BYTES,
  validateScheduleTime,
  normaliseFileSize,
  summariseStatusRows
} = require('../services/cloudStudioService');

const DEFAULT_SETTINGS = {
  pageId: '',
  facebookAppId: '969283649323618',
  connectedPageName: '',
  connectionMethod: 'cloud',
  graphVersion: process.env.FB_GRAPH_VERSION || process.env.GRAPH_VERSION || 'v25.0',
  timezone: 'Europe/London',
  dailySlots: ['11:00', '15:13', '22:15', '23:15'],
  maxScheduleDays: 25,
  minLeadMinutes: 20,
  maxRetries: 3,
  retryBaseDelayMs: 5000,
  preferExactFilenameMatch: true,
  copyImportedFiles: false,
  captionSplitMode: 'auto',
  uiTheme: 'aurora',
  uiDensity: 'comfortable',
  enableMotion: true,
  cloudApiUrl: ''
};

const DEFAULT_UI_TEXTS = {
  appTitle: 'INX Social',
  appSubtitle: 'Content Scheduler',
  dashboardTitle: 'Dashboard',
  dashboardSubtitle: 'Plan and schedule content across your connected Pages.',
  refreshButton: 'Refresh',
  runSchedulerButton: 'Open Bulk Scheduler',
  stopSchedulerButton: 'Stop Scheduler',
  checkSlotsButton: 'Check Schedule Slots',
  testFacebookButton: 'Test Facebook Connection',
  openLocalDataButton: 'Browser session information',
  uploadVideosButton: 'Upload Videos',
  importVideoFolderButton: 'Import Video Folder',
  uploadCaptionsButton: 'Upload Captions',
  importCaptionFolderButton: 'Import Caption Folder',
  importPastedCaptionsButton: 'Import Pasted Captions',
  clearTextButton: 'Clear Text',
  clearLocalLibraryButton: 'Clear Browser Selection',
  fetchMetaButton: 'Fetch Meta Scheduled Posts',
  saveSettingsButton: 'Save Settings'
};

const fileNameSchema = z.string()
  .trim()
  .min(1, 'Choose a video file.')
  .max(255, 'Video filename is too long.')
  .refine(value => /\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(value), 'Choose a supported video file.');

const fileSizeSchema = z.union([
  z.string().regex(/^\d+$/, 'Media file size must contain digits only.'),
  z.number().int().positive()
]);

const directPostSchema = z.object({
  connectedPageIds: z.array(z.string().min(1)).min(1, 'Choose at least one connected Page.').max(50),
  clientRequestId: z.string().trim().min(8).max(80),
  title: z.string().trim().max(200).nullish(),
  caption: z.string().trim().min(1, 'Write a caption before continuing.').max(5000),
  contentType: z.enum(['TEXT', 'IMAGE', 'VIDEO']),
  originalFileName: z.string().trim().max(255).nullish(),
  mimeType: z.string().trim().max(120).nullish(),
  fileSizeBytes: fileSizeSchema.nullish(),
  mediaLibraryAssetId: z.string().trim().min(1).max(100).nullish(),
  scheduledAt: z.string().datetime().nullish(),
  publishMode: z.enum(['SCHEDULED', 'NOW'])
}).superRefine((input, context) => {
  if (input.contentType === 'TEXT' || input.mediaLibraryAssetId) return;
  if (!input.originalFileName) context.addIssue({ code: z.ZodIssueCode.custom, path: ['originalFileName'], message: 'Choose an image or video.' });
  if (!input.fileSizeBytes) context.addIssue({ code: z.ZodIssueCode.custom, path: ['fileSizeBytes'], message: 'The selected media file is empty.' });
  if (input.contentType === 'IMAGE' && !/\.(png|jpe?g|webp)$/i.test(input.originalFileName || '')) context.addIssue({ code: z.ZodIssueCode.custom, path: ['originalFileName'], message: 'Choose a PNG, JPG, JPEG or WebP image.' });
  if (input.contentType === 'VIDEO' && !/\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(input.originalFileName || '')) context.addIssue({ code: z.ZodIssueCode.custom, path: ['originalFileName'], message: 'Choose a supported video file.' });
});

const postEnhancementSchema = z.object({
  caption: z.string().trim().min(1, 'Write a caption before using AI enhancement.').max(5000),
  action: z.enum(['rewrite', 'shorten', 'expand', 'hashtags', 'cta']),
  tone: z.enum(['professional', 'friendly', 'concise', 'energetic']).default('professional')
});

const mediaFolderSchema = z.object({ name: z.string().trim().min(2).max(60) });
const mediaRenameSchema = z.object({ fileName: z.string().trim().min(1).max(180) });

const MAX_DIRECT_IMAGE_BYTES = 15n * 1024n * 1024n;

const draftSchema = z.object({
  connectedPageId: z.string().min(1).optional(),
  clientRequestId: z.string().trim().min(8).max(100).optional(),
  title: z.string().trim().max(200).nullish(),
  caption: z.string().max(5000).nullish(),
  originalFileName: fileNameSchema,
  mimeType: z.string().trim().max(120).nullish(),
  fileSizeBytes: fileSizeSchema,
  scheduledAt: z.string().datetime().nullish(),
  publishMode: z.enum(['SCHEDULED', 'DRAFT', 'NOW']).default('SCHEDULED')
});

const updateSchema = z.object({
  connectedPageId: z.string().min(1).optional(),
  title: z.string().trim().max(200).nullish(),
  caption: z.string().max(5000).nullish(),
  scheduledAt: z.string().datetime().nullish(),
  publishMode: z.enum(['SCHEDULED', 'DRAFT', 'NOW']).optional()
}).refine(input => Object.keys(input).length > 0, 'Provide at least one field to update.');

const preferenceSchema = z.object({
  settings: z.object({
    timezone: z.string().trim().min(1).max(100).optional(),
    dailySlots: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(24).optional(),
    maxScheduleDays: z.coerce.number().int().min(1).max(25).optional(),
    minLeadMinutes: z.coerce.number().int().min(20).max(1440).optional(),
    maxRetries: z.coerce.number().int().min(0).max(10).optional(),
    retryBaseDelayMs: z.coerce.number().int().min(1000).max(60000).optional(),
    preferExactFilenameMatch: z.boolean().optional(),
    captionSplitMode: z.enum(['auto', 'blank-line', 'line']).optional(),
    uiTheme: z.enum(['aurora', 'midnight', 'studio', 'light']).optional(),
    uiDensity: z.enum(['comfortable', 'compact']).optional(),
    enableMotion: z.boolean().optional()
  }).optional(),
  uiTexts: z.record(z.string().max(180)).optional()
});

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || '');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function publicPage(page) {
  if (!page) return null;
  return {
    id: page.id,
    metaAccountId: page.metaAccountId || null,
    facebookPageId: page.facebookPageId,
    facebookPageName: page.facebookPageName,
    facebookPageUsername: page.facebookPageUsername || null,
    facebookPagePicture: page.facebookPagePicture,
    facebookCategory: page.facebookCategory,
    status: page.status,
    isSelected: Boolean(page.isSelected),
    connectedAt: page.connectedAt,
    lastCheckedAt: page.lastCheckedAt,
    lastSyncAt: page.lastSyncAt,
    lastError: page.lastError
  };
}

async function pagePicture(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    const page = await prisma.connectedPage.findFirst({
      where: { id: req.params.id, userId: req.user.id, status: 'ACTIVE' }
    });
    if (!page?.facebookPageId || !page?.encryptedAccessToken) return res.status(404).end();
    const graphVersion = process.env.FB_GRAPH_VERSION || process.env.GRAPH_VERSION || 'v25.0';
    const pageAccessToken = decryptToken(page.encryptedAccessToken);
    let livePictureUrl = null;
    try {
      const picture = await axios.get(
        `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(page.facebookPageId)}`,
        {
          params: { fields: 'picture.type(large)', access_token: pageAccessToken },
          timeout: 15000,
          validateStatus: status => status >= 200 && status < 500
        }
      );
      if (picture.status < 400 && !picture.data?.error) {
        livePictureUrl = picture.data?.picture?.data?.url || null;
      }
    } catch (_) {
      // A temporary Graph lookup failure must not discard the picture saved at connection time.
    }

    // Prefer an authenticated server-side Graph image request when the CDN URL
    // returned in the Page record is missing, expired or protected. The access
    // token never reaches the browser.
    try {
      const directPicture = await axios.get(
        `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(page.facebookPageId)}/picture`,
        {
          params: { type: 'large', access_token: pageAccessToken },
          responseType: 'arraybuffer',
          timeout: 15000,
          maxRedirects: 5,
          validateStatus: status => status >= 200 && status < 500
        }
      );
      const contentType = String(directPicture.headers['content-type'] || '');
      if (directPicture.status < 400 && contentType.startsWith('image/')) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, max-age=300');
        return res.send(Buffer.from(directPicture.data));
      }
    } catch (_) {
      // Fall through to the live and stored picture URLs below.
    }

    const candidates = [...new Set([livePictureUrl, page.facebookPagePicture].filter(Boolean))];
    for (const pictureUrl of candidates) {
      try {
        const response = await axios.get(pictureUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
          maxRedirects: 5,
          validateStatus: status => status >= 200 && status < 500
        });
        const contentType = String(response.headers['content-type'] || '');
        if (response.status >= 400 || !contentType.startsWith('image/')) continue;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, max-age=300');
        return res.send(Buffer.from(response.data));
      } catch (_) {
        // Try the next safe server-side candidate without exposing its URL to the browser.
      }
    }
    return res.status(404).end();
  } catch (error) {
    if (error.response?.status >= 400 && error.response?.status < 500) return res.status(404).end();
    return next(error);
  }
}

function publicAsset(asset) {
  if (!asset) return null;
  return {
    id: asset.id,
    provider: asset.provider,
    originalFileName: asset.originalFileName,
    mimeType: asset.mimeType,
    fileSizeBytes: asset.fileSizeBytes === null || asset.fileSizeBytes === undefined
      ? null
      : asset.fileSizeBytes.toString(),
    sha256: asset.sha256,
    status: asset.status,
    expiresAt: asset.expiresAt,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt
  };
}

function jobVerification(job) {
  return parseJson(job?.rawMetaResponse, {}).verification || {};
}

function isDuplicateProtectedJob(job, now = Date.now()) {
  const status = String(job?.status || '').toUpperCase();
  if (status === JOB_STATUS.FAILED || status === JOB_STATUS.CANCELLED) return false;
  const verification = jobVerification(job);
  if ([JOB_STATUS.SCHEDULED, JOB_STATUS.PUBLISHED].includes(status)) {
    return Boolean(verification.confirmedAt && ['SCHEDULED', 'PUBLISHED'].includes(String(verification.state || status).toUpperCase()));
  }
  if (status !== JOB_STATUS.PROCESSING) return false;
  if (String(verification.state || '').toUpperCase() === 'PROCESSING' && job?.metaVideoId) return true;
  const updatedAt = new Date(job?.updatedAt || job?.createdAt || 0).getTime();
  return Number.isFinite(updatedAt) && now - updatedAt < 30 * 60 * 1000;
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    origin: job.origin,
    uploadStatus: job.uploadStatus,
    publishMode: job.publishMode,
    contentType: job.contentType,
    title: job.title,
    caption: job.caption,
    localFileName: job.localFileName,
    scheduledAt: job.scheduledAt,
    attemptCount: job.attemptCount,
    nextAttemptAt: job.nextAttemptAt,
    completedAt: job.completedAt,
    metaPostId: job.metaPostId,
    metaVideoId: job.metaVideoId,
    errorMessage: job.errorMessage,
    mediaLibraryAssetId: job.mediaLibraryAssetId || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    page: publicPage(job.connectedPage),
    asset: publicAsset(job.cloudAsset)
  };
}

function desktopStatus(status) {
  return {
    DRAFT: 'reel_queued',
    AWAITING_UPLOAD: 'reel_queued',
    READY: 'reel_queued',
    QUEUED: 'reel_queued',
    PROCESSING: 'reel_uploading',
    SCHEDULED: 'reel_scheduled',
    PUBLISHED: 'reel_published',
    FAILED: 'reel_upload_failed',
    CANCELLED: 'cancelled'
  }[status] || String(status || '').toLowerCase();
}

function desktopJob(job) {
  const verification = jobVerification(job);
  return {
    id: job.id,
    title: job.title || null,
    contentType: job.contentType || 'VIDEO',
    videoName: job.localFileName || job.cloudAsset?.originalFileName || (job.contentType === 'TEXT' ? null : 'Cloud media'),
    captionName: 'Cloud caption',
    publishMode: job.publishMode,
    caption: job.caption || '',
    connectedPageId: job.connectedPage?.id || job.connectedPageId || null,
    facebookPageId: job.connectedPage?.facebookPageId || null,
    facebookPageName: job.connectedPage?.facebookPageName || null,
    scheduledAtISO: job.scheduledAt,
    scheduledUnix: job.scheduledAt ? Math.floor(new Date(job.scheduledAt).getTime() / 1000) : null,
    slotLabel: job.publishMode === 'NOW' ? 'Published immediately' : (job.scheduledAt ? new Date(job.scheduledAt).toLocaleString('en-GB') : 'Draft'),
    status: desktopStatus(job.status),
    attempts: job.attemptCount || 0,
    fbVideoId: job.metaVideoId,
    fbPostId: job.metaPostId,
    error: job.errorMessage,
    createdAt: job.createdAt,
    uploadedAt: parseJson(job.rawMetaResponse, {}).verification?.acceptedAt || job.completedAt,
    completedAt: job.completedAt,
    updatedAt: job.updatedAt,
    metaConfirmed: Boolean(verification.confirmedAt),
    metaVerificationState: verification.state || null,
    duplicateProtected: isDuplicateProtectedJob(job),
    cloud: true
  };
}

async function requireStudioLicense(userId) {
  const license = await getLicenseStatus(userId);
  if (!license.allowed) {
    const error = new Error('An active trial or subscription is required to use INX Social.');
    error.status = 403;
    error.publicMessage = error.message;
    throw error;
  }
  return license;
}

async function resolvePage(userId, connectedPageId, includeToken = false) {
  const page = connectedPageId
    ? await prisma.connectedPage.findFirst({
        where: { id: connectedPageId, userId, status: 'ACTIVE' }
      })
    : await prisma.connectedPage.findFirst({
        where: { userId, status: 'ACTIVE', isSelected: true }
      });

  if (!page) {
    const error = new Error('Connect and select an active Facebook Page first.');
    error.status = 400;
    error.publicMessage = error.message;
    throw error;
  }
  if (includeToken && !page.encryptedAccessToken) {
    const error = new Error('The selected Page needs to be reconnected before publishing.');
    error.status = 409;
    error.publicMessage = error.message;
    throw error;
  }
  return page;
}

async function resolvePages(userId, connectedPageIds, includeToken = false) {
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
  if (includeToken && ordered.some(page => !page.encryptedAccessToken)) {
    const error = new Error('One or more selected Pages must be reconnected before publishing.');
    error.status = 409;
    error.publicMessage = error.message;
    throw error;
  }
  return ordered;
}

async function getWorkspaceData(userId, license) {
  const [accounts, pages] = await Promise.all([
    prisma.metaAccount.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { connectedAt: 'desc' },
      include: { pages: { where: { status: 'ACTIVE' }, orderBy: { facebookPageName: 'asc' } } }
    }),
    prisma.connectedPage.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ isSelected: 'desc' }, { facebookPageName: 'asc' }]
    })
  ]);
  const activePage = pages.find(page => page.isSelected) || null;
  return {
    accounts: accounts.map(account => ({
      id: account.id,
      facebookUserId: account.facebookUserId,
      facebookUserName: account.facebookUserName,
      facebookProfileImage: account.facebookProfileImage,
      status: account.status,
      connectedAt: account.connectedAt,
      lastSyncAt: account.lastSyncAt,
      tokenExpiresAt: account.tokenExpiresAt,
      lastError: account.lastError,
      pages: (account.pages || []).map(publicPage)
    })),
    pages: pages.map(publicPage),
    activePage: publicPage(activePage),
    pageUsage: { connected: pages.length, limit: license.limits.pages },
    plan: license.plan,
    lastSyncedAt: new Date()
  };
}

async function capabilities(req, res, next) {
  try {
    const license = await requireStudioLicense(req.user.id);
    res.json({
      phase: '10.0',
      mode: 'FULL_BROWSER_STUDIO',
      license: {
        plan: license.plan,
        subscriptionStatus: license.subscriptionStatus,
        limits: license.limits
      },
      upload: {
        enabled: true,
        provider: 'TEMPORARY_STREAM_TO_META',
        persistentStorage: false,
        maximumFileSizeBytes: MAX_CLOUD_FILE_BYTES.toString(),
        acceptedExtensions: ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'],
        note: 'Keep this browser open until each upload reaches Meta. Temporary server files are deleted after every attempt.'
      },
      publishing: {
        enabled: true,
        mode: 'META_SCHEDULED_AND_IMMEDIATE_REELS'
      }
    });
  } catch (error) {
    next(error);
  }
}

async function desktopState(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    const [license, preference, jobs, socialAgent] = await Promise.all([
      requireStudioLicense(req.user.id),
      prisma.cloudPreference.findUnique({ where: { userId: req.user.id } }),
      prisma.scheduleJob.findMany({
        where: { userId: req.user.id, origin: 'CLOUD' },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        include: { connectedPage: true, cloudAsset: true }
      }),
      agentAccess.getEntitlement(req.user.id)
    ]);
    const workspace = await getWorkspaceData(req.user.id, license);
    const active = workspace.activePage;
    const savedSettings = parseJson(preference?.settingsJson, {});
    const settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      pageId: active?.facebookPageId || '',
      connectedPageName: active?.facebookPageName || '',
      hasPageAccessToken: Boolean(active),
      cloudApiUrl: ''
    };
    const uiTexts = { ...DEFAULT_UI_TEXTS, ...parseJson(preference?.uiTextsJson, {}) };
    const mappedJobs = jobs.map(desktopJob);
    res.json({
      state: {
        settings,
        uiTexts,
        videos: [],
        captions: [],
        jobs: mappedJobs,
        // Detailed backend events are intentionally reserved for administrators.
        // Customers receive the structured publishing history above instead.
        logs: [],
        account: {
          authenticated: true,
          user: {
            id: req.user.id,
            name: req.user.name,
            businessName: req.user.businessName,
            email: req.user.email,
            status: req.user.status
          },
          license,
          features: {
            socialAgent: {
              visible: socialAgent.visible,
              allowed: socialAgent.allowed,
              usage: socialAgent.usage
            }
          },
          device: { deviceName: 'Web browser', status: 'ACTIVE' },
          lastCheckedAt: new Date()
        },
        workspace,
        paths: { userData: 'Browser session', videoRoot: '', captionRoot: '' }
      }
    });
  } catch (error) {
    next(error);
  }
}

async function persistFacebookPublicationMetrics(userId, analytics) {
  const rows = (analytics.content || []).filter(item => item.id && item.insights);
  if (!rows.length) return;
  const byExternalId = new Map(rows.map(item => [String(item.id), item]));
  const publications = await prisma.socialPublication.findMany({
    where: {
      platform: { in: ['facebook', 'FACEBOOK'] },
      externalPostId: { in: [...byExternalId.keys()] },
      profile: { is: { userId } }
    },
    select: { id: true, externalPostId: true, metricsJson: true }
  });
  await Promise.all(publications.map(publication => {
    const item = byExternalId.get(String(publication.externalPostId));
    if (!item) return null;
    const current = parseJson(publication.metricsJson, {});
    return prisma.socialPublication.update({
      where: { id: publication.id },
      data: {
        metricsJson: JSON.stringify({
          ...current,
          facebook: {
            reactions: item.reactions,
            comments: item.comments,
            shares: item.shares,
            ...item.insights,
            fetchedAt: analytics.fetchedAt
          }
        })
      }
    });
  }).filter(Boolean));
}

async function facebookAnalytics(req, res, next) {
  let page = null;
  try {
    await requireStudioLicense(req.user.id);
    page = await resolvePage(req.user.id, req.query.connectedPageId, true);
    const days = Math.min(90, Math.max(7, Number(req.query.days || 30)));
    const force = String(req.query.force || '') === 'true';
    const result = await getFacebookAnalytics({
      pageId: page.facebookPageId,
      accessToken: decryptToken(page.encryptedAccessToken),
      graphVersion: DEFAULT_SETTINGS.graphVersion,
      days,
      force,
      cacheScope: req.user.id
    });
    await Promise.all([
      prisma.connectedPage.updateMany({
        where: { id: page.id, userId: req.user.id },
        data: { lastCheckedAt: new Date(), lastSyncAt: new Date(), lastError: null }
      }),
      persistFacebookPublicationMetrics(req.user.id, result).catch(() => {})
    ]);
    res.json({ analytics: result });
  } catch (error) {
    if (page) {
      await prisma.connectedPage.updateMany({
        where: { id: page.id, userId: req.user.id },
        data: {
          lastCheckedAt: new Date(),
          lastError: String(error.publicMessage || error.message || 'Facebook analytics refresh failed.').slice(0, 1000)
        }
      }).catch(() => {});
    }
    next(error);
  }
}

async function savePreferences(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    const input = preferenceSchema.parse(req.body || {});
    const current = await prisma.cloudPreference.findUnique({ where: { userId: req.user.id } });
    const settings = { ...parseJson(current?.settingsJson, {}), ...(input.settings || {}) };
    const allowedUiKeys = new Set(Object.keys(DEFAULT_UI_TEXTS));
    const uiTexts = {
      ...parseJson(current?.uiTextsJson, {}),
      ...Object.fromEntries(Object.entries(input.uiTexts || {}).filter(([key]) => allowedUiKeys.has(key)))
    };
    await prisma.cloudPreference.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        settingsJson: JSON.stringify(settings),
        uiTextsJson: JSON.stringify(uiTexts)
      },
      update: {
        settingsJson: JSON.stringify(settings),
        uiTextsJson: JSON.stringify(uiTexts)
      }
    });
    res.json({ settings: { ...DEFAULT_SETTINGS, ...settings }, uiTexts: { ...DEFAULT_UI_TEXTS, ...uiTexts } });
  } catch (error) {
    next(error);
  }
}

async function resetUiTexts(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    const current = await prisma.cloudPreference.findUnique({ where: { userId: req.user.id } });
    await prisma.cloudPreference.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, uiTextsJson: JSON.stringify(DEFAULT_UI_TEXTS) },
      update: {
        settingsJson: current?.settingsJson || null,
        uiTextsJson: JSON.stringify(DEFAULT_UI_TEXTS)
      }
    });
    res.json({ uiTexts: DEFAULT_UI_TEXTS });
  } catch (error) {
    next(error);
  }
}

async function overview(req, res, next) {
  try {
    const [license, pages, statusRows] = await Promise.all([
      requireStudioLicense(req.user.id),
      prisma.connectedPage.findMany({
        where: { userId: req.user.id, status: 'ACTIVE' },
        orderBy: [{ isSelected: 'desc' }, { facebookPageName: 'asc' }]
      }),
      prisma.scheduleJob.groupBy({
        by: ['status'],
        where: { userId: req.user.id, origin: 'CLOUD' },
        _count: { _all: true }
      })
    ]);
    res.json({
      user: { id: req.user.id, name: req.user.name, businessName: req.user.businessName, email: req.user.email },
      license: {
        allowed: license.allowed,
        plan: license.plan,
        subscriptionStatus: license.subscriptionStatus,
        trialEndsAt: license.trialEndsAt,
        limits: license.limits
      },
      pages: pages.map(publicPage),
      activePage: publicPage(pages.find(page => page.isSelected) || null),
      summary: summariseStatusRows(statusRows),
      phase: '10.0'
    });
  } catch (error) {
    next(error);
  }
}

async function listJobs(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    const input = z.object({
      status: z.enum(Object.values(JOB_STATUS)).optional(),
      limit: z.coerce.number().int().min(1).max(250).default(100)
    }).parse(req.query);
    const jobs = await prisma.scheduleJob.findMany({
      where: { userId: req.user.id, origin: 'CLOUD', ...(input.status ? { status: input.status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: input.limit,
      include: { connectedPage: true, cloudAsset: true }
    });
    res.json({ jobs: jobs.map(publicJob) });
  } catch (error) {
    next(error);
  }
}

async function createDraft(req, res, next) {
  try {
    const input = draftSchema.parse(req.body);
    const license = await requireStudioLicense(req.user.id);
    if (input.clientRequestId) {
      const existing = await prisma.scheduleJob.findUnique({
        where: { userId_clientRequestId: { userId: req.user.id, clientRequestId: input.clientRequestId } },
        include: { connectedPage: true, cloudAsset: true }
      });
      if (existing) return res.status(200).json({ job: publicJob(existing), idempotent: true });
    }

    const currentBatchSize = await prisma.scheduleJob.count({
      where: {
        userId: req.user.id,
        origin: 'CLOUD',
        status: { in: [JOB_STATUS.DRAFT, JOB_STATUS.AWAITING_UPLOAD, JOB_STATUS.READY, JOB_STATUS.QUEUED, JOB_STATUS.PROCESSING] }
      }
    });
    if (license.limits.batchPosts !== null && currentBatchSize >= license.limits.batchPosts) {
      const error = new Error(`Your ${license.plan} plan allows ${license.limits.batchPosts} active cloud jobs per batch.`);
      error.status = 403;
      error.publicMessage = error.message;
      throw error;
    }

    const page = await resolvePage(req.user.id, input.connectedPageId);
    const immediate = input.publishMode === 'NOW';
    const scheduledAt = immediate ? null : validateScheduleTime(input.scheduledAt);
    if (!immediate && !scheduledAt) {
      const error = new Error('Choose a future date and time before creating the upload.');
      error.status = 400;
      error.publicMessage = error.message;
      throw error;
    }

    const protectedStatuses = [
      JOB_STATUS.PROCESSING,
      JOB_STATUS.SCHEDULED,
      JOB_STATUS.PUBLISHED
    ];
    const duplicateCandidates = await prisma.scheduleJob.findMany({
      where: {
        userId: req.user.id,
        connectedPageId: page.id,
        origin: 'CLOUD',
        localFileName: input.originalFileName,
        status: { in: protectedStatuses }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const duplicateFile = duplicateCandidates.find(job => isDuplicateProtectedJob(job));
    if (duplicateFile) {
      const error = new Error(`${input.originalFileName} is already processing, scheduled, or published for this Page${duplicateFile.scheduledAt ? ` at ${duplicateFile.scheduledAt.toISOString()}` : ''}. Failed attempts may be retried.`);
      error.status = 409;
      error.publicMessage = error.message;
      throw error;
    }

    if (scheduledAt) {
      const occupiedCandidates = await prisma.scheduleJob.findMany({
        where: {
          userId: req.user.id,
          connectedPageId: page.id,
          origin: 'CLOUD',
          scheduledAt,
          status: { in: protectedStatuses }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      const occupiedSlot = occupiedCandidates.find(job => isDuplicateProtectedJob(job));
      if (occupiedSlot) {
        const error = new Error(`This Page already has ${occupiedSlot.localFileName || 'a video'} assigned to ${scheduledAt.toISOString()}. Choose another time.`);
        error.status = 409;
        error.publicMessage = error.message;
        throw error;
      }
    }

    const fileSizeBytes = normaliseFileSize(input.fileSizeBytes);
    const job = await prisma.scheduleJob.create({
      data: {
        userId: req.user.id,
        connectedPageId: page.id,
        status: JOB_STATUS.AWAITING_UPLOAD,
        origin: 'CLOUD',
        uploadStatus: ASSET_STATUS.AWAITING_UPLOAD,
        publishMode: immediate ? 'NOW' : 'SCHEDULED',
        clientRequestId: input.clientRequestId || null,
        contentType: 'VIDEO',
        title: input.title || null,
        caption: input.caption || null,
        localFileName: input.originalFileName,
        scheduledAt,
        cloudAsset: {
          create: {
            userId: req.user.id,
            provider: 'TEMPORARY_STREAM',
            originalFileName: input.originalFileName,
            mimeType: input.mimeType || 'application/octet-stream',
            fileSizeBytes,
            status: ASSET_STATUS.AWAITING_UPLOAD
          }
        }
      },
      include: { connectedPage: true, cloudAsset: true }
    });
    res.status(201).json({
      job: publicJob(job),
      uploadAvailable: true,
      uploadUrl: `/api/studio/jobs/${job.id}/video`
    });
  } catch (error) {
    next(error);
  }
}

async function createDirectPosts(req, res, next) {
  try {
    const input = directPostSchema.parse(req.body);
    const license = await requireStudioLicense(req.user.id);
    const pages = await resolvePages(req.user.id, input.connectedPageIds, true);
    const immediate = input.publishMode === 'NOW';
    const scheduledAt = immediate ? null : validateScheduleTime(input.scheduledAt);
    if (!immediate && !scheduledAt) {
      const error = new Error('Choose a future date and time before scheduling this post.');
      error.status = 400;
      error.publicMessage = error.message;
      throw error;
    }
    const currentBatchSize = await prisma.scheduleJob.count({ where: { userId: req.user.id, origin: 'CLOUD', status: { in: [JOB_STATUS.DRAFT, JOB_STATUS.AWAITING_UPLOAD, JOB_STATUS.READY, JOB_STATUS.QUEUED, JOB_STATUS.PROCESSING] } } });
    if (license.limits.batchPosts !== null && currentBatchSize + pages.length > license.limits.batchPosts) {
      const error = new Error(`This post would exceed the ${license.limits.batchPosts}-item active publishing limit for your ${license.plan} plan.`);
      error.status = 403;
      error.publicMessage = error.message;
      throw error;
    }
    let libraryAsset = null;
    if (input.mediaLibraryAssetId) {
      libraryAsset = await prisma.agentAsset.findFirst({ where: { id: input.mediaLibraryAssetId, userId: req.user.id, status: 'READY', archivedAt: null }, select: { id: true, originalName: true, mimeType: true, byteSize: true } });
      if (!libraryAsset) {
        const error = new Error('The selected Media Library asset is unavailable. Restore it or choose another file.');
        error.status = 404;
        error.publicMessage = error.message;
        throw error;
      }
      const libraryType = String(libraryAsset.mimeType || '').startsWith('video/') ? 'VIDEO' : 'IMAGE';
      if (libraryType !== input.contentType) {
        const error = new Error('The Media Library asset type does not match this post.');
        error.status = 400;
        error.publicMessage = error.message;
        throw error;
      }
    }
    const fileSizeBytes = input.contentType === 'TEXT' ? null : libraryAsset ? BigInt(libraryAsset.byteSize) : normaliseFileSize(input.fileSizeBytes);
    if (input.contentType === 'IMAGE' && fileSizeBytes > MAX_DIRECT_IMAGE_BYTES) {
      const error = new Error('Post images must be no larger than 15 MB.');
      error.status = 413;
      error.publicMessage = error.message;
      throw error;
    }
    const jobs = [];
    const failures = [];
    for (const page of pages) {
      const clientRequestId = `${input.clientRequestId}:${page.id}`.slice(0, 100);
      const existing = await prisma.scheduleJob.findUnique({ where: { userId_clientRequestId: { userId: req.user.id, clientRequestId } }, include: { connectedPage: true, cloudAsset: true } });
      if (existing) { jobs.push(publicJob(existing)); continue; }
      const media = input.contentType !== 'TEXT';
      let job = await prisma.scheduleJob.create({
        data: {
          userId: req.user.id,
          connectedPageId: page.id,
          status: media ? JOB_STATUS.AWAITING_UPLOAD : JOB_STATUS.PROCESSING,
          origin: 'CLOUD',
          uploadStatus: media ? ASSET_STATUS.AWAITING_UPLOAD : 'NOT_REQUIRED',
          publishMode: input.publishMode,
          clientRequestId,
          contentType: input.contentType,
          title: input.title || null,
          caption: input.caption,
          localFileName: media ? libraryAsset?.originalName || input.originalFileName : null,
          mediaLibraryAssetId: libraryAsset?.id || null,
          scheduledAt,
          attemptCount: media ? 0 : 1,
          claimedAt: media ? null : new Date(),
          ...(media ? { cloudAsset: { create: { userId: req.user.id, provider: libraryAsset ? 'MEDIA_LIBRARY' : 'TEMPORARY_STREAM', originalFileName: libraryAsset?.originalName || input.originalFileName, mimeType: libraryAsset?.mimeType || input.mimeType || 'application/octet-stream', fileSizeBytes, status: ASSET_STATUS.AWAITING_UPLOAD } } } : {})
        },
        include: { connectedPage: true, cloudAsset: true }
      });
      if (!media) {
        try {
          const published = await metaPublisher.publishOrganicPost({ pageId: page.facebookPageId, pageAccessToken: decryptToken(page.encryptedAccessToken), caption: input.caption, scheduledAt, publishMode: input.publishMode });
          job = await prisma.scheduleJob.update({ where: { id: job.id }, data: { status: immediate ? JOB_STATUS.PUBLISHED : JOB_STATUS.SCHEDULED, completedAt: new Date(), claimedAt: null, metaPostId: published.postId, rawMetaResponse: JSON.stringify({ ...(published.response || {}), verification: { state: immediate ? 'PUBLISHED' : 'SCHEDULED', confirmedAt: new Date().toISOString() } }) }, include: { connectedPage: true, cloudAsset: true } });
        } catch (error) {
          const message = String(error.publicMessage || error.message || 'Facebook publishing failed.').slice(0, 1000);
          job = await prisma.scheduleJob.update({ where: { id: job.id }, data: { status: JOB_STATUS.FAILED, claimedAt: null, errorMessage: message }, include: { connectedPage: true, cloudAsset: true } });
          failures.push({ pageId: page.id, pageName: page.facebookPageName, error: message });
        }
      }
      jobs.push(publicJob(job));
    }
    res.status(failures.length ? 207 : 201).json({ jobs, failures, uploadRequired: input.contentType !== 'TEXT' });
  } catch (error) { next(error); }
}

async function uploadDirectPostMedia(req, res, next) {
  let tempPath = null;
  let existing = null;
  try {
    await requireStudioLicense(req.user.id);
    existing = await prisma.scheduleJob.findFirst({ where: { id: req.params.id, userId: req.user.id, origin: 'CLOUD', contentType: { in: ['IMAGE', 'VIDEO'] } }, include: { connectedPage: true, cloudAsset: true } });
    if (!existing?.cloudAsset) return res.status(404).json({ error: 'Direct post upload was not found.' });
    const contentType = String(req.headers['content-type'] || '');
    const image = existing.contentType === 'IMAGE';
    if (image ? !/^image\/(png|jpeg|webp)$/i.test(contentType) : !/^video\/|^application\/octet-stream$/i.test(contentType)) return res.status(415).json({ error: image ? 'Upload a PNG, JPEG or WebP image.' : 'Upload a supported video file.' });
    const contentLength = req.headers['content-length'] ? BigInt(req.headers['content-length']) : null;
    const declaredSize = existing.cloudAsset.fileSizeBytes || null;
    const maximum = image ? MAX_DIRECT_IMAGE_BYTES : MAX_CLOUD_FILE_BYTES;
    if (!contentLength || contentLength <= 0n) return res.status(411).json({ error: 'The browser must send the media Content-Length.' });
    if (contentLength > maximum || (declaredSize && contentLength !== declaredSize)) return res.status(413).json({ error: 'Media size does not match the prepared upload or exceeds the allowed limit.' });
    const claimed = await prisma.scheduleJob.updateMany({ where: { id: existing.id, userId: req.user.id, status: { in: [JOB_STATUS.AWAITING_UPLOAD, JOB_STATUS.FAILED] } }, data: { status: JOB_STATUS.PROCESSING, uploadStatus: ASSET_STATUS.UPLOADING, attemptCount: { increment: 1 }, claimedAt: new Date(), errorMessage: null } });
    if (claimed.count !== 1) return res.status(409).json({ error: 'This media upload is already processing or complete.' });
    await prisma.cloudAsset.update({ where: { id: existing.cloudAsset.id }, data: { status: ASSET_STATUS.UPLOADING } });
    const suffix = path.extname(existing.cloudAsset.originalFileName || '').slice(0, 12);
    tempPath = path.join(os.tmpdir(), `inx-social-direct-${crypto.randomUUID()}${suffix}`);
    const received = await receiveTemporaryVideo(req, tempPath, maximum);
    if (received !== contentLength) throw new Error('The media upload ended before all bytes arrived.');
    const page = await resolvePage(req.user.id, existing.connectedPageId, true);
    const immediate = existing.publishMode === 'NOW';
    const result = image
      ? await metaPublisher.publishOrganicPost({ pageId: page.facebookPageId, pageAccessToken: decryptToken(page.encryptedAccessToken), caption: existing.caption, scheduledAt: existing.scheduledAt, publishMode: existing.publishMode, asset: { data: await fs.promises.readFile(tempPath), mimeType: contentType, originalName: existing.cloudAsset.originalFileName } })
      : await metaPublisher.publishReel({ pageId: page.facebookPageId, pageAccessToken: decryptToken(page.encryptedAccessToken), filePath: tempPath, fileSize: Number(received), caption: existing.caption, scheduledAt: existing.scheduledAt, publishMode: existing.publishMode });
    const job = await prisma.scheduleJob.update({ where: { id: existing.id }, data: { status: immediate ? JOB_STATUS.PUBLISHED : JOB_STATUS.SCHEDULED, uploadStatus: ASSET_STATUS.DELETED, completedAt: new Date(), claimedAt: null, metaPostId: result.postId, metaVideoId: result.videoId || null, rawMetaResponse: JSON.stringify({ ...(result.response || result.finish || {}), verification: { state: immediate ? 'PUBLISHED' : 'SCHEDULED', confirmedAt: new Date().toISOString() } }) }, include: { connectedPage: true, cloudAsset: true } });
    await prisma.cloudAsset.update({ where: { id: existing.cloudAsset.id }, data: { status: ASSET_STATUS.DELETED } });
    res.status(202).json({ job: publicJob(job), accepted: true, published: immediate, scheduled: !immediate });
  } catch (error) {
    if (existing) {
      const message = String(error.publicMessage || error.message || 'Media publishing failed.').slice(0, 1000);
      await prisma.scheduleJob.update({ where: { id: existing.id }, data: { status: JOB_STATUS.FAILED, uploadStatus: ASSET_STATUS.FAILED, claimedAt: null, errorMessage: message } }).catch(() => {});
      if (existing.cloudAsset) await prisma.cloudAsset.update({ where: { id: existing.cloudAsset.id }, data: { status: ASSET_STATUS.FAILED } }).catch(() => {});
      error.publicMessage = message;
    }
    next(error);
  } finally {
    if (tempPath) { try { await fs.promises.unlink(tempPath); } catch (_) {} }
  }
}

async function publishDirectPostLibraryMedia(req, res, next) {
  let tempPath = null;
  let existing = null;
  try {
    await requireStudioLicense(req.user.id);
    existing = await prisma.scheduleJob.findFirst({ where: { id: req.params.id, userId: req.user.id, origin: 'CLOUD', mediaLibraryAssetId: { not: null }, contentType: { in: ['IMAGE', 'VIDEO'] } }, include: { connectedPage: true, cloudAsset: true } });
    if (!existing?.cloudAsset || existing.cloudAsset.provider !== 'MEDIA_LIBRARY') return res.status(404).json({ error: 'Reusable Media Library publishing job was not found.' });
    const claimed = await prisma.scheduleJob.updateMany({ where: { id: existing.id, userId: req.user.id, status: { in: [JOB_STATUS.AWAITING_UPLOAD, JOB_STATUS.FAILED] } }, data: { status: JOB_STATUS.PROCESSING, uploadStatus: ASSET_STATUS.UPLOADING, attemptCount: { increment: 1 }, claimedAt: new Date(), errorMessage: null } });
    if (claimed.count !== 1) return res.status(409).json({ error: 'This reusable media job is already processing or complete.' });
    await prisma.cloudAsset.update({ where: { id: existing.cloudAsset.id }, data: { status: ASSET_STATUS.UPLOADING } });
    const asset = await mediaLibrary.findContent(req.user.id, existing.mediaLibraryAssetId);
    if (!asset) throw new Error('The linked Media Library asset is unavailable. Restore it before publishing.');
    const image = existing.contentType === 'IMAGE';
    if (image ? !/^image\/(png|jpeg|webp)$/i.test(asset.mimeType) : !/^video\//i.test(asset.mimeType)) throw new Error('The linked Media Library file format no longer matches this post.');
    const page = await resolvePage(req.user.id, existing.connectedPageId, true);
    const immediate = existing.publishMode === 'NOW';
    let result;
    if (image) {
      result = await metaPublisher.publishOrganicPost({ pageId: page.facebookPageId, pageAccessToken: decryptToken(page.encryptedAccessToken), caption: existing.caption, scheduledAt: existing.scheduledAt, publishMode: existing.publishMode, asset: { data: asset.data, mimeType: asset.mimeType, originalName: asset.originalName } });
    } else {
      const suffix = path.extname(asset.originalName || '').slice(0, 12);
      tempPath = path.join(os.tmpdir(), `inx-social-library-${crypto.randomUUID()}${suffix}`);
      await fs.promises.writeFile(tempPath, asset.data);
      result = await metaPublisher.publishReel({ pageId: page.facebookPageId, pageAccessToken: decryptToken(page.encryptedAccessToken), filePath: tempPath, fileSize: asset.data.length, caption: existing.caption, scheduledAt: existing.scheduledAt, publishMode: existing.publishMode });
    }
    const job = await prisma.scheduleJob.update({ where: { id: existing.id }, data: { status: immediate ? JOB_STATUS.PUBLISHED : JOB_STATUS.SCHEDULED, uploadStatus: ASSET_STATUS.READY, completedAt: new Date(), claimedAt: null, metaPostId: result.postId, metaVideoId: result.videoId || null, rawMetaResponse: JSON.stringify({ ...(result.response || result.finish || {}), verification: { state: immediate ? 'PUBLISHED' : 'SCHEDULED', confirmedAt: new Date().toISOString(), mediaSource: 'MEDIA_LIBRARY' } }) }, include: { connectedPage: true, cloudAsset: true } });
    await prisma.cloudAsset.update({ where: { id: existing.cloudAsset.id }, data: { status: ASSET_STATUS.READY } });
    res.status(202).json({ job: publicJob(job), accepted: true, published: immediate, scheduled: !immediate, reusableMedia: true });
  } catch (error) {
    if (existing) {
      const message = String(error.publicMessage || error.message || 'Reusable media publishing failed.').slice(0, 1000);
      await prisma.scheduleJob.update({ where: { id: existing.id }, data: { status: JOB_STATUS.FAILED, uploadStatus: ASSET_STATUS.FAILED, claimedAt: null, errorMessage: message } }).catch(() => {});
      if (existing.cloudAsset) await prisma.cloudAsset.update({ where: { id: existing.cloudAsset.id }, data: { status: ASSET_STATUS.FAILED } }).catch(() => {});
      error.publicMessage = message;
    }
    next(error);
  } finally {
    if (tempPath) { try { await fs.promises.unlink(tempPath); } catch (_) {} }
  }
}

async function updateDraft(req, res, next) {
  try {
    const input = updateSchema.parse(req.body);
    await requireStudioLicense(req.user.id);
    const existing = await prisma.scheduleJob.findFirst({
      where: { id: req.params.id, userId: req.user.id, origin: 'CLOUD' }
    });
    if (!existing) return res.status(404).json({ error: 'Cloud job not found.' });
    if (!EDITABLE_STATUSES.has(existing.status)) {
      return res.status(409).json({ error: `A ${existing.status.toLowerCase()} job can no longer be edited.` });
    }
    const data = {};
    if (Object.hasOwn(input, 'connectedPageId')) data.connectedPageId = (await resolvePage(req.user.id, input.connectedPageId)).id;
    if (Object.hasOwn(input, 'title')) data.title = input.title || null;
    if (Object.hasOwn(input, 'caption')) data.caption = input.caption || null;
    if (Object.hasOwn(input, 'scheduledAt')) data.scheduledAt = validateScheduleTime(input.scheduledAt);
    const job = await prisma.scheduleJob.update({
      where: { id: existing.id },
      data,
      include: { connectedPage: true, cloudAsset: true }
    });
    res.json({ job: publicJob(job) });
  } catch (error) {
    next(error);
  }
}

async function receiveTemporaryVideo(req, destination, maximumBytes) {
  let received = 0n;
  const meter = new Transform({
    transform(chunk, encoding, callback) {
      received += BigInt(chunk.length);
      if (received > maximumBytes) {
        const error = new Error('The uploaded video is larger than the declared or maximum allowed size.');
        error.status = 413;
        return callback(error);
      }
      callback(null, chunk);
    }
  });
  await pipeline(req, meter, fs.createWriteStream(destination, { flags: 'wx' }));
  return received;
}

async function uploadVideo(req, res, next) {
  let tempPath = null;
  let claimedJob = null;
  let metaAcceptedResult = null;
  try {
    await requireStudioLicense(req.user.id);
    if (!/^video\/|^application\/octet-stream$/i.test(String(req.headers['content-type'] || ''))) {
      return res.status(415).json({ error: 'Upload the video as video/* or application/octet-stream.' });
    }
    const existing = await prisma.scheduleJob.findFirst({
      where: { id: req.params.id, userId: req.user.id, origin: 'CLOUD' },
      include: { connectedPage: true, cloudAsset: true }
    });
    if (!existing) return res.status(404).json({ error: 'Cloud job not found.' });
    if (!existing.cloudAsset) return res.status(409).json({ error: 'Cloud job has no upload record.' });
    const immediate = existing.publishMode === 'NOW';
    if (!immediate) validateScheduleTime(existing.scheduledAt);

    const declaredSize = existing.cloudAsset.fileSizeBytes || null;
    const contentLength = req.headers['content-length'] ? BigInt(req.headers['content-length']) : null;
    if (!contentLength || contentLength <= 0n) {
      return res.status(411).json({ error: 'The browser must send the video Content-Length.' });
    }
    if (contentLength > MAX_CLOUD_FILE_BYTES || (declaredSize && contentLength !== declaredSize)) {
      return res.status(413).json({ error: 'Video size does not match the prepared upload or exceeds 10 GB.' });
    }

    const claimed = await prisma.scheduleJob.updateMany({
      where: {
        id: existing.id,
        userId: req.user.id,
        status: { in: [JOB_STATUS.AWAITING_UPLOAD, JOB_STATUS.FAILED] }
      },
      data: {
        status: JOB_STATUS.PROCESSING,
        uploadStatus: ASSET_STATUS.UPLOADING,
        attemptCount: { increment: 1 },
        claimedAt: new Date(),
        errorMessage: null
      }
    });
    if (claimed.count !== 1) {
      return res.status(409).json({ error: 'This video upload is already processing or completed.' });
    }
    await prisma.cloudAsset.update({
      where: { id: existing.cloudAsset.id },
      data: { status: ASSET_STATUS.UPLOADING }
    });
    claimedJob = existing;

    const suffix = path.extname(existing.cloudAsset.originalFileName || '').slice(0, 12);
    tempPath = path.join(os.tmpdir(), `inx-social-${crypto.randomUUID()}${suffix}`);
    const received = await receiveTemporaryVideo(req, tempPath, declaredSize || MAX_CLOUD_FILE_BYTES);
    if (received !== contentLength) throw new Error('The video upload ended before all bytes arrived.');

    const page = await resolvePage(req.user.id, existing.connectedPageId, true);
    const result = await metaPublisher.publishReel({
      pageId: page.facebookPageId,
      pageAccessToken: decryptToken(page.encryptedAccessToken),
      filePath: tempPath,
      fileSize: Number(received),
      caption: existing.caption,
      scheduledAt: existing.scheduledAt,
      publishMode: immediate ? 'NOW' : 'SCHEDULED'
    });
    metaAcceptedResult = result;

    const [job, asset] = await prisma.$transaction([
      prisma.scheduleJob.update({
        where: { id: existing.id },
        data: {
          status: JOB_STATUS.PROCESSING,
          uploadStatus: ASSET_STATUS.DELETED,
          metaPostId: result.postId,
          metaVideoId: result.videoId,
          rawMetaResponse: JSON.stringify({
            ...result,
            verification: {
              state: 'PROCESSING',
              acceptedAt: new Date().toISOString(),
              confirmedAt: null
            }
          }),
          caption: null,
          completedAt: null,
          nextAttemptAt: new Date(Date.now() + 15000),
          claimedAt: null,
          errorMessage: null
        },
        include: { connectedPage: true, cloudAsset: true }
      }),
      prisma.cloudAsset.update({
        where: { id: existing.cloudAsset.id },
        data: { status: ASSET_STATUS.DELETED }
      })
    ]);
    job.cloudAsset = asset;
    res.status(202).json({ job: publicJob(job), accepted: true, processing: true, scheduled: false, published: false });
  } catch (error) {
    if (claimedJob) {
      try {
        const acceptedByMeta = Boolean(metaAcceptedResult?.videoId);
        await prisma.$transaction([
          prisma.scheduleJob.update({
            where: { id: claimedJob.id },
            data: acceptedByMeta ? {
              status: JOB_STATUS.PROCESSING,
              uploadStatus: ASSET_STATUS.DELETED,
              metaPostId: metaAcceptedResult.postId,
              metaVideoId: metaAcceptedResult.videoId,
              rawMetaResponse: JSON.stringify({
                ...metaAcceptedResult,
                verification: {
                  state: 'PROCESSING',
                  acceptedAt: new Date().toISOString(),
                  confirmedAt: null,
                  localFinalisationError: String(error.message || error)
                }
              }),
              caption: null,
              completedAt: null,
              nextAttemptAt: new Date(Date.now() + 15000),
              claimedAt: null,
              errorMessage: null
            } : {
              status: JOB_STATUS.FAILED,
              caption: null,
              uploadStatus: ASSET_STATUS.FAILED,
              claimedAt: null,
              errorMessage: String(error.publicMessage || error.message || 'Upload failed').slice(0, 2000)
            }
          }),
          prisma.cloudAsset.update({
            where: { id: claimedJob.cloudAsset.id },
            data: { status: acceptedByMeta ? ASSET_STATUS.DELETED : ASSET_STATUS.FAILED }
          })
        ]);
      } catch (_) {}
    }
    if (!error.publicMessage) {
      error.publicMessage = String(error.message || 'Video upload failed.').slice(0, 1000);
    }
    next(error);
  } finally {
    if (tempPath) {
      try { await fs.promises.unlink(tempPath); } catch (_) {}
    }
  }
}

async function testActivePage(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    const page = await resolvePage(req.user.id, null, true);
    const result = await metaPublisher.testPage({
      pageId: page.facebookPageId,
      pageAccessToken: decryptToken(page.encryptedAccessToken)
    });
    res.json({ result, activePage: { id: result.id, name: result.name } });
  } catch (error) {
    next(error);
  }
}

async function scheduledPosts(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    const page = await resolvePage(req.user.id, req.query?.connectedPageId || null, true);
    const result = await metaPublisher.listScheduledPosts({
      pageId: page.facebookPageId,
      pageAccessToken: decryptToken(page.encryptedAccessToken)
    });
    res.json({ result });
  } catch (error) {
    next(error);
  }
}

async function enhancePostCaption(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    const input = postEnhancementSchema.parse(req.body || {});
    const result = await postEnhancement.enhanceCaption(input);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function mediaLibraryWorkspace(req, res, next) {
  try {
    const license = await requireStudioLicense(req.user.id);
    res.json(await mediaLibrary.workspace(req.user.id, license.plan));
  } catch (error) { next(error); }
}

async function uploadMediaLibraryAsset(req, res, next) {
  try {
    const license = await requireStudioLicense(req.user.id);
    let fileName = String(req.headers['x-file-name'] || 'media-asset');
    try { fileName = decodeURIComponent(fileName); } catch (_) {}
    const asset = await mediaLibrary.upload(req.user.id, license.plan, {
      data: req.body,
      fileName,
      mimeType: req.headers['content-type'],
      folderId: req.headers['x-folder-id'] || null
    });
    res.status(201).json({ asset });
  } catch (error) { next(error); }
}

async function mediaLibraryAssetContent(req, res, next) {
  try {
    const userId = mediaLibrary.verifyContentAccess(req.query.access, req.params.id);
    const asset = await mediaLibrary.findContent(userId, req.params.id, { includeArchived: true });
    if (!asset) return res.status(404).json({ error: 'Media asset not found.' });
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', asset.data.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('ETag', `"${asset.checksum}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (String(req.query.download || '') === '1') res.setHeader('Content-Disposition', `attachment; filename="${String(asset.originalName || 'media-asset').replace(/["\\]/g, '')}"`);
    return res.end(asset.data);
  } catch (error) { next(error); }
}

async function createMediaLibraryFolder(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    const input = mediaFolderSchema.parse(req.body || {});
    res.status(201).json({ folder: await mediaLibrary.createFolder(req.user.id, input.name) });
  } catch (error) { next(error); }
}

async function renameMediaLibraryAsset(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    const input = mediaRenameSchema.parse(req.body || {});
    res.json({ asset: await mediaLibrary.rename(req.user.id, req.params.id, input.fileName) });
  } catch (error) { next(error); }
}

async function duplicateMediaLibraryAsset(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    res.status(201).json({ asset: await mediaLibrary.duplicate(req.user.id, req.params.id) });
  } catch (error) { next(error); }
}

async function archiveMediaLibraryAsset(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    await mediaLibrary.archive(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (error) { next(error); }
}

async function restoreMediaLibraryAsset(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    await mediaLibrary.restore(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (error) { next(error); }
}

async function purgeMediaLibraryAsset(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    await mediaLibrary.purge(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (error) { next(error); }
}

async function cancelJob(req, res, next) {
  try {
    await requireStudioLicense(req.user.id);
    const existing = await prisma.scheduleJob.findFirst({
      where: { id: req.params.id, userId: req.user.id, origin: 'CLOUD' },
      include: { cloudAsset: true }
    });
    if (!existing) return res.status(404).json({ error: 'Cloud job not found.' });
    if (TERMINAL_STATUSES.has(existing.status)) {
      return res.status(409).json({ error: `This job is already ${existing.status.toLowerCase()}.` });
    }
    if ([JOB_STATUS.PROCESSING, JOB_STATUS.SCHEDULED].includes(existing.status)) {
      return res.status(409).json({ error: 'A processing or Meta-scheduled job cannot be cancelled here.' });
    }
    const operations = [
      prisma.scheduleJob.update({
        where: { id: existing.id },
        data: { status: JOB_STATUS.CANCELLED, caption: null, completedAt: new Date(), nextAttemptAt: null, errorMessage: null },
        include: { connectedPage: true, cloudAsset: true }
      })
    ];
    if (existing.cloudAsset) {
      operations.push(prisma.cloudAsset.update({
        where: { id: existing.cloudAsset.id },
        data: { status: ASSET_STATUS.DELETED }
      }));
    }
    const [job, asset] = await prisma.$transaction(operations);
    if (asset) job.cloudAsset = asset;
    res.json({ job: publicJob(job) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  capabilities,
  desktopState,
  facebookAnalytics,
  savePreferences,
  resetUiTexts,
  overview,
  listJobs,
  createDraft,
  createDirectPosts,
  uploadDirectPostMedia,
  publishDirectPostLibraryMedia,
  updateDraft,
  uploadVideo,
  testActivePage,
  scheduledPosts,
  enhancePostCaption,
  mediaLibraryWorkspace,
  uploadMediaLibraryAsset,
  mediaLibraryAssetContent,
  createMediaLibraryFolder,
  renameMediaLibraryAsset,
  duplicateMediaLibraryAsset,
  archiveMediaLibraryAsset,
  restoreMediaLibraryAsset,
  purgeMediaLibraryAsset,
  cancelJob,
  publicJob,
  desktopJob,
  isDuplicateProtectedJob,
  resolvePages,
  pagePicture
};
