const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const http = require('http');
const crypto = require('crypto');
const axios = require('axios');
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const { AppStore } = require('./services/store');
const { importFiles, importCaptionText, collectFilesFromFolder, hashFileSync, normaliseBaseName, splitCaptionBlocks } = require('./services/fileImport');
const { buildPairs, assignSlots, createJobs, metaScheduledPostsToSlotKeys, findNextFreeSlot, getOccupiedSlotKeys, slotKey } = require('./services/slotPlanner');
const { FacebookClient } = require('./services/facebookClient');
const { runScheduler } = require('./services/scheduler');
const { CloudClient, buildDeviceIdentity, cloudErrorMessage } = require('./services/cloudClient');
const { DateTime } = require('luxon');
const { nanoid } = require('nanoid');

const DEFAULT_FACEBOOK_APP_ID = '969283649323618';
const RENDERER_ENTRY = path.join(__dirname, '../renderer/index.html');
const ALLOWED_EXTERNAL_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'business.facebook.com',
  'developers.facebook.com'
]);
let mainWindow;
let appStore;
let schedulerRunning = false;
let schedulerControl = null;
let reelsPublisherTimer = null;
let reelsPublisherActive = false;

function normaliseTrustedPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isTrustedRendererUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    if (parsed.protocol !== 'file:') return false;
    return normaliseTrustedPath(fileURLToPath(parsed)) === normaliseTrustedPath(RENDERER_ENTRY);
  } catch (_) {
    return false;
  }
}

function assertTrustedIpcSender(event) {
  const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || '';
  if (!mainWindow || event.sender !== mainWindow.webContents || !isTrustedRendererUrl(senderUrl)) {
    throw new Error('Blocked IPC request from an untrusted renderer.');
  }
}

function handleTrustedIpc(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event);
    return listener(event, ...args);
  });
}

function isAllowedExternalUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    return parsed.protocol === 'https:' && ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

function getCloudClient() {
  const settings = appStore.getSettings();
  const session = appStore.getAccountSession();
  return new CloudClient(settings.cloudApiUrl || 'https://api.social.inaxx.co.uk', session.token || '');
}

async function refreshCloudAccount({ activate = true } = {}) {
  const session = appStore.getAccountSession();
  if (!session.token) return appStore.getAccountState();
  const client = getCloudClient();
  try {
    const [{ user }, { license }] = await Promise.all([client.me(), client.licenseStatus()]);
    let device = session.device || null;
    if (activate) {
      const identity = buildDeviceIdentity();
      const result = await client.activateDevice({ ...identity, appVersion: app.getVersion() });
      device = result.device;
    }
    return appStore.saveAccountSession({ user, license, device, lastCheckedAt: new Date().toISOString() });
  } catch (error) {
    const status = error && error.response && error.response.status;
    if (status === 401 || status === 403) appStore.clearAccountSession();
    throw new Error(cloudErrorMessage(error));
  }
}

async function assertCloudAccess() {
  const session = appStore.getAccountSession();
  if (!session.token) throw new Error('Sign in to INX Social before scheduling.');
  const account = await refreshCloudAccount({ activate: true });
  if (!account.license || !account.license.allowed) {
    const status = account.license && (account.license.subscriptionStatus || account.license.status);
    throw new Error(`Scheduling is locked because your trial or subscription is not active${status ? ` (${status})` : ''}.`);
  }
  if (account.device && account.device.status && account.device.status !== 'ACTIVE') {
    throw new Error('This device is not authorised for the account.');
  }
  return account;
}


function prepareInxSocialUserData() {
  const appDataRoot = app.getPath('appData');
  const legacyPath = path.join(appDataRoot, 'PostPilot Studio');
  const targetPath = path.join(appDataRoot, 'INX Social');

  if (!fs.existsSync(targetPath) && fs.existsSync(legacyPath)) {
    try {
      fs.renameSync(legacyPath, targetPath);
    } catch (_) {
      try { fs.cpSync(legacyPath, targetPath, { recursive: true, errorOnExist: false }); } catch (_) {}
    }
  }
  app.setPath('userData', targetPath);
}

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#080b12',
    title: 'INX Social',
    icon: path.join(__dirname, '../renderer/assets/inx-social-logo.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.loadFile(RENDERER_ENTRY);
}

app.setName('INX Social');

