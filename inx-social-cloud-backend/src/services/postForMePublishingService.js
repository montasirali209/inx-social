const axios = require('axios');
const prisma = require('../db/prisma');
const postForMe = require('./postForMeService');
const mediaLibrary = require('./mediaLibraryService');
const { getLicenseStatus } = require('./licenseService');

const MAX_DIRECT_UPLOAD_BYTES = 10 * 1024 * 1024 * 1024;
const TERMINAL_STATUSES = new Set(['PUBLISHED', 'FAILED', 'CANCELLED']);

function json(value, fallback = {}) {
  return postForMe.parseJson(value, fallback);
}

function cleanText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

function publicationId(value) {
  const raw = String(value || '');
  return raw.startsWith('pfm:') ? raw.slice(4) : raw;
}

function providerAccountId(profile) {
  const metadata = json(profile.metadataJson, {});
  return String(metadata.postForMeAccountId || profile.externalProfileId || '');
}

function validateScheduledAt(value) {
  if (value === null || value === undefined || value === '') return null;
  const scheduledAt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw Object.assign(new Error('Choose a valid publishing date and time.'), { status: 400, publicMessage: 'Choose a valid publishing date and time.' });
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw Object.assign(new Error('Choose a publishing time in the future.'), { status: 400, publicMessage: 'Choose a publishing time in the future.' });
  }
  return scheduledAt.toISOString();
}

async function resolveProfiles(userId, profileIds) {
  const requested = [...new Set((profileIds || []).map(String).filter(Boolean))];
  if (!requested.length) throw Object.assign(new Error('Choose at least one publishing destination.'), { status: 400 });
  const profiles = await prisma.socialProfile.findMany({
    where: { id: { in: requested }, userId, status: 'ACTIVE' },
    include: { connection: true }
  });
  const valid = profiles.filter((profile) => {
    const connectionMetadata = json(profile.connection?.metadataJson, {});
    const profileMetadata = json(profile.metadataJson, {});
    return connectionMetadata.providerEngine === postForMe.PROVIDER_ENGINE
      && profileMetadata.providerEngine === postForMe.PROVIDER_ENGINE
      && providerAccountId(profile);
  });
  const found = new Set(valid.map((profile) => profile.id));
  const missing = requested.filter((id) => !found.has(id));
  return { profiles: valid, missing };
}

function mediaMetadata(input) {
  return {
    providerEngine: postForMe.PROVIDER_ENGINE,
    contentType: String(input.contentType || 'TEXT').toUpperCase(),
    originalFileName: input.originalFileName || null,
    mimeType: input.mimeType || null,
    fileSizeBytes: input.fileSizeBytes == null ? null : Number(input.fileSizeBytes),
    mediaLibraryAssetId: input.mediaLibraryAssetId || null,
    mediaLibraryAssetIds: Array.isArray(input.mediaLibraryAssetIds) ? input.mediaLibraryAssetIds : null,
    providerMedia: null,
    providerPostStatus: null
  };
}

function buildPlatformConfigurations(profiles, input) {
  const platforms = new Set(profiles.map((profile) => profile.platform));
  const result = { ...(input.platformConfigurations || {}) };
  const title = cleanText(input.title || input.caption, 100) || 'INXSocial post';

  if (platforms.has('youtube')) {
    result.youtube = {
      localizations: {},
      title,
      description: cleanText(input.caption, 5000),
      privacy_status: 'public',
      ...(result.youtube || {})
    };
  }
  if (platforms.has('pinterest')) {
    result.pinterest = { title: cleanText(input.title || input.caption, 100), ...(result.pinterest || {}) };
  }
  if (platforms.has('tiktok')) {
    result.tiktok = { title: cleanText(input.title || input.caption, 150), ...(result.tiktok || {}) };
  }
  return Object.keys(result).length ? result : undefined;
}

