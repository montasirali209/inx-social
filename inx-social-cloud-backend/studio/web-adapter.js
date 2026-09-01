(() => {
  'use strict';

  const TOKEN_KEY = 'inx-social-cloud-token';
  const FACEBOOK_APP_ID = '969283649323618';
  const META_SCHEDULE_GUARDRAIL = 60;
  const files = new Map();
  const jobFiles = new Map();
  const pagePictureUrls = new Map();
  const agentAssetUrls = new Map();
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

  async function pagePictureUrl(pageId) {
    const id = String(pageId || '');
    if (!id) return '';
    if (pagePictureUrls.has(id)) return pagePictureUrls.get(id);
    const headers = new Headers();
    if (token()) headers.set('Authorization', `Bearer ${token()}`);
    const response = await fetch(`/api/studio/pages/${encodeURIComponent(id)}/picture`, { headers });
    if (!response.ok) return '';
    const url = URL.createObjectURL(await response.blob());
    pagePictureUrls.set(id, url);
    return url;
  }

  async function agentAssetUrl(assetId) {
    const id = String(assetId || '');
    if (!id) return '';
    if (agentAssetUrls.has(id)) return agentAssetUrls.get(id);
    const headers = new Headers();
    if (token()) headers.set('Authorization', `Bearer ${token()}`);
    const response = await fetch(`/api/agent/assets/${encodeURIComponent(id)}/content`, { headers });
    if (!response.ok) return '';
    const url = URL.createObjectURL(await response.blob());
    agentAssetUrls.set(id, url);
    return url;
  }

  function clearPagePictureCache() {
    for (const url of pagePictureUrls.values()) {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
    pagePictureUrls.clear();
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

  function captionBlocks(text, expectedCount = 0) {
    const normal = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normal) return [];
    const paragraphs = normal.split(/\n\s*\n+/).map(value => value.trim()).filter(Boolean);
    const lines = normal.split('\n').map(value => value.trim()).filter(Boolean);
    const expected = Number(expectedCount || 0);
    if (expected > 0) {
      if (paragraphs.length === expected) return paragraphs;
      if (lines.length === expected) return lines;
    }
    if (paragraphs.length > 1) return paragraphs;
    return lines;
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

  function scheduledPostDate(post) {
    const raw = post?.scheduled_publish_time;
    if (raw === null || raw === undefined || raw === '') return null;
    const numeric = Number(raw);
    const date = Number.isFinite(numeric)
      ? new Date(numeric > 100000000000 ? numeric : numeric * 1000)
      : new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async function liveMetaSchedule(connectedPageId = '') {
    const query = connectedPageId ? `?connectedPageId=${encodeURIComponent(connectedPageId)}` : '';
    const response = await api(`/api/studio/facebook/scheduled-posts${query}`);
    const posts = Array.isArray(response?.result?.data) ? response.result.data : [];
    const futurePosts = posts.filter(post => {
      const date = scheduledPostDate(post);
      return date && date.getTime() > Date.now() && post?.is_published !== true;
    });
    return {
      posts: futurePosts,
      scheduledCount: futurePosts.length,
      guardrailLimit: META_SCHEDULE_GUARDRAIL,
      remainingCapacity: Math.max(0, META_SCHEDULE_GUARDRAIL - futurePosts.length)
    };
  }

  function schedulePlan(count, startDate, requestedTimes, liveSchedule = null, connectedPageId = '') {
    const settings = cachedState.settings || {};
    const times = [...new Set(
      (requestedTimes?.length ? requestedTimes : settings.dailySlots || [])
        .filter(value => /^\d{2}:\d{2}$/.test(value))
    )].sort();
    if (!times.length) throw new Error('Choose at least one valid daily time.');
    const selectedPage = (cachedState.workspace?.pages || []).find(page => page.id === connectedPageId) || cachedState.workspace?.activePage;
    const activeFacebookPageId = String(selectedPage?.facebookPageId || '');
    const occupied = new Set(
      (cachedState.jobs || [])
        .filter(job => !activeFacebookPageId || String(job.facebookPageId || '') === activeFacebookPageId)
        .filter(job => !String(job.status || '').includes('failed') && String(job.status || '') !== 'cancelled' && job.scheduledAtISO)
        .map(job => new Date(job.scheduledAtISO).toISOString().slice(0, 16))
    );
    for (const post of liveSchedule?.posts || []) {
      const date = scheduledPostDate(post);
      if (date) occupied.add(date.toISOString().slice(0, 16));
    }
    if (!startDate) throw new Error('Choose a schedule start date.');
    const start = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) throw new Error('Choose a valid start date.');
    const earliest = Date.now() + Math.max(20, Number(settings.minLeadMinutes || 20)) * 60000;
    const maxDays = Math.min(25, Number(settings.maxScheduleDays || 25));
    const result = [];
    let skippedOccupied = 0;
    let skippedPast = 0;
    for (let day = 0; day < maxDays && result.length < count; day++) {
      for (const value of times) {
        const [hours, minutes] = value.split(':').map(Number);
        const date = new Date(start);
        date.setDate(start.getDate() + day);
        date.setHours(hours, minutes, 0, 0);
        const key = date.toISOString().slice(0, 16);
        if (date.getTime() < earliest) {
          skippedPast++;
        } else if (occupied.has(key)) {
          skippedOccupied++;
        } else {
          occupied.add(key);
          result.push(date);
          if (result.length >= count) break;
        }
      }
    }
    return {
      slots: result,
      skippedOccupied,
      skippedPast,
      requestedCount: count,
      unscheduledByDateWindow: Math.max(0, count - result.length),
      requestedStartDate: startDate,
      firstAvailableAt: result[0]?.toISOString() || null,
      lastAvailableAt: result[result.length - 1]?.toISOString() || null,
      metaScheduledCount: Number(liveSchedule?.scheduledCount || 0),
      metaGuardrailLimit: Number(liveSchedule?.guardrailLimit || META_SCHEDULE_GUARDRAIL),
      metaRemainingCapacity: Number(liveSchedule?.remainingCapacity ?? META_SCHEDULE_GUARDRAIL)
    };
  }

  async function prepareSchedulePlan(count, startDate, requestedTimes, connectedPageId = '') {
    const liveSchedule = await liveMetaSchedule(connectedPageId);
    const allowedCount = Math.min(Number(count || 0), liveSchedule.remainingCapacity);
    const plan = schedulePlan(allowedCount, startDate, requestedTimes, liveSchedule, connectedPageId);
    return {
      ...plan,
      requestedCount: Number(count || 0),
      acceptedByMetaCapacity: plan.slots.length,
      deferredByMetaCapacity: Math.max(0, Number(count || 0) - liveSchedule.remainingCapacity),
      deferredTotal: Math.max(0, Number(count || 0) - plan.slots.length)
    };
  }

  function scheduleSlots(count, startDate, requestedTimes) {
    return schedulePlan(count, startDate, requestedTimes).slots;
  }

  function inspectReelsSelection(paths = [], connectedPageIds = []) {
    const pageIds = connectedPageIds.length ? connectedPageIds : [cachedState.workspace?.activePage?.id].filter(Boolean);
    const pageInspections = pageIds.map(connectedPageId => {
      const page = (cachedState.workspace?.pages || []).find(item => item.id === connectedPageId);
      const existingNames = new Map((cachedState.jobs || [])
        .filter(job => !page?.facebookPageId || String(job.facebookPageId || '') === String(page.facebookPageId))
        .filter(job => job.duplicateProtected === true)
        .map(job => [String(job.videoName || '').toLowerCase(), job]));
      const seen = new Set();
      const duplicates = [];
      const acceptedIndexes = [];
      paths.forEach((path, index) => {
        const name = fileName(path);
        const key = name.toLowerCase();
        const existing = existingNames.get(key);
        if (seen.has(key) || existing) duplicates.push({ index, name, pageId: connectedPageId, pageName: page?.facebookPageName || 'Facebook Page', existingStatus: existing?.status || 'duplicate selection', slotLabel: existing?.slotLabel || null });
        else { seen.add(key); acceptedIndexes.push(index); }
      });
      return { connectedPageId, pageName: page?.facebookPageName || 'Facebook Page', duplicates, acceptedIndexes };
    });
    const duplicates = pageInspections.flatMap(item => item.duplicates);
    const acceptedCount = pageInspections.reduce((sum, item) => sum + item.acceptedIndexes.length, 0);
    return { duplicates, acceptedCount, acceptedVideoCount: new Set(pageInspections.flatMap(item => item.acceptedIndexes)).size, pageInspections };
  }

  async function createCloudJob({ id, file, caption, scheduledAt = null, publishMode = 'SCHEDULED', connectedPageId = '' }) {
    const selectedPage = (cachedState.workspace?.pages || []).find(page => page.id === connectedPageId) || cachedState.workspace?.activePage;
    if (!selectedPage) throw new Error('Choose at least one connected Facebook Page.');
    const immediate = publishMode === 'NOW';
    return api('/api/studio/jobs', {
      method: 'POST',
      body: JSON.stringify({
        connectedPageId: selectedPage.id,
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

  async function uploadJob(job, file, index, total, counters) {
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
    const result = await api(`/api/studio/jobs/${encodeURIComponent(job.id)}/video`, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    counters.uploaded += 1;
    emit({
      type: 'reel-processing',
      phase: 'Facebook processing',
      percent: Math.round(5 + ((index + 1) / total) * 90),
      current: index + 1,
      total,
      uploaded: counters.uploaded,
      failed: counters.failed,
      message: `${file.name} was accepted by Meta and is processing. Activity Logs will update after Facebook confirms the result.`
    });
    return result;
  }

  async function createQueue(payload = {}) {
    await fetchState();
    const paths = Array.isArray(payload.videoPaths) ? payload.videoPaths : [];
    const captions = captionBlocks(payload.captionText || '', paths.length);
    if (!paths.length) throw new Error('Select at least one video.');
    if (!captions.length) throw new Error('Add at least one caption.');
    if (captions.length < paths.length) {
      throw new Error(`Selected ${paths.length} video(s), but detected only ${captions.length} caption(s). Nothing was queued. Add at least one caption for every video and try again.`);
    }
    const connectedPageIds = [...new Set((payload.connectedPageIds || []).map(String).filter(Boolean))];
    if (!connectedPageIds.length) throw new Error('Choose at least one destination Page.');
    const inspection = inspectReelsSelection(paths, connectedPageIds);
    if (inspection.duplicates.length && !payload.skipDuplicateVideos) {
      throw new Error(`${inspection.duplicates.length} duplicate video filename(s) found. Confirm that duplicates should be skipped before continuing.`);
    }
    if (!inspection.acceptedCount) throw new Error('Every selected filename is already processing, scheduled or published for the selected Pages.');
    const immediate = String(payload.publishMode || '').toUpperCase() === 'NOW';
    const jobs = [];
    const schedules = [];
    const deferredVideos = [];
    for (const pageInspection of inspection.pageInspections) {
      const selected = pageInspection.acceptedIndexes.map(index => ({ path: paths[index], caption: captions[index] }));
      const schedule = immediate ? null : await prepareSchedulePlan(selected.length, payload.startDate, payload.times, pageInspection.connectedPageId);
      const count = immediate ? selected.length : schedule.slots.length;
      schedules.push({ connectedPageId: pageInspection.connectedPageId, pageName: pageInspection.pageName, schedule });
      selected.slice(count).forEach(item => deferredVideos.push(`${pageInspection.pageName}: ${fileName(item.path)}`));
      for (let index = 0; index < count; index++) {
        const item = selected[index];
        const file = files.get(item.path);
        if (!file) throw new Error(`The browser no longer has access to ${fileName(item.path)}. Select it again.`);
        jobs.push(await createCloudJob({
          id: item.path,
          file,
          caption: item.caption,
          scheduledAt: immediate ? null : schedule.slots[index],
          publishMode: immediate ? 'NOW' : 'SCHEDULED',
          connectedPageId: pageInspection.connectedPageId
        }));
      }
    }
    await fetchState();
    return {
      jobs,
      state: cachedState,
      captionsUsed: jobs.length,
      captionsIgnored: Math.max(0, captions.length - paths.length),
      skippedDuplicates: inspection.duplicates,
      deferredVideos,
      schedules
    };
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
        results.push(await uploadJob(job, file, index, candidates.length, counters));
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
    const completion = `Accepted by Meta ${counters.uploaded}`;
    const message = stopRequested
      ? `Upload stopped. ${completion}, upload failures ${counters.failed}. Facebook processing results will update in Activity Logs.`
      : `Upload finished. ${completion}, upload failures ${counters.failed}. Facebook processing results will update in Activity Logs.`;
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
    url.searchParams.set('scope', 'public_profile,pages_show_list,pages_read_engagement,pages_read_user_content,read_insights,pages_manage_posts,business_management,instagram_basic,instagram_manage_insights');
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

  async function socialOAuth(platform) {
    const normalized = String(platform || '').toLowerCase();
    const resultKey = 'inx-social-oauth-result';
    localStorage.removeItem(resultKey);
    const start = await api(`/api/social-connections/oauth/${encodeURIComponent(normalized)}/start`, {
      method: 'POST',
      body: '{}'
    });
    const width = 620;
    const height = 760;
    const left = Math.max(0, Math.round((window.screenX || 0) + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round((window.screenY || 0) + (window.outerHeight - height) / 2));
    const popup = window.open(
      start.authorizationUrl,
      `inxSocialConnect-${normalized}`,
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    if (!popup) throw new Error('The connection popup was blocked. Allow popups for INX Social and try again.');
    popup.focus();

    return new Promise((resolve, reject) => {
      let settled = false;
      let closedAt = 0;
      const cleanup = () => {
        window.removeEventListener('message', receive);
        window.removeEventListener('storage', receiveStored);
        clearInterval(closedCheck);
        clearTimeout(timeout);
        localStorage.removeItem(resultKey);
      };
      const finish = message => {
        if (settled) return;
        settled = true;
        cleanup();
        try { popup.close(); } catch (_) {}
        if (!message.ok) return reject(new Error(message.error || 'The social account could not be connected.'));
        resolve(message);
      };
      const consume = raw => {
        if (!raw) return false;
        try {
          const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (message.type !== 'inx-social-oauth-result' || message.platform !== normalized) return false;
          finish(message);
          return true;
        } catch (_) {
          return false;
        }
      };
      const receive = event => {
        if (event.origin === location.origin) consume(event.data);
      };
      const receiveStored = event => {
        if (event.key === resultKey) consume(event.newValue);
      };
      window.addEventListener('message', receive);
      window.addEventListener('storage', receiveStored);
      const closedCheck = setInterval(() => {
        if (settled || consume(localStorage.getItem(resultKey))) return;
        if (popup.closed) {
          closedAt = closedAt || Date.now();
          if (Date.now() - closedAt > 1500) finish({ ok: false, error: 'The connection window was closed before it completed.' });
        } else {
          closedAt = 0;
        }
      }, 400);
      const timeout = setTimeout(() => {
        finish({ ok: false, error: 'The social connection timed out. Please try again.' });
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
    const connectedPages = (cachedState.workspace?.pages || []).filter(page => page.status !== 'REVOKED');
    if (connectedPages.length) add('ok', 'Connected Pages', `${connectedPages.length} Facebook Page${connectedPages.length === 1 ? '' : 's'} available.`);
    else add('error', 'Connected Pages', 'Connect a Facebook Page.');
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

  async function pickDirectPostMedia(contentType = 'IMAGE') {
    const video = String(contentType).toUpperCase() === 'VIDEO';
    const selected = await chooseFiles({
      accept: video ? 'video/mp4,video/quicktime,.mp4,.mov,.m4v,.avi,.mkv,.webm' : 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp',
      multiple: false
    });
    const file = selected[0];
    if (!file) return null;
    const id = fileId(file);
    return { id, name: file.name, type: file.type || (video ? 'video/mp4' : 'image/jpeg'), size: file.size, contentType: video ? 'VIDEO' : 'IMAGE', previewUrl: URL.createObjectURL(file) };
  }

  async function prepareDirectPostMedia(file, contentType = 'IMAGE') {
    if (!(file instanceof File)) throw new Error('Choose a valid image or video file.');
    const video = String(contentType).toUpperCase() === 'VIDEO';
    const id = fileId(file);
    return { id, name: file.name, type: file.type || (video ? 'video/mp4' : 'image/jpeg'), size: file.size, contentType: video ? 'VIDEO' : 'IMAGE', previewUrl: URL.createObjectURL(file) };
  }

  async function publishDirectPost(payload = {}) {
    const media = payload.mediaId ? files.get(payload.mediaId) : null;
    const contentType = String(payload.contentType || 'TEXT').toUpperCase();
    if (contentType !== 'TEXT' && !media) throw new Error('Choose the image or video again.');
    const created = await api('/api/studio/direct-posts', {
      method: 'POST',
      body: JSON.stringify({
        connectedPageIds: payload.connectedPageIds,
        clientRequestId: payload.clientRequestId || `direct-${crypto.randomUUID()}`,
        title: payload.title || null,
        caption: payload.caption,
        contentType,
        originalFileName: media?.name || null,
        mimeType: media?.type || null,
        fileSizeBytes: media ? String(media.size) : null,
        scheduledAt: payload.publishMode === 'NOW' ? null : payload.scheduledAt,
        publishMode: payload.publishMode
      })
    });
    const failures = [...(created.failures || [])];
    const completed = [];
    if (created.uploadRequired && media) {
      for (const job of created.jobs || []) {
        if (!['AWAITING_UPLOAD', 'FAILED'].includes(String(job.status || '').toUpperCase())) { completed.push(job); continue; }
        try {
          const result = await api(`/api/studio/direct-posts/${encodeURIComponent(job.id)}/media`, { method: 'PUT', headers: { 'Content-Type': media.type || 'application/octet-stream' }, body: media });
          completed.push(result.job);
        } catch (error) {
          failures.push({ pageId: job.page?.id || null, pageName: job.page?.facebookPageName || 'Facebook Page', error: error.message });
        }
      }
    } else completed.push(...(created.jobs || []));
    await fetchState();
    return { jobs: completed, failures, state: cachedState };
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
    getAgentOverview: async () => api('/api/agent/overview'),
    getAgentProviderHealth: async (probe = false) => api(`/api/agent/provider-health${probe ? '?probe=1' : ''}`),
    uploadAgentAsset: async payload => api('/api/agent/assets', { method: 'POST', body: JSON.stringify(payload) }),
    deleteAgentAsset: async id => api(`/api/agent/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    getAgentAssetUrl: agentAssetUrl,
    preflightAgentMission: async payload => api('/api/agent/preflight', { method: 'POST', body: JSON.stringify(payload) }),
    createAgentPlan: async payload => api('/api/agent/plans', { method: 'POST', body: JSON.stringify(payload) }),
    approveAgentPlan: async id => api(`/api/agent/plans/${encodeURIComponent(id)}/approve`, { method: 'POST', body: '{}' }),
    resumeAgentPlan: async id => api(`/api/agent/plans/${encodeURIComponent(id)}/resume`, { method: 'POST', body: '{}' }),
    cancelAgentPlan: async id => api(`/api/agent/plans/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: '{}' }),
    prepareAgentCampaignReview: async id => api(`/api/agent/plans/${encodeURIComponent(id)}/prepare-review`, { method: 'POST', body: '{}' }),
    getAgentCampaign: async id => api(`/api/agent/campaigns/${encodeURIComponent(id)}`),
    updateAgentCampaignPost: async (campaignId, postId, payload) => api(`/api/agent/campaigns/${encodeURIComponent(campaignId)}/posts/${encodeURIComponent(postId)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    approveAgentCampaignPost: async (campaignId, postId) => api(`/api/agent/campaigns/${encodeURIComponent(campaignId)}/posts/${encodeURIComponent(postId)}/approve`, { method: 'POST', body: '{}' }),
    regenerateAgentCampaignPostImage: async (campaignId, postId, payload = {}) => api(`/api/agent/campaigns/${encodeURIComponent(campaignId)}/posts/${encodeURIComponent(postId)}/regenerate-image`, { method: 'POST', body: JSON.stringify(payload) }),
    approveAgentCampaign: async campaignId => api(`/api/agent/campaigns/${encodeURIComponent(campaignId)}/approve`, { method: 'POST', body: '{}' }),
    scheduleAgentCampaign: async campaignId => api(`/api/agent/campaigns/${encodeURIComponent(campaignId)}/schedule`, { method: 'POST', body: '{}' }),
    pickDirectPostMedia,
    prepareDirectPostMedia,
    publishDirectPost,
    getWorkspace: workspaceResult,
    refreshWorkspace: workspaceResult,
    connectFacebookWorkspace: facebookLogin,
    listSocialConnections: () => api('/api/social-connections'),
    connectSocialPlatform: platform => String(platform).toLowerCase() === 'instagram'
      ? api('/api/social-connections/instagram/sync', { method: 'POST', body: '{}' })
      : socialOAuth(platform),
    disconnectSocialConnection: id => api(`/api/social-connections/${encodeURIComponent(id)}`, { method: 'DELETE' }),
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
    inspectReelsSelection: async (paths, connectedPageIds = []) => {
      await fetchState();
      return inspectReelsSelection(Array.isArray(paths) ? paths : [], Array.isArray(connectedPageIds) ? connectedPageIds : []);
    },
    previewReelsSchedule: async payload => {
      await fetchState();
      const connectedPageIds = Array.isArray(payload.connectedPageIds) && payload.connectedPageIds.length ? payload.connectedPageIds : [cachedState.workspace?.activePage?.id].filter(Boolean);
      const schedules = [];
      for (const pageId of connectedPageIds) schedules.push(await prepareSchedulePlan(payload.count, payload.startDate, payload.times, pageId));
      return { ...(schedules[0] || await prepareSchedulePlan(payload.count, payload.startDate, payload.times)), destinationCount: connectedPageIds.length, destinationSchedules: schedules };
    },
    getPagePictureUrl: pagePictureUrl,
    clearPagePictureCache: async () => {
      clearPagePictureCache();
      return { cleared: true };
    },
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
    getFacebookAnalytics: async ({ connectedPageId, days = 30, force = false } = {}) => {
      const query = new URLSearchParams({ days: String(days), force: String(Boolean(force)) });
      if (connectedPageId) query.set('connectedPageId', connectedPageId);
      return api(`/api/studio/analytics/facebook?${query.toString()}`);
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
      window.dispatchEvent(new CustomEvent('inx:studio-notice', {
        detail: {
          message: 'Cloud Studio keeps only your current browser file selections.',
          details: ['Videos stream temporarily to Meta and are deleted from the server after each attempt.']
        }
      }));
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
