(() => {
  'use strict';

  const TOKEN_KEY = 'inx-social-cloud-token';
  const FACEBOOK_APP_ID = '969283649323618';
  const files = new Map();
  const jobFiles = new Map();
  const progressListeners = new Set();
  let localVideos = [];
  let localCaptions = [];
  let cachedState = unauthenticatedState();
  let stopRequested = false;

  function unauthenticatedState() {
    return {
      settings: {
        cloudApiUrl: location.origin,
        timezone: 'Europe/London',
        dailySlots: ['11:00', '15:13', '22:15', '23:15'],
        maxScheduleDays: 25,
        minLeadMinutes: 20,
        maxRetries: 3,
        retryBaseDelayMs: 5000,
        captionSplitMode: 'auto',
        uiTheme: 'aurora',
        uiDensity: 'comfortable',
        enableMotion: true
      },
      uiTexts: {
        appTitle: 'INX Social',
        appSubtitle: 'Content Scheduler',
        dashboardTitle: 'Dashboard',
        dashboardSubtitle: 'Plan and schedule content across your connected Pages.'
      },
      videos: [],
      captions: [],
      jobs: [],
      logs: [],
      account: { authenticated: false, user: null, license: null },
      workspace: { accounts: [], pages: [], activePage: null, pageUsage: null, plan: null },
      paths: { userData: 'Browser session', videoRoot: '', captionRoot: '' }
    };
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('inxToken') || '';
  }

  async function api(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (token()) headers.set('Authorization', `Bearer ${token()}`);
    if (options.body && !(options.body instanceof Blob) && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(url, { ...options, headers });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const message = payload?.error || payload?.message || `Request failed (HTTP ${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function withLocalState(serverState) {
    cachedState = {
      ...serverState,
      settings: { ...serverState.settings, cloudApiUrl: location.origin },
      videos: [...localVideos],
      captions: [...localCaptions]
    };
    return cachedState;
  }

  async function fetchState() {
    if (!token()) {
      cachedState = unauthenticatedState();
      return cachedState;
    }
    try {
      const result = await api('/api/studio/desktop-state');
      return withLocalState(result.state);
    } catch (error) {
      if (error.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('inxToken');
        cachedState = unauthenticatedState();
        return cachedState;
      }
      throw error;
    }
  }

  function emit(payload) {
    const event = { ...payload, state: payload.state || cachedState };
    for (const listener of progressListeners) {
      try { listener(event); } catch (_) {}
    }
  }

  function fileId(file) {
    const id = `webfile:${crypto.randomUUID()}`;
    files.set(id, file);
    return id;
  }

  function fileName(id) {
    return files.get(id)?.name || String(id || '').split(/[\\/]/).pop() || 'video';
  }

  function videoMeta(id, file) {
    return {
      id,
      name: file.name,
      path: id,
      size: file.size,
      type: file.type,
      importedAt: new Date().toISOString(),
      browserSession: true
    };
  }

  function captionBlocks(text) {
    const normal = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normal) return [];
    const paragraphs = normal.split(/\n\s*\n+/).map(value => value.trim()).filter(Boolean);
    if (paragraphs.length > 1) return paragraphs;
    return normal.split('\n').map(value => value.trim()).filter(Boolean);
  }

  function captionMeta(content, sourceName, index) {
    return {
      id: `caption:${crypto.randomUUID()}`,
      name: `${sourceName || 'caption'} #${index + 1}`,
      sourceName: sourceName || 'browser-caption.txt',
      sourceIndex: index,
      content,
      importedAt: new Date().toISOString(),
      browserSession: true
    };
  }

  function chooseFiles({ accept, multiple = false, directory = false }) {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept || '';
      input.multiple = multiple || directory;
      if (directory) input.webkitdirectory = true;
      input.style.display = 'none';
      document.body.appendChild(input);
      let settled = false;
      const finish = values => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(values);
      };
      input.addEventListener('change', () => finish([...input.files]));
      // Chromium fires "cancel" when the chooser closes without a selection.
      // A window-focus fallback can run before the file input's change event on
      // Windows, which incorrectly turned a valid single-file choice into [].
      input.addEventListener('cancel', () => finish([]), { once: true });
      input.click();
    });
  }

  async function pickVideoFiles(directory = false) {
    const selected = await chooseFiles({
      accept: 'video/mp4,video/quicktime,.mp4,.mov,.m4v,.avi,.mkv,.webm',
      multiple: true,
      directory
    });
    return selected.filter(file => /\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(file.name));
  }

  async function pickCaptionFiles(directory = false) {
    const selected = await chooseFiles({ accept: '.txt,.md,text/plain', multiple: true, directory });
    return selected.filter(file => /\.(txt|md)$/i.test(file.name));
  }

  async function importVideos(selected) {
    const accepted = [];
    for (const file of selected) {
      const id = fileId(file);
      const meta = videoMeta(id, file);
      localVideos.push(meta);
      accepted.push(meta);
    }
    withLocalState(cachedState);
    return { accepted, rejected: [], state: cachedState };
  }

  async function importCaptions(selected) {
    const accepted = [];
    for (const file of selected) {
      const text = await file.text();
      captionBlocks(text).forEach((content, index) => {
        const meta = captionMeta(content, file.name, index);
        localCaptions.push(meta);
        accepted.push(meta);
      });
    }
    withLocalState(cachedState);
    return { accepted, rejected: [], state: cachedState };
  }

  function scheduleSlots(count, startDate, requestedTimes) {
    const settings = cachedState.settings || {};
    const times = [...new Set(
      (requestedTimes?.length ? requestedTimes : settings.dailySlots || [])
        .filter(value => /^\d{2}:\d{2}$/.test(value))
    )].sort();
    if (!times.length) throw new Error('Choose at least one valid daily time.');
    const occupied = new Set(
      (cachedState.jobs || [])
        .filter(job => !String(job.status || '').includes('failed') && job.scheduledAtISO)
        .map(job => new Date(job.scheduledAtISO).toISOString().slice(0, 16))
    );
    const start = new Date(`${startDate || new Date().toISOString().slice(0, 10)}T00:00:00`);
    if (Number.isNaN(start.getTime())) throw new Error('Choose a valid start date.');
    const earliest = Date.now() + Math.max(20, Number(settings.minLeadMinutes || 20)) * 60000;
    const maxDays = Math.min(25, Number(settings.maxScheduleDays || 25));
    const result = [];
    for (let day = 0; day < maxDays && result.length < count; day++) {
      for (const value of times) {
        const [hours, minutes] = value.split(':').map(Number);
        const date = new Date(start);
        date.setDate(start.getDate() + day);
        date.setHours(hours, minutes, 0, 0);
        const key = date.toISOString().slice(0, 16);
        if (date.getTime() >= earliest && !occupied.has(key)) {
          occupied.add(key);
          result.push(date);
          if (result.length >= count) break;
        }
      }
    }
    if (result.length < count) {
      throw new Error(`Only ${result.length} future slot(s) are available inside ${maxDays} days.`);
    }
    return result;
  }

  async function createCloudJob({ id, file, caption, scheduledAt = null, publishMode = 'SCHEDULED' }) {
    const active = cachedState.workspace?.activePage;
    if (!active) throw new Error('Connect and select a Facebook Page first.');
    const immediate = publishMode === 'NOW';
    return api('/api/studio/jobs', {
      method: 'POST',
      body: JSON.stringify({
        connectedPageId: active.id,
        clientRequestId: `web-${crypto.randomUUID()}`,
        caption,
        originalFileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSizeBytes: String(file.size),
        scheduledAt: immediate ? null : scheduledAt.toISOString(),
        publishMode: immediate ? 'NOW' : 'SCHEDULED'
      })
    }).then(result => {
      jobFiles.set(result.job.id, file);
      if (id) jobFiles.set(id, file);
      return result.job;
    });
  }

  async function uploadJob(jobId, file, index, total, counters) {
    emit({
      type: 'reel-job-start',
      phase: 'Studio upload',
      percent: Math.round(5 + (index / total) * 90),
      current: index + 1,
      total,
      uploaded: counters.uploaded,
      failed: counters.failed,
      message: `Uploading ${index + 1}/${total}: ${file.name}. Keep this browser open.`
    });
    const result = await api(`/api/studio/jobs/${encodeURIComponent(jobId)}/video`, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    counters.uploaded += 1;
    emit({
      type: 'reel-job-success',
      phase: 'Studio upload',
      percent: Math.round(5 + ((index + 1) / total) * 90),
      current: index + 1,
      total,
      uploaded: counters.uploaded,
      failed: counters.failed,
      message: job.publishMode === 'NOW' ? `Published on Facebook ${index + 1}/${total}: ${file.name}` : `Scheduled on Meta ${index + 1}/${total}: ${file.name}`
    });
    return result;
  }

  async function createQueue(payload = {}) {
    const paths = Array.isArray(payload.videoPaths) ? payload.videoPaths : [];
    const captions = captionBlocks(payload.captionText || '');
    const count = Math.min(paths.length, captions.length);
    if (!count) throw new Error('Select at least one video and one caption.');
    const immediate = String(payload.publishMode || '').toUpperCase() === 'NOW';
    const slots = immediate ? [] : scheduleSlots(count, payload.startDate, payload.times);
    const jobs = [];
    for (let index = 0; index < count; index++) {
      const file = files.get(paths[index]);
      if (!file) throw new Error(`The browser no longer has access to ${fileName(paths[index])}. Select it again.`);
      jobs.push(await createCloudJob({
        id: paths[index],
        file,
        caption: captions[index],
        scheduledAt: immediate ? null : slots[index],
        publishMode: immediate ? 'NOW' : 'SCHEDULED'
      }));
    }
    await fetchState();
    return { jobs, state: cachedState };
  }

  async function runJobs(payload = {}) {
    stopRequested = false;
    const requested = new Set(Array.isArray(payload.jobIds) ? payload.jobIds : []);
    const candidates = (cachedState.jobs || [])
      .filter(job => ['reel_queued', 'reel_upload_failed'].includes(job.status))
      .filter(job => !requested.size || requested.has(job.id))
      .filter(job => jobFiles.has(job.id));
    if (!candidates.length) {
      return { uploaded: 0, published: 0, failed: 0, message: 'No selected browser videos are ready to upload.', state: cachedState };
    }
    const counters = { uploaded: 0, failed: 0 };
    const results = [];
    for (let index = 0; index < candidates.length; index++) {
      if (stopRequested) break;
      const job = candidates[index];
      const file = jobFiles.get(job.id);
      try {
        results.push(await uploadJob(job.id, file, index, candidates.length, counters));
        jobFiles.delete(job.id);
      } catch (error) {
        counters.failed += 1;
        emit({
          type: 'reel-job-failed',
          phase: 'Studio upload',
          percent: Math.round(5 + ((index + 1) / candidates.length) * 90),
          current: index + 1,
          total: candidates.length,
          uploaded: counters.uploaded,
          failed: counters.failed,
          message: `${file.name} failed: ${error.message}`
        });
      }
    }
    await fetchState();
    const immediateCount = candidates.filter(job => job.publishMode === 'NOW').length;
    const scheduledCount = candidates.length - immediateCount;
    const completion = immediateCount && !scheduledCount
      ? `Published ${counters.uploaded}`
      : scheduledCount && !immediateCount
        ? `Scheduled ${counters.uploaded}`
        : `Completed ${counters.uploaded}`;
    const message = stopRequested
      ? `Upload stopped. ${completion}, failed ${counters.failed}.`
      : `Upload finished. ${completion}, failed ${counters.failed}.`;
    emit({ type: 'reel-finished', phase: 'Done', percent: 100, ...counters, message, state: cachedState });
    return { ...counters, published: counters.uploaded, stopped: stopRequested, results, message, state: cachedState };
  }

  async function workspaceResult() {
    await fetchState();
    return { workspace: cachedState.workspace, state: cachedState };
  }

  async function facebookLogin() {
    const stateValue = crypto.randomUUID();
    const initialPages = new Map(
      (cachedState.workspace?.pages || []).map(page => [
        String(page.facebookPageId || page.id),
        String(page.lastSyncAt || '')
      ])
    );
    const redirectUri = `${location.origin}/studio/facebook-callback.html`;
    const url = new URL(`https://www.facebook.com/${cachedState.settings.graphVersion || 'v25.0'}/dialog/oauth`);
    url.searchParams.set('client_id', FACEBOOK_APP_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'token');
    url.searchParams.set('scope', 'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,business_management');
    url.searchParams.set('state', stateValue);
    url.searchParams.set('auth_type', 'rerequest');
    url.searchParams.set('return_scopes', 'true');

    sessionStorage.setItem('inx-facebook-oauth-state', stateValue);
    sessionStorage.removeItem('inx-facebook-oauth-notice');
    const resultKey = `inx-facebook-oauth-result:${stateValue}`;
    localStorage.removeItem(resultKey);

    const width = 620;
    const height = 760;
    const left = Math.max(0, Math.round((window.screenX || 0) + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round((window.screenY || 0) + (window.outerHeight - height) / 2));
    const popup = window.open(
      url.toString(),
      'inxFacebookConnect',
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    if (!popup) {
      throw new Error('Facebook popup was blocked. Allow popups for INX Social and try again.');
    }
    popup.focus();

    return new Promise((resolve, reject) => {
      let settled = false;
      let popupClosedAt = 0;
      let recoveryInFlight = false;
      const cleanup = () => {
        window.removeEventListener('message', receive);
        window.removeEventListener('storage', receiveStored);
        clearInterval(closedCheck);
        clearTimeout(timeout);
        localStorage.removeItem(resultKey);
      };
      const finish = async message => {
        if (settled) return;
        settled = true;
        cleanup();
        if (message.ok) {
          try { popup.close(); } catch (_) {}
          await fetchState();
          resolve({
            state: cachedState,
            workspace: cachedState.workspace,
            notice: message.notice || 'Facebook connected. Pages refreshed automatically.'
          });
          return;
        }
        reject(new Error(message.error || 'Facebook connection failed.'));
      };
      const consumeStored = raw => {
        if (!raw) return false;
        try {
          const message = JSON.parse(raw);
          if (message.type !== 'inx-facebook-oauth-result' || message.state !== stateValue) return false;
          finish(message).catch(reject);
          return true;
        } catch (_) {
          return false;
        }
      };
      const receive = event => {
        if (event.origin !== location.origin) return;
        const message = event.data || {};
        if (message.type !== 'inx-facebook-oauth-result' || message.state !== stateValue) return;
        finish(message).catch(reject);
      };
      const receiveStored = event => {
        if (event.key === resultKey) consumeStored(event.newValue);
      };
      const recoverFromServer = async () => {
        if (settled || recoveryInFlight) return false;
        recoveryInFlight = true;
        try {
          await fetchState();
          const currentPages = cachedState.workspace?.pages || [];
          const savedOrUpdated = currentPages.some(page => {
            const id = String(page.facebookPageId || page.id);
            if (!initialPages.has(id)) return true;
            return String(page.lastSyncAt || '') !== initialPages.get(id);
          });
          if (savedOrUpdated) {
            await finish({
              ok: true,
              notice: 'Facebook connected. Pages refreshed automatically.'
            });
            return true;
          }
        } catch (_) {
          // The normal timeout still reports a failure if the server remains unavailable.
        } finally {
          recoveryInFlight = false;
        }
        return false;
      };
      window.addEventListener('message', receive);
      window.addEventListener('storage', receiveStored);
      const closedCheck = setInterval(() => {
        if (settled || consumeStored(localStorage.getItem(resultKey))) return;
        if (popup.closed) {
          popupClosedAt = popupClosedAt || Date.now();
          recoverFromServer().catch(() => {});
          if (Date.now() - popupClosedAt >= 12000 && !recoveryInFlight) {
            finish({ ok: false, error: 'Facebook connection was closed before it completed.' }).catch(reject);
          }
        } else {
          popupClosedAt = 0;
        }
      }, 500);
      const timeout = setTimeout(() => {
        try { popup.close(); } catch (_) {}
        finish({ ok: false, error: 'Facebook connection timed out. Please try again.' }).catch(reject);
      }, 5 * 60 * 1000);
    });
  }

  async function savePreferences(settings, uiTexts) {
    const payload = {};
    if (settings) {
      const {
        timezone, dailySlots, maxScheduleDays, minLeadMinutes, maxRetries,
        retryBaseDelayMs, preferExactFilenameMatch, captionSplitMode,
        uiTheme, uiDensity, enableMotion
      } = settings;
      payload.settings = {
        timezone,
        dailySlots: Array.isArray(dailySlots)
          ? dailySlots
          : String(dailySlots || '').split(/[\n,]+/).map(value => value.trim()).filter(Boolean),
        maxScheduleDays,
        minLeadMinutes,
        maxRetries,
        retryBaseDelayMs,
        preferExactFilenameMatch,
        captionSplitMode,
        uiTheme,
        uiDensity,
        enableMotion
      };
      Object.keys(payload.settings).forEach(key => payload.settings[key] === undefined && delete payload.settings[key]);
    }
    if (uiTexts) payload.uiTexts = uiTexts;
    await api('/api/studio/preferences', { method: 'PUT', body: JSON.stringify(payload) });
    await fetchState();
    return cachedState;
  }

  function healthResult(extraChecks = []) {
    const checks = [];
    const add = (level, title, message) => checks.push({ level, title, message });
    if (cachedState.workspace?.activePage) add('ok', 'Active Page', `${cachedState.workspace.activePage.facebookPageName} is selected.`);
    else add('error', 'Active Page', 'Connect and select a Facebook Page.');
    if (localVideos.length) add('ok', 'Browser videos', `${localVideos.length} video(s) selected in this browser session.`);
    else add('warning', 'Browser videos', 'No browser videos are selected yet.');
    if (localCaptions.length) add('ok', 'Captions', `${localCaptions.length} caption(s) are ready.`);
    else add('warning', 'Captions', 'No captions are selected yet.');
    checks.push(...extraChecks);
    const summary = checks.reduce((result, check) => {
      result[check.level] = (result[check.level] || 0) + 1;
      return result;
    }, { ok: 0, warning: 0, error: 0 });
    return { checks, summary, state: cachedState };
  }

  async function manualHealth(payload = {}) {
    const extra = [];
    const file = files.get(payload.videoPath);
    if (file) extra.push({ level: 'ok', title: 'Video', message: `${file.name} (${Math.round(file.size / 1048576)} MB).` });
    else extra.push({ level: 'error', title: 'Video', message: 'Choose one video.' });
    if (String(payload.caption || '').trim()) extra.push({ level: 'ok', title: 'Caption', message: `${String(payload.caption).trim().length} characters.` });
    else extra.push({ level: 'error', title: 'Caption', message: 'Add a caption.' });
    let slot = null;
    try {
      slot = scheduleSlots(1, payload.date, [payload.time])[0];
      extra.push({ level: 'ok', title: 'Schedule slot', message: slot.toLocaleString() });
    } catch (error) {
      extra.push({ level: 'error', title: 'Schedule time', message: error.message });
    }
    return { ...healthResult(extra), slot: slot ? {
      scheduledAtISO: slot.toISOString(),
      scheduledUnix: Math.floor(slot.getTime() / 1000),
      slotLabel: slot.toLocaleString()
    } : null };
  }

  async function manualPublishNow(payload = {}) {
    const file = files.get(payload.videoPath);
    if (!file) throw new Error('Choose one video.');
    const caption = String(payload.caption || '').trim();
    if (!caption) throw new Error('Add a caption.');
    if (!cachedState.workspace?.activePage) throw new Error('Connect and select a Facebook Page first.');

    const job = await createCloudJob({
      file,
      caption,
      publishMode: 'NOW'
    });
    await fetchState();
    jobFiles.set(job.id, file);
    const upload = await runJobs({ jobIds: [job.id] });
    const desktop = cachedState.jobs.find(item => item.id === job.id) || {
      id: job.id,
      videoName: file.name,
      slotLabel: 'Published immediately'
    };
    return { job: desktop, upload, state: cachedState };
  }

  async function manualScheduleAndUpload(payload = {}) {
    const health = await manualHealth(payload);
    if (health.summary.error) throw new Error(health.checks.find(check => check.level === 'error')?.message || 'Manual schedule check failed.');
    const file = files.get(payload.videoPath);
    const job = await createCloudJob({
      file,
      caption: String(payload.caption || '').trim(),
      scheduledAt: new Date(health.slot.scheduledAtISO)
    });
    await fetchState();
    jobFiles.set(job.id, file);
    const upload = await runJobs({ jobIds: [job.id] });
    const desktop = cachedState.jobs.find(item => item.id === job.id) || {
      id: job.id,
      videoName: file.name,
      slotLabel: health.slot.slotLabel
    };
    return { job: desktop, upload, health, state: cachedState };
  }

  const unsupported = name => async () => {
    throw new Error(`${name} is a desktop-only legacy tool. Use Auto Scheduler or Manual Scheduler in Cloud Studio.`);
  };

  window.schedulerApi = {
    getState: fetchState,
    registerAccount: async payload => {
      const result = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          password: payload.password,
          acceptedTerms: true
        })
      });
      return { ...result, state: cachedState };
    },
    loginAccount: async payload => {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: payload.email, password: payload.password })
      });
      localStorage.setItem(TOKEN_KEY, result.token);
      localStorage.setItem('inxToken', result.token);
      await fetchState();
      return { account: cachedState.account, state: cachedState };
    },
    refreshAccount: async () => {
      await fetchState();
      return { account: cachedState.account, state: cachedState };
    },
    logoutAccount: async () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('inxToken');
      cachedState = unauthenticatedState();
      return { state: cachedState };
    },
    openBillingPortal: async () => {
      const result = await api('/api/billing/portal', { method: 'POST', body: '{}' });
      location.assign(result.url);
      return result;
    },
    deleteAccount: async payload => {
      const result = await api('/api/portal/account', { method: 'DELETE', body: JSON.stringify(payload) });
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('inxToken');
      cachedState = unauthenticatedState();
      return result;
    },
    getWorkspace: workspaceResult,
    refreshWorkspace: workspaceResult,
    connectFacebookWorkspace: facebookLogin,
    discoverMetaAccount: accessToken => api('/api/pages/accounts/discover', { method: 'POST', body: JSON.stringify({ accessToken }) }),
    connectMetaAccount: payload => api('/api/pages/accounts/connect', { method: 'POST', body: JSON.stringify(payload) }),
    syncMetaAccount: accountId => api(`/api/pages/accounts/${encodeURIComponent(accountId)}/sync`, { method: 'POST', body: '{}' }),
    disconnectMetaAccount: async accountId => {
      await api(`/api/pages/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' });
      return workspaceResult();
    },
    selectWorkspacePage: async pageId => {
      await api(`/api/pages/${encodeURIComponent(pageId)}/select`, { method: 'POST', body: '{}' });
      return workspaceResult();
    },
    revokeWorkspacePage: async pageId => {
      await api(`/api/pages/${encodeURIComponent(pageId)}`, { method: 'DELETE' });
      return workspaceResult();
    },
    saveSettings: async settings => ({ settings: (await savePreferences(settings)).settings, state: cachedState }),
    saveUITexts: async uiTexts => ({ uiTexts: (await savePreferences(null, uiTexts)).uiTexts, state: cachedState }),
    resetUITexts: async () => {
      await api('/api/studio/preferences/reset-ui-texts', { method: 'POST', body: '{}' });
      await fetchState();
      return { uiTexts: cachedState.uiTexts, state: cachedState };
    },
    pickVideos: async () => importVideos(await pickVideoFiles()),
    pickCaptions: async () => importCaptions(await pickCaptionFiles()),
    pickVideoFolder: async () => importVideos(await pickVideoFiles(true)),
    pickCaptionFolder: async () => importCaptions(await pickCaptionFiles(true)),
    getPathForFile: file => fileId(file),
    importDropped: async (paths, type) => {
      const selected = paths.map(id => files.get(id)).filter(Boolean);
      return type === 'caption' ? importCaptions(selected) : importVideos(selected);
    },
    importCaptionText: async (text, sourceName) => {
      const accepted = captionBlocks(text).map((content, index) => captionMeta(content, sourceName, index));
      localCaptions.push(...accepted);
      withLocalState(cachedState);
      return { accepted, rejected: [], state: cachedState };
    },
    previewPlan: async () => {
      const pairs = Math.min(localVideos.length, localCaptions.length);
      const assignments = scheduleSlots(pairs, new Date().toISOString().slice(0, 10), []);
      return {
        pairing: { pairs: localVideos.slice(0, pairs).map((video, index) => ({ video, caption: localCaptions[index] })), unmatchedVideos: [], unmatchedCaptions: [] },
        plan: { assignments: assignments.map((slot, index) => ({ video: localVideos[index], caption: localCaptions[index], scheduledAtISO: slot.toISOString(), slotLabel: slot.toLocaleString() })) },
        metaOccupiedSlotCount: 0,
        state: cachedState
      };
    },
    createPlan: unsupported('Old local plan creation'),
    runScheduler: unsupported('Old local library scheduler'),
    pickReelsSessionVideos: async () => {
      const selected = await pickVideoFiles();
      const paths = selected.map(file => fileId(file));
      return { paths };
    },
    pickReelsCaptionFile: async () => {
      const selected = await pickCaptionFiles();
      const file = selected[0];
      return file ? { text: await file.text(), path: file.name } : { text: '', path: '' };
    },
    createReelsQueue: createQueue,
    runDueReels: runJobs,
    startReelsWatcher: async () => ({ active: false, message: 'Cloud uploads run only while this browser is open.', state: cachedState }),
    stopReelsWatcher: async () => {
      stopRequested = true;
      return { active: false, message: 'Stop requested. The current Meta request may finish; later videos will not start.', state: cachedState };
    },
    stopScheduler: async () => {
      stopRequested = true;
      return { stopped: true, message: 'Stop requested. The current Meta request may finish; later videos will not start.', state: cachedState };
    },
    testFacebook: async () => {
      const result = await api('/api/studio/facebook/test');
      await fetchState();
      return { ...result, state: cachedState };
    },
    connectFacebookPage: facebookLogin,
    disconnectFacebookPage: async () => {
      const active = cachedState.workspace?.activePage;
      if (active) await api(`/api/pages/${encodeURIComponent(active.id)}`, { method: 'DELETE' });
      await fetchState();
      return { settings: cachedState.settings, state: cachedState };
    },
    listScheduledPosts: async () => {
      const result = await api('/api/studio/facebook/scheduled-posts');
      return { ...result, state: cachedState };
    },
    deleteLocalJob: async id => {
      await api(`/api/studio/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: '{}' });
      await fetchState();
      return { jobs: cachedState.jobs, state: cachedState };
    },
    clearAll: async () => {
      files.clear();
      jobFiles.clear();
      localVideos = [];
      localCaptions = [];
      withLocalState(cachedState);
      return cachedState;
    },
    openUserData: async () => {
      alert('Cloud Studio keeps only your current browser file selections. Videos stream temporarily to Meta and are deleted from the server after each attempt.');
      return 'Browser session';
    },
    openExternalUrl: async url => {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !/(^|\.)facebook\.com$/.test(parsed.hostname)) throw new Error('Only Facebook HTTPS links are allowed.');
      window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
      return true;
    },
    pickManualVideo: async () => {
      const selected = await pickVideoFiles();
      const file = selected[0];
      return file ? { path: fileId(file) } : { path: null };
    },
    manualHealthCheck: manualHealth,
    manualSchedule: unsupported('Prepare-only manual scheduling'),
    manualPublishNow,
    manualScheduleAndUpload,
    runHealthCheck: async () => healthResult(),
    onSchedulerProgress: callback => {
      progressListeners.add(callback);
      return () => progressListeners.delete(callback);
    },
    labPublishReelNow: unsupported('Test Lab'),
    labPublishLegacyNow: unsupported('Legacy publishing'),
    labDiagnostics: unsupported('Test Lab'),
    uploadDraftTest: unsupported('Draft testing'),
    pickDraftSessionVideos: async () => ({ paths: (await pickVideoFiles()).map(file => fileId(file)) }),
    pickDraftSessionCaptionFile: async () => {
      const selected = await pickCaptionFiles();
      const file = selected[0];
      return file ? { text: await file.text(), path: file.name } : { text: '', path: '' };
    },
    uploadDraftSession: unsupported('Draft upload')
  };
})();
