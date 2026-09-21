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

function providerAccountId(profile) {
  const metadata = json(profile?.metadataJson, {});
  return String(metadata.postForMeAccountId || profile?.externalProfileId || '');
}

function filterPlatformConfigurations(configurations, rows) {
  if (!configurations || typeof configurations !== 'object' || Array.isArray(configurations)) return configurations || null;
  const platforms = new Set(rows.map((row) => String(row.platform || '').toLowerCase()).filter(Boolean));
  const filtered = Object.fromEntries(Object.entries(configurations).filter(([key]) => platforms.has(String(key).toLowerCase())));
  return Object.keys(filtered).length ? filtered : null;
}

function filterAccountConfigurations(configurations, accountIdsToKeep) {
  if (!configurations || typeof configurations !== 'object' || Array.isArray(configurations)) return configurations || null;
  const keep = new Set(accountIdsToKeep.map(String));
  const filtered = Object.entries(configurations).filter(([key]) => keep.has(String(key)));
  return filtered.length ? Object.fromEntries(filtered) : null;
}

function providerBody(parent, rows, { caption, scheduledAt, externalId }) {
  const accounts = rows.map((row) => providerAccountId(row.profile)).filter(Boolean);
  if (!accounts.length || accounts.length !== rows.length) {
    throw Object.assign(new Error('One or more selected destinations are missing their publishing account mapping.'), {
      status: 409,
      publicMessage: 'One or more selected destinations must be reconnected before this edit can be applied.'
    });
  }
  const time = futureIso(scheduledAt);
  return {
    caption: cleanText(caption, 5000),
    social_accounts: accounts,
    scheduled_at: time,
    external_id: externalId,
    media: parent?.media || null,
    platform_configurations: filterPlatformConfigurations(parent?.platform_configurations, rows),
    account_configurations: filterAccountConfigurations(parent?.account_configurations, accounts),
    isDraft: false
  };
}

async function providerParent(publication) {
  if (!publication.externalPostId) {
    throw Object.assign(new Error('This post has not been submitted to the publishing provider yet.'), { status: 409, publicMessage: 'This post has not been submitted to the publishing provider yet.' });
  }
  const parent = await postForMe.apiRequest('GET', `/social-posts/${encodeURIComponent(publication.externalPostId)}`);
  assertEditableProviderPost(parent, publication);
  return parent;
}

async function parentRows(userId, parentId) {
  return prisma.socialPublication.findMany({
    where: { externalPostId: String(parentId), profile: { userId } },
    include: { content: true, profile: true }
  });
}

async function syncContentCaption(contentId) {
  const rows = await prisma.socialPublication.findMany({
    where: { contentId },
    select: { platformCaption: true }
  });
  const captions = [...new Set(rows.map((row) => String(row.platformCaption || '').trim()))];
  if (captions.length === 1) {
    await prisma.socialContent.update({ where: { id: contentId }, data: { caption: captions[0] } }).catch(() => {});
  }
}

function mediaStatusJson(row, providerStatus) {
  const meta = json(row.mediaJson, {});
  return JSON.stringify({
    ...meta,
    providerPostStatus: String(providerStatus || 'scheduled').toLowerCase()
  });
}

async function persistParentRows(rows, { parentId, caption, scheduledAt, providerStatus }) {
  const time = new Date(scheduledAt);
  await prisma.$transaction(rows.map((row) => prisma.socialPublication.update({
    where: { id: row.id },
    data: {
      externalPostId: String(parentId),
      platformCaption: cleanText(caption, 5000),
      scheduledAt: time,
      status: 'SCHEDULED',
      lastError: null,
      mediaJson: mediaStatusJson(row, providerStatus)
    }
  })));
  for (const contentId of new Set(rows.map((row) => row.contentId))) await syncContentCaption(contentId);
}