async function findOrCreateContent(userId, input, profiles) {
  const key = cleanText(input.clientRequestId, 255) || `pfm-${Date.now()}`;
  const existing = await prisma.socialPublication.findMany({
    where: { profileId: { in: profiles.map((profile) => profile.id) }, idempotencyKey: key },
    include: { content: true, profile: true }
  });
  if (existing.length) return { content: existing[0].content, existing, key };

  const content = await prisma.socialContent.create({
    data: {
      userId,
      title: cleanText(input.title, 200) || null,
      caption: cleanText(input.caption, 5000),
      status: 'DRAFT',
      approvalStatus: 'NOT_REQUIRED',
      source: input.source || 'MANUAL'
    }
  });
  return { content, existing: [], key };
}

async function createPublicationRows(userId, input) {
  const scheduledAt = validateScheduledAt(input.scheduledAt);
  input = { ...input, scheduledAt };
  await postForMe.syncConnections(userId);
  const requestedIds = input.profileIds || input.connectedPageIds || [];
  const { profiles, missing } = await resolveProfiles(userId, requestedIds);
  if (!profiles.length) {
    throw Object.assign(new Error('None of the selected destinations is connected through Post for Me.'), { status: 400 });
  }

  const { content, existing, key } = await findOrCreateContent(userId, input, profiles);
  const existingByProfile = new Map(existing.map((publication) => [publication.profileId, publication]));

  const license = await getLicenseStatus(userId);
  const trialLimit = license.limits?.publishedPostsPerTrial;
  const isAdministrator = ['ADMIN', 'SUPER_ADMIN'].includes(String(license.userRole || '').toUpperCase());
  if (!isAdministrator && String(license.plan || '').toUpperCase() === 'TRIAL' && Number.isFinite(trialLimit)) {
    const newDestinationCount = profiles.filter(profile => !existingByProfile.has(profile.id)).length;
    if (newDestinationCount > 0) {
      const trialStart = license.trialStartsAt ? new Date(license.trialStartsAt) : new Date(Date.now() - (7 * 86400000));
      const submitted = await prisma.socialPublication.count({
        where: {
          profile: { userId },
          externalPostId: { not: null },
          createdAt: { gte: trialStart }
        }
      });
      if (submitted + newDestinationCount > Number(trialLimit)) {
        const remaining = Math.max(0, Number(trialLimit) - submitted);
        const message = remaining
          ? `Your Trial has ${remaining} publishing destination${remaining === 1 ? '' : 's'} remaining. Reduce the selected destinations or upgrade your plan.`
          : `You have used all ${trialLimit} Trial publishing destinations. Upgrade in Billing & Plans to continue publishing.`;
        throw Object.assign(new Error(message), {
          status: 402,
          publicMessage: message,
          code: 'TRIAL_PUBLISHING_LIMIT_REACHED'
        });
      }
    }
  }

  const meta = mediaMetadata(input);
  const rows = [];

  for (const profile of profiles) {
    const prior = existingByProfile.get(profile.id);
    if (prior) {
      rows.push(prior);
      continue;
    }
    rows.push(await prisma.socialPublication.create({
      data: {
        contentId: content.id,
        profileId: profile.id,
        platform: profile.platform,
        status: meta.contentType === 'TEXT' || meta.mediaLibraryAssetId || meta.mediaLibraryAssetIds?.length ? 'READY' : 'AWAITING_MEDIA',
        platformCaption: cleanText(input.caption, 5000),
        mediaJson: JSON.stringify(meta),
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        idempotencyKey: key
      },
      include: { profile: true, content: true }
    }));
  }

  return {
    content,
    publications: rows,
    profiles,
    input,
    failures: missing.map((id) => ({ pageId: id, pageName: 'Unavailable destination', error: 'This destination is not connected through the current social gateway.' }))
  };
}