app.whenReady().then(() => {
  prepareInxSocialUserData();
  appStore = new AppStore(app.getPath('userData'));
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


async function buildSafePlanPreview() {
  const settings = appStore.getSettings();
  const metaOccupiedSlotKeys = await getMetaOccupiedSlotKeysForPlanning(settings);
  const pairing = buildPairs(appStore.getVideos(), appStore.getCaptions(), appStore.getJobs(), settings.preferExactFilenameMatch);
  const plan = assignSlots(pairing.pairs, settings, appStore.getJobs(), metaOccupiedSlotKeys);
  return { pairing, plan, metaOccupiedSlotCount: metaOccupiedSlotKeys.size };
}

async function createSafeLocalPlan() {
  const preview = await buildSafePlanPreview();
  const jobs = createJobs(preview.plan.assignments);
  if (jobs.length) {
    appStore.addJobs(jobs);
    appStore.log('planner', `Created ${jobs.length} safe local scheduled job${jobs.length === 1 ? '' : 's'}.`, {
      metaOccupiedSlotCount: preview.metaOccupiedSlotCount
    });
  } else {
    appStore.log('planner', 'No new local jobs created. All imported videos/captions are already planned, scheduled, unmatched, or outside Max schedule days.', {
      pairs: preview.pairing.pairs.length,
      assigned: preview.plan.assignments.length,
      unmatchedVideos: preview.pairing.unmatchedVideos.length,
      unmatchedCaptions: preview.pairing.unmatchedCaptions.length,
      metaOccupiedSlotCount: preview.metaOccupiedSlotCount
    });
  }
  return { jobs, pairing: preview.pairing, plan: preview.plan, metaOccupiedSlotCount: preview.metaOccupiedSlotCount, state: appStore.getState() };
}

async function getMetaOccupiedSlotKeysForPlanning(settings) {
  if (!settings.pageId || !settings.pageAccessToken) return new Set();
  try {
    const client = new FacebookClient(settings);
    const result = await client.listScheduledPosts(500);
    const keys = metaScheduledPostsToSlotKeys(result.data || [], settings.timezone || 'Europe/London');
    if (keys.size) appStore.log('facebook', `Planner reserved ${keys.size} slot(s) already scheduled on Meta.`);
    return keys;
  } catch (err) {
    appStore.log('warning', `Planner could not check Meta scheduled slots: ${err.message}`);
    return new Set();
  }
}

function selectedManualSlot(settings, payload) {
  const timezone = settings.timezone || 'Europe/London';
  if (!payload || !payload.date || !payload.time) throw new Error('Choose a date and time for the manual post.');
  const dt = DateTime.fromISO(`${payload.date}T${payload.time}:00`, { zone: timezone });
  if (!dt.isValid) throw new Error('Selected manual date/time is invalid.');
  return {
    scheduledAtISO: dt.toISO(),
    scheduledUnix: Math.floor(dt.toSeconds()),
    slotLabel: dt.toFormat('ccc dd LLL yyyy, h:mm a ZZZZ'),
    key: slotKey(dt, timezone)
  };
}

async function buildManualHealth(payload) {
  const settings = appStore.getSettings();
  const checks = [];
  const summary = { ok: 0, warning: 0, error: 0 };
  const add = (level, title, message) => { checks.push({ level, title, message }); summary[level] = (summary[level] || 0) + 1; };

  const videoPath = String(payload && payload.videoPath || '').trim();
  const caption = String(payload && payload.caption || '').trim();
  let slot = null;
  let metaOccupiedSlotCount = 0;

  if (!videoPath) add('error', 'Video missing', 'Choose one video file before scheduling.');
  else if (!fs.existsSync(videoPath)) add('error', 'Video not found', `The selected video does not exist: ${videoPath}`);
  else {
    const ext = path.extname(videoPath).toLowerCase();
    const stat = fs.statSync(videoPath);
    if (!['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'].includes(ext)) add('error', 'Unsupported video type', `Use MP4/MOV/M4V/AVI/MKV/WEBM. Selected: ${ext || 'unknown'}.`);
    else add('ok', 'Video file', `${path.basename(videoPath)} selected (${formatBytes(stat.size)}).`);
    if (stat.size <= 0) add('error', 'Empty video', 'This video file is empty.');
    if (stat.size > 1024 * 1024 * 1024) add('warning', 'Large video', 'Video is over 1GB. Upload may take a long time or fail on weak internet.');

    const hash = hashFileSync(videoPath);
    const duplicate = appStore.getJobs().find(j => j.videoHash === hash && ['planned','uploading','scheduled','failed_retryable','stopped','reel_queued','reel_publishing','reel_published','reel_failed'].includes(j.status));
    if (duplicate) add('warning', 'Repeated video', `This video was used before (${duplicate.status} at ${duplicate.slotLabel || 'unknown time'}), but repeat use is allowed.`);
  }

  if (!caption) add('error', 'Caption missing', 'Write a caption before scheduling.');
  else {
    const hashtags = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length;
    if (caption.length < 20) add('warning', 'Caption is very short', 'Short captions can work, but add a small hook for better engagement.');
    else add('ok', 'Caption length', `${caption.length} characters.`);
    if (hashtags > 8) add('warning', 'Too many hashtags', `${hashtags} hashtags found. For Facebook, 3–5 is usually cleaner.`);
    else add('ok', 'Hashtags', `${hashtags} hashtag(s) found.`);
  }

  try {
    slot = selectedManualSlot(settings, payload);
    const metaKeys = await getMetaOccupiedSlotKeysForPlanning(settings);
    metaOccupiedSlotCount = metaKeys.size;
    const occupied = getOccupiedSlotKeys(appStore.getJobs(), settings.timezone || 'Europe/London', metaKeys);
    if (occupied.has(slot.key)) {
      const next = findNextFreeSlot(settings, appStore.getJobs(), metaKeys, slot.scheduledAtISO);
      if (payload && payload.useNextFree && next) {
        add('warning', 'Selected slot is busy', `The selected slot is already occupied. The app can use next free slot: ${next.slotLabel}.`);
        slot = { ...next, key: slotKey(DateTime.fromISO(next.scheduledAtISO, { zone: settings.timezone || 'Europe/London' }), settings.timezone || 'Europe/London') };
      } else {
        add('error', 'Selected slot is busy', next ? `Choose another time or use next free slot: ${next.slotLabel}.` : 'No free slot found inside Max schedule days.');
      }
    } else {
      add('ok', 'Schedule slot', `Selected slot is free: ${slot.slotLabel}.`);
    }
  } catch (err) {
    add('error', 'Schedule time', err.message);
  }

  return { checks, summary, slot, metaOccupiedSlotCount, state: appStore.getState() };
}

async function scheduleManualPost(payload, event) {
  const health = await buildManualHealth(payload);
  if (health.summary.error > 0) {
    const firstError = health.checks.find(c => c.level === 'error');
    throw new Error(firstError ? firstError.message : 'Manual Reel did not pass the schedule check.');
  }
  const videoPath = String(payload.videoPath || '').trim();
  const stat = fs.statSync(videoPath);
  const videoHash = hashFileSync(videoPath);
  const caption = String(payload.caption || '').trim();
  const nowISO = new Date().toISOString();
  const job = {
    id: `manual-reel-${nanoid(12)}`,
    videoId: `manual-reel-video-${nanoid(8)}`,
    videoHash,
    videoKey: `manual-reel:${videoPath}:${Date.now()}`,
    captionId: `manual-reel-caption-${nanoid(8)}`,
    captionHash: crypto.createHash('sha256').update(caption, 'utf8').digest('hex'),
    captionKey: `manual-reel-caption:${Date.now()}`,
    videoName: path.basename(videoPath),
    captionName: 'Manual Reel caption',
    videoPath,
    captionPath: null,
    caption,
    matchType: 'manual-reel',
    scheduledAtISO: health.slot.scheduledAtISO,
    scheduledUnix: health.slot.scheduledUnix,
    slotLabel: health.slot.slotLabel,
    status: 'reel_queued',
    uploadMode: 'facebook-reels-scheduled-api',
    endpoint: '/video_reels',
    attempts: 0,
    fbVideoId: null,
    fbPostId: null,
    error: null,
    manual: true,
    size: stat.size,
    createdAt: nowISO,
    updatedAt: nowISO
  };
  appStore.addJobs([job]);
  appStore.log('reels', `Manual Reel prepared for immediate Meta schedule upload: ${job.videoName}.`, {
    slot: job.slotLabel,
    endpoint: '/video_reels',
    note: 'Manual Scheduler will upload this Reel to Meta now and set video_state=SCHEDULED for the chosen time.'
  });
  if (event && event.sender) {
    event.sender.send('scheduler:progress', {
      type: 'manual-reel-ready',
      phase: 'Manual Reel ready',
      percent: 40,
      message: `Manual Reel ready for Meta schedule upload: ${job.slotLabel}`,  
      state: appStore.getState()
    });
  }
  return { job, result: { ready: true, endpoint: '/video_reels', uploadMode: 'facebook-reels-scheduled-api' }, health, state: appStore.getState() };
}

async function scheduleManualPostAndUpload(payload, event) {
  const prepared = await scheduleManualPost(payload, event);
  const upload = await runDueReels(event, { internal: true, jobIds: [prepared.job.id] });
  return { ...prepared, upload, state: appStore.getState() };
}

async function buildHealthCheck() {
  const settings = appStore.getSettings();
  const videos = appStore.getVideos();
  const captions = appStore.getCaptions();
  const jobs = appStore.getJobs();
  const checks = [];
  const summary = { ok: 0, warning: 0, error: 0 };
  const add = (level, title, message) => { checks.push({ level, title, message }); summary[level] = (summary[level] || 0) + 1; };
  const metaKeys = await getMetaOccupiedSlotKeysForPlanning(settings);

  if (!settings.pageId || !settings.pageAccessToken) add('error', 'Meta settings missing', 'Add Facebook Page ID and Page Access Token in Settings.');
  else add('ok', 'Meta settings', 'Page ID and token are saved.');

  if (!videos.length) add('warning', 'No videos imported', 'Import videos for bulk auto scheduling, or use Manual Post for one video.');
  else add('ok', 'Videos imported', `${videos.length} video(s) in the local library.`);

  if (!captions.length) add('warning', 'No captions imported', 'Import captions.txt or paste captions for bulk auto scheduling.');
  else add('ok', 'Captions imported', `${captions.length} caption(s) available.`);

  const pairing = buildPairs(videos, captions, jobs, settings.preferExactFilenameMatch);
  if (pairing.pairs.length) add('ok', 'Bulk pairs ready', `${pairing.pairs.length} new video/caption pair(s) ready for auto scheduler.`);
  if (pairing.unmatchedVideos.length) add('warning', 'Videos without captions', `${pairing.unmatchedVideos.length} video(s) do not have matching captions yet.`);
  if (pairing.unmatchedCaptions.length) add('warning', 'Extra captions', `${pairing.unmatchedCaptions.length} caption(s) have no new video waiting. This is okay if you keep captions ready for later.`);

  const plan = assignSlots(pairing.pairs, settings, jobs, metaKeys);
  if (plan.assignments.length) add('ok', 'Free schedule slots', `${plan.assignments.length} free slot(s) found. First: ${plan.assignments[0].slotLabel}.`);
  else if (pairing.pairs.length) add('error', 'No free slots', `Meta/local jobs occupy all schedule slots inside Max schedule days (${settings.maxScheduleDays}).`);
  else add('warning', 'No new auto upload', 'No new bulk upload will happen until new video/caption pairs exist.');

  const scheduled = jobs.filter(j => j.status === 'scheduled').length;
  const failed = jobs.filter(j => String(j.status).includes('failed')).length;
  if (scheduled) add('ok', 'Local scheduled records', `${scheduled} post(s) already confirmed by Meta.`);
  if (failed) add('warning', 'Failed local jobs', `${failed} failed job(s) exist. Check Logs before retrying.`);

  for (const cap of captions.slice(0, 25)) {
    const hashtags = (String(cap.content || '').match(/#[\p{L}\p{N}_]+/gu) || []).length;
    if (hashtags > 8) add('warning', `Many hashtags: ${cap.name}`, `${hashtags} hashtags found. Consider 3–5 for cleaner Facebook captions.`);
  }

  return { checks, summary, metaOccupiedSlotCount: metaKeys.size, pairing, plan, state: appStore.getState() };
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}


function waitForFacebookImplicitToken({ port = 37531, expectedState, timeoutMs = 180000 }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;

    const finish = (err, payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { server.close(); } catch (_) {}
      if (err) reject(err);
      else resolve(payload);
    };

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (url.pathname === '/facebook-connect') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html><head><title>Facebook Connected</title></head><body style="font-family:Segoe UI,Arial;background:#0f172a;color:white;padding:30px"><h2>Completing Facebook connection...</h2><p>You can return to the scheduler app in a moment.</p><script>
          if (location.hash && location.hash.length > 1) {
            location.replace('/facebook-token?' + location.hash.substring(1));
          } else {
            document.body.innerHTML = '<h2>Facebook did not return an access token.</h2><p>Please close this page and try again.</p>';
          }
        </script></body></html>`);
        return;
      }

      if (url.pathname === '/facebook-token') {
        const accessToken = url.searchParams.get('access_token');
        const stateParam = url.searchParams.get('state');
        const error = url.searchParams.get('error_description') || url.searchParams.get('error');
        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h2>Facebook connection failed</h2><p>${escapeHtmlForServer(error)}</p>`);
          finish(new Error(error));
          return;
        }
        if (!accessToken) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h2>No access token returned.</h2>');
          finish(new Error('No Facebook access token was returned.'));
          return;
        }
        if (expectedState && stateParam && stateParam !== expectedState) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h2>Security state check failed.</h2>');
          finish(new Error('Facebook login state check failed. Please try again.'));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>Facebook Page connection received.</h2><p>You can close this browser tab and return to the dashboard.</p>');
        finish(null, { accessToken });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    });

    server.on('error', err => {
      if (err && err.code === 'EADDRINUSE') {
        finish(new Error(`Local callback port ${port} is already in use. Close other scheduler windows and try again.`));
      } else {
        finish(err);
      }
    });

    server.listen(port, '127.0.0.1', () => {
      timer = setTimeout(() => finish(new Error('Facebook connection timed out. Please try again.')), timeoutMs);
    });
  });
}

