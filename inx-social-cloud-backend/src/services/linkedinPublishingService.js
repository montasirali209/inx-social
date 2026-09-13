const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const { encryptToken, decryptToken } = require('../utils/tokenCrypto');
const mediaLibrary = require('./mediaLibraryService');

const LINKEDIN_SCOPES = ['openid', 'profile', 'email', 'w_member_social'];
const API_VERSION = String(process.env.LINKEDIN_API_VERSION || '202608').replace(/[^0-9]/g, '').slice(0, 6) || '202608';
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const WORKER_INTERVAL_MS = 60 * 1000;
let workerTimer = null;
let workerRunning = false;

function error(message, status = 400, code = null) {
  const value = new Error(message);
  value.status = status;
  value.publicMessage = message;
  if (code) value.code = code;
  return value;
}

function publicOrigin() {
  return String(process.env.APP_URL || 'http://localhost:5050').trim().replace(/\/+$/, '');
}

function callbackUrl() {
  return `${publicOrigin()}/api/social-connections/linkedin/callback`;
}

function stateSecret() {
  const value = String(process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || '').trim();
  if (!value) throw error('OAuth state signing is not configured.', 503);
  return value;
}

function settings() {
  const clientId = String(process.env.LINKEDIN_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.LINKEDIN_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) throw error('LinkedIn OAuth credentials are not configured on the server.', 503, 'OAUTH_PROVIDER_NOT_CONFIGURED');
  return { clientId, clientSecret };
}

function authorization(userId) {
  if (!userId) throw error('Sign in before connecting LinkedIn.', 401);
  const { clientId } = settings();
  const state = jwt.sign({ sub: userId, purpose: 'linkedin-publishing-oauth', nonce: crypto.randomBytes(18).toString('base64url') }, stateSecret(), { expiresIn: '10m', issuer: 'inx-social' });
  const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl());
  url.searchParams.set('scope', LINKEDIN_SCOPES.join(' '));
  url.searchParams.set('state', state);
  return { authorizationUrl: url.toString(), redirectUri: callbackUrl(), platform: 'linkedin' };
}

function verifyState(state) {
  try {
    const payload = jwt.verify(String(state || ''), stateSecret(), { issuer: 'inx-social' });
    if (payload.purpose !== 'linkedin-publishing-oauth' || !payload.sub) throw new Error('invalid state');
    return payload;
  } catch (_) {
    throw error('The LinkedIn connection session expired. Start the connection again.', 401);
  }
}

function splitScopes(value) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || '').split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
}

