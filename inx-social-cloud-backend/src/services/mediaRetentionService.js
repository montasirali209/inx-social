'use strict';

const prisma = require('../db/prisma');

const DAY_MS = 24 * 60 * 60 * 1000;
const VIDEO_RETENTION_DAYS = 10;
const OTHER_MEDIA_RETENTION_DAYS = 30;
const RUN_INTERVAL_MS = 60 * 60 * 1000;

function retentionDays(mimeType) {
  return String(mimeType || '').toLowerCase().startsWith('video/')
    ? VIDEO_RETENTION_DAYS
    : OTHER_MEDIA_RETENTION_DAYS;
}

function expiresAtFor(mimeType, from = new Date()) {
  return new Date(new Date(from).getTime() + retentionDays(mimeType) * DAY_MS);
}

async function runMediaRetention(options = {}) {
  const database = options.prisma || prisma;
  const now = options.now || new Date();
  const videoCutoff = new Date(now.getTime() - VIDEO_RETENTION_DAYS * DAY_MS);
  const otherCutoff = new Date(now.getTime() - OTHER_MEDIA_RETENTION_DAYS * DAY_MS);
  const result = await database.agentAsset.deleteMany({
    where: {
      OR: [
        { expiresAt: { lte: now } },
        { expiresAt: null, mimeType: { startsWith: 'video/' }, createdAt: { lte: videoCutoff } },
        { expiresAt: null, NOT: { mimeType: { startsWith: 'video/' } }, createdAt: { lte: otherCutoff } },
      ],
    },
  });
  return result.count;
}

function startMediaRetention() {
  const run = () => runMediaRetention()
    .then(count => {
      if (count) console.log(`[MEDIA RETENTION] Removed ${count} expired media asset(s).`);
    })
    .catch(error => console.error('[MEDIA RETENTION]', error));

  run();
  const timer = setInterval(run, RUN_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = {
  VIDEO_RETENTION_DAYS,
  OTHER_MEDIA_RETENTION_DAYS,
  retentionDays,
  expiresAtFor,
  runMediaRetention,
  startMediaRetention,
};