function escapeHtmlForServer(value) {
  return String(value || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function extractFacebookAccessTokenFromUrl(rawUrl, expectedState) {
  const text = String(rawUrl || '');
  if (!text) return null;
  const hashIndex = text.indexOf('#');
  const queryIndex = text.indexOf('?');
  const paramsText = hashIndex >= 0 ? text.slice(hashIndex + 1) : (queryIndex >= 0 ? text.slice(queryIndex + 1) : '');
  if (!paramsText) return null;
  const params = new URLSearchParams(paramsText);
  const error = params.get('error_description') || params.get('error_reason') || params.get('error');
  if (error) throw new Error(`Facebook login failed: ${error}`);
  const stateParam = params.get('state');
  if (expectedState && stateParam && stateParam !== expectedState) throw new Error('Facebook login state check failed. Please try again.');
  const accessToken = params.get('access_token');
  return accessToken ? { accessToken } : null;
}

function waitForFacebookTokenInPopup(authUrl, expectedState, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let lastObservedUrl = '';
    let closeTimer = null;
    // Use a fresh non-persistent Electron session for every Facebook connection attempt.
    // This prevents an old Facebook login/cookie grant from silently reusing scopes that
    // did not include Page access, which is the common cause of /me/accounts returning no Pages.
    const oauthPartition = `facebook-connect-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const popup = new BrowserWindow({
      width: 980,
      height: 760,
      parent: mainWindow,
      modal: false,
      title: 'Connect Facebook Page',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        devTools: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        partition: oauthPartition
      }
    });

    popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    popup.webContents.on('will-attach-webview', event => event.preventDefault());
    popup.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    popup.webContents.session.setPermissionCheckHandler(() => false);

    const finish = (err, payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(closeTimer);
      try { if (!popup.isDestroyed()) popup.close(); } catch (_) {}
      if (err) reject(err);
      else resolve(payload);
    };

    const inspect = rawUrl => {
      lastObservedUrl = String(rawUrl || lastObservedUrl || '');
      try {
        const token = extractFacebookAccessTokenFromUrl(lastObservedUrl, expectedState);
        if (token) {
          finish(null, token);
          return true;
        }
      } catch (err) {
        finish(err);
        return true;
      }
      return false;
    };

    const inspectLoadedLocation = () => {
      if (settled || popup.isDestroyed()) return;
      try { inspect(popup.webContents.getURL()); } catch (_) {}
    };

    const timer = setTimeout(() => finish(new Error('Facebook connection timed out. Please try again.')), timeoutMs);
    popup.on('closed', () => {
      if (settled) return;
      closeTimer = setTimeout(() => {
        if (!inspect(lastObservedUrl)) {
          finish(new Error('Facebook login did not finish inside INX Social. Keep the Facebook window open until the app closes it automatically.'));
        }
      }, 350);
    });
    popup.webContents.on('did-start-navigation', (_, url) => inspect(url));
    popup.webContents.on('will-redirect', (event, url) => { if (inspect(url)) event.preventDefault(); });
    popup.webContents.on('will-navigate', (event, url) => { if (inspect(url)) event.preventDefault(); });
    popup.webContents.on('did-navigate', (_, url) => inspect(url));
    popup.webContents.on('did-navigate-in-page', (_, url) => inspect(url));
    popup.webContents.on('did-finish-load', inspectLoadedLocation);
    popup.webContents.on('dom-ready', inspectLoadedLocation);
    popup.loadURL(authUrl);
  });
}

async function connectFacebookPageAuto() {
  const settings = appStore.getSettings();
  const appId = String(settings.facebookAppId || DEFAULT_FACEBOOK_APP_ID).trim();
  if (!appId) {
    throw new Error('Facebook App ID is not configured in this build.');
  }
  const graphVersion = settings.graphVersion || 'v25.0';
  const redirectUri = 'https://social.inaxx.co.uk/oauth-callback.html';
  const state = crypto.randomBytes(16).toString('hex');
  const scopes = [
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'business_management'
  ];

  const authUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', scopes.join(','));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('auth_type', 'rerequest');
  authUrl.searchParams.set('return_scopes', 'true');

  appStore.log('facebook', 'Opening Facebook Connect popup for Page connection.', {
    appIdMasked: appId ? `${appId.slice(0, 4)}...${appId.slice(-4)}` : '',
    redirectUri,
    scopes
  });
  const { accessToken } = await waitForFacebookTokenInPopup(authUrl.toString(), state);

  const accountsUrl = `https://graph.facebook.com/${graphVersion}/me/accounts`;
  const accounts = await axios.get(accountsUrl, {
    params: {
      fields: 'id,name,category,access_token,tasks',
      limit: 100,
      access_token: accessToken
    },
    timeout: 30000
  });

  let pages = Array.isArray(accounts.data && accounts.data.data) ? accounts.data.data : [];

  // Fallback for Pages held inside a Meta Business Portfolio. Some business-owned Pages
  // do not appear from /me/accounts until the business asset path is checked.
  const businessDiagnostics = { tried: false, businesses: 0, ownedPages: 0, clientPages: 0, errors: [] };
  if (!pages.length) {
    try {
      businessDiagnostics.tried = true;
      const businesses = await axios.get(`https://graph.facebook.com/${graphVersion}/me/businesses`, {
        params: { fields: 'id,name', limit: 50, access_token: accessToken },
        timeout: 30000
      });
      const businessRows = Array.isArray(businesses.data && businesses.data.data) ? businesses.data.data : [];
      businessDiagnostics.businesses = businessRows.length;
      const collected = [];
      for (const business of businessRows) {
        for (const edge of ['owned_pages', 'client_pages']) {
          try {
            const res = await axios.get(`https://graph.facebook.com/${graphVersion}/${business.id}/${edge}`, {
              params: { fields: 'id,name,category,access_token,tasks', limit: 100, access_token: accessToken },
              timeout: 30000
            });
            const rows = Array.isArray(res.data && res.data.data) ? res.data.data : [];
            if (edge === 'owned_pages') businessDiagnostics.ownedPages += rows.length;
            if (edge === 'client_pages') businessDiagnostics.clientPages += rows.length;
            for (const row of rows) {
              if (!collected.some(p => p.id === row.id)) collected.push(row);
            }
          } catch (err) {
            businessDiagnostics.errors.push(`${edge}: ${err && err.response && err.response.data ? JSON.stringify(err.response.data) : err.message}`);
          }
        }
      }
      pages = collected;
    } catch (err) {
      businessDiagnostics.errors.push(err && err.response && err.response.data ? JSON.stringify(err.response.data) : err.message);
    }
  }

  appStore.log('facebook', `Facebook Connect Page discovery returned ${pages.length} Page${pages.length === 1 ? '' : 's'}.`, {
    accountsEdgeCount: Array.isArray(accounts.data && accounts.data.data) ? accounts.data.data.length : 0,
    businessDiagnostics
  });

  if (!pages.length) {
    throw new Error('Facebook login succeeded, but no manageable Pages were returned. Remove the INX Social business integration from Facebook, then reconnect, then reconnect and make sure the Page is selected. Also check that pages_show_list, pages_manage_posts, pages_read_engagement, and business_management are included in App Review/permissions.');
  }

  let selected = pages[0];
  if (pages.length > 1) {
    const buttons = pages.map(p => p.name || p.id).concat('Cancel');
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Choose Facebook Page',
      message: 'Select the Facebook Page to connect.',
      detail: 'The app will save this Page connection and keep the access token hidden from the Settings screen.',
      buttons,
      cancelId: buttons.length - 1,
      defaultId: 0,
      noLink: true
    });
    if (choice.response >= pages.length) throw new Error('Facebook Page connection cancelled.');
    selected = pages[choice.response];
  }

  if (!selected.access_token) {
    throw new Error('Selected Page did not return a Page access token. Try reconnecting and ensure all Page permissions are approved.');
  }

  appStore.saveSettings({
    pageId: selected.id,
    pageAccessToken: selected.access_token,
    connectedPageName: selected.name || '',
    connectionMethod: 'facebook-login',
    facebookAppId: appId,
    graphVersion
  });
  appStore.log('facebook', `Connected Facebook Page through Facebook Login: ${selected.name || selected.id}.`, {
    pageId: selected.id,
    method: 'facebook-login'
  });
  return { page: { id: selected.id, name: selected.name || selected.id, category: selected.category || '', tasks: selected.tasks || [] }, settings: appStore.getRendererSettings(), state: appStore.getState() };
}


function buildReelQueueSlots(videoCount, startDateISO, timeValues, settings) {
  const timezone = settings.timezone || 'Europe/London';
  const rawTimes = Array.isArray(timeValues) && timeValues.length ? timeValues : (settings.dailySlots || []);
  const times = [...new Set(rawTimes.map(normaliseDraftTime).filter(Boolean))].sort();
  if (!times.length) throw new Error('No valid queue times selected. Choose custom times or set default daily slots in Settings.');

  let day = startDateISO ? DateTime.fromISO(String(startDateISO), { zone: timezone }) : DateTime.now().setZone(timezone);
  if (!day.isValid) throw new Error('Invalid queue start date.');
  day = day.startOf('day');

  const earliest = DateTime.now().setZone(timezone).plus({ minutes: 1 });
  const occupied = new Set();
  for (const job of appStore.getJobs()) {
    if (job.facebookPageId && settings.pageId && job.facebookPageId !== settings.pageId) continue;
    if (!job.scheduledAtISO && !job.scheduledISO) continue;
    if (!['reel_queued','reel_uploading','reel_scheduled','reel_publishing','reel_published','planned','uploading','scheduled'].includes(job.status)) continue;
    const dt = DateTime.fromISO(job.scheduledAtISO || job.scheduledISO, { zone: timezone });
    if (dt.isValid) occupied.add(slotKey(dt, timezone));
  }

  const slots = [];
  let guardDays = 0;
  while (slots.length < videoCount && guardDays < 370) {
    for (const time of times) {
      const [hour, minute] = time.split(':').map(Number);
      const dt = day.set({ hour, minute, second: 0, millisecond: 0 });
      const key = slotKey(dt, timezone);
      if (dt > earliest && !occupied.has(key)) {
        occupied.add(key);
        slots.push({
          scheduledAtISO: dt.toISO(),
          scheduledUnix: Math.floor(dt.toSeconds()),
          slotLabel: dt.toFormat('ccc dd LLL yyyy, h:mm a ZZZZ'),
          time,
          key
        });
        if (slots.length >= videoCount) break;
      }
    }
    day = day.plus({ days: 1 });
    guardDays++;
  }
  if (slots.length < videoCount) {
    throw new Error(`Only ${slots.length} future free slot(s) were available for ${videoCount} video(s). Add more days/times.`);
  }
  return slots;
}

function buildSessionCaptions(text, settings) {
  return splitCaptionBlocks(text || '', settings.captionSplitMode || 'auto');
}