async function uploadBuffer(data, mimeType) {
  if (!Buffer.isBuffer(data) || !data.length) throw Object.assign(new Error('The media file is empty.'), { status: 400 });
  if (data.length > MAX_DIRECT_UPLOAD_BYTES) throw Object.assign(new Error('This media file is too large for the current uploader.'), { status: 413 });

  const signed = await postForMe.apiRequest('POST', '/media/create-upload-url');
  if (!signed?.upload_url || !signed?.media_url) throw new Error('Post for Me did not return a media upload URL.');
  await axios.put(signed.upload_url, data, {
    headers: {
      'Content-Type': String(mimeType || 'application/octet-stream').split(';')[0],
      'Content-Length': data.length
    },
    timeout: Number(process.env.POST_FOR_ME_MEDIA_TIMEOUT_MS || 300000),
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });
  return { url: signed.media_url };
}

async function uploadStream(stream, { mimeType, contentLength }) {
  const size = Number(contentLength || 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw Object.assign(new Error('The browser must send the media Content-Length.'), { status: 411, publicMessage: 'The browser must send the media Content-Length.' });
  }
  if (size > MAX_DIRECT_UPLOAD_BYTES) {
    throw Object.assign(new Error('This media file exceeds the current 10 GB upload ceiling.'), { status: 413, publicMessage: 'This media file exceeds the current 10 GB upload ceiling.' });
  }
  const signed = await postForMe.apiRequest('POST', '/media/create-upload-url');
  if (!signed?.upload_url || !signed?.media_url) throw new Error('Post for Me did not return a media upload URL.');
  await axios.put(signed.upload_url, stream, {
    headers: {
      'Content-Type': String(mimeType || 'application/octet-stream').split(';')[0],
      'Content-Length': size
    },
    timeout: 0,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });
  return { url: signed.media_url };
}

async function uploadLibraryAssets(userId, assetIds) {
  const ids = [...new Set((assetIds || []).map(String).filter(Boolean))];
  if (!ids.length) return [];
  const media = [];
  for (const id of ids) {
    const asset = await mediaLibrary.findContent(userId, id);
    if (!asset) throw Object.assign(new Error('One of the selected Media Library assets is unavailable.'), { status: 404 });
    media.push(await uploadBuffer(asset.data, asset.mimeType));
  }
  return media;
}

async function updatePublicationMedia(publications, providerMedia) {
  for (const publication of publications) {
    const current = json(publication.mediaJson, {});
    publication.mediaJson = JSON.stringify({ ...current, providerMedia });
    await prisma.socialPublication.update({ where: { id: publication.id }, data: { mediaJson: publication.mediaJson } });
  }
}

function parentStatus(data, scheduledAt) {
  const status = String(data?.status || '').toLowerCase();
  if (status === 'draft') return 'DRAFT';
  if (status === 'scheduled' || scheduledAt) return 'SCHEDULED';
  if (status === 'processed') return 'PROCESSING';
  return 'PROCESSING';
}

async function markBundleFailed(bundle, error) {
  const message = String(error?.publicMessage || error?.message || 'Post for Me rejected this publishing request.').slice(0, 1000);
  const now = new Date();
  await prisma.socialPublication.updateMany({
    where: { id: { in: bundle.publications.map((publication) => publication.id) } },
    data: {
      status: 'FAILED',
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      lastError: message
    }
  });
  await prisma.socialContent.update({
    where: { id: bundle.content.id },
    data: { status: 'FAILED' }
  }).catch(() => {});
  return message;
}

