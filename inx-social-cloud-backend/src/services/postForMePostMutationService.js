const prisma = require('../db/prisma');
const postForMe = require('./postForMeService');

function localId(value) {
  const raw = String(value || '');
  return raw.startsWith('pfm:') ? raw.slice(4) : raw;
}

async function ownedPublication(userId, rawId) {
  const publication = await prisma.socialPublication.findFirst({
    where: { id: localId(rawId), profile: { userId } },
    include: { content: true, profile: true }
  });
  if (!publication) throw Object.assign(new Error('Publication not found.'), { status: 404 });
  return publication;
}

async function remove(userId, rawId) {
  const publication = await ownedPublication(userId, rawId);
  const parentId = publication.externalPostId;
  const siblings = await prisma.socialPublication.findMany({
    where: { contentId: publication.contentId },
    select: { id: true }
  });

  if (parentId) {
    try {
      await postForMe.apiRequest('DELETE', `/social-posts/${encodeURIComponent(parentId)}`);
    } catch (error) {
      if (Number(error.status || 0) !== 404) throw error;
    }
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
  if (!publication.externalPostId) throw Object.assign(new Error('This post has not been submitted to the publishing gateway yet.'), { status: 409 });
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error('Choose a valid publishing date and time.'), { status: 400 });

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
  return { ok: true, scheduledAt: date.toISOString() };
}

module.exports = { remove, reschedule };