async function createReelsQueue(payload = {}) {
  const settings = appStore.getSettings();
  if (!settings.pageId || !settings.pageAccessToken) {
    throw new Error('Auto Scheduler cannot start until an active Facebook Page is selected.');
  }
  const videoPaths = Array.isArray(payload.videoPaths) ? payload.videoPaths.filter(Boolean) : [];
  const captions = buildSessionCaptions(payload.captionText || '', settings);
  if (!videoPaths.length) throw new Error('Reels Queue cannot start: select at least one video.');
  if (!captions.length) throw new Error('Reels Queue cannot start: add captions.');

  const videos = [];
  for (const filePath of videoPaths) {
    if (!fs.existsSync(filePath)) throw new Error(`Selected video does not exist: ${filePath}`);
    videos.push(getVideoMeta(filePath));
  }
  const pairCount = Math.min(videos.length, captions.length);
  if (!pairCount) throw new Error('No video/caption pairs could be created.');

  const times = Array.isArray(payload.times) && payload.times.length ? payload.times : settings.dailySlots;
  const slots = buildReelQueueSlots(pairCount, payload.startDate, times, settings);
  const nowISO = new Date().toISOString();
  const jobs = videos.slice(0, pairCount).map((video, index) => {
    const caption = captions[index];
    const slot = slots[index];
    return {
      id: `reel-${nanoid(12)}`,
      videoId: video.id,
      videoName: video.name,
      videoPath: video.path,
      videoHash: video.videoHash,
      videoKey: `reel-session:${video.path}:${Date.now()}:${index}`,
      caption,
      captionName: `reel-caption-${index + 1}`,
      captionHash: crypto.createHash('sha256').update(caption, 'utf8').digest('hex'),
      captionKey: `reel-session-caption:${Date.now()}:${index}`,
      facebookPageId: settings.pageId,
      facebookPageName: settings.connectedPageName || settings.pageId,
      scheduledAtISO: slot.scheduledAtISO,
      scheduledUnix: slot.scheduledUnix,
      slotLabel: slot.slotLabel,
      status: 'reel_queued',
      uploadMode: 'facebook-reels-scheduled-api',
      endpoint: '/video_reels',
      attempts: 0,
      createdAt: nowISO,
      updatedAt: nowISO
    };
  });

  appStore.addJobs(jobs);
  appStore.log('reels', `Prepared ${jobs.length} Facebook Reels Studio upload item(s).`, {
    pairCount,
    firstSlot: jobs[0] ? jobs[0].slotLabel : null,
    note: 'Start Studio Upload will upload each Reel to Meta now and ask Facebook to hold it for the selected future time.'
  });
  return { jobs, state: appStore.getState() };
}

async function runDueReels(event, options = {}) {
  // This function is now the Studio uploader: it uploads queued Reels to Meta now
  // and finishes each Reel with video_state=SCHEDULED + scheduled_publish_time.
  if (schedulerRunning && !options.internal) throw new Error('Another upload is already running.');
  if (!options.internal) schedulerRunning = true;
  const abortController = new AbortController();
  if (!options.internal) {
    schedulerControl = {
      stopRequested: false,
      signal: abortController.signal,
      abort: () => abortController.abort(),
      isStopped: () => schedulerControl ? schedulerControl.stopRequested : true
    };
  }

  try {
    const settings = appStore.getSettings();
    const requestedJobIds = new Set(Array.isArray(options.jobIds) ? options.jobIds : []);
    const queuedJobs = appStore.getJobs()
      .filter(job => ['reel_queued', 'reel_failed', 'reel_upload_failed'].includes(job.status))
      .filter(job => !requestedJobIds.size || requestedJobIds.has(job.id))
      .filter(job => job.scheduledAtISO && job.videoPath)
      .sort((a, b) => String(a.scheduledAtISO).localeCompare(String(b.scheduledAtISO))); 

    if (!queuedJobs.length) {
      return { uploaded: 0, failed: 0, message: 'No Reel items are ready for Studio upload.', state: appStore.getState() };
    }

    const client = new FacebookClient(settings);
    let uploaded = 0;
    let failed = 0;
    const results = [];

    appStore.log('reels', `Studio upload started for ${queuedJobs.length} Reel item(s).`, {
      endpoint: '/video_reels',
      note: 'Each video is uploaded now and finished with video_state=SCHEDULED for its selected future time.'
    });

    for (let i = 0; i < queuedJobs.length; i++) {
      if (schedulerControl && schedulerControl.isStopped()) break;
      let job = appStore.updateJob(queuedJobs[i].id, { status: 'reel_uploading', attempts: Number(queuedJobs[i].attempts || 0) + 1, error: null });
      const progress = {
        type: 'reel-job-start',
        phase: 'Studio upload',
        percent: Math.round(5 + (i / queuedJobs.length) * 85),
        current: i + 1,
        total: queuedJobs.length,
        uploaded,
        failed,
        message: `Uploading Reel ${i + 1}/${queuedJobs.length} to Meta schedule: ${job.videoName}`,
        state: appStore.getState()
      };
      if (event && event.sender) event.sender.send('scheduler:progress', progress);

      try {
        if (job.facebookPageId && job.facebookPageId !== settings.pageId) {
          throw new Error(`This Reel was prepared for ${job.facebookPageName || job.facebookPageId}. Switch the active Page before uploading it.`);
        }
        const result = await client.scheduleReel(job, { signal: schedulerControl ? schedulerControl.signal : undefined });
        job = appStore.updateJob(job.id, {
          status: result.videoState === 'SCHEDULED' ? 'reel_scheduled' : 'reel_published',
          fbVideoId: result.video_id || result.id || null,
          fbPostId: result.post_id || null,
          rawResponse: result,
          endpoint: result.endpoint,
          uploadedAtISO: new Date().toISOString(),
          error: null
        });
        uploaded++;
        results.push({ job, result });
        appStore.log('reels', `Uploaded to Meta schedule: ${job.videoName}.`, {
          videoId: result.video_id,
          postId: result.post_id,
          scheduled_publish_time: result.scheduled_publish_time,
          videoState: result.videoState,
          slot: job.slotLabel,
          endpoint: result.endpoint,
          metaResponse: result.raw || result.finishResponse
        });
        if (event && event.sender) event.sender.send('scheduler:progress', {
          type: 'reel-job-success',
          phase: 'Studio upload',
          percent: Math.round(5 + ((i + 1) / queuedJobs.length) * 85),
          current: i + 1,
          total: queuedJobs.length,
          uploaded,
          failed,
          message: `Uploaded/scheduled ${i + 1}/${queuedJobs.length}: ${job.videoName}`,
          state: appStore.getState()
        });
      } catch (err) {
        failed++;
        appStore.updateJob(job.id, { status: 'reel_upload_failed', error: err.message, rawError: describeBackendError(err) });
        appStore.log('error', `Facebook Reel Studio upload failed for ${job.videoName}: ${err.message}`, {
          details: describeBackendError(err),
          endpoint: '/video_reels',
          slot: job.slotLabel,
          scheduledUnix: job.scheduledUnix
        });
        if (event && event.sender) event.sender.send('scheduler:progress', {
          type: 'reel-job-failed',
          phase: 'Studio upload',
          percent: Math.round(5 + ((i + 1) / queuedJobs.length) * 85),
          current: i + 1,
          total: queuedJobs.length,
          uploaded,
          failed,
          message: `Failed ${i + 1}/${queuedJobs.length}: ${err.message}`,
          state: appStore.getState()
        });
      }
    }

    const stopped = schedulerControl && schedulerControl.stopRequested;
    const message = stopped
      ? `Studio upload stopped. Uploaded/scheduled ${uploaded}, failed ${failed}.`
      : `Studio upload finished. Uploaded/scheduled ${uploaded}, failed ${failed}.`;
    appStore.log('reels', message);
    return { uploaded, published: uploaded, failed, stopped, results, message, state: appStore.getState() };
  } finally {
    if (!options.internal) {
      schedulerRunning = false;
      schedulerControl = null;
    }
  }
}

async function startReelsQueueWatcher(event) {
  // No background watcher. This button uploads all queued items to Meta now and Meta keeps them scheduled.
  return runDueReels(event, {});
}

function stopReelsQueueWatcher() {
  if (schedulerControl) {
    schedulerControl.stopRequested = true;
    if (schedulerControl.abort) schedulerControl.abort();
  }
  if (reelsPublisherTimer) clearInterval(reelsPublisherTimer);
  reelsPublisherTimer = null;
  reelsPublisherActive = false;
  appStore.log('reels', 'Stop upload requested. Current Meta upload may finish, but no new item will start.');
  return { active: false, message: 'Stop upload requested.', state: appStore.getState() };
}

async function publishLabReelNow(event, payload = {}) {
  const videoPath = String(payload.videoPath || '').trim();
  const caption = String(payload.caption || '').trim();
  if (!videoPath) throw new Error('Publishing Lab: choose one video first.');
  if (!fs.existsSync(videoPath)) throw new Error(`Publishing Lab: video not found: ${videoPath}`);
  const video = getVideoMeta(videoPath);
  const job = { id: `lab-reel-${nanoid(8)}`, videoName: video.name, videoPath: video.path, caption, status: 'lab_reel_publishing' };
  const client = new FacebookClient(appStore.getSettings());
  appStore.log('lab', `Publishing Lab: starting Facebook Reel test for ${job.videoName}.`);
  const result = await client.publishReel(job);
  appStore.log('lab', `Publishing Lab: Facebook Reel test completed for ${job.videoName}.`, { endpoint: result.endpoint, metaResponse: result });
  return { result, state: appStore.getState() };
}

async function publishLabLegacyNow(event, payload = {}) {
  const videoPath = String(payload.videoPath || '').trim();
  const caption = String(payload.caption || '').trim();
  if (!videoPath) throw new Error('Publishing Lab: choose one video first.');
  if (!fs.existsSync(videoPath)) throw new Error(`Publishing Lab: video not found: ${videoPath}`);
  const video = getVideoMeta(videoPath);
  const job = { id: `lab-legacy-${nanoid(8)}`, videoName: video.name, videoPath: video.path, caption, status: 'lab_legacy_publishing' };
  const client = new FacebookClient(appStore.getSettings());
  appStore.log('lab', `Publishing Lab: starting legacy Page video test for ${job.videoName}.`);
  const result = await client.publishLegacyVideoNow(job);
  appStore.log('lab', `Publishing Lab: legacy Page video test completed for ${job.videoName}.`, { endpoint: result.endpoint, metaResponse: result });
  return { result, state: appStore.getState() };
}