async function submitBundle(bundle, providerMedia = []) {
  const alreadySubmitted = bundle.publications.find((publication) => publication.externalPostId);
  if (alreadySubmitted) return alreadySubmitted.externalPostId;

  const socialAccounts = bundle.profiles.map(providerAccountId).filter(Boolean);
  const body = {
    caption: cleanText(bundle.input.caption, 5000),
    social_accounts: socialAccounts,
    external_id: `inx:${bundle.content.id}`,
    scheduled_at: bundle.input.scheduledAt || null
  };
  if (providerMedia.length) body.media = providerMedia;
  const platformConfigurations = buildPlatformConfigurations(bundle.profiles, bundle.input);
  if (platformConfigurations) body.platform_configurations = platformConfigurations;
  if (bundle.input.isDraft) body.isDraft = true;

  const post = await postForMe.apiRequest('POST', '/social-posts', { data: body, maxRetries: 5 });
  if (!post?.id) throw new Error('Post for Me did not return a post identifier.');
  const status = parentStatus(post, bundle.input.scheduledAt);
  const now = new Date();

  await prisma.socialPublication.updateMany({
    where: { id: { in: bundle.publications.map((publication) => publication.id) } },
    data: {
      externalPostId: String(post.id),
      status,
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      lastError: null
    }
  });
  await prisma.socialContent.update({ where: { id: bundle.content.id }, data: { status } });
  return String(post.id);
}

async function createPublications(userId, input) {
  const bundle = await createPublicationRows(userId, input);
  const contentType = String(input.contentType || 'TEXT').toUpperCase();
  let providerMedia = Array.isArray(input.media) ? input.media.filter((item) => item?.url) : [];

  if (!providerMedia.length && input.mediaLibraryAssetId) {
    providerMedia = await uploadLibraryAssets(userId, [input.mediaLibraryAssetId]);
  }
  if (!providerMedia.length && Array.isArray(input.mediaLibraryAssetIds) && input.mediaLibraryAssetIds.length) {
    providerMedia = await uploadLibraryAssets(userId, input.mediaLibraryAssetIds);
  }
  if (providerMedia.length) await updatePublicationMedia(bundle.publications, providerMedia);

  const uploadRequired = contentType !== 'TEXT' && !providerMedia.length;
  if (!uploadRequired) {
    try {
      await submitBundle(bundle, providerMedia);
    } catch (error) {
      await markBundleFailed(bundle, error);
      throw error;
    }
  }
  const publications = await getPublicationsByIds(bundle.publications.map((publication) => publication.id));
  return {
    jobs: publications.map(publicationToJob),
    failures: bundle.failures,
    uploadRequired
  };
}

async function getPublicationsByIds(ids) {
  return prisma.socialPublication.findMany({
    where: { id: { in: ids } },
    include: { content: true, profile: true },
    orderBy: { createdAt: 'asc' }
  });
}

async function bundleForPublication(userId, rawPublicationId) {
  const id = publicationId(rawPublicationId);
  const publication = await prisma.socialPublication.findFirst({
    where: { id, profile: { userId } },
    include: { content: true, profile: true }
  });
  if (!publication) throw Object.assign(new Error('Publication not found.'), { status: 404 });
  const publications = await prisma.socialPublication.findMany({
    where: { contentId: publication.contentId },
    include: { content: true, profile: true }
  });
  const profiles = publications.map((item) => item.profile);
  const inputMeta = json(publication.mediaJson, {});
  return {
    content: publication.content,
    publications,
    profiles,
    input: {
      caption: publication.content.caption || publication.platformCaption || '',
      title: publication.content.title || null,
      contentType: inputMeta.contentType || 'TEXT',
      scheduledAt: publication.scheduledAt?.toISOString() || null,
      mediaLibraryAssetId: inputMeta.mediaLibraryAssetId || null,
      mediaLibraryAssetIds: inputMeta.mediaLibraryAssetIds || null
    },
    publication
  };
}

async function attachMedia(userId, rawPublicationId, input) {
  const bundle = await bundleForPublication(userId, rawPublicationId);
  if (bundle.publications.some((item) => item.externalPostId)) {
    const fresh = await prisma.socialPublication.findUnique({ where: { id: bundle.publication.id }, include: { content: true, profile: true } });
    return publicationToJob(fresh);
  }
  const providerMedia = [await uploadBuffer(input.data, input.mimeType)];
  await updatePublicationMedia(bundle.publications, providerMedia);
  try {
    await submitBundle(bundle, providerMedia);
  } catch (error) {
    await markBundleFailed(bundle, error);
    throw error;
  }
  const fresh = await prisma.socialPublication.findUnique({ where: { id: bundle.publication.id }, include: { content: true, profile: true } });
  return publicationToJob(fresh);
}

