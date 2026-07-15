const { DateTime } = require('luxon');
const { nanoid } = require('nanoid');

const BLOCKING_STATUSES = new Set(['planned', 'uploading', 'scheduled', 'failed_retryable', 'draft_planned', 'draft_uploading', 'draft_uploaded']);

function buildPairs(videos, captions, existingJobs = [], preferExactFilenameMatch = true) {
  const usedVideoKeys = new Set(existingJobs.map(job => videoJobKey(job)).filter(Boolean));
  const usedVideoIds = new Set(existingJobs.map(job => job.videoId).filter(Boolean));
  const usedVideoNames = new Set(existingJobs.map(job => job.videoName).filter(Boolean));
  const usedCaptionKeys = new Set(existingJobs.map(job => captionJobKey(job)).filter(Boolean));
  const usedCaptionIds = new Set(existingJobs.map(job => job.captionId).filter(Boolean));
  const usedCaptionNames = new Set(existingJobs.map(job => job.captionName).filter(Boolean));

  const availableVideos = videos
    .filter(v => !usedVideoIds.has(v.id) && !usedVideoKeys.has(videoItemKey(v)) && !usedVideoNames.has(v.name))
    .sort(sortByName);
  const availableCaptions = captions
    .filter(c => !usedCaptionIds.has(c.id) && !usedCaptionKeys.has(captionItemKey(c)) && !usedCaptionNames.has(c.name))
    .sort(sortByName);

  const pairs = [];
  const remainingVideos = [...availableVideos];
  const remainingCaptions = [...availableCaptions];

  if (preferExactFilenameMatch) {
    for (let i = remainingVideos.length - 1; i >= 0; i--) {
      const video = remainingVideos[i];
      const captionIndex = remainingCaptions.findIndex(caption => caption.baseName === video.baseName);
      if (captionIndex >= 0) {
        pairs.push({ video, caption: remainingCaptions[captionIndex], matchType: 'exact-name' });
        remainingVideos.splice(i, 1);
        remainingCaptions.splice(captionIndex, 1);
      }
    }
  }

  remainingVideos.sort(sortByName);
  remainingCaptions.sort(sortByName);
  const positionalCount = Math.min(remainingVideos.length, remainingCaptions.length);
  for (let i = 0; i < positionalCount; i++) {
    pairs.push({ video: remainingVideos[i], caption: remainingCaptions[i], matchType: 'position' });
  }

  return {
    pairs: pairs.sort((a, b) => a.video.name.localeCompare(b.video.name, undefined, { numeric: true })),
    unmatchedVideos: remainingVideos.slice(positionalCount),
    unmatchedCaptions: remainingCaptions.slice(positionalCount)
  };
}

function assignSlots(pairs, settings, existingJobs = [], extraOccupiedSlotKeys = new Set()) {
  const timezone = settings.timezone || 'Europe/London';
  const now = DateTime.now().setZone(timezone);
  const minTime = now.plus({ minutes: Number(settings.minLeadMinutes || 20) });
  const slots = normaliseSlots(settings.dailySlots || ['11:00', '15:13', '22:15', '23:15']);
  const maxDays = Number(settings.maxScheduleDays || 25);
  const occupied = getOccupiedSlotKeys(existingJobs, timezone, extraOccupiedSlotKeys);

  const assignments = [];
  let cursorDate = now.startOf('day');
  const deadline = now.plus({ days: maxDays }).endOf('day');

  while (assignments.length < pairs.length && cursorDate <= deadline) {
    for (const slot of slots) {
      const slotTime = buildSlotTime(cursorDate, slot);
      const key = slotKey(slotTime, timezone);
      if (slotTime <= minTime || occupied.has(key)) continue;

      const pair = pairs[assignments.length];
      assignments.push(slotAssignment(pair, slotTime));
      occupied.add(key);
      if (assignments.length >= pairs.length) break;
    }
    cursorDate = cursorDate.plus({ days: 1 });
  }

  return {
    assignments,
    skipped: pairs.slice(assignments.length),
    timezone,
    minTimeISO: minTime.toISO(),
    maxDateISO: deadline.toISO(),
    occupiedSlotCount: occupied.size
  };
}