async function completeOAuth(query) {
  const payload = verifyState(query.state);
  if (query.error) throw error(String(query.error_description || query.error), 400);
  if (!query.code) throw error('LinkedIn did not return an authorization code.', 400);
  const { clientId, clientSecret } = settings();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(query.code),
    redirect_uri: callbackUrl(),
    client_id: clientId,
    client_secret: clientSecret
  });
  const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000
  });
  const token = tokenResponse.data || {};
  if (!token.access_token) throw error('LinkedIn did not return an access token.', 400);
  const userInfoResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` }, timeout: 20000
  });
  const userInfo = userInfoResponse.data || {};
  if (!userInfo.sub) throw error('LinkedIn did not return a member identity.', 400);

  let memberId = String(userInfo.sub);
  try {
    const memberResponse = await axios.get('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${token.access_token}`, 'X-Restli-Protocol-Version': '2.0.0' }, timeout: 15000
    });
    if (memberResponse.data?.id) memberId = String(memberResponse.data.id);
  } catch (_) {
    // OpenID Connect already gives us the signed-in member subject. Some apps
    // do not expose the legacy /v2/me endpoint, so this is an optional upgrade.
  }

  const tokenScopes = splitScopes(token.scope);
  const grantedScopes = tokenScopes.length ? tokenScopes : LINKEDIN_SCOPES;
  const canPublish = grantedScopes.includes('w_member_social');
  if (!canPublish) throw error('LinkedIn connected, but publishing permission was not granted. Reconnect and allow Share on LinkedIn.', 403, 'LINKEDIN_PUBLISH_SCOPE_MISSING');
  const expiresAt = Number(token.expires_in || 0) > 0 ? new Date(Date.now() + Number(token.expires_in) * 1000) : null;

  const connection = await prisma.socialConnection.upsert({
    where: { userId_platform_externalAccountId: { userId: String(payload.sub), platform: 'linkedin', externalAccountId: String(userInfo.sub) } },
    create: {
      userId: String(payload.sub), platform: 'linkedin', externalAccountId: String(userInfo.sub), accountType: 'MEMBER',
      displayName: userInfo.name || userInfo.email || 'LinkedIn member', status: 'ACTIVE',
      encryptedAccessToken: encryptToken(token.access_token), encryptedRefreshToken: token.refresh_token ? encryptToken(token.refresh_token) : null,
      tokenExpiresAt: expiresAt, scopesJson: JSON.stringify(grantedScopes),
      metadataJson: JSON.stringify({ connectedBy: 'OAUTH', authMethod: 'LINKEDIN_SHARE', memberId }),
      lastSyncedAt: new Date(), lastError: null
    },
    update: {
      accountType: 'MEMBER', displayName: userInfo.name || userInfo.email || 'LinkedIn member', status: 'ACTIVE',
      encryptedAccessToken: encryptToken(token.access_token),
      encryptedRefreshToken: token.refresh_token ? encryptToken(token.refresh_token) : undefined,
      tokenExpiresAt: expiresAt || undefined, scopesJson: JSON.stringify(grantedScopes),
      metadataJson: JSON.stringify({ connectedBy: 'OAUTH', authMethod: 'LINKEDIN_SHARE', memberId }),
      lastSyncedAt: new Date(), lastError: null
    }
  });
  await prisma.socialProfile.updateMany({ where: { connectionId: connection.id, externalProfileId: { not: memberId } }, data: { status: 'REVOKED', isDefault: false } });
  await prisma.socialProfile.upsert({
    where: { connectionId_externalProfileId: { connectionId: connection.id, externalProfileId: memberId } },
    create: {
      userId: String(payload.sub), connectionId: connection.id, platform: 'linkedin', externalProfileId: memberId,
      displayName: userInfo.name || 'LinkedIn member', username: userInfo.email || null, profileType: 'MEMBER',
      avatarUrl: userInfo.picture || null, status: 'ACTIVE', isDefault: true,
      capabilitiesJson: JSON.stringify({ identity: true, publish: true, publishText: true, publishImage: true, publishVideo: true, scheduling: true, analytics: false }),
      metadataJson: JSON.stringify({ email: userInfo.email || null, locale: userInfo.locale || null, authorUrn: `urn:li:person:${memberId}` })
    },
    update: {
      displayName: userInfo.name || 'LinkedIn member', username: userInfo.email || null, profileType: 'MEMBER',
      avatarUrl: userInfo.picture || null, status: 'ACTIVE', isDefault: true,
      capabilitiesJson: JSON.stringify({ identity: true, publish: true, publishText: true, publishImage: true, publishVideo: true, scheduling: true, analytics: false }),
      metadataJson: JSON.stringify({ email: userInfo.email || null, locale: userInfo.locale || null, authorUrn: `urn:li:person:${memberId}` })
    }
  });
  return prisma.socialConnection.findUnique({ where: { id: connection.id }, include: { profiles: true } });
}

function headers(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Linkedin-Version': API_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json'
  };
}