async function attachMediaStream(userId, rawPublicationId, input) {
  const bundle = await bundleForPublication(userId, rawPublicationId);
  if (bundle.publications.some((item) => item.externalPostId)) {
    const fresh = await prisma.socialPublication.findUnique({ where: { id: bundle.publication.id }, include: { content: true, profile: true } });
    return publicationToJob(fresh);
  }
  const providerMedia = [await uploadStream(input.stream, { mimeType: input.mimeType, contentLength: input.contentLength })];
  await updatePublicationMedia(bundle.publications, providerMedia);
  try {
    await submitBundle(bundle, providerMedia);
  } catch (error) {
    await markBundleFailed(bundle, error);
    throw error;
  }
  const fresh = await prisma.socialPublication.findUnique({ where: { id: bundle.publication.id }, include: { content: true, profile: true } });
  return publicationToJob(fresh);
}

async function attachLibraryMedia(userId, rawPublicationId) {
  const bundle = await bundleForPublication(userId, rawPublicationId);
  if (bundle.publications.some((item) => item.externalPostId)) {
    const fresh = await prisma.socialPublication.findUnique({ where: { id: bundle.publication.id }, include: { content: true, profile: true } });
    return publicationToJob(fresh);
  }
  const meta = json(bundle.publication.mediaJson, {});
  const ids = meta.mediaLibraryAssetIds?.length ? meta.mediaLibraryAssetIds : meta.mediaLibraryAssetId ? [meta.mediaLibraryAssetId] : [];
  if (!ids.length) throw Object.assign(new Error('This publication has no Media Library asset attached.'), { status: 404 });
  const providerMedia = await uploadLibraryAssets(userId, ids);
  await updatePublicationMedia(bundle.publications, providerMedia);
  try {
    await submitBundle(bundle, providerMedia);
  } catch (error) {
    await markBundleFailed(bundle, error);
    throw error;
  }
  const fresh = await prisma.socialPublication.findUnique({ where: { id: bundle.publication.id }, include: { content: true, profile: true } });
  return publicationToJob(fresh);
}

async function retryPublication(userId, rawPublicationId) {
  const bundle = await bundleForPublication(userId, rawPublicationId);
  if (bundle.publications.some((item) => item.externalPostId)) {
    throw Object.assign(new Error('This post already has a Post for Me schedule and cannot be retried as a new submission.'), {
      status: 409,
      publicMessage: 'This post already has a Post for Me schedule.'
    });
  }
  if (!bundle.publications.some((item) => item.status === 'FAILED' || item.status === 'READY')) {
    throw Object.assign(new Error('Only failed or incomplete provider submissions can be retried.'), {
      status: 409,
      publicMessage: 'Only failed or incomplete provider submissions can be retried.'
    });
  }

  const scheduledAt = bundle.input.scheduledAt ? validateScheduledAt(bundle.input.scheduledAt) : null;
  bundle.input = { ...bundle.input, scheduledAt };
  const meta = json(bundle.publication.mediaJson, {});
  const providerMedia = Array.isArray(meta.providerMedia) ? meta.providerMedia.filter((item) => item?.url) : [];
  if (String(bundle.input.contentType || 'TEXT').toUpperCase() !== 'TEXT' && !providerMedia.length) {
    throw Object.assign(new Error('The original media is no longer attached to this failed post. Recreate the media post from Bulk Scheduler.'), {
      status: 409,
      publicMessage: 'The original media is no longer attached to this failed post. Recreate the media post from Bulk Scheduler.'
    });
  }

  await prisma.socialPublication.updateMany({
    where: { id: { in: bundle.publications.map((publication) => publication.id) } },
    data: { status: 'READY', lastError: null }
  });
  await prisma.socialContent.update({ where: { id: bundle.content.id }, data: { status: 'PROCESSING' } }).catch(() => {});

  try {
    await submitBundle(bundle, providerMedia);
  } catch (error) {
    await markBundleFailed(bundle, error);
    throw error;
  }

  const fresh = await prisma.socialPublication.findUnique({
    where: { id: bundle.publication.id },
    include: { content: true, profile: true }
  });
  return publicationToJob(fresh);
}

