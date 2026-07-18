const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const crypto = require('crypto');

const DEFAULT_SETTINGS = {
  pageId: '',
  pageAccessToken: '',
  facebookAppId: '',
  connectedPageName: '',
  connectionMethod: 'manual',
  graphVersion: 'v25.0',
  timezone: 'Europe/London',
  dailySlots: ['11:00', '15:13', '22:15', '23:15'],
  maxScheduleDays: 25,
  minLeadMinutes: 20,
  maxRetries: 3,
  retryBaseDelayMs: 5000,
  preferExactFilenameMatch: true,
  copyImportedFiles: true,
  captionSplitMode: 'auto',
  uiTheme: 'aurora',
  uiDensity: 'comfortable',
  enableMotion: true,
  cloudApiUrl: 'https://api.social.inaxx.co.uk'
};

const DEFAULT_UI_TEXTS = {
  appTitle: 'INX Social',
  appSubtitle: 'Content Scheduler',
  dashboardTitle: 'Dashboard',
  dashboardSubtitle: 'Schedule Facebook Reels using Auto or Manual Scheduler.',
  refreshButton: 'Refresh',
  runSchedulerButton: 'Open Scheduler',
  stopSchedulerButton: 'Stop Scheduler',
  checkSlotsButton: 'Check Schedule Slots',
  testFacebookButton: 'Test Facebook Connection',
  openLocalDataButton: 'Open Local Data Folder',
  uploadVideosButton: 'Upload Videos',
  importVideoFolderButton: 'Import Video Folder',
  uploadCaptionsButton: 'Upload Captions',
  importCaptionFolderButton: 'Import Caption Folder',
  importPastedCaptionsButton: 'Import Pasted Captions',
  clearTextButton: 'Clear Text',
  clearLocalLibraryButton: 'Clear Local Library',
  fetchMetaButton: 'Fetch Meta Scheduled Posts',
  saveSettingsButton: 'Save Settings'
};

