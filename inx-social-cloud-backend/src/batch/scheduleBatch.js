#!/usr/bin/env node
try { require('dotenv').config(); } catch (_) { /* dotenv is installed by npm install; ignore if unavailable during syntax checks. */ }
const fs = require('fs');
const path = require('path');
const { matchVideosToCaptions } = require('./matchFiles');
const { generateSlots } = require('./slotPlanner');
const stateStore = require('./stateStore');
const fb = require('../services/facebook');

function readConfig(overrides = {}) {
  const videosDir = overrides.videosDir || process.env.VIDEOS_DIR || path.join(__dirname, '../../videos');
  const captionsDir = overrides.captionsDir || process.env.CAPTIONS_DIR || path.join(__dirname, '../../captions');
  const statePath = overrides.statePath || process.env.STATE_PATH || path.join(__dirname, '../../data/schedule-state.json');
  const timezone = overrides.timezone || process.env.TIMEZONE || 'Europe/London';
  const rawScheduleTimes = overrides.scheduleTimes || process.env.SCHEDULE_TIMES || '11:00,15:13,22:15,23:15';
  const scheduleTimes = Array.isArray(rawScheduleTimes)
    ? rawScheduleTimes.map(s => String(s).trim()).filter(Boolean)
    : String(rawScheduleTimes).split(',').map(s => s.trim()).filter(Boolean);

  return {
    videosDir,
    captionsDir,
    statePath,
    timezone,
    scheduleTimes,
    pageId: overrides.pageId || process.env.FB_PAGE_ID,
    pageToken: overrides.pageAccessToken || process.env.FB_PAGE_ACCESS_TOKEN,
    dryRun: Boolean(overrides.dryRun || process.argv.includes('--dry-run')),
    delayMs: Number(overrides.delayMs || process.env.BATCH_DELAY_MS || 3000),
    maxRetries: Number(overrides.maxRetries || process.env.MAX_RETRIES || 3),
    retryBaseDelayMs: Number(overrides.retryBaseDelayMs || process.env.RETRY_BASE_DELAY_MS || 5000),
    minLeadMinutes: Number(overrides.minLeadMinutes || process.env.MIN_LEAD_MINUTES || 20),
    maxScheduleDays: overrides.maxScheduleDays ?? (process.env.MAX_SCHEDULE_DAYS ? Number(process.env.MAX_SCHEDULE_DAYS) : null),
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scheduleWithRetry(item, slot, config, onEvent = () => {}) {
  let lastError;
  for (let attempt = 1; attempt <= config.maxRetries; attempt += 1) {
    try {
      const fileBuffer = fs.readFileSync(item.videoPath);
      return await fb.scheduleVideoPostFromFile({
        pageId: config.pageId,
        pageAccessToken: config.pageToken,
        fileBuffer,
        fileName: item.videoFile,
        caption: item.caption,
        scheduledPublishTime: Math.floor(slot.toSeconds()),
      });
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === config.maxRetries;
      onEvent({ type: 'attempt-failed', item, slot, attempt, maxRetries: config.maxRetries, error: err });
      if (!isLastAttempt) {
        const backoff = config.retryBaseDelayMs * attempt;
        onEvent({ type: 'retry-wait', item, slot, attempt, delayMs: backoff });
        await sleep(backoff);
      }
    }
  }
  throw lastError;
}

function buildPreview(overrides = {}) {
  const config = readConfig({ ...overrides, dryRun: true });
  const state = stateStore.loadState(config.statePath);
  const matches = matchVideosToCaptions(config.videosDir, config.captionsDir);
  const pending = matches.filter(m => !stateStore.isAlreadyScheduled(state, m.videoFile));
  const missingCaption = pending.filter(m => !m.captionPath);
  const ready = pending.filter(m => m.captionPath);
  const slots = generateSlots({
    timesOfDay: config.scheduleTimes,
    timezone: config.timezone,
    count: ready.length,
    usedSlotKeys: stateStore.usedSlotKeys(state, config.timezone),
    minLeadMinutes: config.minLeadMinutes,
    maxScheduleDays: config.maxScheduleDays,
  });
  return {
    config,
    state,
    matches,
    pending,
    missingCaption,
    ready,
    slots,
    schedulable: ready.slice(0, slots.length),
    beyondWindow: ready.slice(slots.length),
  };
}

async function runBatch(overrides = {}, onEvent = () => {}) {
  const config = readConfig(overrides);

  onEvent({ type: 'start', config });
  console.log(`\nfb-scheduler batch run ${config.dryRun ? '(DRY RUN — no uploads will happen)' : ''}`);
  console.log(`Videos dir:   ${config.videosDir}`);
  console.log(`Captions dir: ${config.captionsDir}`);
  console.log(`Timezone:     ${config.timezone}`);
  console.log(`Daily slots:  ${config.scheduleTimes.join(', ')}\n`);

  if (!config.dryRun && (!config.pageId || !config.pageToken)) {
    throw new Error('FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN must be set in .env (or use --dry-run to preview).');
  }

  const preview = buildPreview(config);
  const { state, matches, pending, missingCaption, ready, slots, beyondWindow } = preview;

  if (matches.length === 0) {
    console.log('No video files found. Nothing to do.');
    onEvent({ type: 'done', uploaded: 0, failed: 0, skipped: 0, preview });
    return { uploaded: 0, failed: 0, skipped: 0, preview };
  }

  const alreadyDone = matches.length - pending.length;
  if (alreadyDone > 0) {
    console.log(`Skipping ${alreadyDone} video(s) already scheduled in a previous run.\n`);
  }

  if (missingCaption.length > 0) {
    console.warn('WARNING: these videos have no matching caption file and will be SKIPPED:');
    missingCaption.forEach(m => console.warn(`  - ${m.videoFile}`));
    console.warn('');
  }

  if (beyondWindow.length > 0) {
    console.warn(`WARNING: ${beyondWindow.length} video(s) are outside MAX_SCHEDULE_DAYS and will be left for a future run.`);
    beyondWindow.slice(0, 10).forEach(m => console.warn(`  - ${m.videoFile}`));
    if (beyondWindow.length > 10) console.warn(`  ...and ${beyondWindow.length - 10} more`);
    console.warn('');
  }

  const readyThisRun = ready.slice(0, slots.length);
  if (readyThisRun.length === 0) {
    console.log('No new videos with captions to schedule.');
    onEvent({ type: 'done', uploaded: 0, failed: 0, skipped: missingCaption.length + beyondWindow.length, preview });
    return { uploaded: 0, failed: 0, skipped: missingCaption.length + beyondWindow.length, preview };
  }

  console.log(`Scheduling ${readyThisRun.length} video(s):\n`);

  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < readyThisRun.length; i += 1) {
    const item = readyThisRun[i];
    const slot = slots[i];
    const captionPreview = item.caption.length > 60 ? `${item.caption.slice(0, 60)}...` : item.caption;

    console.log(`[${i + 1}/${readyThisRun.length}] ${item.videoFile}`);
    console.log(`    caption: "${captionPreview}" (${item.matchType} match)`);
    console.log(`    slot:    ${slot.toFormat('cccc, dd LLL yyyy HH:mm')} (${config.timezone})`);
    onEvent({ type: 'item-start', index: i + 1, total: readyThisRun.length, item, slot });

    if (config.dryRun) {
      console.log('    -> skipped upload (dry run)\n');
      onEvent({ type: 'item-dry-run', index: i + 1, total: readyThisRun.length, item, slot });
      continue;
    }

    try {
      const result = await scheduleWithRetry(item, slot, config, onEvent);
      stateStore.recordScheduled(state, {
        videoFile: item.videoFile,
        captionFile: item.captionFile,
        videoId: result.id,
        postId: result.post_id || null,
        slotISO: slot.toISO(),
        scheduledAt: new Date().toISOString(),
      });
      stateStore.saveState(config.statePath, state);
      uploaded += 1;
      console.log(`    -> scheduled OK, video id: ${result.id}\n`);
      onEvent({ type: 'item-success', index: i + 1, total: readyThisRun.length, item, slot, result });
    } catch (err) {
      failed += 1;
      stateStore.recordFailed(state, {
        videoFile: item.videoFile,
        captionFile: item.captionFile,
        slotISO: slot.toISO(),
        error: err.message,
        failedAt: new Date().toISOString(),
      });
      stateStore.saveState(config.statePath, state);
      console.error(`    -> FAILED after ${config.maxRetries} attempts: ${err.message}\n`);
      onEvent({ type: 'item-failed', index: i + 1, total: readyThisRun.length, item, slot, error: err });
    }

    if (i < readyThisRun.length - 1) {
      await sleep(config.delayMs);
    }
  }

  console.log('Batch run complete.');
  onEvent({ type: 'done', uploaded, failed, skipped: missingCaption.length + beyondWindow.length, preview });
  return { uploaded, failed, skipped: missingCaption.length + beyondWindow.length, preview };
}

if (require.main === module) {
  runBatch().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  readConfig,
  buildPreview,
  runBatch,
  scheduleWithRetry,
};