async function resolveProfile(userId, profileId) {
  const profile = await prisma.socialProfile.findFirst({
    where: { id: profileId, userId, platform: 'linkedin', status: 'ACTIVE' }, include: { connection: true }
  });
  if (!profile || profile.connection?.status !== 'ACTIVE') throw error('LinkedIn profile is not connected.', 404);
  if (profile.profileType !== 'MEMBER') throw error('LinkedIn Company Page publishing is not enabled yet.', 403, 'LINKEDIN_ORGANIZATION_NOT_ENABLED');
  const scopes = splitScopes(profile.connection.scopesJson ? JSON.parse(profile.connection.scopesJson) : []);
  let capabilities = {};
  try { capabilities = JSON.parse(profile.capabilitiesJson || '{}'); } catch (_) {}
  if (!scopes.includes('w_member_social') || !capabilities.publish) throw error('Reconnect LinkedIn to grant publishing permission.', 403, 'LINKEDIN_RECONNECT_REQUIRED');
  if (!profile.connection.encryptedAccessToken) throw error('Reconnect LinkedIn before publishing.', 401);
  return { profile, accessToken: decryptToken(profile.connection.encryptedAccessToken), authorUrn: `urn:li:person:${profile.externalProfileId}` };
}

function basePost(authorUrn, commentary) {
  return {
    author: authorUrn,
    commentary,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false
  };
}

async function createLinkedInPost({ accessToken, authorUrn, caption, media = null }) {
  const payload = basePost(authorUrn, caption);
  if (media?.urn) payload.content = { media: { id: media.urn, ...(media.title ? { title: media.title } : {}) } };
  const response = await axios.post('https://api.linkedin.com/rest/posts', payload, { headers: headers(accessToken), timeout: 30000 });
  const postId = response.headers['x-restli-id'] || response.data?.id || null;
  if (!postId) throw error('LinkedIn accepted the request but did not return a post identifier.', 502);
  return { postId: String(postId) };
}

async function uploadImage(accessToken, authorUrn, data, mimeType) {
  const init = await axios.post('https://api.linkedin.com/rest/images?action=initializeUpload', { initializeUploadRequest: { owner: authorUrn } }, { headers: headers(accessToken), timeout: 30000 });
  const value = init.data?.value || {};
  if (!value.uploadUrl || !value.image) throw error('LinkedIn did not initialize the image upload.', 502);
  await axios.put(value.uploadUrl, data, { headers: { 'Content-Type': mimeType || 'application/octet-stream' }, maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 120000 });
  return String(value.image);
}

async function uploadVideo(accessToken, authorUrn, data) {
  const init = await axios.post('https://api.linkedin.com/rest/videos?action=initializeUpload', {
    initializeUploadRequest: { owner: authorUrn, fileSizeBytes: data.length, uploadCaptions: false, uploadThumbnail: false }
  }, { headers: headers(accessToken), timeout: 30000 });
  const value = init.data?.value || {};
  const instructions = Array.isArray(value.uploadInstructions) ? value.uploadInstructions : [];
  if (!value.video || !instructions.length) throw error('LinkedIn did not initialize the video upload.', 502);
  const uploadedPartIds = [];
  for (const instruction of instructions) {
    const first = Number(instruction.firstByte || 0);
    const last = Math.min(data.length - 1, Number(instruction.lastByte ?? data.length - 1));
    const response = await axios.put(instruction.uploadUrl, data.subarray(first, last + 1), {
      headers: { 'Content-Type': 'application/octet-stream' }, maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 180000
    });
    const etag = String(response.headers.etag || '').replace(/^W\//, '').replace(/^"|"$/g, '');
    if (!etag) throw error('LinkedIn did not confirm an uploaded video part.', 502);
    uploadedPartIds.push(etag);
  }
  await axios.post('https://api.linkedin.com/rest/videos?action=finalizeUpload', {
    finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken || '', uploadedPartIds }
  }, { headers: headers(accessToken), timeout: 30000 });
  return String(value.video);
}

async function waitForVideo(accessToken, videoUrn) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await axios.get(`https://api.linkedin.com/rest/videos/${encodeURIComponent(videoUrn)}`, { headers: headers(accessToken), timeout: 20000 });
      const status = String(response.data?.status || '').toUpperCase();
      if (status === 'AVAILABLE') return;
      if (status.includes('FAILED')) throw error('LinkedIn could not process the uploaded video.', 502);
    } catch (value) {
      if (value.publicMessage) throw value;
      if (value.response?.status && value.response.status < 500 && value.response.status !== 404) throw value;
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw error('LinkedIn is still processing the video. Try publishing again shortly.', 504);
}