async function fetchLabDiagnostics(payload = {}) {
  const objectId = String(payload.objectId || '').trim();
  const client = new FacebookClient(appStore.getSettings());
  const result = await client.getVideoDiagnostics(objectId);
  appStore.log('lab', `Fetched diagnostics for ${objectId}.`, result);
  return { result, state: appStore.getState() };
}


async function uploadDraftTest(event, payload = {}) {
  if (schedulerRunning) throw new Error('Scheduler/upload is already running. Stop or wait before starting draft test.');
  schedulerRunning = true;
  const limit = Math.max(1, Math.min(3, Number(payload.limit || 3)));
  const abortController = new AbortController();
  schedulerControl = {
    stopRequested: false,
    signal: abortController.signal,
    abort: () => abortController.abort(),
    isStopped: () => schedulerControl ? schedulerControl.stopRequested : true
  };

  try {
    const settings = appStore.getSettings();
    const client = new FacebookClient(settings);
    event.sender.send('scheduler:progress', {
      type: 'draft-test-start',
      phase: 'Draft test',
      percent: 5,
      message: `Preparing up to ${limit} draft video${limit === 1 ? '' : 's'}...`,
      state: appStore.getState()
    });

    const preview = await buildSafePlanPreview();
    const assignments = (preview.plan.assignments || []).slice(0, limit);
    if (!assignments.length) {
      return {
        uploaded: 0,
        failed: 0,
        message: 'No draft uploads available. Import videos/captions or free schedule slots first.',
        pairing: preview.pairing,
        plan: preview.plan,
        state: appStore.getState()
      };
    }

    const jobs = createJobs(assignments).map(job => ({
      ...job,
      status: 'draft_planned',
      draftMode: true,
      draftTest: true,
      intendedManualSchedule: job.slotLabel,
      uploadMode: 'meta-draft-test'
    }));
    appStore.addJobs(jobs);
    appStore.log('draft', `Created ${jobs.length} draft test job(s). Intended schedule slots are stored locally.`);

    let uploaded = 0;
    let failed = 0;
    const results = [];

    for (let i = 0; i < jobs.length; i++) {
      if (schedulerControl.isStopped()) throw new Error('Draft upload stopped by user.');
      const job = appStore.updateJob(jobs[i].id, { status: 'draft_uploading', attempts: 1, error: null });
      event.sender.send('scheduler:progress', {
        type: 'draft-job-start',
        jobId: job.id,
        phase: 'Draft upload',
        percent: Math.round(10 + (i / jobs.length) * 75),
        message: `Uploading draft ${i + 1}/${jobs.length}: ${job.videoName}`,
        current: i + 1,
        total: jobs.length,
        uploaded,
        failed,
        state: appStore.getState()
      });

      try {
        let result;
        let fallbackNoSchedule = false;
        try {
          result = await client.uploadDraftVideo(job, { includeScheduleTime: true, signal: schedulerControl.signal });
        } catch (err) {
          const msg = String(err.message || '').toLowerCase();
          if (msg.includes('scheduled_publish_time') || msg.includes('unpublished_content_type') || msg.includes('draft')) {
            appStore.log('draft', `Meta rejected draft with schedule time for ${job.videoName}; retrying as plain draft.`, { error: err.message });
            result = await client.uploadDraftVideo(job, { includeScheduleTime: false, signal: schedulerControl.signal });
            fallbackNoSchedule = true;
          } else {
            throw err;
          }
        }

        const updated = appStore.updateJob(job.id, {
          status: 'draft_uploaded',
          fbVideoId: result.id || null,
          fbPostId: result.post_id || null,
          rawResponse: result,
          draftScheduleFallback: fallbackNoSchedule,
          error: fallbackNoSchedule ? 'Meta accepted the draft but rejected API schedule time. Use the stored intended slot manually in Business Suite.' : null
        });
        uploaded++;
        results.push({ job: updated, result, fallbackNoSchedule });
        appStore.log('draft', `Draft uploaded: ${job.videoName}. Intended slot: ${job.slotLabel}.`, { fbVideoId: result.id, fbPostId: result.post_id, fallbackNoSchedule });
        event.sender.send('scheduler:progress', {
          type: 'draft-job-success',
          jobId: job.id,
          phase: 'Draft upload',
          percent: Math.round(10 + ((i + 1) / jobs.length) * 75),
          message: fallbackNoSchedule
            ? `Draft uploaded ${i + 1}/${jobs.length}. Schedule time stored locally: ${job.slotLabel}`
            : `Draft uploaded ${i + 1}/${jobs.length}: ${job.slotLabel}`,
          current: i + 1,
          total: jobs.length,
          uploaded,
          failed,
          state: appStore.getState()
        });
      } catch (err) {
        failed++;
        appStore.updateJob(job.id, { status: 'failed_retryable', error: err.message, rawError: err.meta || null });
        appStore.log('error', `Draft upload failed for ${job.videoName}: ${err.message}`, err.meta || {});
        event.sender.send('scheduler:progress', {
          type: 'draft-job-failed',
          jobId: job.id,
          phase: 'Draft upload',
          percent: Math.round(10 + ((i + 1) / jobs.length) * 75),
          message: `Draft failed ${i + 1}/${jobs.length}: ${err.message}`,
          current: i + 1,
          total: jobs.length,
          uploaded,
          failed,
          state: appStore.getState()
        });
      }
    }

    const message = `Draft test finished. Uploaded drafts: ${uploaded}. Failed: ${failed}.`;
    appStore.log('draft', message);
    event.sender.send('scheduler:progress', {
      type: 'draft-test-done',
      phase: 'Draft test done',
      percent: 100,
      message,
      uploaded,
      failed,
      state: appStore.getState()
    });
    return { uploaded, failed, results, state: appStore.getState() };
  } finally {
    schedulerRunning = false;
    schedulerControl = null;
  }
}

function buildDraftSessionSlots(videoCount, startDateISO, timeValues, settings) {
  const timezone = settings.timezone || 'Europe/London';
  const minLeadMinutes = Number(settings.minLeadMinutes || 20);
  const rawTimes = Array.isArray(timeValues) && timeValues.length ? timeValues : (settings.dailySlots || []);
  const times = [...new Set(rawTimes.map(normaliseDraftTime).filter(Boolean))].sort();
  if (!times.length) throw new Error('No valid draft times selected. Choose at least one time or set default slots in Settings.');

  let day = startDateISO
    ? DateTime.fromISO(String(startDateISO), { zone: timezone })
    : DateTime.now().setZone(timezone);
  if (!day.isValid) throw new Error('Invalid draft start date.');
  day = day.startOf('day');

  const earliest = DateTime.now().setZone(timezone).plus({ minutes: minLeadMinutes });
  const slots = [];
  let guardDays = 0;
  while (slots.length < videoCount && guardDays < 370) {
    for (const time of times) {
      const [hour, minute] = time.split(':').map(Number);
      const dt = day.set({ hour, minute, second: 0, millisecond: 0 });
      if (dt > earliest) {
        slots.push({
          scheduledISO: dt.toISO(),
          scheduledUnix: Math.floor(dt.toSeconds()),
          label: dt.toFormat('ccc, LLL dd, h:mm a'),
          time
        });
        if (slots.length >= videoCount) break;
      }
    }
    day = day.plus({ days: 1 });
    guardDays++;
  }
  if (!slots.length) throw new Error('No valid future draft time was created. Choose a future date/time or use Settings slots.');
  return slots;
}

function normaliseDraftTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getVideoMeta(filePath) {
  const stat = fs.statSync(filePath);
  return {
    id: nanoid(12),
    path: filePath,
    originalPath: filePath,
    name: path.basename(filePath),
    size: stat.size,
    videoHash: hashFileSync(filePath),
    videoKey: `session:${filePath}:${stat.size}:${stat.mtimeMs}`
  };
}


function describeBackendError(err) {
  const axiosResponse = err && err.response ? err.response : null;
  return {
    name: err && err.name ? err.name : 'Error',
    message: err && err.message ? err.message : String(err),
    code: err && err.code ? err.code : null,
    meta: err && err.meta ? err.meta : null,
    httpStatus: axiosResponse ? axiosResponse.status : null,
    responseData: axiosResponse ? axiosResponse.data : null,
    stack: err && err.stack ? String(err.stack).split('\n').slice(0, 8).join('\n') : null
  };
}