function publicationToJob(publication) {
  const meta = json(publication.mediaJson, {});
  const result = json(publication.metricsJson, {});
  const staleUnsubmittedText = publication.status === 'READY'
    && meta.contentType === 'TEXT'
    && !publication.externalPostId
    && Date.now() - publication.createdAt.getTime() > 10_000;
  const status = publication.status === 'AWAITING_MEDIA' ? 'AWAITING_UPLOAD'
    : staleUnsubmittedText ? 'FAILED'
      : publication.status === 'READY' ? 'READY'
        : publication.status === 'SCHEDULED' ? 'SCHEDULED'
        : publication.status === 'PUBLISHED' ? 'PUBLISHED'
          : publication.status === 'FAILED' ? 'FAILED'
            : publication.status === 'CANCELLED' ? 'CANCELLED'
              : publication.status === 'DRAFT' ? 'DRAFT' : 'PROCESSING';
  return {
    id: `pfm:${publication.id}`,
    status,
    uploadStatus: publication.status === 'AWAITING_MEDIA' ? 'AWAITING_UPLOAD' : meta.providerMedia?.length ? 'COMPLETE' : 'NOT_REQUIRED',
    publishMode: publication.scheduledAt ? 'SCHEDULED' : 'NOW',
    contentType: ['IMAGE', 'VIDEO'].includes(meta.contentType) ? meta.contentType : 'TEXT',
    title: publication.content?.title || null,
    caption: publication.content?.caption || publication.platformCaption || null,
    localFileName: meta.originalFileName || null,
    scheduledAt: publication.scheduledAt?.toISOString() || null,
    completedAt: publication.publishedAt?.toISOString() || null,
    errorMessage: publication.lastError || (staleUnsubmittedText ? 'This text post was prepared in INX Social but was not accepted by Post for Me. Review and retry it.' : null),
    mediaLibraryAssetId: meta.mediaLibraryAssetId || null,
    metaPostId: result.platformPostId || null,
    metaVideoId: null,
    createdAt: publication.createdAt.toISOString(),
    updatedAt: publication.updatedAt.toISOString(),
    page: null,
    destination: publication.profile ? {
      id: publication.profile.id,
      platform: publication.profile.platform,
      name: publication.profile.displayName,
      username: publication.profile.username,
      avatarUrl: publication.profile.avatarUrl
    } : null,
    platformUrl: result.platformUrl || null,
    asset: null,
    contentId: publication.contentId,
    providerPostId: publication.externalPostId || null,
    providerStatus: meta.providerPostStatus || String(publication.status || '').toLowerCase() || null,
    source: publication.content?.source || null
  };
}

async function listPublications(userId, limit = 150) {
  const profiles = await prisma.socialProfile.findMany({ where: { userId }, select: { id: true } });
  if (!profiles.length) return [];
  const rows = await prisma.socialPublication.findMany({
    where: { profileId: { in: profiles.map((profile) => profile.id) } },
    include: { content: true, profile: true },
    orderBy: { createdAt: 'desc' },
    take: Math.min(1000, Math.max(1, Number(limit) || 150))
  });
  return rows.map(publicationToJob);
}

