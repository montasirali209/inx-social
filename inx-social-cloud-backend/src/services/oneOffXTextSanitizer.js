const prisma = require('../db/prisma');
const mutations = require('./postForMePostMutationService');

const ACTION = 'ONE_OFF_X_TEXT_SANITIZE';
const RUN_PREFIX = 'run:';
const RECENT_WINDOW_MS = 72 * 60 * 60 * 1000;
const BATCH_GAP_MS = 30 * 60 * 1000;
const emojiSegmenter = typeof Intl?.Segmenter === 'function'
  ? new Intl.Segmenter('en', { granularity: 'grapheme' })
  : null;
const emojiPattern = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

function parseJson(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
}

function removeHashtagTokens(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line
      .replace(/(^|[ \t]+)#[^\s]+/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function keepFirstEmojiOnly(value) {
  const source = String(value || '');
  if (!source) return '';
  if (!emojiSegmenter) {
    let kept = false;
    return source.replace(/\p{Extended_Pictographic}/gu, (match) => {
      if (!kept) {
        kept = true;
        return match;
      }
      return '';
    });
  }

  let kept = false;
  let result = '';
  for (const { segment } of emojiSegmenter.segment(source)) {
    if (!emojiPattern.test(segment)) {
      result += segment;
      continue;
    }
    if (!kept) {
      kept = true;
      result += segment;
    }
  }
  return result;
}

function sanitizeXText(value) {
  return keepFirstEmojiOnly(removeHashtagTokens(value))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitIntoRecentBatches(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const key = `${row.content.userId}:${row.profileId}`;
    const current = buckets.get(key) || [];
    current.push(row);
    buckets.set(key, current);
  }

  const batches = [];
  for (const [key, bucket] of buckets.entries()) {
    const sorted = [...bucket].sort((a, b) => a.createdAt - b.createdAt);
    let group = [];
    for (const row of sorted) {
      const previous = group.at(-1);
      if (previous && row.createdAt.getTime() - previous.createdAt.getTime() > BATCH_GAP_MS) {
        batches.push({ key, rows: group });
        group = [];
      }
      group.push(row);
    }
    if (group.length) batches.push({ key, rows: group });
  }
  return batches.sort((a, b) => b.rows.at(-1).createdAt - a.rows.at(-1).createdAt);
}

async function updateLocalCaption(row, caption) {
  await prisma.$transaction([
    prisma.socialContent.update({
      where: { id: row.contentId },
      data: { caption }
    }),
    prisma.socialPublication.update({
      where: { id: row.id },
      data: { platformCaption: caption }
    })
  ]);
}

async function updateProviderWithRetry(row, caption) {
  let attempt = 0;
  while (true) {
    try {
      return await mutations.update(row.content.userId, row.id, { caption });
    } catch (error) {
      const status = Number(error?.status || 0);
      if (status !== 429 || attempt >= 5) throw error;
      const delay = Math.min(60_000, Math.max(1500, Number(error?.retryAfterMs || 0) || 1500 * (attempt + 1)));
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}

async function runOneOffXTextSanitizer() {
  const operationId = String(process.env.ONE_OFF_X_TEXT_SANITIZE_OPERATION || '').trim();
  if (!operationId.startsWith(RUN_PREFIX)) return { skipped: true, reason: 'disabled' };

  const expectedCount = Number(process.env.ONE_OFF_X_TEXT_SANITIZE_EXPECTED_COUNT || 61);
  if (!Number.isInteger(expectedCount) || expectedCount < 1 || expectedCount > 500) {
    throw new Error('[one-off-x-cleanup] invalid expected count');
  }

  const prior = await prisma.auditLog.findFirst({
    where: { action: ACTION, entityId: operationId }
  });
  if (prior) {
    console.info('[one-off-x-cleanup] operation already completed; skipping', { operationId });
    return { skipped: true, reason: 'already-completed' };
  }

  const cutoff = new Date(Date.now() - RECENT_WINDOW_MS);
  const candidates = await prisma.socialPublication.findMany({
    where: {
      platform: { in: ['x', 'twitter'] },
      status: { in: ['SCHEDULED', 'FAILED'] },
      scheduledAt: { not: null },
      createdAt: { gte: cutoff },
      content: { source: 'BULK_SCHEDULER' }
    },
    include: { content: true, profile: true },
    orderBy: [{ createdAt: 'asc' }]
  });

  const batches = splitIntoRecentBatches(candidates)
    .filter((batch) => batch.rows.length === expectedCount);

  if (batches.length !== 1) {
    throw new Error(`[one-off-x-cleanup] expected exactly one recent batch of ${expectedCount}; found ${batches.length}`);
  }

  const rows = batches[0].rows;
  const userIds = new Set(rows.map((row) => row.content.userId));
  const profileIds = new Set(rows.map((row) => row.profileId));
  const contentIds = new Set(rows.map((row) => row.contentId));
  if (userIds.size !== 1 || profileIds.size !== 1 || contentIds.size !== expectedCount) {
    throw new Error('[one-off-x-cleanup] batch identity is ambiguous; aborting');
  }

  for (const row of rows) {
    const meta = parseJson(row.mediaJson, {});
    if (String(meta.contentType || '').toUpperCase() !== 'TEXT') {
      throw new Error(`[one-off-x-cleanup] non-text publication detected: ${row.id}`);
    }
  }

  const siblingCount = await prisma.socialPublication.count({
    where: { contentId: { in: [...contentIds] } }
  });
  if (siblingCount !== expectedCount) {
    throw new Error('[one-off-x-cleanup] selected content has additional platform siblings; aborting to avoid cross-platform edits');
  }

  const prepared = rows.map((row) => {
    const original = String(row.platformCaption || row.content.caption || '');
    const cleaned = sanitizeXText(original);
    return { row, original, cleaned };
  });

  const empty = prepared.filter((item) => !item.cleaned);
  if (empty.length) {
    throw new Error(`[one-off-x-cleanup] ${empty.length} caption(s) would become empty; aborting`);
  }

  const changed = prepared.filter((item) => item.cleaned !== item.original);
  const statusCounts = Object.fromEntries([...new Set(rows.map((row) => row.status))].map((status) => [
    status,
    rows.filter((row) => row.status === status).length
  ]));
  console.info('[one-off-x-cleanup] verified exact batch; applying cleanup', {
    operationId,
    total: rows.length,
    changed: changed.length,
    statusCounts,
    scheduledFrom: rows[0]?.scheduledAt?.toISOString() || null,
    scheduledTo: rows.at(-1)?.scheduledAt?.toISOString() || null
  });

  let providerUpdated = 0;
  let localOnlyUpdated = 0;
  let unchanged = 0;
  const skipped = [];
  const failures = [];

  for (let index = 0; index < prepared.length; index += 1) {
    const { row, original, cleaned } = prepared[index];
    if (cleaned === original) {
      unchanged += 1;
      continue;
    }

    const future = row.scheduledAt && row.scheduledAt.getTime() > Date.now();
    const hasProviderSchedule = row.status === 'SCHEDULED' && Boolean(row.externalPostId);

    try {
      if (hasProviderSchedule && future) {
        await updateProviderWithRetry(row, cleaned);
        providerUpdated += 1;
      } else if (!row.externalPostId && ['FAILED', 'SCHEDULED'].includes(row.status)) {
        await updateLocalCaption(row, cleaned);
        localOnlyUpdated += 1;
      } else {
        skipped.push({ id: row.id, status: row.status, reason: future ? 'not-editable' : 'scheduled-time-passed' });
      }
    } catch (error) {
      if (Number(error?.status || 0) === 409) {
        skipped.push({ id: row.id, status: row.status, reason: 'provider-processing' });
      } else {
        failures.push({ id: row.id, status: row.status, error: String(error?.publicMessage || error?.message || error).slice(0, 300) });
      }
    }

    if ((index + 1) % 10 === 0 || index === prepared.length - 1) {
      console.info('[one-off-x-cleanup] progress', {
        current: index + 1,
        total: prepared.length,
        providerUpdated,
        localOnlyUpdated,
        skipped: skipped.length,
        failures: failures.length
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (failures.length) {
    console.error('[one-off-x-cleanup] completed with failures; operation not marked complete', {
      operationId,
      providerUpdated,
      localOnlyUpdated,
      unchanged,
      skipped,
      failures
    });
    throw new Error(`[one-off-x-cleanup] ${failures.length} update(s) failed`);
  }

  await prisma.auditLog.create({
    data: {
      userId: rows[0].content.userId,
      action: ACTION,
      entity: 'SocialPublicationBatch',
      entityId: operationId,
      metadata: JSON.stringify({
        expectedCount,
        total: rows.length,
        changed: changed.length,
        providerUpdated,
        localOnlyUpdated,
        unchanged,
        skipped,
        profileId: rows[0].profileId,
        createdFrom: rows[0].createdAt.toISOString(),
        createdTo: rows.at(-1).createdAt.toISOString(),
        scheduledFrom: rows.map((row) => row.scheduledAt).filter(Boolean).sort((a, b) => a - b)[0]?.toISOString() || null,
        scheduledTo: rows.map((row) => row.scheduledAt).filter(Boolean).sort((a, b) => a - b).at(-1)?.toISOString() || null
      })
    }
  });

  console.info('[one-off-x-cleanup] completed successfully', {
    operationId,
    total: rows.length,
    changed: changed.length,
    providerUpdated,
    localOnlyUpdated,
    unchanged,
    skipped: skipped.length
  });

  return { total: rows.length, changed: changed.length, providerUpdated, localOnlyUpdated, unchanged, skipped };
}

module.exports = {
  runOneOffXTextSanitizer,
  sanitizeXText,
  removeHashtagTokens,
  keepFirstEmojiOnly,
  splitIntoRecentBatches
};