class AppStore {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.mediaRoot = path.join(userDataPath, 'media');
    this.videoRoot = path.join(this.mediaRoot, 'videos');
    this.captionRoot = path.join(this.mediaRoot, 'captions');
    this.store = new Store({
      cwd: userDataPath,
      name: 'scheduler-state',
      defaults: {
        settings: DEFAULT_SETTINGS,
        uiTexts: DEFAULT_UI_TEXTS,
        videos: [],
        captions: [],
        jobs: [],
        logs: [],
        accountSession: { token: '', user: null, license: null, device: null, lastCheckedAt: null },
        workspace: { accounts: [], pages: [], activePage: null, pageUsage: null, plan: null, lastSyncedAt: null }
      }
    });
    fs.mkdirSync(this.videoRoot, { recursive: true });
    fs.mkdirSync(this.captionRoot, { recursive: true });
    this.normaliseExistingLibrary();
  }

  normaliseExistingLibrary() {
    const videos = this.getVideos();
    const captions = this.getCaptions();
    const jobs = this.getJobs();

    const uniqueVideos = uniqueBy(videos.map(video => ({
      ...video,
      videoKey: video.videoKey || (video.videoHash ? `sha256:${video.videoHash}` : `${video.name || ''}:${video.size || ''}`)
    })), video => video.videoKey || `${video.name || ''}:${video.size || ''}`);

    const uniqueCaptions = uniqueBy(captions.map(caption => {
      const captionHash = caption.captionHash || hashText(caption.content || '');
      return {
        ...caption,
        captionHash,
        captionKey: caption.captionKey || `source:${caption.sourceName || caption.name || 'caption'}:${caption.sourceIndex || ''}:${captionHash}`
      };
    }), caption => caption.captionKey || `${caption.name || ''}:${caption.captionHash || ''}`);

    const uniqueJobs = bestJobPerVideo(jobs.map(job => ({
      ...job,
      videoKey: job.videoKey || (job.videoHash ? `sha256:${job.videoHash}` : `${job.videoName || ''}`),
      captionKey: job.captionKey || (job.captionHash ? `caption:${job.captionName || ''}:${job.captionHash}` : `${job.captionName || ''}`)
    })));

    if (uniqueVideos.length !== videos.length) this.setVideos(uniqueVideos);
    else if (videos.some((v, i) => v.videoKey !== uniqueVideos[i]?.videoKey)) this.setVideos(uniqueVideos);

    if (uniqueCaptions.length !== captions.length) this.setCaptions(uniqueCaptions);
    else if (captions.some((c, i) => c.captionKey !== uniqueCaptions[i]?.captionKey)) this.setCaptions(uniqueCaptions);

    if (uniqueJobs.length !== jobs.length) this.setJobs(uniqueJobs);
    else if (jobs.some((j, i) => j.videoKey !== uniqueJobs[i]?.videoKey || j.captionKey !== uniqueJobs[i]?.captionKey)) this.setJobs(uniqueJobs);

    if (uniqueVideos.length !== videos.length || uniqueCaptions.length !== captions.length || uniqueJobs.length !== jobs.length) {
      this.log('system', `Cleaned duplicate local records. Videos ${videos.length}→${uniqueVideos.length}, captions ${captions.length}→${uniqueCaptions.length}, jobs ${jobs.length}→${uniqueJobs.length}.`);
    }
  }

  getState() {
    return {
      settings: this.getSettings(),
      uiTexts: this.getUITexts(),
      videos: this.store.get('videos', []),
      captions: this.store.get('captions', []),
      jobs: this.store.get('jobs', []),
      logs: this.store.get('logs', []),
      account: this.getAccountState(),
      workspace: this.getWorkspace(),
      paths: {
        userData: this.userDataPath,
        videoRoot: this.videoRoot,
        captionRoot: this.captionRoot
      }
    };
  }

  getSettings() {
    return { ...DEFAULT_SETTINGS, ...this.store.get('settings', {}) };
  }

  saveSettings(partial) {
    const current = this.getSettings();
    const cleaned = { ...current, ...partial };

    if (typeof cleaned.dailySlots === 'string') {
      cleaned.dailySlots = cleaned.dailySlots
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);
    }

    cleaned.dailySlots = [...new Set(cleaned.dailySlots)]
      .map(normaliseTime)
      .filter(Boolean)
      .sort();

    cleaned.maxScheduleDays = Number(cleaned.maxScheduleDays) || DEFAULT_SETTINGS.maxScheduleDays;
    cleaned.minLeadMinutes = Number(cleaned.minLeadMinutes) || DEFAULT_SETTINGS.minLeadMinutes;
    cleaned.maxRetries = Number(cleaned.maxRetries) || DEFAULT_SETTINGS.maxRetries;
    cleaned.retryBaseDelayMs = Number(cleaned.retryBaseDelayMs) || DEFAULT_SETTINGS.retryBaseDelayMs;
    cleaned.captionSplitMode = ['auto', 'blank-line', 'line'].includes(cleaned.captionSplitMode) ? cleaned.captionSplitMode : DEFAULT_SETTINGS.captionSplitMode;
    cleaned.uiTheme = ['aurora', 'midnight', 'studio', 'light'].includes(cleaned.uiTheme) ? cleaned.uiTheme : DEFAULT_SETTINGS.uiTheme;
    cleaned.uiDensity = ['comfortable', 'compact'].includes(cleaned.uiDensity) ? cleaned.uiDensity : DEFAULT_SETTINGS.uiDensity;
    cleaned.enableMotion = Boolean(cleaned.enableMotion);

    this.store.set('settings', cleaned);
    this.log('settings', 'Settings saved.');
    return this.getSettings();
  }

  getUITexts() {
    return { ...DEFAULT_UI_TEXTS, ...this.store.get('uiTexts', {}) };
  }

  saveUITexts(partial) {
    const current = this.getUITexts();
    const cleaned = { ...current };
    for (const key of Object.keys(DEFAULT_UI_TEXTS)) {
      if (Object.prototype.hasOwnProperty.call(partial || {}, key)) {
        const value = String(partial[key] ?? '').trim();
        cleaned[key] = value || DEFAULT_UI_TEXTS[key];
      }
    }
    this.store.set('uiTexts', cleaned);
    this.log('settings', 'Interface text saved.');
    return this.getUITexts();
  }

  resetUITexts() {
    this.store.set('uiTexts', DEFAULT_UI_TEXTS);
    this.log('settings', 'Interface text reset to defaults.');
    return this.getUITexts();
  }


  getAccountSession() {
    return this.store.get('accountSession', { token: '', user: null, license: null, device: null, lastCheckedAt: null });
  }

  getAccountState() {
    const session = this.getAccountSession();
    return {
      authenticated: Boolean(session.token && session.user),
      user: session.user || null,
      license: session.license || null,
      device: session.device || null,
      lastCheckedAt: session.lastCheckedAt || null
    };
  }

  saveAccountSession(patch) {
    const current = this.getAccountSession();
    const next = { ...current, ...patch };
    this.store.set('accountSession', next);
    return this.getAccountState();
  }

  clearAccountSession() {
    this.store.set('accountSession', { token: '', user: null, license: null, device: null, lastCheckedAt: null });
    this.clearWorkspace();
    this.log('account', 'Signed out of INX Social Cloud.');
    return this.getAccountState();
  }

  getWorkspace() {
    return this.store.get('workspace', { accounts: [], pages: [], activePage: null, pageUsage: null, plan: null, lastSyncedAt: null });
  }

  saveWorkspace(patch) {
    const current = this.getWorkspace();
    const next = { ...current, ...patch, lastSyncedAt: new Date().toISOString() };
    this.store.set('workspace', next);
    return next;
  }

  clearWorkspace() {
    const empty = { accounts: [], pages: [], activePage: null, pageUsage: null, plan: null, lastSyncedAt: null };
    this.store.set('workspace', empty);
    return empty;
  }

  getVideos() {
    return this.store.get('videos', []);
  }

  setVideos(videos) {
    this.store.set('videos', videos);
  }

  getCaptions() {
    return this.store.get('captions', []);
  }

  setCaptions(captions) {
    this.store.set('captions', captions);
  }

  getJobs() {
    return this.store.get('jobs', []);
  }

  setJobs(jobs) {
    this.store.set('jobs', jobs);
  }

  addJobs(newJobs) {
    const jobs = this.getJobs();
    this.setJobs([...jobs, ...newJobs]);
    return this.getJobs();
  }

  updateJob(jobId, patch) {
    const jobs = this.getJobs().map(job => {
      if (job.id !== jobId) return job;
      return { ...job, ...patch, updatedAt: new Date().toISOString() };
    });
    this.setJobs(jobs);
    return jobs.find(j => j.id === jobId);
  }

  deleteJob(jobId) {
    const jobs = this.getJobs().filter(job => job.id !== jobId);
    this.setJobs(jobs);
    this.log('job', `Deleted local job ${jobId}.`);
    return jobs;
  }

  clearAll() {
    this.store.set('videos', []);
    this.store.set('captions', []);
    this.store.set('jobs', []);
    this.store.set('logs', []);
    fs.rmSync(this.mediaRoot, { recursive: true, force: true });
    fs.mkdirSync(this.videoRoot, { recursive: true });
    fs.mkdirSync(this.captionRoot, { recursive: true });
    this.log('system', 'Local library cleared.');
    return this.getState();
  }

  log(type, message, extra = {}) {
    const logs = this.store.get('logs', []);
    const row = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      message,
      extra,
      createdAt: new Date().toISOString()
    };
    logs.unshift(row);
    this.store.set('logs', logs.slice(0, 500));
    return row;
  }
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const output = [];
  for (const item of items || []) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function bestJobPerVideo(jobs) {
  const rank = { scheduled: 5, uploading: 4, planned: 3, failed_retryable: 2, stopped: 2, failed: 1 };
  const byVideo = new Map();
  for (const job of jobs || []) {
    const key = job.videoKey || job.videoName || job.videoId || job.id;
    const current = byVideo.get(key);
    if (!current) {
      byVideo.set(key, job);
      continue;
    }
    const jobRank = rank[job.status] || 0;
    const currentRank = rank[current.status] || 0;
    if (jobRank > currentRank) {
      byVideo.set(key, job);
    } else if (jobRank === currentRank && Number(job.scheduledUnix || 0) < Number(current.scheduledUnix || Infinity)) {
      byVideo.set(key, job);
    }
  }
  return Array.from(byVideo.values()).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

function hashText(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function normaliseTime(value) {
  if (!value) return null;
  const raw = String(value).trim().toUpperCase();
  const twelve = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (twelve) {
    let hour = Number(twelve[1]);
    const minute = Number(twelve[2] || '0');
    if (hour === 12) hour = 0;
    if (twelve[3] === 'PM') hour += 12;
    if (hour > 23 || minute > 59) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  const twentyFour = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!twentyFour) return null;
  const hour = Number(twentyFour[1]);
  const minute = Number(twentyFour[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

module.exports = { AppStore, DEFAULT_SETTINGS, DEFAULT_UI_TEXTS, normaliseTime };