async function uploadDraftSession(event, payload = {}) {
  if (schedulerRunning) throw new Error('Another upload is already running. Stop or wait before starting Draft Studio.');
  schedulerRunning = true;
  const abortController = new AbortController();
  schedulerControl = {
    stopRequested: false,
    signal: abortController.signal,
    abort: () => abortController.abort(),
    isStopped: () => schedulerControl ? schedulerControl.stopRequested : true
  };

  try {
    const settings = appStore.getSettings();
    const client = new FacebookClient(settings);
    const videoPaths = Array.isArray(payload.videoPaths) ? payload.videoPaths.filter(Boolean) : [];
    const captions = splitCaptionBlocks(payload.captionText || '', settings.captionSplitMode || 'auto');
    if (!videoPaths.length) throw new Error('Draft Studio cannot start: select at least one video for this session.');
    if (!captions.length) throw new Error('Draft Studio cannot start: add captions for this session.');

    const videos = [];
    for (const filePath of videoPaths) {
      if (!fs.existsSync(filePath)) throw new Error(`Selected video no longer exists: ${filePath}`);
      videos.push(getVideoMeta(filePath));
    }
    const pairCount = Math.min(videos.length, captions.length);
    if (!pairCount) throw new Error('Draft Studio cannot start: no video/caption pairs were created.');
    const slots = buildDraftSessionSlots(pairCount, payload.startDate, payload.times, settings);

    const jobs = videos.slice(0, pairCount).map((video, index) => {
      const slot = slots[index];
      return {
        id: `draft-session-${nanoid(10)}`,
        videoId: video.id,
        videoName: video.name,
        videoPath: video.path,
        videoHash: video.videoHash,
        videoKey: video.videoKey,
        caption: captions[index],
        captionName: `session-caption-${index + 1}.txt`,
        captionHash: crypto.createHash('sha256').update(captions[index], 'utf8').digest('hex'),
        captionKey: `session-caption-${index + 1}`,
        scheduledISO: slot.scheduledISO,
        scheduledUnix: slot.scheduledUnix,
        slotLabel: slot.label,
        status: 'draft_session_planned',
        draftMode: true,
        draftSession: true,
        uploadMode: 'meta-draft-session',
        createdAt: new Date().toISOString()
      };
    });

    appStore.log('draft', `Draft Studio session started with ${jobs.length} selected video(s). Old local library/cache ignored.`, { videoCount: videos.length, captionCount: captions.length, pairCount, startDate: payload.startDate || null, times: Array.isArray(payload.times) ? payload.times : [], note: 'Session mode does not use local imported video/caption cache and does not block duplicate file reuse.' });
    event.sender.send('scheduler:progress', {
      type: 'draft-session-start',
      phase: 'Draft Studio',
      percent: 2,
      message: `Uploading ${jobs.length} session draft${jobs.length === 1 ? '' : 's'}...`,
      current: 0,
      total: jobs.length,
      uploaded: 0,
      failed: 0,
      state: appStore.getState()
    });

    let uploaded = 0;
    let failed = 0;
    const results = [];
    for (let i = 0; i < jobs.length; i++) {
      if (schedulerControl.isStopped()) break;
      const job = jobs[i];
      event.sender.send('scheduler:progress', {
        type: 'draft-job-start', phase: 'Draft Studio', percent: Math.round(5 + (i / jobs.length) * 80),
        message: `Uploading draft ${i + 1}/${jobs.length}: ${job.videoName}`,
        current: i + 1, total: jobs.length, uploaded, failed, state: appStore.getState()
      });
      try {
        let result;
        let fallbackNoSchedule = false;
        try {
          result = await client.uploadDraftVideo(job, { includeScheduleTime: true, signal: schedulerControl.signal });
        } catch (err) {
          const msg = String(err.message || '').toLowerCase();
          if (msg.includes('scheduled_publish_time') || msg.includes('unpublished_content_type') || msg.includes('draft')) {
            appStore.log('draft', `Meta rejected draft schedule fields for ${job.videoName}; retrying as plain draft.`, describeBackendError(err));
            result = await client.uploadDraftVideo(job, { includeScheduleTime: false, signal: schedulerControl.signal });
            fallbackNoSchedule = true;
          } else {
            throw err;
          }
        }
        uploaded++;
        results.push({ job: { ...job, status: 'draft_uploaded', fbVideoId: result.id || null, fbPostId: result.post_id || null }, result, fallbackNoSchedule });
        appStore.log('draft', `Draft Studio uploaded: ${job.videoName}. Intended slot: ${job.slotLabel}.`, { fbVideoId: result.id || null, fbPostId: result.post_id || null, fallbackNoSchedule, metaResponse: result });
        event.sender.send('scheduler:progress', {
          type: 'draft-job-success', phase: 'Draft Studio', percent: Math.round(5 + ((i + 1) / jobs.length) * 80),
          message: fallbackNoSchedule ? `Draft uploaded ${i + 1}/${jobs.length}. Intended time: ${job.slotLabel}` : `Draft uploaded ${i + 1}/${jobs.length}: ${job.slotLabel}`,
          current: i + 1, total: jobs.length, uploaded, failed, state: appStore.getState()
        });
      } catch (err) {
        failed++;
        appStore.log('error', `Draft Studio failed for ${job.videoName}: ${err.message}`, { video: job.videoName, intendedSlot: job.slotLabel, details: describeBackendError(err) });
        event.sender.send('scheduler:progress', {
          type: 'draft-job-failed', phase: 'Draft Studio', percent: Math.round(5 + ((i + 1) / jobs.length) * 80),
          message: `Draft failed ${i + 1}/${jobs.length}: ${err.message}`,
          current: i + 1, total: jobs.length, uploaded, failed, state: appStore.getState()
        });
      }
    }

    const stopped = schedulerControl && schedulerControl.stopRequested;
    const message = stopped ? `Draft Studio stopped. Uploaded ${uploaded}, failed ${failed}.` : `Draft Studio finished. Uploaded ${uploaded}, failed ${failed}.`;
    appStore.log('draft', message);
    event.sender.send('scheduler:progress', {
      type: 'draft-session-done', phase: 'Draft Studio', percent: 100,
      message, uploaded, failed, stopped, state: appStore.getState()
    });
    return { uploaded, failed, stopped, results, planned: jobs, state: appStore.getState() };
  } finally {
    schedulerRunning = false;
    schedulerControl = null;
  }
}


function saveLocalFacebookWorkspaceFallback(error) {
  const settings = appStore.getSettings();
  if (!settings.pageId || !settings.pageAccessToken) return null;

  const current = appStore.getWorkspace() || {};
  const account = appStore.getAccountState();
  const previousPage = (current.pages || []).find(page => page.facebookPageId === settings.pageId) || {};
  const page = {
    ...previousPage,
    id: `local-${settings.pageId}`,
    facebookPageId: settings.pageId,
    facebookPageName: settings.connectedPageName || previousPage.facebookPageName || settings.pageId,
    facebookCategory: previousPage.facebookCategory || 'Facebook Page',
    metaAccountId: 'local-facebook-account',
    status: 'ACTIVE',
    isSelected: true,
    localOnly: true
  };
  const limit = Number(current.pageUsage?.limit || account.license?.limits?.pages || 10);
  const warning = cloudErrorMessage(error);

  return appStore.saveWorkspace({
    accounts: [{
      id: 'local-facebook-account',
      facebookUserName: 'Saved Facebook connection',
      status: 'ACTIVE',
      legacyMode: true,
      pages: [page]
    }],
    pages: [page],
    activePage: page,
    pageUsage: { connected: 1, limit },
    plan: current.plan || account.license?.plan || null,
    legacyMode: true,
    syncWarning: warning
  });
}

async function refreshCloudWorkspace({ preferLocalSelection = false } = {}) {
  const session = appStore.getAccountSession();
  if (!session.token) {
    appStore.clearWorkspace();
    return appStore.getWorkspace();
  }

  const settings = appStore.getSettings();
  const client = new CloudClient(settings.cloudApiUrl, session.token);
  try {
    let workspaceData = null;
    try {
      workspaceData = await client.getWorkspace();
    } catch (error) {
      if ([401, 403].includes(error?.response?.status)) throw error;
    }

    let pageData = workspaceData || { pages: [] };
    let accountData = workspaceData || { accounts: [], legacyMode: true };
    if (!workspaceData) {
      let pageRequestError = null;
      try { pageData = await client.listPages(); } catch (error) { pageRequestError = error; }
      try {
        accountData = await client.listMetaAccounts();
      } catch (error) {
        if (pageRequestError) throw pageRequestError;
      }

      if (!Array.isArray(pageData.pages) || !pageData.pages.length) {
        const accountPages = (accountData.accounts || []).flatMap(account => account.pages || []);
        if (accountPages.length) pageData = { ...pageData, pages: accountPages };
      }
    }

    const localSettings = appStore.getSettings();
    let rawPages = Array.isArray(pageData.pages)
      ? pageData.pages.filter(page => page.status !== 'REVOKED')
      : [];
    const localPageIsMissing = localSettings.pageId && !rawPages.some(
      page => page.facebookPageId === localSettings.pageId
    );
    if (localSettings.pageId && localSettings.pageAccessToken && (!rawPages.length || (preferLocalSelection && localPageIsMissing))) {
      rawPages = [...rawPages, {
        id: `local-${localSettings.pageId}`,
        facebookPageId: localSettings.pageId,
        facebookPageName: localSettings.connectedPageName || localSettings.pageId,
        facebookCategory: 'Facebook Page',
        status: 'ACTIVE',
        isSelected: true,
        localOnly: true
      }];
    }
    const serverActivePage = pageData.activePage || null;
    const pages = rawPages.map(page => ({
      ...page,
      facebookCategory: page.facebookCategory || page.category || '',
      isSelected: Boolean(
        preferLocalSelection
          ? localSettings.pageId && page.facebookPageId === localSettings.pageId
          : serverActivePage
            ? page.id === serverActivePage.id
            : page.isSelected || (localSettings.pageId && page.facebookPageId === localSettings.pageId)
      )
    }));

    let accounts = Array.isArray(accountData.accounts) ? accountData.accounts : [];
    if (!accounts.length && pages.length) {
      const legacyAccountId = 'legacy-facebook-account';
      accounts = [{
        id: legacyAccountId,
        facebookUserName: 'Connected Facebook account',
        status: 'ACTIVE',
        legacyMode: true,
        pages: pages.map(page => ({ ...page, metaAccountId: page.metaAccountId || legacyAccountId }))
      }];
      for (const page of pages) page.metaAccountId = page.metaAccountId || legacyAccountId;
    }

    const activePage = pages.find(page => page.isSelected) || serverActivePage || (pages.length === 1 ? pages[0] : null);
    const connected = pages.filter(page => page.status !== 'REVOKED').length;
    const limit = Number(pageData.limit || accountData.pageUsage?.limit || 0);
    const reportedUsage = pageData.pageUsage || accountData.pageUsage || {};
    const workspace = appStore.saveWorkspace({
      accounts,
      pages,
      activePage,
      pageUsage: {
        connected: Math.max(connected, Number(reportedUsage.connected || 0)),
        limit: Number(reportedUsage.limit || limit)
      },
      plan: accountData.plan || pageData.plan || null,
      legacyMode: Boolean(accountData.legacyMode),
      syncWarning: null
    });

    const credentials = pageData.activePageCredentials;
    if (!preferLocalSelection && activePage && credentials?.accessToken) {
      appStore.saveSettings({
        pageId: credentials.pageId || activePage.facebookPageId,
        pageAccessToken: credentials.accessToken,
        connectedPageName: credentials.pageName || activePage.facebookPageName,
        connectionMethod: 'cloud-workspace'
      });
    } else if (!activePage) {
      appStore.saveSettings({
        pageId: '',
        pageAccessToken: '',
        connectedPageName: '',
        connectionMethod: 'facebook-login'
      });
    }

    return workspace;
  } catch (error) {
    const status = error?.response?.status;
    if (![401, 403].includes(status)) {
      const fallback = saveLocalFacebookWorkspaceFallback(error);
      if (fallback) {
        appStore.log('workspace', `Cloud workspace unavailable; using the verified Page saved on this device: ${cloudErrorMessage(error)}`);
        return fallback;
      }
    }
    throw new Error(cloudErrorMessage(error));
  }
}