function asJob(publication, profile, content, media = {}) {
  const now = new Date().toISOString();
  return {
    id: `linkedin:${publication.id}`,
    status: publication.status,
    uploadStatus: publication.status === 'AWAITING_MEDIA' ? 'AWAITING_UPLOAD' : 'NOT_REQUIRED',
    publishMode: publication.scheduledAt ? 'SCHEDULED' : 'NOW',
    contentType: media.contentType || 'TEXT',
    title: content.title || null,
    caption: publication.platformCaption || content.caption || null,
    localFileName: media.originalFileName || null,
    scheduledAt: publication.scheduledAt ? publication.scheduledAt.toISOString() : null,
    completedAt: publication.publishedAt ? publication.publishedAt.toISOString() : null,
    errorMessage: publication.lastError || null,
    mediaLibraryAssetId: media.mediaLibraryAssetId || null,
    metaPostId: publication.externalPostId || null,
    metaVideoId: null,
    createdAt: publication.createdAt?.toISOString?.() || now,
    updatedAt: publication.updatedAt?.toISOString?.() || now,
    page: {
      id: profile.id, facebookPageId: profile.externalProfileId, facebookPageName: profile.displayName,
      facebookPageUsername: profile.username || null, facebookPagePicture: profile.avatarUrl || null,
      facebookCategory: 'LinkedIn Member', status: 'ACTIVE', isSelected: false,
      connectedAt: publication.createdAt?.toISOString?.() || now, lastCheckedAt: null, lastSyncAt: null, lastError: publication.lastError || null
    },
    asset: null
  };
}

async function createPublications(userId, input) {
  if (!Array.isArray(input.profileIds) || !input.profileIds.length) throw error('Choose at least one LinkedIn profile.');
  if (!input.caption || !String(input.caption).trim()) throw error('Write a caption before continuing.');
  if (String(input.caption).length > 3000) throw error('LinkedIn captions must be 3,000 characters or fewer.');
  const contentType = ['TEXT', 'IMAGE', 'VIDEO'].includes(input.contentType) ? input.contentType : 'TEXT';
  if (!['NOW', 'SCHEDULED'].includes(input.publishMode)) throw error('Choose a valid publishing mode.');
  const scheduledAt = input.publishMode === 'SCHEDULED' ? new Date(input.scheduledAt || '') : null;
  if (scheduledAt && (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date())) throw error('Choose a future date and time before scheduling this LinkedIn post.');
  const profiles = [];
  for (const id of [...new Set(input.profileIds.map(String))].slice(0, 50)) profiles.push(await resolveProfile(userId, id));
  const content = await prisma.socialContent.create({ data: { userId, title: input.title || null, caption: String(input.caption).trim(), status: input.publishMode === 'NOW' ? 'READY' : 'SCHEDULED', source: 'MANUAL' } });
  const jobs = [];
  const failures = [];
  for (const item of profiles) {
    const key = `${String(input.clientRequestId || crypto.randomUUID())}:${item.profile.id}`.slice(0, 180);
    let publication = await prisma.socialPublication.findFirst({ where: { profileId: item.profile.id, idempotencyKey: key }, include: { profile: true, content: true } });
    if (!publication) {
      publication = await prisma.socialPublication.create({
        data: {
          contentId: content.id, profileId: item.profile.id, platform: 'linkedin',
          status: contentType === 'TEXT' ? (input.publishMode === 'NOW' ? 'PROCESSING' : 'SCHEDULED') : 'AWAITING_MEDIA',
          platformCaption: String(input.caption).trim(), scheduledAt,
          idempotencyKey: key,
          mediaJson: JSON.stringify({ contentType, originalFileName: input.originalFileName || null, mimeType: input.mimeType || null, fileSizeBytes: input.fileSizeBytes || null, mediaLibraryAssetId: input.mediaLibraryAssetId || null })
        }, include: { profile: true, content: true }
      });
    }
    if (contentType === 'TEXT' && input.publishMode === 'NOW' && publication.status !== 'PUBLISHED') {
      try {
        const published = await createLinkedInPost({ accessToken: item.accessToken, authorUrn: item.authorUrn, caption: publication.platformCaption });
        publication = await prisma.socialPublication.update({ where: { id: publication.id }, data: { status: 'PUBLISHED', externalPostId: published.postId, publishedAt: new Date(), attemptCount: { increment: 1 }, lastAttemptAt: new Date(), lastError: null }, include: { profile: true, content: true } });
      } catch (value) {
        const message = String(value.response?.data?.message || value.publicMessage || value.message || 'LinkedIn publishing failed.').slice(0, 1000);
        publication = await prisma.socialPublication.update({ where: { id: publication.id }, data: { status: 'FAILED', attemptCount: { increment: 1 }, lastAttemptAt: new Date(), lastError: message }, include: { profile: true, content: true } });
        failures.push({ pageId: item.profile.id, pageName: item.profile.displayName, error: message });
      }
    }
    let media = {};
    try { media = JSON.parse(publication.mediaJson || '{}'); } catch (_) {}
    jobs.push(asJob(publication, publication.profile || item.profile, publication.content || content, media));
  }
  return { jobs, failures, uploadRequired: contentType !== 'TEXT' };
}