async function refreshContentStatus(contentId) {
  const publications = await prisma.socialPublication.findMany({ where: { contentId }, select: { status: true } });
  if (!publications.length) return;
  const statuses = publications.map((publication) => publication.status);
  let status = 'PROCESSING';
  if (statuses.every((item) => item === 'PUBLISHED')) status = 'PUBLISHED';
  else if (statuses.every((item) => item === 'FAILED' || item === 'CANCELLED')) status = 'FAILED';
  else if (statuses.every((item) => item === 'SCHEDULED')) status = 'SCHEDULED';
  else if (statuses.every((item) => TERMINAL_STATUSES.has(item))) status = 'PARTIAL';
  else if (statuses.some((item) => item === 'AWAITING_MEDIA')) status = 'AWAITING_MEDIA';
  await prisma.socialContent.update({ where: { id: contentId }, data: { status } }).catch(() => {});
}

function resultError(data) {
  if (!data?.error) return null;
  if (typeof data.error === 'string') return data.error.slice(0, 1000);
  try { return JSON.stringify(data.error).slice(0, 1000); } catch (_) { return 'Publishing failed.'; }
}

async function handleWebhook(payload) {
  const eventType = String(payload?.event_type || '');
  const data = payload?.data || {};

  if (eventType === 'social.post.result.created') {
    const profile = await prisma.socialProfile.findFirst({
      where: { externalProfileId: String(data.social_account_id || ''), status: 'ACTIVE' }
    });
    if (!profile || !data.post_id) return true;
    const publication = await prisma.socialPublication.findFirst({
      where: { profileId: profile.id, externalPostId: String(data.post_id) }
    });
    if (!publication) return true;
    const details = {
      providerResultId: data.id || null,
      platformPostId: data.platform_data?.id || null,
      platformUrl: data.platform_data?.url || null,
      details: data.details || null,
      media: data.media || null
    };
    await prisma.socialPublication.update({
      where: { id: publication.id },
      data: {
        status: data.success ? 'PUBLISHED' : 'FAILED',
        publishedAt: data.success ? new Date() : null,
        lastError: data.success ? null : resultError(data),
        metricsJson: JSON.stringify(details),
        lastAttemptAt: new Date()
      }
    });
    await refreshContentStatus(publication.contentId);
    return true;
  }

  if (eventType === 'social.post.updated' || eventType === 'social.post.deleted') {
    const parentId = String(data.id || '');
    if (!parentId) return true;
    const rows = await prisma.socialPublication.findMany({ where: { externalPostId: parentId }, select: { id: true, contentId: true } });
    if (!rows.length) return true;
    let status = 'PROCESSING';
    if (eventType === 'social.post.deleted') status = 'CANCELLED';
    else if (String(data.status || '').toLowerCase() === 'scheduled') status = 'SCHEDULED';
    else if (String(data.status || '').toLowerCase() === 'draft') status = 'DRAFT';
    await prisma.socialPublication.updateMany({ where: { id: { in: rows.map((row) => row.id) }, status: { notIn: ['PUBLISHED', 'FAILED'] } }, data: { status } });
    for (const contentId of new Set(rows.map((row) => row.contentId))) await refreshContentStatus(contentId);
    return true;
  }

  return eventType === 'social.post.created';
}

async function getFeed(userId, rawProfileId, options = {}) {
  const profile = await prisma.socialProfile.findFirst({ where: { id: String(rawProfileId), userId, status: 'ACTIVE' } });
  if (!profile) throw Object.assign(new Error('Connected profile not found.'), { status: 404 });
  const accountId = providerAccountId(profile);
  if (!accountId) throw Object.assign(new Error('The provider account mapping is missing.'), { status: 409 });
  const params = new URLSearchParams();
  params.set('limit', String(Math.min(50, Math.max(1, Number(options.limit) || 25))));
  if (options.cursor) params.set('cursor', String(options.cursor));
  if (options.expandMetrics !== false) params.append('expand', 'metrics');
  return postForMe.apiRequest('GET', `/social-account-feeds/${encodeURIComponent(accountId)}?${params.toString()}`);
}

module.exports = {
  createPublications,
  attachMedia,
  attachLibraryMedia,
  listPublications,
  publicationToJob,
  handleWebhook,
  getFeed,
  uploadBuffer,
  uploadStream,
  attachMediaStream,
  validateScheduledAt,
  retryPublication
};