async function update(userId, rawId, input = {}) {
  const publication = await ownedPublication(userId, rawId);
  const parent = await providerParent(publication);
  const rows = await parentRows(userId, publication.externalPostId);
  if (!rows.length) throw Object.assign(new Error('Scheduled post destinations could not be resolved.'), { status: 409 });

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
    ? String(parent.caption || publication.platformCaption || publication.content.caption || '')
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

  const updatedProvider = await postForMe.apiRequest('PUT', `/social-posts/${encodeURIComponent(publication.externalPostId)}`, { data: body, maxRetries: 5 });
  await persistParentRows(rows, {
    parentId: publication.externalPostId,
    caption,
    scheduledAt: body.scheduled_at,
    providerStatus: updatedProvider?.status || parent.status || 'scheduled'
  });
  if (input.title !== undefined) {
    await prisma.socialContent.update({ where: { id: publication.contentId }, data: { title } }).catch(() => {});
  }

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

async function restoreOriginalParent(parentId, parent, allRows) {
  const originalCaption = String(parent?.caption || allRows[0]?.platformCaption || allRows[0]?.content?.caption || '');
  const originalTime = String(parent?.scheduled_at || allRows[0]?.scheduledAt?.toISOString() || '');
  const original = providerBody(parent, allRows, {
    caption: originalCaption,
    scheduledAt: originalTime,
    externalId: parent?.external_id || `inx:${allRows[0]?.contentId}`
  });
  await postForMe.apiRequest('PUT', `/social-posts/${encodeURIComponent(parentId)}`, { data: original, maxRetries: 2 });
}

async function bulkEdit(userId, entries = []) {
  const requested = Array.isArray(entries) ? entries.slice(0, 250) : [];
  if (!requested.length) throw Object.assign(new Error('Choose at least one scheduled destination.'), { status: 400 });

  const normalized = requested.map((entry) => ({
    id: localId(entry?.publicationId || entry?.id),
    caption: entry?.caption === undefined ? undefined : cleanText(entry.caption, 5000),
    scheduledAt: entry?.scheduledAt === undefined ? undefined : futureIso(entry.scheduledAt)
  }));
  if (normalized.some((entry) => !entry.id)) throw Object.assign(new Error('One or more selected scheduled posts are invalid.'), { status: 400 });

  const ids = [...new Set(normalized.map((entry) => entry.id))];
  if (ids.length !== normalized.length) throw Object.assign(new Error('Duplicate scheduled destinations were selected.'), { status: 400 });

  const selectedRows = await prisma.socialPublication.findMany({
    where: { id: { in: ids }, profile: { userId } },
    include: { content: true, profile: true }
  });
  if (selectedRows.length !== ids.length) throw Object.assign(new Error('One or more selected scheduled destinations were not found.'), { status: 404 });

  const parentIds = [...new Set(selectedRows.map((row) => String(row.externalPostId || '')))];
  if (parentIds.length !== 1 || !parentIds[0]) {
    throw Object.assign(new Error('A bulk edit request must contain destinations from one scheduled post at a time.'), {
      status: 400,
      publicMessage: 'Please retry this bulk edit. The selected schedules could not be grouped safely.'
    });
  }

  const parentId = parentIds[0];
  for (const row of selectedRows) {
    if (row.status !== 'SCHEDULED') {
      throw Object.assign(new Error('One or more selected posts are no longer editable.'), {
        status: 409,
        publicMessage: 'One or more selected posts have already started processing and were left unchanged.'
      });
    }
  }

  const parent = await postForMe.apiRequest('GET', `/social-posts/${encodeURIComponent(parentId)}`);
  assertEditableProviderPost(parent, selectedRows[0]);
  const allRows = await parentRows(userId, parentId);
  if (!allRows.length) throw Object.assign(new Error('Scheduled destinations could not be resolved.'), { status: 409 });

  const inputById = new Map(normalized.map((entry) => [entry.id, entry]));
  const edits = selectedRows.map((row) => {
    const input = inputById.get(row.id);
    return {
      row,
      caption: input.caption === undefined ? String(row.platformCaption || parent.caption || row.content.caption || '') : input.caption,
      scheduledAt: input.scheduledAt === undefined ? String(row.scheduledAt?.toISOString() || parent.scheduled_at || '') : input.scheduledAt
    };
  });
  const captions = [...new Set(edits.map((entry) => entry.caption))];
  const times = [...new Set(edits.map((entry) => futureIso(entry.scheduledAt)))];
  if (captions.length !== 1 || times.length !== 1) {
    throw Object.assign(new Error('Selected destinations from the same scheduled post must receive the same caption and time.'), {
      status: 400,
      publicMessage: 'Selected destinations from the same scheduled post must receive the same Bulk Edit changes.'
    });
  }

  const caption = captions[0];
  const scheduledAt = times[0];
  const selectedSet = new Set(selectedRows.map((row) => row.id));
  const remainingRows = allRows.filter((row) => !selectedSet.has(row.id));
  const externalBase = parent.external_id || `inx:${selectedRows[0].contentId}`;

  if (!remainingRows.length) {
    const body = providerBody(parent, allRows, { caption, scheduledAt, externalId: externalBase });
    const updated = await postForMe.apiRequest('PUT', `/social-posts/${encodeURIComponent(parentId)}`, { data: body, maxRetries: 5 });
    await persistParentRows(allRows, {
      parentId,
      caption,
      scheduledAt,
      providerStatus: updated?.status || parent.status || 'scheduled'
    });
    return {
      ok: true,
      split: false,
      affected: selectedRows.map((row) => ({
        publicationId: `pfm:${row.id}`,
        providerPostId: parentId,
        caption,
        scheduledAt
      }))
    };
  }

  const originalCaption = String(parent.caption || remainingRows[0]?.platformCaption || remainingRows[0]?.content?.caption || '');
  const originalTime = String(parent.scheduled_at || remainingRows[0]?.scheduledAt?.toISOString() || '');
  const newBody = providerBody(parent, selectedRows, {
    caption,
    scheduledAt,
    externalId: `${externalBase}:split:${Date.now()}`
  });
  const remainingBody = providerBody(parent, remainingRows, {
    caption: originalCaption,
    scheduledAt: originalTime,
    externalId: externalBase
  });

  let createdId = null;
  try {
    const created = await postForMe.apiRequest('POST', '/social-posts', { data: newBody, maxRetries: 5 });
    if (!created?.id) throw new Error('The publishing provider did not return a new schedule identifier.');
    createdId = String(created.id);

    await postForMe.apiRequest('PUT', `/social-posts/${encodeURIComponent(parentId)}`, { data: remainingBody, maxRetries: 5 });

    try {
      await persistParentRows(selectedRows, {
        parentId: createdId,
        caption,
        scheduledAt,
        providerStatus: created.status || 'scheduled'
      });
      await persistParentRows(remainingRows, {
        parentId,
        caption: originalCaption,
        scheduledAt: originalTime,
        providerStatus: parent.status || 'scheduled'
      });
    } catch (dbError) {
      await restoreOriginalParent(parentId, parent, allRows).catch(() => {});
      await postForMe.apiRequest('DELETE', `/social-posts/${encodeURIComponent(createdId)}`, { maxRetries: 1 }).catch(() => {});
      throw dbError;
    }
  } catch (error) {
    if (createdId) {
      await restoreOriginalParent(parentId, parent, allRows).catch(() => {});
      await postForMe.apiRequest('DELETE', `/social-posts/${encodeURIComponent(createdId)}`, { maxRetries: 1 }).catch(() => {});
    }
    throw error;
  }

  return {
    ok: true,
    split: true,
    affected: selectedRows.map((row) => ({
      publicationId: `pfm:${row.id}`,
      providerPostId: createdId,
      caption,
      scheduledAt
    }))
  };
}


async function markCancelledRows(rows) {
  const activeRows = rows.filter((row) => row.status !== 'CANCELLED');
  if (!activeRows.length) return;

  await prisma.socialPublication.updateMany({
    where: { id: { in: activeRows.map((row) => row.id) } },
    data: { status: 'CANCELLED', lastError: null }
  });

  for (const contentId of new Set(activeRows.map((row) => row.contentId))) {
    const remaining = await prisma.socialPublication.count({
      where: { contentId, status: { not: 'CANCELLED' } }
    });
    if (!remaining) {
      await prisma.socialContent.update({
        where: { id: contentId },
        data: { status: 'CANCELLED' }
      }).catch(() => {});
    }
  }
}

async function bulkCancel(userId, publicationIds = []) {
  const requested = Array.isArray(publicationIds) ? publicationIds.slice(0, 250) : [];
  const ids = [...new Set(requested.map(localId).filter(Boolean))];
  if (!ids.length) {
    throw Object.assign(new Error('Choose at least one scheduled destination to cancel.'), {
      status: 400,
      publicMessage: 'Choose at least one scheduled destination to cancel.'
    });
  }

  const selectedRows = await prisma.socialPublication.findMany({
    where: { id: { in: ids }, profile: { userId } },
    include: { content: true, profile: true }
  });

  if (selectedRows.length !== ids.length) {
    throw Object.assign(new Error('One or more selected scheduled destinations were not found.'), { status: 404 });
  }

  for (const row of selectedRows) {
    if (row.status !== 'SCHEDULED' || !row.externalPostId) {
      throw Object.assign(new Error('One or more selected posts are no longer cancellable.'), {
        status: 409,
        publicMessage: 'One or more selected posts have already started processing or no longer have an active schedule.'
      });
    }
  }

  const groups = new Map();
  for (const row of selectedRows) {
    const parentId = String(row.externalPostId);
    const group = groups.get(parentId) || [];
    group.push(row);
    groups.set(parentId, group);
  }

  const affected = [];
  const failures = [];

  for (const [parentId, groupRows] of groups.entries()) {
    let allRows = [];
    try {
      allRows = await parentRows(userId, parentId);
      if (!allRows.length) throw Object.assign(new Error('Scheduled destinations could not be resolved.'), { status: 409 });

      let parent = null;
      try {
        parent = await postForMe.apiRequest('GET', `/social-posts/${encodeURIComponent(parentId)}`);
        assertEditableProviderPost(parent, groupRows[0]);
      } catch (error) {
        if (Number(error.status || 0) !== 404) throw error;

        // If the provider schedule is already gone, reconcile every local row tied to it.
        await markCancelledRows(allRows);
        affected.push(...allRows.map((row) => `pfm:${row.id}`));
        continue;
      }

      const selectedSet = new Set(groupRows.map((row) => row.id));
      const remainingRows = allRows.filter((row) => row.status !== 'CANCELLED' && !selectedSet.has(row.id));

      if (!remainingRows.length) {
        try {
          await postForMe.apiRequest('DELETE', `/social-posts/${encodeURIComponent(parentId)}`, { maxRetries: 3 });
        } catch (error) {
          if (Number(error.status || 0) !== 404) throw error;
        }
        await markCancelledRows(allRows);
        affected.push(...allRows.map((row) => `pfm:${row.id}`));
        continue;
      }

      const caption = String(parent.caption || remainingRows[0]?.platformCaption || remainingRows[0]?.content?.caption || '');
      const scheduledAt = String(parent.scheduled_at || remainingRows[0]?.scheduledAt?.toISOString() || '');
      const body = providerBody(parent, remainingRows, {
        caption,
        scheduledAt,
        externalId: parent.external_id || `inx:${remainingRows[0]?.contentId}`
      });

      await postForMe.apiRequest('PUT', `/social-posts/${encodeURIComponent(parentId)}`, { data: body, maxRetries: 5 });

      try {
        await markCancelledRows(groupRows);
      } catch (dbError) {
        await restoreOriginalParent(parentId, parent, allRows).catch(() => {});
        throw dbError;
      }

      affected.push(...groupRows.map((row) => `pfm:${row.id}`));
    } catch (error) {
      const message = error?.publicMessage || error?.message || 'Cancellation failed.';
      failures.push(...groupRows.map((row) => ({
        publicationId: `pfm:${row.id}`,
        message
      })));
    }
  }

  return {
    ok: failures.length === 0,
    cancelled: affected.length,
    affected,
    failures
  };
}

async function remove(userId, rawId) {
  const publication = await ownedPublication(userId, rawId);
  const parentId = publication.externalPostId;
  const rows = parentId ? await parentRows(userId, parentId) : [publication];

  if (parentId) {
    try {
      const parent = await postForMe.apiRequest('GET', `/social-posts/${encodeURIComponent(parentId)}`);
      assertEditableProviderPost(parent, publication);
      await postForMe.apiRequest('DELETE', `/social-posts/${encodeURIComponent(parentId)}`);
    } catch (error) {
      if (Number(error.status || 0) !== 404) throw error;
    }
  }

  await markCancelledRows(rows);
  return { ok: true, publicationId: `pfm:${publication.id}`, affected: rows.length };
}

async function reschedule(userId, rawId, scheduledAt) {
  return update(userId, rawId, { scheduledAt });
}

module.exports = { remove, reschedule, update, bulkEdit, bulkCancel, assertEditableProviderPost };