async function attachMedia(userId, publicationId, input) {
  let publication = await prisma.socialPublication.findFirst({ where: { id: publicationId, profile: { userId, platform: 'linkedin', status: 'ACTIVE' } }, include: { profile: { include: { connection: true } }, content: true } });
  if (!publication) throw error('LinkedIn publication was not found.', 404);
  let media = {};
  try { media = JSON.parse(publication.mediaJson || '{}'); } catch (_) {}
  if (!['IMAGE', 'VIDEO'].includes(media.contentType)) throw error('This LinkedIn publication does not require media.');
  let data = input.data;
  let mimeType = input.mimeType || media.mimeType || 'application/octet-stream';
  let fileName = input.fileName || media.originalFileName || (media.contentType === 'VIDEO' ? 'video.mp4' : 'image.jpg');
  if (input.mediaLibraryAssetId) {
    const asset = await mediaLibrary.findContent(userId, input.mediaLibraryAssetId);
    if (!asset?.data) throw error('The selected Media Library asset is unavailable.', 404);
    data = asset.data;
    mimeType = asset.mimeType || mimeType;
    fileName = asset.originalName || fileName;
    media.mediaLibraryAssetId = input.mediaLibraryAssetId;
  }
  if (!Buffer.isBuffer(data) || !data.length) throw error('Choose a non-empty media file.');
  if (data.length > MAX_UPLOAD_BYTES) throw error('LinkedIn media uploads must be 100 MB or smaller.', 413);
  const resolved = await resolveProfile(userId, publication.profileId);
  let urn;
  if (media.contentType === 'IMAGE') urn = await uploadImage(resolved.accessToken, resolved.authorUrn, data, mimeType);
  else urn = await uploadVideo(resolved.accessToken, resolved.authorUrn, data);
  media = { ...media, urn, mimeType, originalFileName: fileName, fileSizeBytes: data.length };
  publication = await prisma.socialPublication.update({ where: { id: publication.id }, data: { mediaJson: JSON.stringify(media), status: publication.scheduledAt ? 'SCHEDULED' : 'PROCESSING', lastError: null }, include: { profile: true, content: true } });
  if (!publication.scheduledAt) {
    try {
      if (media.contentType === 'VIDEO') await waitForVideo(resolved.accessToken, urn);
      const result = await createLinkedInPost({ accessToken: resolved.accessToken, authorUrn: resolved.authorUrn, caption: publication.platformCaption || publication.content.caption || '', media: { urn, title: fileName } });
      publication = await prisma.socialPublication.update({ where: { id: publication.id }, data: { status: 'PUBLISHED', externalPostId: result.postId, publishedAt: new Date(), attemptCount: { increment: 1 }, lastAttemptAt: new Date(), lastError: null }, include: { profile: true, content: true } });
    } catch (value) {
      const message = String(value.response?.data?.message || value.publicMessage || value.message || 'LinkedIn publishing failed.').slice(0, 1000);
      publication = await prisma.socialPublication.update({ where: { id: publication.id }, data: { status: 'FAILED', attemptCount: { increment: 1 }, lastAttemptAt: new Date(), lastError: message }, include: { profile: true, content: true } });
      throw error(message, 400);
    }
  }
  return asJob(publication, publication.profile, publication.content, media);
}

