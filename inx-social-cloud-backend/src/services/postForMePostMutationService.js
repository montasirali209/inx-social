const prisma = require('../db/prisma');
const postForMe = require('./postForMeService');

function localId(value) {
  const raw = String(value || '');
  return raw.startsWith('pfm:') ? raw.slice(4) : raw;
}

function json(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
}

function cleanText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

async function ownedPublication(userId, rawId) {
  const publication = await prisma.socialPublication.findFirst({
    where: { id: localId(rawId), profile: { userId } },
    include: { content: true, profile: true }
  });
  if (!publication) throw Object.assign(new Error('Publication not found.'), { status: 404 });
  return publication;
}

function assertEditableProviderPost(parent, publication) {
  const providerStatus = String(parent?.status || '').toLowerCase();
  if (providerStatus && !['draft', 'scheduled'].includes(providerStatus)) {
    throw Object.assign(new Error('This post has already started processing and can no longer be edited or cancelled.'), {
      status: 409,
      publicMessage: 'This post has already started processing and can no longer be edited or cancelled.'
    });
  }
  if (!providerStatus && !['DRAFT', 'SCHEDULED'].includes(String(publication.status || '').toUpperCase())) {
    throw Object.assign(new Error('This post is no longer editable.'), { status: 409, publicMessage: 'This post is no longer editable.' });
  }
}

function futureIso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error('Choose a valid publishing date and time.'), { status: 400, publicMessage: 'Choose a valid publishing date and time.' });
  }
  if (date.getTime() <= Date.now()) {
    throw Object.assign(new Error('Choose a publishing time in the future.'), { status: 400, publicMessage: 'Choose a publishing time in the future.' });
  }
  return date.toISOString();
}

function accountIds(parent) {
  return Array.isArray(parent?.social_accounts)
    ? parent.social_accounts.map((account) => typeof account === 'string' ? account : account?.id).filter(Boolean)
    : [];
}

async function providerParent(publication) {
  if (!publication.externalPostId) {
    throw Object.assign(new Error('This post has not been submitted to the publishing provider yet.'), { status: 409, publicMessage: 'This post has not been submitted to the publishing provider yet.' });
  }
  const parent = await postForMe.apiRequest('GET', `/social-posts/${encodeURIComponent(publication.externalPostId)}`);
  assertEditableProviderPost(parent, publication);
  return parent;
}

async function update(userId, rawId, input = {}) {
  const publication = await ownedPublication(userId, rawId);
  const parent = await providerParent(publication);
  const accounts = accountIds(parent);
  if (!accounts.length) {
    throw Object.assign(new Error('The publishing provider did not return the destinations for this scheduled post.'), { status: 409, publicMessage: 'The publishing provider did not return the destinations for this scheduled post.' });
  }

  const scheduledAt = input.scheduledAt === undefined
    ? String(parent.scheduled_at || publication.scheduledAt?.toISOString() || '')
    : futureIso(input.scheduledAt);
  if (!scheduledAt) {
    throw Object.assign(new Error('This scheduled post no longer has a future publishing time.'), { status: 409, publicMessage: 'This scheduled post no longer has a future publishing time.' });
  }

  const caption = input.caption === undefined
    ? String(parent.caption || publication.content.caption || publication.platformCaption || '')
    : cleanText(input.caption, 5000);
  const title = input.title === undefined ? publication.content.title : cleanText(input.title, 200) || null;
  const media = input.providerMedia === undefined ? (parent.media || null) : input.providerMedia;

  const body = {
    caption,
    social_accounts: accounts,
    scheduled_at: new Date(scheduledAt).toISOString(),
    external_id: parent.external_id || `inx:${publication.contentId}`,
    media,
    platform_configurations: parent.platform_configurations || null,
    account_configurations: parent.account_configurations || null,
    isDraft: false
  };

  const updatedProvider = await postForMe.apiRequest('PUT', `/social-posts/${encodeURIComponent(publication.externalPostId)}`, { data: body });
  const siblings = await prisma.socialPublication.findMany({
    where: { contentId: publication.contentId },
    select: { id: true, mediaJson: true }
  });

  await prisma.$transaction([
    prisma.socialContent.update({
      where: { id: publication.contentId },
      data: { title, caption, status: 'SCHEDULED' }
    }),
    prisma.socialPublication.updateMany({
      where: { id: { in: siblings.map(row => row.id) } },
      data: {
        scheduledAt: new Date(body.scheduled_at),
        status: 'SCHEDULED',
        platformCaption: caption,
        lastError: null
      }
    }),
    ...siblings.map(row => {
      const meta = json(row.mediaJson, {});
      return prisma.socialPublication.update({
        where: { id: row.id },
        data: {
          mediaJson: JSON.stringify({
            ...meta,
            ...(input.providerMedia !== undefined ? { providerMedia: input.providerMedia } : {}),
            providerPostStatus: String(updatedProvider?.status || parent.status || 'scheduled').toLowerCase()
          })
        }
      });
    })
  ]);

  return {
    ok: true,
    publicationId: `pfm:${publication.id}`,
    providerPostId: publication.externalPostId,
    providerStatus: String(updatedProvider?.status || parent.status || 'scheduled').toLowerCase(),
    scheduledAt: body.scheduled_at,
    caption,
    title
  };
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
      const parent = await postForMe.apiRequest('GET', `/social-posts/${encodeURIComponent(parentId)}`);
      assertEditableProviderPost(parent, publication);
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
  return update(userId, rawId, { scheduledAt });
}

module.exports = { remove, reschedule, update, assertEditableProviderPost };