function findNextFreeSlot(settings, existingJobs = [], extraOccupiedSlotKeys = new Set(), preferredISO = null) {
  const timezone = settings.timezone || 'Europe/London';
  const now = DateTime.now().setZone(timezone);
  const minTime = now.plus({ minutes: Number(settings.minLeadMinutes || 20) });
  const slots = normaliseSlots(settings.dailySlots || ['11:00', '15:13', '22:15', '23:15']);
  const maxDays = Number(settings.maxScheduleDays || 25);
  const occupied = getOccupiedSlotKeys(existingJobs, timezone, extraOccupiedSlotKeys);
  const deadline = now.plus({ days: maxDays }).endOf('day');
  const preferred = preferredISO ? DateTime.fromISO(preferredISO, { zone: timezone }) : null;
  let cursorDate = (preferred && preferred.isValid && preferred > now ? preferred : now).startOf('day');

  while (cursorDate <= deadline) {
    for (const slot of slots) {
      const slotTime = buildSlotTime(cursorDate, slot);
      const key = slotKey(slotTime, timezone);
      if (slotTime <= minTime || occupied.has(key)) continue;
      return slotAssignment(null, slotTime);
    }
    cursorDate = cursorDate.plus({ days: 1 });
  }

  return null;
}

function createJobs(assignments) {
  return assignments.map(item => {
    const { pair, scheduledAtISO, scheduledUnix, slotLabel } = item;
    return {
      id: nanoid(14),
      videoId: pair.video.id,
      videoHash: pair.video.videoHash || null,
      videoKey: videoItemKey(pair.video),
      captionId: pair.caption.id,
      captionHash: pair.caption.captionHash || null,
      captionKey: captionItemKey(pair.caption),
      videoName: pair.video.name,
      captionName: pair.caption.name,
      videoPath: pair.video.path,
      captionPath: pair.caption.path,
      caption: pair.caption.content || '',
      matchType: pair.matchType,
      scheduledAtISO,
      scheduledUnix,
      slotLabel,
      status: 'planned',
      attempts: 0,
      fbVideoId: null,
      fbPostId: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
}

function getOccupiedSlotKeys(existingJobs = [], timezone = 'Europe/London', extraOccupiedSlotKeys = new Set(), ignoreJobId = null) {
  const occupied = new Set(extraOccupiedSlotKeys || []);
  for (const job of existingJobs || []) {
    if (ignoreJobId && job.id === ignoreJobId) continue;
    if (!BLOCKING_STATUSES.has(job.status)) continue;
    if (!job.scheduledAtISO) continue;
    const dt = DateTime.fromISO(job.scheduledAtISO, { zone: timezone });
    if (dt.isValid) occupied.add(slotKey(dt, timezone));
  }
  return occupied;
}

function metaScheduledPostsToSlotKeys(posts = [], timezone = 'Europe/London') {
  const keys = new Set();
  for (const post of posts || []) {
    const raw = post.scheduled_publish_time;
    if (!raw) continue;
    let dt;
    if (typeof raw === 'number') dt = DateTime.fromSeconds(raw, { zone: timezone });
    else if (/^\d+$/.test(String(raw))) dt = DateTime.fromSeconds(Number(raw), { zone: timezone });
    else dt = DateTime.fromISO(String(raw), { zone: timezone });
    if (dt.isValid) keys.add(slotKey(dt, timezone));
  }
  return keys;
}

function slotAssignment(pair, slotTime) {
  return {
    pair,
    scheduledAtISO: slotTime.toISO(),
    scheduledUnix: Math.floor(slotTime.toSeconds()),
    slotLabel: slotTime.toFormat('ccc dd LLL yyyy, h:mm a ZZZZ')
  };
}

function buildSlotTime(date, slot) {
  const [hour, minute] = slot.split(':').map(Number);
  return date.set({ hour, minute, second: 0, millisecond: 0 });
}

function slotKey(dateTime, timezone = 'Europe/London') {
  return dateTime.setZone(timezone).toFormat('yyyy-LL-dd HH:mm');
}

function normaliseSlots(slots) {
  return slots.slice().filter(Boolean).sort();
}

function videoItemKey(item) {
  if (!item) return '';
  if (item.videoKey) return item.videoKey;
  if (item.videoHash) return `sha256:${item.videoHash}`;
  return `${item.name || ''}:${item.size || ''}`;
}

function videoJobKey(job) {
  if (!job) return '';
  if (job.videoKey) return job.videoKey;
  if (job.videoHash) return `sha256:${job.videoHash}`;
  return `${job.videoName || ''}`;
}

function captionItemKey(item) {
  if (!item) return '';
  if (item.captionKey) return item.captionKey;
  if (item.captionHash) return `caption:${item.sourceName || ''}:${item.sourceIndex || ''}:${item.captionHash}`;
  return `${item.name || ''}`;
}

function captionJobKey(job) {
  if (!job) return '';
  if (job.captionKey) return job.captionKey;
  if (job.captionHash) return `caption:${job.captionName || ''}:${job.captionHash}`;
  return `${job.captionName || ''}`;
}

function sortByName(a, b) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

module.exports = {
  buildPairs,
  assignSlots,
  createJobs,
  findNextFreeSlot,
  getOccupiedSlotKeys,
  metaScheduledPostsToSlotKeys,
  slotKey,
  videoItemKey,
  captionItemKey,
  BLOCKING_STATUSES
};
