const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

function loadState(statePath) {
  try {
    if (!fs.existsSync(statePath)) return defaultState();
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      scheduled: Array.isArray(parsed.scheduled) ? parsed.scheduled : [],
      failed: Array.isArray(parsed.failed) ? parsed.failed : [],
      updatedAt: parsed.updatedAt || null,
    };
  } catch (err) {
    console.warn(`WARNING: Could not read state file ${statePath}: ${err.message}`);
    return defaultState();
  }
}

function defaultState() {
  return { scheduled: [], failed: [], updatedAt: null };
}

function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const copy = { ...state, updatedAt: new Date().toISOString() };
  fs.writeFileSync(statePath, JSON.stringify(copy, null, 2), 'utf8');
}

function isAlreadyScheduled(state, videoFile) {
  return (state.scheduled || []).some(row => row.videoFile === videoFile);
}

function recordScheduled(state, row) {
  state.scheduled = (state.scheduled || []).filter(item => item.videoFile !== row.videoFile);
  state.scheduled.push(row);
  state.failed = (state.failed || []).filter(item => item.videoFile !== row.videoFile);
}

function recordFailed(state, row) {
  state.failed = (state.failed || []).filter(item => item.videoFile !== row.videoFile);
  state.failed.push(row);
}

function usedSlotKeys(state, timezone = 'Europe/London') {
  return new Set(
    (state.scheduled || [])
      .map(row => row.slotISO)
      .filter(Boolean)
      .map(iso => DateTime.fromISO(iso, { zone: timezone }).toFormat('yyyy-LL-dd HH:mm'))
  );
}

module.exports = {
  loadState,
  saveState,
  isAlreadyScheduled,
  recordScheduled,
  recordFailed,
  usedSlotKeys,
};