async function listPublications(userId, limit = 100) {
  const rows = await prisma.socialPublication.findMany({
    where: { platform: 'linkedin', profile: { userId } }, orderBy: { createdAt: 'desc' }, take: Math.min(250, Math.max(1, Number(limit) || 100)), include: { profile: true, content: true }
  });
  return rows.map(row => {
    let media = {};
    try { media = JSON.parse(row.mediaJson || '{}'); } catch (_) {}
    return asJob(row, row.profile, row.content, media);
  });
}

async function processScheduled() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    const due = await prisma.socialPublication.findMany({
      where: { platform: 'linkedin', status: 'SCHEDULED', scheduledAt: { lte: new Date() } }, orderBy: { scheduledAt: 'asc' }, take: 20, include: { profile: { include: { connection: true } }, content: true }
    });
    for (const publication of due) {
      const claimed = await prisma.socialPublication.updateMany({ where: { id: publication.id, status: 'SCHEDULED' }, data: { status: 'PROCESSING', lastAttemptAt: new Date(), attemptCount: { increment: 1 } } });
      if (!claimed.count) continue;
      try {
        const resolved = await resolveProfile(publication.profile.userId, publication.profileId);
        let media = {};
        try { media = JSON.parse(publication.mediaJson || '{}'); } catch (_) {}
        if (['IMAGE', 'VIDEO'].includes(media.contentType) && !media.urn) throw error('Scheduled LinkedIn media is missing. Recreate this post.', 400);
        if (media.contentType === 'VIDEO') await waitForVideo(resolved.accessToken, media.urn);
        const result = await createLinkedInPost({ accessToken: resolved.accessToken, authorUrn: resolved.authorUrn, caption: publication.platformCaption || publication.content.caption || '', media: media.urn ? { urn: media.urn, title: media.originalFileName || null } : null });
        await prisma.socialPublication.update({ where: { id: publication.id }, data: { status: 'PUBLISHED', externalPostId: result.postId, publishedAt: new Date(), lastError: null } });
      } catch (value) {
        const message = String(value.response?.data?.message || value.publicMessage || value.message || 'LinkedIn publishing failed.').slice(0, 1000);
        const attempts = Number(publication.attemptCount || 0) + 1;
        await prisma.socialPublication.update({ where: { id: publication.id }, data: attempts < 3 ? { status: 'SCHEDULED', scheduledAt: new Date(Date.now() + 5 * 60 * 1000), lastError: message } : { status: 'FAILED', lastError: message } });
      }
    }
  } finally {
    workerRunning = false;
  }
}

function startWorker() {
  if (workerTimer) return;
  void processScheduled().catch(value => console.error('LinkedIn publishing worker failed:', value.message));
  workerTimer = setInterval(() => void processScheduled().catch(value => console.error('LinkedIn publishing worker failed:', value.message)), WORKER_INTERVAL_MS);
  if (typeof workerTimer.unref === 'function') workerTimer.unref();
}

module.exports = {
  LINKEDIN_SCOPES,
  authorization,
  completeOAuth,
  createPublications,
  attachMedia,
  listPublications,
  startWorker,
  processScheduled
};