function requireCloudSession() {
  const session = appStore.getAccountSession();
  if (!session.token) throw new Error('Sign in to INX Social before managing Facebook workspaces.');
  const settings = appStore.getSettings();
  return { session, client: new CloudClient(settings.cloudApiUrl, session.token) };
}

function registerIpc() {
  handleTrustedIpc('state:get', async () => appStore.getState());
  handleTrustedIpc('account:register', async (_, payload) => {
    const settings = appStore.getSettings();
    const baseUrl = String(payload && payload.cloudApiUrl || settings.cloudApiUrl || 'https://api.social.inaxx.co.uk').trim();
    appStore.saveSettings({ cloudApiUrl: baseUrl });
    const client = new CloudClient(baseUrl);
    try {
      const result = await client.register({ name: payload.name, email: payload.email, password: payload.password });
      appStore.saveAccountSession({ token: result.token, user: result.user });
      const account = await refreshCloudAccount({ activate: true });
      await refreshCloudWorkspace();
      appStore.log('account', `Created cloud account for ${result.user.email}.`);
      return { account, state: appStore.getState() };
    } catch (error) { throw new Error(cloudErrorMessage(error)); }
  });

  handleTrustedIpc('account:login', async (_, payload) => {
    const settings = appStore.getSettings();
    const baseUrl = String(payload && payload.cloudApiUrl || settings.cloudApiUrl || 'https://api.social.inaxx.co.uk').trim();
    appStore.saveSettings({ cloudApiUrl: baseUrl });
    const client = new CloudClient(baseUrl);
    try {
      const result = await client.login({ email: payload.email, password: payload.password });
      appStore.saveAccountSession({ token: result.token, user: result.user });
      const account = await refreshCloudAccount({ activate: true });
      await refreshCloudWorkspace();
      appStore.log('account', `Signed in as ${result.user.email}.`);
      return { account, state: appStore.getState() };
    } catch (error) { throw new Error(cloudErrorMessage(error)); }
  });

  handleTrustedIpc('account:refresh', async () => {
    const account = await refreshCloudAccount({ activate: true });
    await refreshCloudWorkspace();
    return { account, state: appStore.getState() };
  });

  handleTrustedIpc('account:logout', async () => {
    const account = appStore.clearAccountSession();
    return { account, state: appStore.getState() };
  });


  handleTrustedIpc('workspace:get', async () => ({ workspace: appStore.getWorkspace(), state: appStore.getState() }));

  handleTrustedIpc('workspace:refresh', async () => {
    const workspace = await refreshCloudWorkspace();
    return { workspace, state: appStore.getState() };
  });

  handleTrustedIpc('workspace:connect-facebook', async () => {
    const { client } = requireCloudSession();
    try {
      // "Connect Facebook Page" must always start a fresh Facebook OAuth flow.
      // Refreshing an existing connection is handled by Refresh Pages instead.
      // The OAuth popup uses a new non-persistent Electron session on every run,
      // allowing the user to sign in with another Facebook account or choose a
      // different Page managed by the same account.
      const localResult = await connectFacebookPageAuto();
      const selected = localResult.page;
      const settings = appStore.getSettings();

      let cloudWarning = null;
      try {
        const cloudPage = await client.connectPage({
          facebookPageId: selected.id,
          facebookPageName: selected.name,
          facebookCategory: selected.category || null,
          accessToken: settings.pageAccessToken,
          metaAppId: settings.facebookAppId
        });
        if (cloudPage?.page?.id) await client.selectPage(cloudPage.page.id);
      } catch (cloudError) {
        cloudWarning = cloudErrorMessage(cloudError);
        appStore.log('workspace', `Facebook Page connected on this device, but cloud sync failed: ${cloudWarning}`);
      }
      // Prefer the Page just verified on this device. This also keeps the UI usable
      // if an older cloud backend has not returned the newly synchronized Page yet.
      const workspace = await refreshCloudWorkspace({ preferLocalSelection: true });
      appStore.log(
        'workspace',
        cloudWarning
          ? `Connected Facebook Page on this device; cloud sync is pending: ${selected.name}.`
          : `Connected Facebook Page to cloud workspace: ${selected.name}.`
      );
      return { page: selected, workspace, warning: cloudWarning, state: appStore.getState() };
    } catch (error) {
      throw new Error(cloudErrorMessage(error));
    }
  });

  handleTrustedIpc('workspace:discover-account', async (_, accessToken) => {
    const { client } = requireCloudSession();
    try { return await client.discoverMetaAccount(accessToken); }
    catch (error) { throw new Error(cloudErrorMessage(error)); }
  });

  handleTrustedIpc('workspace:connect-account', async (_, payload) => {
    const { client } = requireCloudSession();
    try {
      const result = await client.connectMetaAccount(payload);
      const workspace = await refreshCloudWorkspace();
      appStore.log('workspace', `Connected Meta account with ${result.connectedPageCount || 0} Page(s).`);
      return { result, workspace, state: appStore.getState() };
    } catch (error) { throw new Error(cloudErrorMessage(error)); }
  });

  handleTrustedIpc('workspace:sync-account', async (_, accountId) => {
    const { client } = requireCloudSession();
    try {
      const result = await client.syncMetaAccount(accountId);
      const workspace = await refreshCloudWorkspace();
      return { result, workspace, state: appStore.getState() };
    } catch (error) { throw new Error(cloudErrorMessage(error)); }
  });

  handleTrustedIpc('workspace:disconnect-account', async (_, accountId) => {
    const { client } = requireCloudSession();
    try {
      const result = await client.disconnectMetaAccount(accountId);
      const workspace = await refreshCloudWorkspace();
      return { result, workspace, state: appStore.getState() };
    } catch (error) { throw new Error(cloudErrorMessage(error)); }
  });

  handleTrustedIpc('workspace:select-page', async (_, pageId) => {
    const { client } = requireCloudSession();
    try {
      const currentWorkspace = appStore.getWorkspace();
      const target = (currentWorkspace.pages || []).find(page => page.id === pageId);
      const result = await client.selectPage(pageId);
      let workspace = await refreshCloudWorkspace();
      const selected = workspace.pages.find(page => page.id === pageId) || target || workspace.activePage;
      if (selected) {
        const existingSettings = appStore.getSettings();
        if (existingSettings.pageId !== selected.facebookPageId || !existingSettings.pageAccessToken) {
          throw new Error('Reconnect this Page through Facebook Login before selecting it for publishing. Its Page access token is not stored on this device.');
        }
        appStore.saveSettings({
          pageId: selected.facebookPageId,
          connectedPageName: selected.facebookPageName,
          connectionMethod: result.legacyMode ? 'facebook-login' : 'cloud-workspace'
        });
        workspace = appStore.saveWorkspace({
          ...workspace,
          pages: workspace.pages.map(page => ({ ...page, isSelected: page.id === selected.id })),
          activePage: { ...selected, isSelected: true }
        });
      }
      return { result, workspace, state: appStore.getState() };
    } catch (error) { throw new Error(cloudErrorMessage(error)); }
  });

  handleTrustedIpc('workspace:revoke-page', async (_, pageId) => {
    const { client } = requireCloudSession();
    try {
      const result = await client.revokePage(pageId);
      const workspace = await refreshCloudWorkspace();
      return { result, workspace, state: appStore.getState() };
    } catch (error) { throw new Error(cloudErrorMessage(error)); }
  });


  handleTrustedIpc('settings:save', async (_, settings) => {
    const safeSettings = { ...(settings || {}) };
    delete safeSettings.pageAccessToken;
    appStore.saveSettings(safeSettings);
    return { settings: appStore.getRendererSettings(), state: appStore.getState() };
  });

  handleTrustedIpc('ui-texts:save', async (_, uiTexts) => {
    const saved = appStore.saveUITexts(uiTexts);
    return { uiTexts: saved, state: appStore.getState() };
  });

  handleTrustedIpc('ui-texts:reset', async () => {
    const saved = appStore.resetUITexts();
    return { uiTexts: saved, state: appStore.getState() };
  });

  handleTrustedIpc('files:pick-videos', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose videos',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm'] }]
    });
    if (result.canceled) return { accepted: [], rejected: [], state: appStore.getState() };
    return importFiles(appStore, result.filePaths, 'video');
  });

  handleTrustedIpc('files:pick-captions', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose captions',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Text captions', extensions: ['txt', 'md'] }]
    });
    if (result.canceled) return { accepted: [], rejected: [], state: appStore.getState() };
    return importFiles(appStore, result.filePaths, 'caption');
  });

  handleTrustedIpc('folders:pick-videos', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose a folder containing videos',
      properties: ['openDirectory']
    });
    if (result.canceled) return { accepted: [], rejected: [], state: appStore.getState() };
    const files = collectFilesFromFolder(result.filePaths[0], 'video');
    return importFiles(appStore, files, 'video');
  });

  handleTrustedIpc('folders:pick-captions', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose a folder containing captions',
      properties: ['openDirectory']
    });
    if (result.canceled) return { accepted: [], rejected: [], state: appStore.getState() };
    const files = collectFilesFromFolder(result.filePaths[0], 'caption');
    return importFiles(appStore, files, 'caption');
  });

  handleTrustedIpc('files:import-dropped', async (_, { paths, type }) => {
    return importFiles(appStore, Array.isArray(paths) ? paths : [], type);
  });

  handleTrustedIpc('captions:import-text', async (_, { text, sourceName }) => {
    return importCaptionText(appStore, text, sourceName || 'pasted-captions.txt');
  });


  handleTrustedIpc('schedule:preview', async () => {
    const preview = await buildSafePlanPreview();
    return { ...preview, state: appStore.getState() };
  });

  handleTrustedIpc('schedule:create-plan', async () => {
    const result = await createSafeLocalPlan();
    return result;
  });


  handleTrustedIpc('reels:pick-session-videos', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select videos for Reels Queue',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm'] }]
    });
    if (result.canceled) return { paths: [] };
    return { paths: result.filePaths || [] };
  });

  handleTrustedIpc('reels:pick-caption-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Reels Queue caption file',
      properties: ['openFile'],
      filters: [{ name: 'Text files', extensions: ['txt', 'md'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { text: '', path: '' };
    return { text: fs.readFileSync(result.filePaths[0], 'utf8'), path: result.filePaths[0] };
  });

  handleTrustedIpc('reels:create-queue', async (_, payload) => {
    return createReelsQueue(payload || {});
  });

  handleTrustedIpc('reels:run-due', async (event, payload = {}) => {
    await assertCloudAccess();
    return runDueReels(event, { jobIds: Array.isArray(payload.jobIds) ? payload.jobIds : [] });
  });

  handleTrustedIpc('reels:start-watcher', async (event) => {
    await assertCloudAccess();
    return startReelsQueueWatcher(event);
  });

  handleTrustedIpc('reels:stop-watcher', async () => {
    return stopReelsQueueWatcher();
  });

  handleTrustedIpc('lab:publish-reel-now', async (event, payload) => {
    await assertCloudAccess();
    return publishLabReelNow(event, payload || {});
  });

  handleTrustedIpc('lab:publish-legacy-now', async (event, payload) => {
    await assertCloudAccess();
    return publishLabLegacyNow(event, payload || {});
  });

  handleTrustedIpc('lab:diagnostics', async (_, payload) => {
    return fetchLabDiagnostics(payload || {});
  });

  handleTrustedIpc('schedule:run', async event => {
    await assertCloudAccess();
    if (schedulerRunning) throw new Error('Scheduler is already running.');
    schedulerRunning = true;
    const abortController = new AbortController();
    schedulerControl = {
      stopRequested: false,
      signal: abortController.signal,
      abort: () => abortController.abort(),
      isStopped: () => schedulerControl ? schedulerControl.stopRequested : true
    };
    try {
      // Safe beginner behaviour: every click checks the imported media, creates
      // only missing local jobs, and skips anything already planned/scheduled.
      // Existing local jobs and live Meta scheduled slots are treated as occupied.
      const planResult = await createSafeLocalPlan();
      if (planResult.jobs.length) {
        event.sender.send('scheduler:progress', {
          type: 'auto-plan',
          message: `Created ${planResult.jobs.length} new safe schedule job(s). Starting upload...`,
          percent: 10,
          phase: 'Planning',
          state: appStore.getState()
        });
      } else {
        event.sender.send('scheduler:progress', {
          type: 'auto-plan-empty',
          message: 'No new jobs created. Existing planned jobs will upload, if any.',
          percent: 10,
          phase: 'Planning',
          state: appStore.getState()
        });
      }

      const uploadResult = await runScheduler(appStore, payload => {
        event.sender.send('scheduler:progress', payload);
      }, schedulerControl);
      return {
        ...uploadResult,
        planSummary: {
          pairs: planResult.pairing.pairs.length,
          assignments: planResult.plan.assignments.length,
          unmatchedVideos: planResult.pairing.unmatchedVideos.length,
          unmatchedCaptions: planResult.pairing.unmatchedCaptions.length,
          metaOccupiedSlotCount: planResult.metaOccupiedSlotCount,
          maxDateISO: planResult.plan.maxDateISO
        }
      };
    } finally {
      schedulerRunning = false;
      schedulerControl = null;
    }
  });

  handleTrustedIpc('draft:upload-test', async (event, payload) => {
    await assertCloudAccess();
    return uploadDraftTest(event, payload || { limit: 3 });
  });

  handleTrustedIpc('draft:pick-session-videos', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Draft Studio videos for this session',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm'] }]
    });
    if (result.canceled) return { paths: [] };
    return { paths: result.filePaths || [] };
  });

  handleTrustedIpc('draft:pick-session-caption-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Draft Studio caption file',
      properties: ['openFile'],
      filters: [{ name: 'Text files', extensions: ['txt', 'md'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { text: '', path: '' };
    return { text: fs.readFileSync(result.filePaths[0], 'utf8'), path: result.filePaths[0] };
  });

  handleTrustedIpc('draft:upload-session', async (event, payload) => {
    await assertCloudAccess();
    return uploadDraftSession(event, payload || {});
  });

  handleTrustedIpc('schedule:stop', async event => {
    if (!schedulerRunning || !schedulerControl) {
      return { stopped: false, message: 'Scheduler is not running.', state: appStore.getState() };
    }
    schedulerControl.stopRequested = true;
    schedulerControl.abort();
    appStore.log('scheduler', 'Stop requested by user. Active upload will cancel if possible; remaining jobs stay local.');
    event.sender.send('scheduler:progress', {
      type: 'stop-requested',
      message: 'Stop requested. Cancelling current upload and keeping remaining jobs local...',
      percent: null,
      phase: 'Stopping',
      state: appStore.getState()
    });
    return { stopped: true, message: 'Stop requested.', state: appStore.getState() };
  });


  handleTrustedIpc('manual:pick-video', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose one video for manual scheduling',
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm'] }]
    });
    if (result.canceled || !result.filePaths.length) return { path: null };
    return { path: result.filePaths[0] };
  });

  handleTrustedIpc('manual:health-check', async (_, payload) => {
    return buildManualHealth(payload || {});
  });

  handleTrustedIpc('manual:schedule', async (event, payload) => {
    await assertCloudAccess();
    return scheduleManualPost(payload || {}, event);
  });

  handleTrustedIpc('manual:schedule-and-upload', async (event, payload) => {
    await assertCloudAccess();
    return scheduleManualPostAndUpload(payload || {}, event);
  });

  handleTrustedIpc('health:run', async () => {
    return buildHealthCheck();
  });

  handleTrustedIpc('facebook:connect-page', async () => {
    const result = await connectFacebookPageAuto();
    return result;
  });

  handleTrustedIpc('facebook:disconnect-page', async () => {
    appStore.saveSettings({ pageId: '', pageAccessToken: '', connectedPageName: '', connectionMethod: 'manual' });
    appStore.clearWorkspace();
    appStore.log('facebook', 'Facebook Page connection cleared from Settings.');
    return { settings: appStore.getRendererSettings(), state: appStore.getState() };
  });

  handleTrustedIpc('facebook:test', async () => {
    let workspace = appStore.getWorkspace();
    let activePage = workspace.activePage || (workspace.pages || []).find(page => page.isSelected) || null;
    let settings = appStore.getSettings();
    let expectedPageId = String(activePage?.facebookPageId || settings.pageId || '');

    // Page selection is stored in the cloud workspace. If the active Page and
    // the local publishing credential ever drift apart, refresh before testing
    // so this action always follows the current Active Page selector.
    if (activePage && (String(settings.pageId || '') !== expectedPageId || !settings.pageAccessToken)) {
      workspace = await refreshCloudWorkspace();
      activePage = workspace.activePage || (workspace.pages || []).find(page => page.isSelected) || null;
      settings = appStore.getSettings();
      expectedPageId = String(activePage?.facebookPageId || settings.pageId || '');
    }

    if (!expectedPageId || !settings.pageAccessToken) {
      throw new Error('No active Facebook Page is connected. Open Pages, connect a Page, and select it first.');
    }
    if (String(settings.pageId || '') !== expectedPageId) {
      throw new Error('The active Facebook Page credential could not be loaded. Refresh Pages and try again.');
    }

    const client = new FacebookClient(settings);
    const verifiedPage = await client.testConnection();
    if (String(verifiedPage.id || '') !== expectedPageId) {
      throw new Error('Facebook returned a different Page than the selected Active Page. Reconnect this Page before publishing.');
    }

    const result = { id: verifiedPage.id, name: verifiedPage.name || activePage?.facebookPageName || settings.connectedPageName || verifiedPage.id };
    if (result.name !== settings.connectedPageName) appStore.saveSettings({ connectedPageName: result.name });
    appStore.log('facebook', `Active Facebook Page verified: ${result.name}.`, { pageId: result.id });
    return { result, activePage: { id: result.id, name: result.name }, state: appStore.getState() };
  });

  handleTrustedIpc('facebook:list-scheduled', async () => {
    const client = new FacebookClient(appStore.getSettings());
    const result = await client.listScheduledPosts();
    appStore.log('facebook', `Fetched ${result.data ? result.data.length : 0} scheduled posts from Meta.`);
    return { result, state: appStore.getState() };
  });

  handleTrustedIpc('jobs:delete-local', async (_, id) => {
    const jobs = appStore.deleteJob(id);
    return { jobs, state: appStore.getState() };
  });

  handleTrustedIpc('data:clear-all', async () => appStore.clearAll());

  handleTrustedIpc('app:open-user-data', async () => {
    await shell.openPath(app.getPath('userData'));
    return app.getPath('userData');
  });

  handleTrustedIpc('app:open-external-url', async (_, url) => {
    const safeUrl = String(url || '');
    if (!isAllowedExternalUrl(safeUrl)) throw new Error('Only approved Facebook HTTPS links can be opened from INX Social.');
    await shell.openExternal(safeUrl);
    return true;
  });
}
