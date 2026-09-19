const prisma = require('../db/prisma');
const postForMe = require('./postForMeService');
const objectStorage = require('./mediaObjectStorageService');

function localId(value) {
  const raw = String(value || '');
  return raw.startsWith('pfm:') ? raw.slice(4) : raw;
}

function json(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

async function ownedPublication(userId, rawId) {
  const publication = await prisma.socialPublication.findFirst({
    where: { id: localId(rawId), profile: { userId } },
    include: { content: true, profile: true }
  });
  if (!publication) throw Object.assign(new Error('Publication not found.'), { status: 404 });
  return publication;
}

async function cleanupQueuedMedia(publications) {
  const refs = new Map();
  for (const publication of publications || []) {
    const media = json(publication.mediaJson, {});
    for (const ref of Array.isArray(media.queuedMedia) ? media.queuedMedia : []) {
      if (!ref?.storageKey) continue;
      refs.set(`${ref.storageProvider || ''}:${ref.storageKey}`, ref);
    }
  }
  await Promise.allSettled(
    [...refs.values()].map(ref => objectStorage.deleteObject(ref.storageKey, ref.storageProvider || null))
  );
}

async function remove(userId, rawId) {
  const publication = await ownedPublication(userId, rawId);
  const parentId = publication.externalPostId;
  const siblings = await prisma.socialPublication.findMany({
    where: { contentId: publication.contentId },
    select: { id: true, mediaJson: true }
  });

  if (parentId) {
    try {
      await postForMe.apiRequest('DELETE', `/social-posts/${encodeURIComponent(parentId)}`);
    } catch (error) {
      if (Number(error.status || 0) !== 404) throw error;
    }
  } else {
    await cleanupQueuedMedia(siblings);
  }

  await prisma.socialPublication.updateMany({
    where: { id: { in: siblings.map((item) => item.id) } },
    data: { status: 'CANCELLED', lastError: null }
  });
  await prisma.socialContent.update({ where: { id: publication.contentId }, data: { status: 'CANCELLED' } });
  return { ok: true, publicationId: `pfm:${publication.id}`, affected: siblings.length };
}

async function reschedule(userId, rawId, scheduledAt) {
  const publication = await ownedPublication(userId, rawId);
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error('Choose a valid publishing date and time.'), { status: 400 });
  if (date.getTime() <= Date.now()) throw Object.assign(new Error('Choose a publishing time in the future.'), { status: 400 });

  if (!publication.externalPostId) {
    await prisma.socialPublication.updateMany({
      where: { contentId: publication.contentId, status: { notIn: ['PUBLISHED', 'CANCELLED'] } },
      data: { scheduledAt: date, status: 'SCHEDULED', lastError: null, lastAttemptAt: null }
    });
    await prisma.socialContent.update({ where: { id: publication.contentId }, data: { status: 'SCHEDULED' } });
    return { ok: true, scheduledAt: date.toISOString(), serverQueued: true };
  }

  const parent = await postForMe.apiRequest('GET', `/social-posts/${encodeURIComponent(publication.externalPostId)}`);
  const accountIds = Array.isArray(parent?.social_accounts)
    ? parent.social_accounts.map((account) => typeof account === 'string' ? account : account?.id).filter(Boolean)
    : [];
  if (!accountIds.length) throw Object.assign(new Error('The publishing gateway did not return the destination accounts for this post.'), { status: 409 });

  await postForMe.apiRequest('PUT', `/social-posts/${encodeURIComponent(publication.externalPostId)}`, {
    data: {
      caption: String(parent.caption || publication.content.caption || ''),
      social_accounts: accountIds,
      scheduled_at: date.toISOString(),
      external_id: parent.external_id || `inx:${publication.contentId}`,
      media: parent.media || null,
      platform_configurations: parent.platform_configurations || null,
      account_configurations: parent.account_configurations || null,
      isDraft: false
    }
  });

  await prisma.socialPublication.updateMany({
    where: { contentId: publication.contentId },
    data: { scheduledAt: date, status: 'SCHEDULED', lastError: null }
  });
  await prisma.socialContent.update({ where: { id: publication.contentId }, data: { status: 'SCHEDULED' } });
  return { ok: true, scheduledAt: date.toISOString(), serverQueued: false };
}

module.exports = { remove, reschedule };
