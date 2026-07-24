let state = null;
let lastPreview = null;
let isSchedulerRunning = false;
let draftSessionVideos = [];
let draftSelectedTimes = [];
let draftSessionRunning = false;
let reelsSessionVideos = [];
let reelsSelectedTimes = [];
let labVideoPath = '';
let accountMode = 'login';
let cloudWorkspace = { accounts: [], pages: [], activePage: null, pageUsage: null, plan: null };

const UI_TEXT_FIELDS = [
  'appTitle', 'appSubtitle', 'dashboardTitle', 'dashboardSubtitle',
  'refreshButton', 'runSchedulerButton', 'stopSchedulerButton',
  'checkSlotsButton', 'testFacebookButton', 'openLocalDataButton',
  'uploadVideosButton', 'importVideoFolderButton', 'uploadCaptionsButton',
  'importCaptionFolderButton', 'importPastedCaptionsButton', 'clearTextButton',
  'clearLocalLibraryButton', 'fetchMetaButton', 'saveSettingsButton'
];

const views = {
  dashboard: ['Home', 'Your INX Social publishing command centre.'],
  pages: ['Pages', 'Connect and choose the Page that receives your next scheduled content.'],
  media: ['Old Auto Scheduler', 'Hidden old Page Video scheduler.'],
  reels: ['Auto Scheduler', 'Upload videos to Meta now and schedule them as Facebook Reels for future times.'],
  lab: ['Hidden Test Tools', 'Hidden technical test tools.'],
  draft: ['Hidden Draft Tools', 'Hidden old draft tools.'],
  manual: ['Manual Scheduler', 'Upload one Reel to Meta now and schedule it for a future time.'],
  health: ['Health Check', 'Check video, caption, schedule, and Meta connection risks before posting.'],
  calendar: ['Calendar', 'See what is planned locally and what has been published.'],
  analytics: ['Analytics', 'Publishing health, usage and account performance.'],
  logs: ['Logs', 'Track imports, scheduled uploads, publishing, retries, and errors.'],
  settings: ['Settings', 'Facebook Connect and scheduler rules.']
};

window.addEventListener('DOMContentLoaded', async () => {
  bindNavigation();
  bindButtons();
  bindDragAndDrop();
  bindAccountUI();
  window.schedulerApi.onSchedulerProgress(payload => {
    updateProgress(payload);
    if (payload.state) {
      state = payload.state;
      render();
    }
  });
  await refresh();
  await refreshWorkspaceV2({ silent: true });
  renderAccountGate();
  const md = document.getElementById('manualDate');
  if (md && !md.value) md.value = defaultDateInput();
  const dd = document.getElementById('draftStartDate');
  if (dd && !dd.value) dd.value = defaultDateInput();
  const rd = document.getElementById('reelsStartDate');
  if (rd && !rd.value) rd.value = defaultDateInput();
  buildDraftTimePicker();
  buildReelsTimePicker();
});


function bindAccountUI() {
  const loginTab = document.getElementById('accountTabLogin');
  const registerTab = document.getElementById('accountTabRegister');
  if (loginTab) loginTab.addEventListener('click', () => setAccountMode('login'));
  if (registerTab) registerTab.addEventListener('click', () => setAccountMode('register'));
  const form = document.getElementById('accountForm');
  if (form) form.addEventListener('submit', submitAccountForm);
  on('btnAccountRefresh', refreshAccount);
  on('btnAccountLogout', logoutAccount);
}

function setAccountMode(mode) {
  accountMode = mode === 'register' ? 'register' : 'login';
  document.getElementById('accountTabLogin')?.classList.toggle('active', accountMode === 'login');
  document.getElementById('accountTabRegister')?.classList.toggle('active', accountMode === 'register');
  document.getElementById('accountNameWrap')?.classList.toggle('hidden', accountMode !== 'register');
  const submit = document.getElementById('btnAccountSubmit');
  if (submit) submit.textContent = accountMode === 'register' ? 'Create account & start trial' : 'Sign in';
  const password = document.getElementById('accountPassword');
  if (password) password.autocomplete = accountMode === 'register' ? 'new-password' : 'current-password';
  setAccountMessage('');
}

async function submitAccountForm(event) {
  event.preventDefault();
  const payload = {
    name: document.getElementById('accountName')?.value.trim(),
    email: document.getElementById('accountEmail')?.value.trim(),
    password: document.getElementById('accountPassword')?.value
  };
  const button = document.getElementById('btnAccountSubmit');
  if (button) button.disabled = true;
  setAccountMessage(accountMode === 'register' ? 'Creating account and activating this device…' : 'Signing in and checking licence…', 'working');
  try {
    const result = accountMode === 'register'
      ? await window.schedulerApi.registerAccount(payload)
      : await window.schedulerApi.loginAccount(payload);
    if (result.requiresVerification) {
      state = result.state || state;
      setAccountMode('login');
      setAccountMessage(result.message || 'Account created. Verify your email, then sign in.', 'working');
      toast(result.message || 'Account created. Check your email to verify it.');
      return;
    }
    state = result.state;
    render();
    renderAccountGate();
    setAccountMessage('');
    toast(accountMode === 'register' ? 'Account created. Your trial is active.' : 'Signed in successfully.');
  } catch (error) {
    setAccountMessage(error.message, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

async function refreshAccount() {
  try {
    const result = await window.schedulerApi.refreshAccount();
    state = result.state;
    render();
    renderAccountGate();
    toast('Account and licence refreshed.');
  } catch (error) {
    toast(error.message, true);
    await refresh();
    renderAccountGate();
  }
}

async function logoutAccount() {
  const result = await window.schedulerApi.logoutAccount();
  state = result.state;
  render();
  renderAccountGate();
}

function setAccountMessage(message, kind = '') {
  const el = document.getElementById('accountMessage');
  if (!el) return;
  el.textContent = message || '';
  el.className = `account-message ${kind}`.trim();
}

function renderAccountGate() {
  const gate = document.getElementById('accountGate');
  const badge = document.getElementById('accountBadge');
  if (!gate || !state) return;
  const account = state.account || {};
  const loggedIn = Boolean(account.authenticated);
  gate.classList.toggle('hidden', loggedIn);
  badge?.classList.toggle('hidden', !loggedIn);
  if (!loggedIn) return;
  const user = account.user || {};
  const licence = account.license || {};
  const name = document.getElementById('accountUserName');
  const plan = document.getElementById('accountPlanText');
  if (name) name.textContent = user.name || user.email || 'INX Social account';
  if (plan) {
    const days = licence.trialEndsAt ? Math.max(0, Math.ceil((new Date(licence.trialEndsAt).getTime() - Date.now()) / 86400000)) : null;
    const suffix = licence.subscriptionStatus === 'TRIALING' && days !== null ? ` · ${days} trial day${days === 1 ? '' : 's'} left` : '';
    plan.textContent = `${licence.plan || 'TRIAL'} · ${licence.allowed ? 'Active' : 'Locked'}${suffix}`;
  }
  document.body.classList.toggle('license-locked', !licence.allowed);
}

function bindNavigation() {
  document.querySelectorAll('.nav').forEach(button => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
}

function switchView(viewName) {
  document.body.dataset.activeView = viewName;
  document.querySelectorAll('.nav').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === viewName));
  document.getElementById('viewTitle').textContent = views[viewName][0];
  document.getElementById('viewSubtitle').textContent = views[viewName][1];
  if (['pages','analytics'].includes(viewName)) refreshWorkspaceV2({ silent: true });
}

function bindButtons() {
  on('btnRefresh', refresh);
  on('btnPickVideos', () => importAction(window.schedulerApi.pickVideos));
  on('btnPickVideos2', () => importAction(window.schedulerApi.pickVideos));
  on('btnPickCaptions', () => importAction(window.schedulerApi.pickCaptions));
  on('btnPickCaptions2', () => importAction(window.schedulerApi.pickCaptions));
  on('btnPickVideoFolder', () => importAction(window.schedulerApi.pickVideoFolder));
  on('btnPickCaptionFolder', () => importAction(window.schedulerApi.pickCaptionFolder));
  on('btnPickCaptionFolder2', () => importAction(window.schedulerApi.pickCaptionFolder));
  on('btnImportPastedCaptions', importPastedCaptions);
  on('btnClearPaste', () => { document.getElementById('captionPasteText').value = ''; });
  on('btnPreviewPlan', previewPlan);
  on('btnRunScheduler', () => switchView('reels'));
  on('btnUploadDraftTest', uploadDraftTest);
  on('btnDraftPickVideos', pickDraftSessionVideos);
  on('btnDraftPickCaptions', pickDraftSessionCaptions);
  on('btnDraftClearSession', clearDraftSession);
  on('btnDraftAddTime', addDraftSelectedTime);
  on('btnUploadDraftSession', uploadDraftSession);
  on('btnStopDraftSession', stopScheduler);
  on('btnOpenBusinessFromDraft', () => openExternalUrl('https://business.facebook.com/latest/posts?content_table=POSTS'));
  on('btnReelsOpenSettings', () => switchView('settings'));
  on('btnReelsManagePages', () => switchView('pages'));
  on('btnReelsPickVideos', pickReelsSessionVideos);
  on('btnReelsPickCaptions', pickReelsSessionCaptions);
  on('btnReelsClearSession', clearReelsSession);
  on('btnReelsAddTime', addReelsSelectedTime);
  on('btnReelsCreateQueue', createReelsQueue);
  on('btnReelsRunDue', runDueReels);
  on('btnReelsStartWatcher', startReelsWatcher);
  on('btnReelsStopWatcher', stopReelsWatcher);
  on('btnLabPickVideo', pickLabVideo);
  on('btnLabPublishReel', publishLabReel);
  on('btnLabPublishLegacy', publishLabLegacy);
  on('btnLabDiagnostics', fetchLabDiagnostics);
  const draftMode = document.getElementById('draftTimingMode');
  if (draftMode) draftMode.addEventListener('change', renderDraftSessionSummary);
  const reelsMode = document.getElementById('reelsTimingMode');
  if (reelsMode) reelsMode.addEventListener('change', renderReelsSessionSummary);
  const reelsPageSelect = document.getElementById('reelsPageSelect');
  if (reelsPageSelect) reelsPageSelect.addEventListener('change', async event => {
    const pageId = event.target.value;
    if (!pageId) return;
    const active = cloudWorkspace?.activePage || (cloudWorkspace?.pages || []).find(page => page.isSelected);
    if (active?.id === pageId) return;
    event.target.disabled = true;
    await selectPageV2(pageId);
  });
  on('btnHeroRun', () => switchView('reels'));
  on('btnHeroManual', () => switchView('manual'));
  on('btnHeroHealth', () => { switchView('health'); runHealthCheck(); });
  on('dockDashboard', () => switchView('dashboard'));
  on('dockAuto', () => switchView('reels'));
  on('dockManual', () => switchView('manual'));
  on('dockHealth', () => { switchView('health'); runHealthCheck(); });
  on('btnAutoJumpSettings', () => switchView('settings'));
  on('btnStopScheduler', stopReelsWatcher);
  on('btnTestFacebook', testFacebook);
  on('btnTestFacebook2', testFacebook);
  on('btnConnectFacebookPage', connectFacebookPage);
  on('btnDisconnectFacebookPage', disconnectFacebookPage);
  on('btnOpenMetaBusiness', () => openExternalUrl('https://business.facebook.com/settings/system-users'));
  on('btnOpenGraphExplorer', () => openExternalUrl('https://developers.facebook.com/tools/explorer/'));
  on('btnOpenMetaDevelopers', () => openExternalUrl('https://developers.facebook.com/apps/'));
  on('btnListMeta', listMetaScheduled);
  on('btnOpenUserData', openUserData);
  on('btnClearAll', clearAll);
  on('btnManualPickVideo', pickManualVideo);
  on('btnManualPickCaptionFile', pickManualCaptionFile);
  on('btnManualHealth', checkManualPost);
  on('btnManualSchedule', scheduleManualPost);
  on('btnManualClear', clearManualForm);
  on('btnRunHealthCheck', runHealthCheck);

  on('activeWorkspaceChip', toggleActiveWorkspaceMenu);
  on('btnAddMetaAccount', connectFacebookWorkspaceV2);
  on('btnDisconnectActivePage', disconnectActiveWorkspacePage);
  on('btnOpenFacebookIntegrations', () => openExternalUrl('https://www.facebook.com/settings?tab=business_tools'));
  on('btnOpenPagesSettings', () => switchView('pages'));
  on('btnPagesRefresh', () => refreshWorkspaceV2());
  const pageSearch = document.getElementById('pageSearchInput');
  if (pageSearch) pageSearch.addEventListener('input', renderPagesV2);
  document.addEventListener('click', event => {
    const reelsTimeButton = event.target.closest('[data-remove-reels-time]');
    if (reelsTimeButton) removeReelsSelectedTime(reelsTimeButton.dataset.removeReelsTime);

    const draftTimeButton = event.target.closest('[data-remove-draft-time]');
    if (draftTimeButton) removeDraftSelectedTime(draftTimeButton.dataset.removeDraftTime);

    const removeJobButton = event.target.closest('[data-remove-job-id]');
    if (removeJobButton) deleteLocalJob(removeJobButton.dataset.removeJobId);

    const control = document.getElementById('activeWorkspaceControl');
    if (control && !control.contains(event.target)) closeActiveWorkspaceMenu();
  });

  const form = document.getElementById('settingsForm');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    await saveSettings();
  });

  const interfaceForm = document.getElementById('interfaceForm');
  if (interfaceForm) {
    interfaceForm.addEventListener('submit', async event => {
      event.preventDefault();
      await saveUITexts();
    });
  }
  on('btnResetUITexts', resetUITexts);

  ['settingUiTheme'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', async () => {
        applyThemePreviewFromControls();
        await saveSettings({ silent: true });
        toast('Interface theme saved.');
      });
    }
  });
}


function on(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}

function bindDragAndDrop() {
  document.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', event => {
      event.preventDefault();
      zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', async event => {
      event.preventDefault();
      zone.classList.remove('dragover');
      const paths = Array.from(event.dataTransfer.files)
        .map(file => window.schedulerApi.getPathForFile(file))
        .filter(Boolean);
      if (!paths.length) return toast('No readable file paths found. Use the upload button instead.');
      try {
        const result = await window.schedulerApi.importDropped(paths, zone.dataset.type);
        state = result.state;
        render();
        toast(`Imported ${result.accepted.length} file(s).`);
      } catch (err) {
        toast(err.message, true);
      }
    });
  });
}

async function refresh() {
  state = await window.schedulerApi.getState();
  render();
}

async function importAction(fn) {
  try {
    const result = await fn();
    state = result.state;
    render();
    toast(`Imported ${result.accepted.length} file(s). ${result.rejected.length ? result.rejected.length + ' skipped/rejected.' : ''}`);
  } catch (err) {
    toast(err.message, true);
  }
}


async function importPastedCaptions() {
  const text = document.getElementById('captionPasteText').value.trim();
  if (!text) {
    toast('Paste captions first. Use one caption per line, or blank lines between longer captions.', true);
    return;
  }
  try {
    const result = await window.schedulerApi.importCaptionText(text, 'pasted-captions.txt');
    state = result.state;
    document.getElementById('captionPasteText').value = '';
    render();
    toast(`Imported ${result.accepted.length} caption block(s). ${result.rejected.length ? result.rejected.length + ' duplicate block(s) skipped.' : ''}`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function previewPlan() {
  try {
    setSimpleScheduleCheck('Checking Meta scheduled slots and local upload list...', 'working');
    const result = await window.schedulerApi.previewPlan();
    lastPreview = result;
    state = result.state;
    render();
    renderPlan(result);
    const summary = getSimplePlanSummary(result);
    setSimpleScheduleCheck(summary.html, summary.kind);
    toast(summary.toast, summary.kind === 'error');
  } catch (err) {
    setSimpleScheduleCheck(`Could not check schedule: ${escapeHtml(err.message)}`, 'error');
    toast(err.message, true);
  }
}

async function createPlan() {
  try {
    const result = await window.schedulerApi.createPlan();
    state = result.state;
    lastPreview = result;
    render();
    renderPlan(result);
    toast(`Created ${result.jobs.length} new local job(s). Existing videos/slots were skipped.`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function runScheduler() {
  if (isSchedulerRunning) {
    toast('Scheduler is already running. Use Stop Upload if you need to cancel it.', true);
    return;
  }

  isSchedulerRunning = true;
  updateRunButtons();

  try {
    updateProgress({ type: 'start', phase: 'Meta check', percent: 1, message: 'Checking Meta/Facebook slots before upload...', current: 0, total: 0, uploaded: 0, failed: 0 });
    setSimpleScheduleCheck('Checking Meta first. The app will not reuse occupied Facebook slots.', 'working');
    const result = await window.schedulerApi.runScheduler();
    state = result.state;
    render();

    if (result.stopped) {
      setSimpleScheduleCheck('Upload stopped. Already confirmed Meta schedules were kept. Current/remaining local jobs can be resumed later.', 'warning');
      toast(`Stopped. Uploaded ${result.uploaded || 0}, failed ${result.failed || 0}.`);
      return;
    }

    if (result.planSummary) {
      setSimpleScheduleCheck(getSimpleRunSummary(result), result.uploaded > 0 ? 'success' : 'warning');
    }

    if (result.uploaded === 0 && result.failed === 0) {
      const reason = result.planSummary && result.planSummary.assignments === 0
        ? 'Nothing uploaded: Meta has no free schedule slots inside your Max schedule days, or all imported videos are already planned/scheduled.'
        : 'Nothing uploaded: no planned jobs waiting.';
      toast(reason, true);
    } else {
      toast(`Done. Uploaded ${result.uploaded}, failed ${result.failed}. Occupied Meta slots were skipped.`);
    }
  } catch (err) {
    toast(err.message, true);
    setProgress(err.message);
    setSimpleScheduleCheck(`Upload stopped: ${escapeHtml(err.message)}`, 'error');
  } finally {
    isSchedulerRunning = false;
    updateRunButtons();
  }
}


async function pickReelsSessionVideos() {
  try {
    const result = await window.schedulerApi.pickReelsSessionVideos();
    reelsSessionVideos = result.paths || [];
    renderReelsSessionSummary();
    toast(`${reelsSessionVideos.length} Auto Scheduler video(s) selected.`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function pickReelsSessionCaptions() {
  try {
    const result = await window.schedulerApi.pickReelsCaptionFile();
    if (result.text) document.getElementById('reelsCaptionText').value = result.text;
    renderReelsSessionSummary();
    toast(result.path ? 'Auto Scheduler caption file loaded.' : 'No caption file selected.');
  } catch (err) {
    toast(err.message, true);
  }
}

function clearReelsSession() {
  reelsSessionVideos = [];
  reelsSelectedTimes = [];
  const text = document.getElementById('reelsCaptionText');
  if (text) text.value = '';
  renderReelsSessionSummary();
  updateReelsPanel({ phase: 'Idle', percent: 0, current: 0, total: 0, uploaded: 0, failed: 0, message: 'Auto Scheduler session cleared.' });
}

function buildReelsTimePicker() {
  const picker = document.getElementById('reelsTimePicker');
  if (!picker) return;
  const settingsSlots = state && state.settings ? state.settings.dailySlots || [] : ['11:00', '15:13', '22:15', '23:15'];
  const all = new Set(settingsSlots);
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) all.add(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  picker.innerHTML = [...all].sort().map(t => `<option value="${t}">${to12(t)}</option>`).join('');
}

function addReelsSelectedTime() {
  const picker = document.getElementById('reelsTimePicker');
  const value = picker ? picker.value : '';
  if (!value) return;
  if (!reelsSelectedTimes.includes(value)) reelsSelectedTimes.push(value);
  reelsSelectedTimes.sort();
  renderReelsSessionSummary();
}

function removeReelsSelectedTime(time) {
  reelsSelectedTimes = reelsSelectedTimes.filter(t => t !== time);
  renderReelsSessionSummary();
}

function getReelsCaptionBlocks() {
  const text = document.getElementById('reelsCaptionText') ? document.getElementById('reelsCaptionText').value : '';
  const normal = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normal) return [];
  const paragraphs = normal.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;
  const lines = normal.split('\n').map(x => x.trim()).filter(Boolean);
  return lines.length > 1 ? lines : paragraphs;
}

function getReelsTimesForSummary() {
  const mode = document.getElementById('reelsTimingMode') ? document.getElementById('reelsTimingMode').value : 'settings';
  if (mode === 'custom') return reelsSelectedTimes;
  return state && state.settings ? state.settings.dailySlots || [] : [];
}

function renderReelsSessionSummary() {
  const mode = document.getElementById('reelsTimingMode') ? document.getElementById('reelsTimingMode').value : 'settings';
  const customBox = document.getElementById('reelsCustomTimesBox');
  if (customBox) customBox.classList.toggle('hidden', mode !== 'custom');
  const selectedTimes = document.getElementById('reelsSelectedTimes');
  if (selectedTimes) {
    selectedTimes.innerHTML = reelsSelectedTimes.length
      ? reelsSelectedTimes.map(t => `<span class="pill">${to12(t)} <button type="button" data-remove-reels-time="${escapeHtml(t)}" aria-label="Remove ${escapeHtml(to12(t))}">×</button></span>`).join('')
      : '<span class="muted">No custom times selected.</span>';
  }
  const captions = getReelsCaptionBlocks();
  const times = getReelsTimesForSummary();
  const pairs = Math.min(reelsSessionVideos.length, captions.length);
  const perDay = Math.max(1, times.length || 0);
  const days = pairs ? Math.ceil(pairs / perDay) : 0;
  const box = document.getElementById('reelsSessionSummary');
  const activePage = cloudWorkspace?.activePage || (cloudWorkspace?.pages || []).find(page => page.isSelected) || null;
  if (box) {
    box.className = pairs && activePage ? 'simple-check success' : 'simple-check muted';
    box.innerHTML = `${reelsSessionVideos.length} video(s) selected · ${captions.length} caption(s) · ${pairs} ready pair(s) · ${times.length || 0} slot(s)/day · estimated ${days} day(s).<br><span class="muted">Destination: ${escapeHtml(activePage?.facebookPageName || 'No Page selected')}. Start Studio Upload sends every item in this session to this Page.</span>`;
  }
  renderReelsSchedulePreview();
}

function renderReelsSchedulePreview() {
  const target = document.getElementById('reelsSchedulePreview');
  if (!target) return;
  const captions = getReelsCaptionBlocks();
  const times = getReelsTimesForSummary();
  const pairs = Math.min(reelsSessionVideos.length, captions.length);
  if (!pairs || !times.length) {
    target.innerHTML = '<div class="empty">Select videos, captions, and at least one time slot to preview Reel assignments.</div>';
    return;
  }
  const start = document.getElementById('reelsStartDate')?.value || defaultDateInput();
  const rows = [];
  let d = new Date(`${start}T00:00:00`);
  let guard = 0;
  while (rows.length < Math.min(pairs, 20) && guard < pairs + 60) {
    for (const t of times) {
      if (rows.length >= Math.min(pairs, 20)) break;
      const [h,m] = t.split(':').map(Number);
      const dt = new Date(d);
      dt.setHours(h, m, 0, 0);
      if (dt.getTime() > Date.now() + 60 * 1000) {
        const file = reelsSessionVideos[rows.length] || '';
        rows.push(`<div class="draft-preview-row"><strong>${rows.length + 1}.</strong> <span>${escapeHtml(file.split(/[\\/]/).pop())}</span><em>${dt.toLocaleString([], { weekday:'short', month:'short', day:'2-digit', hour:'numeric', minute:'2-digit' })}</em></div>`);
      }
    }
    d.setDate(d.getDate() + 1);
    guard++;
  }
  target.innerHTML = `<h4>Studio upload preview</h4>${rows.join('')}${pairs > rows.length ? `<p class="muted">Showing first ${rows.length} of ${pairs} assignments.</p>` : ''}`;
}

async function createReelsQueue() {
  const activePage = cloudWorkspace?.activePage || (cloudWorkspace?.pages || []).find(page => page.isSelected) || null;
  if (!activePage) return toast('Choose a Facebook Page before preparing this Auto Scheduler session.', true);
  const captions = getReelsCaptionBlocks();
  const mode = document.getElementById('reelsTimingMode') ? document.getElementById('reelsTimingMode').value : 'settings';
  const times = mode === 'custom' ? reelsSelectedTimes : [];
  const pairs = Math.min(reelsSessionVideos.length, captions.length);
  if (!pairs) return toast('Select at least one Reel video and one caption.', true);
  if (mode === 'custom' && !times.length) return toast('Choose at least one custom time, or switch to Settings slots.', true);
  try {
    const result = await window.schedulerApi.createReelsQueue({
      videoPaths: reelsSessionVideos.slice(0, pairs),
      captionText: document.getElementById('reelsCaptionText').value,
      startDate: document.getElementById('reelsStartDate')?.value || defaultDateInput(),
      times
    });
    state = result.state || state;
    reelsSessionVideos = [];
    reelsSelectedTimes = [];
    const text = document.getElementById('reelsCaptionText');
    if (text) text.value = '';
    render();
    toast(`Prepared ${result.jobs.length} Reel item(s). Start Studio Upload will upload only these selected items to Meta now.`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function runDueReels() {
  if (isSchedulerRunning) return toast('Another upload is already running.', true);
  isSchedulerRunning = true;
  updateRunButtons();
  updateReelsPanel({ phase: 'Studio upload', percent: 5, message: 'Uploading Reels to Meta schedule now...', current: 0, total: 0, uploaded: 0, failed: 0 });
  try {
    const result = await window.schedulerApi.runDueReels({});
    state = result.state || state;
    render();
    updateReelsPanel({ phase: 'Done', percent: 100, message: result.message || `Uploaded/scheduled ${result.uploaded || result.published || 0}, failed ${result.failed || 0}.`, current: 0, total: 0, uploaded: result.published || 0, failed: result.failed || 0 });
    toast(result.message || `Studio upload complete. Uploaded/scheduled ${result.uploaded || result.published || 0}, failed ${result.failed || 0}.`);
  } catch (err) {
    updateReelsPanel({ phase: 'Error', percent: 100, message: err.message, failed: 1 });
    toast(err.message, true);
  } finally {
    isSchedulerRunning = false;
    updateRunButtons();
  }
}

async function startReelsWatcher() {
  if (isSchedulerRunning) return toast('Upload is already running.', true);
  const activePage = cloudWorkspace?.activePage || (cloudWorkspace?.pages || []).find(page => page.isSelected) || null;
  if (!activePage) return toast('Choose a Facebook Page before starting Auto Scheduler.', true);
  isSchedulerRunning = true;
  updateRunButtons();
  updateReelsPanel({ phase: 'Studio upload', percent: 3, message: 'Preparing selected Reels for immediate Meta schedule upload...', current: 0, total: 0, uploaded: 0, failed: 0 });
  try {
    const captions = getReelsCaptionBlocks();
    const mode = document.getElementById('reelsTimingMode') ? document.getElementById('reelsTimingMode').value : 'settings';
    const times = mode === 'custom' ? reelsSelectedTimes : [];
    const pairs = Math.min(reelsSessionVideos.length, captions.length);

    if (!pairs) {
      throw new Error('Select videos and captions first. Start Studio Upload now uploads only the items currently selected on this screen, not old local items.');
    }
    if (mode === 'custom' && !times.length) throw new Error('Choose at least one custom time, or switch to Settings slots.');

    const created = await window.schedulerApi.createReelsQueue({
      videoPaths: reelsSessionVideos.slice(0, pairs),
      captionText: document.getElementById('reelsCaptionText').value,
      startDate: document.getElementById('reelsStartDate')?.value || defaultDateInput(),
      times
    });
    state = created.state || state;
    const jobIds = (created.jobs || []).map(j => j.id);
    render();

    const result = await window.schedulerApi.runDueReels({ jobIds });
    state = result.state || state;
    reelsSessionVideos = [];
    reelsSelectedTimes = [];
    const text = document.getElementById('reelsCaptionText');
    if (text) text.value = '';
    render();
    updateReelsPanel({ phase: 'Done', percent: 100, message: result.message || `Studio upload finished. Uploaded/scheduled ${result.uploaded || 0}, failed ${result.failed || 0}.`, current: 0, total: 0, uploaded: result.uploaded || result.published || 0, failed: result.failed || 0 });
    toast(result.message || `Studio upload finished. Uploaded/scheduled ${result.uploaded || 0}, failed ${result.failed || 0}.`);
  } catch (err) {
    updateReelsPanel({ phase: 'Error', percent: 100, message: err.message, failed: 1 });
    toast(err.message, true);
  } finally {
    isSchedulerRunning = false;
    updateRunButtons();
  }
}

async function stopReelsWatcher() {
  try {
    const result = await window.schedulerApi.stopReelsWatcher();
    state = result.state || state;
    updateReelsPanel({ phase: 'Stopping', percent: 0, message: result.message || 'Stop upload requested.' });
    toast(result.message || 'Stop upload requested.');
  } catch (err) {
    toast(err.message, true);
  }
}

function updateReelsPanel(payload = {}) {
  const percent = payload.percent === null || payload.percent === undefined ? null : Math.max(0, Math.min(100, Number(payload.percent || 0)));
  const fill = document.getElementById('reelsProgressFill');
  if (fill && percent !== null) fill.style.width = `${percent}%`;
  const percentEl = document.getElementById('reelsPercent');
  if (percentEl && percent !== null) percentEl.textContent = `${Math.round(percent)}%`;
  const phase = document.getElementById('reelsPhase');
  if (phase) phase.textContent = payload.phase || 'Reels';
  const box = document.getElementById('reelsStatusBox');
  if (box) box.textContent = payload.message || 'Working...';
  const current = document.getElementById('reelsCurrent');
  if (current) current.textContent = `${Number(payload.current || 0)}/${Number(payload.total || 0)}`;
  const published = document.getElementById('reelsPublished');
  if (published) published.textContent = Number(payload.uploaded || payload.published || 0);
  const failed = document.getElementById('reelsFailed');
  if (failed) failed.textContent = Number(payload.failed || 0);
}

function statusLabel(status) {
  const labels = {
    reel_queued: 'Ready to upload',
    reel_uploading: 'Uploading to Meta',
    reel_publishing: 'Publishing',
    reel_scheduled: 'Scheduled on Facebook',
    reel_published: 'Published',
    reel_failed: 'Failed',
    reel_upload_failed: 'Upload failed',
    planned: 'Ready',
    uploading: 'Uploading',
    scheduled: 'Scheduled on Facebook',
    failed_retryable: 'Failed - retry allowed',
    stopped: 'Stopped'
  };
  return labels[status] || String(status || '-').replace(/_/g, ' ');
}

function renderReelsQueueTable() {
  const target = document.getElementById('reelsQueueTable');
  if (!target || !state) return;
  const items = (state.jobs || []).filter(j => String(j.status || '').startsWith('reel_')).sort((a,b) => String(a.scheduledAtISO || '').localeCompare(String(b.scheduledAtISO || '')));
  if (!items.length) { target.innerHTML = '<div class="empty">No Reel upload items yet.</div>'; return; }
  target.innerHTML = `<table><thead><tr><th>Video</th><th>Slot</th><th>Status</th><th>Result / Error</th></tr></thead><tbody>${items.map(j => `<tr><td>${escapeHtml(j.videoName)}</td><td>${escapeHtml(j.slotLabel || '-')}</td><td><span class="status ${escapeHtml(j.status)}">${escapeHtml(statusLabel(j.status))}</span></td><td>${escapeHtml(j.fbVideoId || j.fbPostId || j.error || '-')}</td></tr>`).join('')}</tbody></table>`;
}

async function pickLabVideo() {
  try {
    const result = await window.schedulerApi.pickManualVideo();
    if (result.path) {
      labVideoPath = result.path;
      document.getElementById('labVideoPath').value = result.path;
      toast('Publishing Lab video selected.');
    }
  } catch (err) { toast(err.message, true); }
}

async function publishLabReel() {
  try {
    setLabResult('Publishing through Facebook Reels API...', 'working');
    const result = await window.schedulerApi.labPublishReelNow({ videoPath: labVideoPath, caption: document.getElementById('labCaption').value });
    state = result.state || state;
    const id = result.result.video_id || result.result.id || '';
    document.getElementById('labDiagId').value = id;
    setLabResult(`<strong>Facebook Reel published.</strong><br>Endpoint: <span class="code">${escapeHtml(result.result.endpoint)}</span><br>Video ID: <span class="code">${escapeHtml(id)}</span><br><pre>${escapeHtml(JSON.stringify(result.result, null, 2))}</pre>`, 'success');
    render();
  } catch (err) { setLabResult(`Reel publish failed: ${escapeHtml(err.message)}`, 'error'); toast(err.message, true); }
}

async function publishLabLegacy() {
  try {
    setLabResult('Publishing through legacy Page Videos API...', 'working');
    const result = await window.schedulerApi.labPublishLegacyNow({ videoPath: labVideoPath, caption: document.getElementById('labCaption').value });
    state = result.state || state;
    const id = result.result.id || '';
    document.getElementById('labDiagId').value = id;
    setLabResult(`<strong>Legacy Page video published.</strong><br>Endpoint: <span class="code">${escapeHtml(result.result.endpoint)}</span><br>Video ID: <span class="code">${escapeHtml(id)}</span><br><pre>${escapeHtml(JSON.stringify(result.result, null, 2))}</pre>`, 'warning');
    render();
  } catch (err) { setLabResult(`Legacy publish failed: ${escapeHtml(err.message)}`, 'error'); toast(err.message, true); }
}

async function fetchLabDiagnostics() {
  try {
    const objectId = document.getElementById('labDiagId').value.trim();
    if (!objectId) return toast('Paste a video/post ID first.', true);
    const result = await window.schedulerApi.labDiagnostics({ objectId });
    state = result.state || state;
    document.getElementById('labDiagBox').textContent = JSON.stringify(result.result, null, 2);
    render();
  } catch (err) { document.getElementById('labDiagBox').textContent = err.message; toast(err.message, true); }
}

function setLabResult(html, kind = '') {
  const el = document.getElementById('labResult');
  if (!el) return;
  el.className = `simple-check ${kind}`.trim();
  el.innerHTML = html;
}


async function pickDraftSessionVideos() {
  try {
    const result = await window.schedulerApi.pickDraftSessionVideos();
    draftSessionVideos = result.paths || [];
    renderDraftSessionSummary();
    toast(`${draftSessionVideos.length} Draft Studio video(s) selected for this session.`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function pickDraftSessionCaptions() {
  try {
    const result = await window.schedulerApi.pickDraftSessionCaptionFile();
    if (result.text) document.getElementById('draftCaptionText').value = result.text;
    renderDraftSessionSummary();
    toast(result.path ? 'Draft Studio caption file loaded.' : 'No caption file selected.');
  } catch (err) {
    toast(err.message, true);
  }
}

function clearDraftSession() {
  draftSessionVideos = [];
  draftSelectedTimes = [];
  const text = document.getElementById('draftCaptionText');
  if (text) text.value = '';
  renderDraftSessionSummary();
  updateDraftPanel({ phase: 'Idle', percent: 0, current: 0, total: 0, uploaded: 0, failed: 0, message: 'Draft Studio session cleared.' });
}

function buildDraftTimePicker() {
  const picker = document.getElementById('draftTimePicker');
  if (!picker) return;
  const settingsSlots = state && state.settings ? state.settings.dailySlots || [] : ['11:00', '15:13', '22:15', '23:15'];
  const all = new Set(settingsSlots);
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) all.add(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  picker.innerHTML = [...all].sort().map(t => `<option value="${t}">${to12(t)}</option>`).join('');
}

function addDraftSelectedTime() {
  const picker = document.getElementById('draftTimePicker');
  const value = picker ? picker.value : '';
  if (!value) return;
  if (!draftSelectedTimes.includes(value)) draftSelectedTimes.push(value);
  draftSelectedTimes.sort();
  renderDraftSessionSummary();
}

function removeDraftSelectedTime(time) {
  draftSelectedTimes = draftSelectedTimes.filter(t => t !== time);
  renderDraftSessionSummary();
}

function getDraftCaptionBlocks() {
  const text = document.getElementById('draftCaptionText') ? document.getElementById('draftCaptionText').value : '';
  const normal = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normal) return [];
  const paragraphs = normal.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;
  const lines = normal.split('\n').map(x => x.trim()).filter(Boolean);
  return lines.length > 1 ? lines : paragraphs;
}

function getDraftTimesForSummary() {
  const mode = document.getElementById('draftTimingMode') ? document.getElementById('draftTimingMode').value : 'settings';
  if (mode === 'custom') return draftSelectedTimes;
  return state && state.settings ? state.settings.dailySlots || [] : [];
}

function renderDraftSessionSummary() {
  const mode = document.getElementById('draftTimingMode') ? document.getElementById('draftTimingMode').value : 'settings';
  const customBox = document.getElementById('draftCustomTimesBox');
  if (customBox) customBox.classList.toggle('hidden', mode !== 'custom');
  const selectedTimes = document.getElementById('draftSelectedTimes');
  if (selectedTimes) {
    selectedTimes.innerHTML = draftSelectedTimes.length
      ? draftSelectedTimes.map(t => `<span class="pill">${to12(t)} <button type="button" data-remove-draft-time="${escapeHtml(t)}" aria-label="Remove ${escapeHtml(to12(t))}">×</button></span>`).join('')
      : '<span class="muted">No custom times selected.</span>';
  }
  const captions = getDraftCaptionBlocks();
  const times = getDraftTimesForSummary();
  const pairs = Math.min(draftSessionVideos.length, captions.length);
  const perDay = Math.max(1, times.length || 0);
  const days = pairs ? Math.ceil(pairs / perDay) : 0;
  const box = document.getElementById('draftSessionSummary');
  if (box) {
    box.className = pairs ? 'simple-check success' : 'simple-check muted';
    box.innerHTML = `${draftSessionVideos.length} video(s) selected · ${captions.length} caption(s) · ${pairs} ready pair(s) · ${times.length || 0} slot(s)/day · estimated ${days} day(s).<br><span class="muted">Old local library/cache will be ignored. Same video can be selected again.</span>`;
  }
  renderDraftSchedulePreview();
}

function renderDraftSchedulePreview() {
  const target = document.getElementById('draftSchedulePreview');
  if (!target) return;
  const captions = getDraftCaptionBlocks();
  const times = getDraftTimesForSummary();
  const pairs = Math.min(draftSessionVideos.length, captions.length);
  if (!pairs || !times.length) {
    target.innerHTML = '<div class="empty">Select videos, captions, and at least one time slot to preview draft assignments.</div>';
    return;
  }
  const start = document.getElementById('draftStartDate')?.value || defaultDateInput();
  const rows = [];
  let d = new Date(`${start}T00:00:00`);
  let idx = 0;
  while (rows.length < Math.min(pairs, 20) && idx < pairs + 40) {
    for (const t of times) {
      if (rows.length >= Math.min(pairs, 20)) break;
      const [h,m] = t.split(':').map(Number);
      const dt = new Date(d);
      dt.setHours(h, m, 0, 0);
      if (dt.getTime() > Date.now() + 20 * 60000) {
        const file = draftSessionVideos[rows.length] || '';
        rows.push(`<div class="draft-preview-row"><strong>${rows.length + 1}.</strong> <span>${escapeHtml(file.split(/[\\/]/).pop())}</span><em>${dt.toLocaleString([], { weekday:'short', month:'short', day:'2-digit', hour:'numeric', minute:'2-digit' })}</em></div>`);
      }
    }
    d.setDate(d.getDate() + 1);
    idx++;
  }
  target.innerHTML = `<h4>Draft schedule preview</h4>${rows.join('')}${pairs > rows.length ? `<p class="muted">Showing first ${rows.length} of ${pairs} assignments.</p>` : ''}`;
}

async function uploadDraftSession() {
  if (isSchedulerRunning) {
    toast('Another upload is already running. Use Stop Upload first if needed.', true);
    return;
  }
  const captions = getDraftCaptionBlocks();
  const mode = document.getElementById('draftTimingMode') ? document.getElementById('draftTimingMode').value : 'settings';
  const times = mode === 'custom' ? draftSelectedTimes : [];
  const pairs = Math.min(draftSessionVideos.length, captions.length);
  if (!pairs) {
    toast('Draft Studio needs at least one selected video and one caption.', true);
    return;
  }
  if (mode === 'custom' && !times.length) {
    toast('Choose at least one custom time, or switch to Settings slots.', true);
    return;
  }
  isSchedulerRunning = true;
  draftSessionRunning = true;
  updateRunButtons();
  updateDraftPanel({ phase: 'Draft Studio', percent: 2, current: 0, total: pairs, uploaded: 0, failed: 0, message: `Starting ${pairs} session draft upload(s)...` });
  try {
    const result = await window.schedulerApi.uploadDraftSession({
      videoPaths: draftSessionVideos.slice(0, pairs),
      captionText: document.getElementById('draftCaptionText').value,
      startDate: document.getElementById('draftStartDate')?.value || defaultDateInput(),
      times
    });
    state = result.state || state;
    render();
    updateDraftPanel({ phase: 'Done', percent: 100, current: pairs, total: pairs, uploaded: result.uploaded || 0, failed: result.failed || 0, message: `Draft Studio finished. Uploaded ${result.uploaded || 0}, failed ${result.failed || 0}. Session cleared; you can select the same videos again.` });
    // V12.8: clear Draft Studio session after upload so no old selected files are reused.
    draftSessionVideos = [];
    draftSelectedTimes = [];
    const draftTextBox = document.getElementById('draftCaptionText');
    if (draftTextBox) draftTextBox.value = '';
    renderDraftSessionSummary();
    toast(`Draft Studio finished. Uploaded ${result.uploaded || 0}, failed ${result.failed || 0}.`);
  } catch (err) {
    updateDraftPanel({ phase: 'Error', percent: 100, current: 0, total: pairs, uploaded: 0, failed: 0, message: err.message, failedType: true });
    toast(err.message, true);
  } finally {
    isSchedulerRunning = false;
    draftSessionRunning = false;
    updateRunButtons();
  }
}

function updateDraftPanel(payload = {}) {
  const percent = payload.percent === null || payload.percent === undefined ? null : Math.max(0, Math.min(100, Number(payload.percent ?? 0)));
  const bar = document.getElementById('draftUploadBar');
  if (bar && percent !== null) bar.style.width = `${percent}%`;
  const pct = document.getElementById('draftUploadPercent');
  if (pct && percent !== null) pct.textContent = `${Math.round(percent)}%`;
  const phase = document.getElementById('draftUploadPhase');
  if (phase) phase.textContent = payload.phase || 'Working';
  const cur = document.getElementById('draftCurrentCount');
  if (cur) cur.textContent = `${Number(payload.current || 0)}/${Number(payload.total || 0)}`;
  const up = document.getElementById('draftUploadedCount');
  if (up) up.textContent = Number(payload.uploaded || 0);
  const fail = document.getElementById('draftFailedCount');
  if (fail) fail.textContent = Number(payload.failed || 0);
  const act = document.getElementById('draftActivity');
  if (act && payload.message) {
    act.className = `simple-check ${payload.failedType ? 'error' : 'working'}`;
    act.textContent = payload.message;
  }
}

async function uploadDraftTest() {
  if (isSchedulerRunning) {
    toast('Another upload is already running. Use Stop Upload first if needed.', true);
    return;
  }
  // No confirmation popup. Draft Studio should start immediately when user clicks the button.
  isSchedulerRunning = true;
  updateRunButtons();
  setDraftTestStatus('Preparing 3 draft uploads and checking Meta slots...', 'working');
  try {
    updateProgress({ type: 'draft-test-start', phase: 'Draft test', percent: 3, message: 'Preparing draft test...', current: 0, total: 3, uploaded: 0, failed: 0 });
    const result = await window.schedulerApi.uploadDraftTest(3);
    state = result.state;
    render();
    const fallbackCount = (result.results || []).filter(r => r.fallbackNoSchedule).length;
    const extra = fallbackCount
      ? `<br><strong>Note:</strong> ${fallbackCount} draft(s) were accepted without API schedule time. Use the app's intended slot when manually scheduling in Business Suite.`
      : '';
    setDraftTestStatus(`Draft test finished. Uploaded drafts: <strong>${result.uploaded || 0}</strong>. Failed: <strong>${result.failed || 0}</strong>.${extra}<br>Now open Meta Business Suite drafts and check whether publishing manually shows as Montasir Ali or INX Social.`, (result.failed || 0) ? 'warning' : 'success');
    toast(`Draft test done. Uploaded ${result.uploaded || 0}, failed ${result.failed || 0}.`);
  } catch (err) {
    setDraftTestStatus(`Draft test failed: ${escapeHtml(err.message)}`, 'error');
    toast(err.message, true);
  } finally {
    isSchedulerRunning = false;
    updateRunButtons();
  }
}

function setDraftTestStatus(html, kind = '') {
  const el = document.getElementById('draftTestStatus');
  if (!el) return;
  el.className = `simple-check ${kind || 'muted'}`.trim();
  el.innerHTML = html;
}

async function stopScheduler() {
  try {
    const result = await window.schedulerApi.stopScheduler();
    if (result.state) {
      state = result.state;
      render();
    }
    toast(result.message || 'Stop requested.');
    updateProgress({ type: 'stop-requested', phase: 'Stopping', message: result.message || 'Stop requested.', current: 0, total: 0 });
  } catch (err) {
    toast(`Stop failed: ${err.message}`, true);
  }
}

function updateRunButtons() {
  const run = document.getElementById('btnRunScheduler');
  const stop = document.getElementById('btnStopScheduler');
  if (run) run.disabled = isSchedulerRunning;
  const hero = document.getElementById('btnHeroRun');
  if (hero) hero.disabled = isSchedulerRunning;
  const draft = document.getElementById('btnUploadDraftTest');
  if (draft) draft.disabled = isSchedulerRunning;
  const draftSession = document.getElementById('btnUploadDraftSession');
  const stopDraft = document.getElementById('btnStopDraftSession');
  const studioStart = document.getElementById('btnReelsStartWatcher');
  const studioStop = document.getElementById('btnReelsStopWatcher');
  const pageSelect = document.getElementById('reelsPageSelect');
  if (draftSession) draftSession.disabled = isSchedulerRunning;
  if (stopDraft) stopDraft.disabled = !draftSessionRunning;
  if (studioStart) studioStart.disabled = isSchedulerRunning;
  if (studioStop) studioStop.disabled = !isSchedulerRunning;
  if (pageSelect) pageSelect.disabled = isSchedulerRunning || !(cloudWorkspace?.pages || []).length;
  if (stop) stop.disabled = !isSchedulerRunning;
}


async function connectFacebookPage() {
  try {
    const metaAppId = '969283649323618';

    // Save the visible Settings form first. The Meta App ID is built into this app,
    // so reviewers/users are never asked to type it.
    const settings = {
      pageId: val('settingPageId'),
      facebookAppId: metaAppId,
      graphVersion: val('settingGraphVersion') || 'v25.0',
      timezone: val('settingTimezone') || 'Europe/London',
      dailySlots: val('settingSlots'),
      maxScheduleDays: Number(val('settingMaxDays') || 25),
      minLeadMinutes: Number(val('settingLead') || 20),
      maxRetries: Number(val('settingRetries') || 3),
      retryBaseDelayMs: Number(val('settingRetryDelay') || 5000),
      preferExactFilenameMatch: document.getElementById('settingExact').checked,
      copyImportedFiles: document.getElementById('settingCopy').checked,
      captionSplitMode: document.getElementById('settingCaptionSplitMode').value || 'auto',
      uiTheme: document.getElementById('settingUiTheme').value || 'aurora',
      uiDensity: 'comfortable',
      enableMotion: true
    };
    const saved = await window.schedulerApi.saveSettings(settings);
    state = saved.state;

    toast('Opening Facebook login. Select the Page permissions, then return to the app.');
    const result = await window.schedulerApi.connectFacebookPage();
    state = result.state;
    render();
    toast(`Connected Page: ${result.page.name}`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function disconnectFacebookPage() {
  if (!confirm('Clear the saved Facebook Page ID and access token from this app?')) return;
  try {
    const result = await window.schedulerApi.disconnectFacebookPage();
    state = result.state;
    render();
    toast('Facebook connection cleared.');
  } catch (err) {
    toast(err.message, true);
  }
}


async function openExternalUrl(url) {
  try {
    await window.schedulerApi.openExternalUrl(url);
  } catch (err) {
    toast(`Could not open link: ${err.message}`, true);
  }
}

async function testFacebook() {
  try {
    const result = await window.schedulerApi.testFacebook();
    state = result.state;
    render();
    toast(`Active Page verified: ${result.activePage?.name || result.result.name || result.result.id}`);
  } catch (err) {
    toast(`Active Page test failed: ${err.message}`, true);
  }
}

async function listMetaScheduled() {
  try {
    const result = await window.schedulerApi.listScheduledPosts();
    state = result.state;
    renderMetaScheduled(result.result.data || []);
    toast(`Fetched ${(result.result.data || []).length} Meta scheduled post(s).`);
  } catch (err) {
    toast(`Could not fetch Meta scheduled posts: ${err.message}`, true);
  }
}


async function pickManualVideo() {
  try {
    const result = await window.schedulerApi.pickManualVideo();
    if (!result || !result.path) return;
    document.getElementById('manualVideoPath').value = result.path;
    toast('Manual Reel video selected.');
  } catch (err) {
    toast(err.message, true);
  }
}

function manualPayload() {
  return {
    videoPath: val('manualVideoPath'),
    caption: document.getElementById('manualCaption').value.trim(),
    date: val('manualDate'),
    time: val('manualTime'),
    useNextFree: document.getElementById('manualUseNextFree').checked
  };
}

async function pickManualCaptionFile() {
  try {
    const result = await window.schedulerApi.pickReelsCaptionFile();
    if (!result.text) return toast('No caption file selected.');
    const normal = String(result.text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const paragraphs = normal.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean);
    const blocks = paragraphs.length > 1 ? paragraphs : normal.split('\n').map(x => x.trim()).filter(Boolean);
    const caption = blocks[0] || '';
    document.getElementById('manualCaption').value = caption;
    toast(`Caption file loaded. Using 1 caption for this 1 selected Reel${blocks.length > 1 ? ` (${blocks.length - 1} extra caption(s) ignored here).` : '.'}`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function checkManualPost() {
  try {
    setManualHealth('Checking selected Reel and schedule slot...', 'working');
    const result = await window.schedulerApi.manualHealthCheck(manualPayload());
    state = result.state;
    render();
    renderManualHealth(result);
  } catch (err) {
    setManualHealth(`Check failed: ${escapeHtml(err.message)}`, 'error');
    toast(err.message, true);
  }
}

async function scheduleManualPost() {
  try {
    updateManualProgress({ phase: 'Starting', percent: 5, message: 'Checking selected Reel and uploading it to Meta schedule...' });
    const result = await window.schedulerApi.manualScheduleAndUpload(manualPayload());
    state = result.state;
    render();
    const uploaded = result.upload && (result.upload.uploaded || result.upload.published || 0);
    const failed = result.upload && (result.upload.failed || 0);
    if (failed) {
      updateManualProgress({ phase: 'Failed', percent: 100, message: result.upload.message || 'Meta scheduled upload failed.' });
      setManualHealth(`Manual Reel was prepared but Meta upload failed.<br>Slot: <strong>${escapeHtml(result.job.slotLabel)}</strong><br>Check Logs for the exact backend error.`, 'error');
      toast(result.upload.message || 'Meta scheduled upload failed.', true);
    } else {
      updateManualProgress({ phase: 'Scheduled on Meta', percent: 100, message: `Uploaded to Meta schedule: ${result.job.slotLabel}` });
      setManualHealth(`Uploaded to Meta schedule.<br>Slot: <strong>${escapeHtml(result.job.slotLabel)}</strong><br>Status: <span class="code">Scheduled on Facebook</span>`, 'success');
      toast('Manual Reel uploaded to Meta schedule.');
    }
  } catch (err) {
    updateManualProgress({ phase: 'Failed', percent: 100, message: err.message });
    setManualHealth(`Manual Reel schedule failed: ${escapeHtml(err.message)}`, 'error');
    toast(err.message, true);
  }
}

function clearManualForm() {
  document.getElementById('manualVideoPath').value = '';
  document.getElementById('manualCaption').value = '';
  document.getElementById('manualDate').value = defaultDateInput();
  document.getElementById('manualTime').value = '';
  setManualHealth('Choose a video, write a caption, then click Check This Reel.', '');
  updateManualProgress({ phase: 'Idle', percent: 0, message: 'No manual schedule action running.' });
}

async function runHealthCheck() {
  try {
    document.getElementById('healthSummary').innerHTML = '<div class="health-card working">Checking local library and Meta scheduled slots...</div>';
    const result = await window.schedulerApi.runHealthCheck();
    state = result.state;
    render();
    renderHealthCheck(result);
    toast(`Health check complete: ${result.summary.ok} OK, ${result.summary.warning} warnings, ${result.summary.error} errors.`);
  } catch (err) {
    document.getElementById('healthSummary').innerHTML = `<div class="health-card error">Health check failed: ${escapeHtml(err.message)}</div>`;
    toast(err.message, true);
  }
}

function renderManualHealth(result) {
  const rows = (result.checks || []).map(check => `<li class="${check.level}"><strong>${escapeHtml(check.title)}</strong><br><span>${escapeHtml(check.message)}</span></li>`).join('');
  const slot = result.slot ? `<div class="health-slot">Selected/assigned slot: <strong>${escapeHtml(result.slot.slotLabel)}</strong></div>` : '';
  setManualHealth(`${slot}<ul class="health-list">${rows}</ul>`, result.summary.error ? 'error' : result.summary.warning ? 'warning' : 'success');
}

function renderHealthCheck(result) {
  document.getElementById('healthSummary').innerHTML = `
    <div class="health-cards">
      <div class="health-card success"><strong>${result.summary.ok}</strong><span>OK</span></div>
      <div class="health-card warning"><strong>${result.summary.warning}</strong><span>Warnings</span></div>
      <div class="health-card error"><strong>${result.summary.error}</strong><span>Errors</span></div>
      <div class="health-card"><strong>${result.metaOccupiedSlotCount}</strong><span>Meta occupied slots</span></div>
    </div>`;
  document.getElementById('healthResults').innerHTML = `<ul class="health-list">${(result.checks || []).map(check => `
    <li class="${check.level}"><strong>${escapeHtml(check.title)}</strong><br><span>${escapeHtml(check.message)}</span></li>`).join('')}</ul>`;
}

function setManualHealth(html, kind = '') {
  const el = document.getElementById('manualHealthBox');
  if (!el) return;
  el.className = `health-box ${kind}`.trim();
  el.innerHTML = html;
}

function updateManualProgress(payload) {
  const percent = Math.max(0, Math.min(100, Number(payload.percent || 0)));
  const phase = document.getElementById('manualProgressPhase');
  const pct = document.getElementById('manualProgressPercent');
  const fill = document.getElementById('manualProgressFill');
  const box = document.getElementById('manualProgressBox');
  if (phase) phase.textContent = payload.phase || 'Idle';
  if (pct) pct.textContent = `${Math.round(percent)}%`;
  if (fill) fill.style.width = `${percent}%`;
  if (box) box.textContent = payload.message || 'No manual schedule action running.';
}

function defaultDateInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function openUserData() {
  await window.schedulerApi.openUserData();
}

async function clearAll() {
  if (!confirm('Clear all local videos, captions, jobs, and logs from this app? This will not delete posts already scheduled on Facebook.')) return;
  state = await window.schedulerApi.clearAll();
  lastPreview = null;
  render();
  toast('Local library cleared.');
}

async function deleteLocalJob(id) {
  const result = await window.schedulerApi.deleteLocalJob(id);
  state = result.state;
  render();
  toast('Local job removed.');
}

async function saveSettings(options = {}) {
  const settings = {
    pageId: val('settingPageId'),
    facebookAppId: val('settingFacebookAppId') || '969283649323618',
    graphVersion: val('settingGraphVersion'),
    timezone: val('settingTimezone'),
    dailySlots: val('settingSlots'),
    maxScheduleDays: Number(val('settingMaxDays')),
    minLeadMinutes: Number(val('settingLead')),
    maxRetries: Number(val('settingRetries')),
    retryBaseDelayMs: Number(val('settingRetryDelay')),
    preferExactFilenameMatch: document.getElementById('settingExact').checked,
    copyImportedFiles: document.getElementById('settingCopy').checked,
    captionSplitMode: document.getElementById('settingCaptionSplitMode').value,
    uiTheme: document.getElementById('settingUiTheme').value,
    uiDensity: 'comfortable',
    enableMotion: true
  };
  const result = await window.schedulerApi.saveSettings(settings);
  state = result.state;
  render();
  if (!options.silent) toast('Settings saved.');
}



async function saveUITexts() {
  const uiTexts = {};
  for (const key of UI_TEXT_FIELDS) {
    const el = document.getElementById(`uiText_${key}`);
    if (el) uiTexts[key] = el.value;
  }
  const result = await window.schedulerApi.saveUITexts(uiTexts);
  state = result.state;
  render();
  toast('Interface text saved.');
}

async function resetUITexts() {
  if (!confirm('Reset all button names and interface labels to default?')) return;
  const result = await window.schedulerApi.resetUITexts();
  state = result.state;
  render();
  toast('Interface text reset.');
}

function val(id) {
  return document.getElementById(id).value.trim();
}

function render() {
  renderAccountGate();
  if (!state) return;
  cloudWorkspace = state.workspace || cloudWorkspace;
  applyThemeSettings();
  renderStats();
  renderSlotPills();
  renderTables();
  renderCalendar();
  renderLogs();
  fillSettings();
  fillInterfaceSettings();
  applyUITexts();
  updateRunButtons();
  buildDraftTimePicker();
  renderDraftSessionSummary();
  buildReelsTimePicker();
  renderReelsSessionSummary();
  renderReelsQueueTable();
  if (lastPreview) renderPlan(lastPreview);
  renderWorkspaceV2();
}

function renderStats() {
  const jobs = state.jobs || [];
  const videos = state.videos || [];
  const captions = state.captions || [];
  const planned = jobs.filter(j => ['reel_queued','reel_uploading','reel_publishing','reel_failed','reel_upload_failed','planned','failed_retryable','stopped'].includes(j.status)).length;
  const scheduled = jobs.filter(j => ['reel_scheduled','reel_published','scheduled'].includes(j.status)).length;
  document.getElementById('statVideos').textContent = videos.length;
  document.getElementById('statCaptions').textContent = captions.length;
  document.getElementById('statPlanned').textContent = planned;
  document.getElementById('statScheduled').textContent = scheduled;
  updateDashboardPulse({ planned, scheduled, videos: videos.length, captions: captions.length });
}

function updateDashboardPulse(stats = {}) {
  const ring = document.getElementById('dashboardProgressRing');
  const ringText = document.getElementById('dashboardRingPercent');
  const system = document.getElementById('dashboardSystemState');
  const hint = document.getElementById('dashboardSystemHint');
  const total = Number(stats.planned || 0) + Number(stats.scheduled || 0);
  const percent = total ? Math.round((Number(stats.scheduled || 0) / total) * 100) : 0;
  if (ring) ring.style.setProperty('--p', percent);
  if (ring) ring.title = total
    ? `${Number(stats.scheduled || 0)} completed or scheduled out of ${total} tracked queue item${total === 1 ? '' : 's'}.`
    : 'No tracked queue items yet.';
  if (ringText) ringText.textContent = `${percent}%`;
  if (system) {
    if (isSchedulerRunning) system.textContent = 'Publishing now';
    else if (stats.planned) system.textContent = 'Schedule ready';
    else if (!stats.videos) system.textContent = 'Waiting for videos';
    else if (!stats.captions) system.textContent = 'Waiting for captions';
    else system.textContent = 'Synced / idle';
  }
  if (hint) {
    if (isSchedulerRunning) hint.textContent = 'Live publishing progress is updating below.';
    else if (stats.planned) hint.textContent = `${stats.planned} content item${Number(stats.planned) === 1 ? '' : 's'} ready for upload.`;
    else if (!stats.videos || !stats.captions) hint.textContent = 'Open Auto Scheduler to select videos and captions.';
    else hint.textContent = 'Create an Auto or Manual schedule to begin.';
  }
}

function renderSlotPills() {
  document.getElementById('slotPills').innerHTML = state.settings.dailySlots
    .map(slot => `<span class="pill">${escapeHtml(to12(slot))}</span>`)
    .join('');
}

function renderTables() {
  const jobsSorted = [...state.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  document.getElementById('recentJobs').innerHTML = renderJobTable(jobsSorted.slice(0, 12));
  document.getElementById('videoTable').innerHTML = renderMediaTable(state.videos, 'video');
  document.getElementById('captionTable').innerHTML = renderMediaTable(state.captions, 'caption');
}

function renderMediaTable(items, type) {
  if (!items.length) return `<div class="empty">No ${type}s imported yet.</div>`;
  const captionMode = type === 'caption';
  return `<table><thead><tr><th>Name</th><th>${captionMode ? 'Caption preview' : 'Base match key'}</th><th>Size</th><th>Imported</th></tr></thead><tbody>${items.map(item => `
    <tr>
      <td>${escapeHtml(item.name)}${captionMode && item.sourceTotal > 1 ? `<br><span class="muted">Block ${item.sourceIndex} of ${item.sourceTotal}</span>` : ''}</td>
      <td class="${captionMode ? '' : 'code'}">${captionMode ? escapeHtml(shorten(item.content || '', 90)) : escapeHtml(item.baseName)}</td>
      <td>${formatBytes(item.size)}</td>
      <td>${formatDate(item.importedAt)}</td>
    </tr>`).join('')}</tbody></table>`;
}

function renderJobTable(jobs) {
  if (!jobs.length) return '<div class="empty">No schedule jobs yet.</div>';
  return `<table><thead><tr><th>Status</th><th>Video</th><th>Caption</th><th>Scheduled Time</th><th>Meta ID</th><th>Error</th><th></th></tr></thead><tbody>${jobs.map(job => `
    <tr>
      <td><span class="status ${escapeHtml(job.status)}">${escapeHtml(statusLabel(job.status))}</span></td>
      <td>${escapeHtml(job.videoName)}<br><span class="muted">${escapeHtml(job.matchType || '')}</span></td>
      <td>${escapeHtml(job.captionName)}</td>
      <td>${escapeHtml(job.slotLabel || formatDate(job.scheduledAtISO))}</td>
      <td class="code">${escapeHtml(job.fbVideoId || job.fbPostId || '-')}</td>
      <td>${escapeHtml(job.error || '')}</td>
      <td><button class="btn ghost compact" data-remove-job-id="${escapeHtml(job.id)}">Remove</button></td>
    </tr>`).join('')}</tbody></table>`;
}

function renderPlan(result) {
  const box = document.getElementById('simpleScheduleCheck');
  if (!box || !result) return;
  const summary = getSimplePlanSummary(result);
  setSimpleScheduleCheck(summary.html, summary.kind);
}

function getSimplePlanSummary(result) {
  const plan = result.plan || { assignments: [], skipped: [] };
  const pairing = result.pairing || { pairs: [], unmatchedVideos: [], unmatchedCaptions: [] };
  const metaCount = Number(result.metaOccupiedSlotCount || 0);
  const assignments = plan.assignments || [];
  const unmatchedVideos = pairing.unmatchedVideos || [];
  const unmatchedCaptions = pairing.unmatchedCaptions || [];
  const maxDate = formatDate(plan.maxDateISO);

  if (assignments.length > 0) {
    const first = assignments[0];
    const last = assignments[assignments.length - 1];
    return {
      kind: 'success',
      toast: `${assignments.length} video(s) can be scheduled safely.`,
      html: `<strong>${assignments.length} video(s) ready to upload.</strong><br>
        First empty slot: <strong>${escapeHtml(first.slotLabel)}</strong><br>
        Last assigned slot: <strong>${escapeHtml(last.slotLabel)}</strong><br>
        Meta/Facebook already has <strong>${metaCount}</strong> occupied scheduled slot(s), so those were skipped.<br>
        <span class="muted">Extra captions available: ${unmatchedCaptions.length}. Extra videos without captions: ${unmatchedVideos.length}.</span>`
    };
  }

  if ((pairing.pairs || []).length > 0 && metaCount > 0) {
    return {
      kind: 'warning',
      toast: 'No free Meta slots found inside your current Max schedule days.',
      html: `<strong>No free slot available right now.</strong><br>
        You have <strong>${pairing.pairs.length}</strong> video/caption pair(s) ready, but Meta/Facebook already has <strong>${metaCount}</strong> scheduled slot(s) reserved up to your limit.<br>
        Current max check date: <strong>${escapeHtml(maxDate)}</strong>.<br>
        <span class="muted">This is safe: the app will not upload duplicates into already-used times. Add more days in Settings only if Meta accepts further future scheduling.</span>`
    };
  }

  if (unmatchedVideos.length > 0 && unmatchedCaptions.length === 0) {
    return {
      kind: 'error',
      toast: 'Videos found, but not enough captions.',
      html: `<strong>Videos are waiting for captions.</strong><br>
        Extra videos without captions: <strong>${unmatchedVideos.length}</strong>.<br>
        Add more captions, then run again.`
    };
  }

  if (unmatchedCaptions.length > 0 && state && state.videos && state.videos.length === 0) {
    return {
      kind: 'warning',
      toast: 'Captions found, but no videos imported.',
      html: `<strong>No videos imported yet.</strong><br>
        Captions available: <strong>${unmatchedCaptions.length}</strong>.<br>
        Import videos, then run the scheduler.`
    };
  }

  return {
    kind: 'warning',
    toast: 'Nothing new to schedule.',
    html: `<strong>Nothing new to upload.</strong><br>
      This usually means your videos are already planned/scheduled, or there are no matching video/caption pairs.<br>
      <span class="muted">Meta occupied slots found: ${metaCount}. Extra captions: ${unmatchedCaptions.length}. Extra videos: ${unmatchedVideos.length}.</span>`
  };
}

function getSimpleRunSummary(result) {
  const p = result.planSummary || {};
  const maxDate = formatDate(p.maxDateISO);
  if (result.uploaded > 0) {
    return `<strong>Upload complete.</strong><br>
      Uploaded/scheduled: <strong>${result.uploaded}</strong>. Failed: <strong>${result.failed}</strong>.<br>
      Meta occupied slots checked before upload: <strong>${p.metaOccupiedSlotCount || 0}</strong>.`;
  }
  return `<strong>No upload was made.</strong><br>
    Ready pairs found: <strong>${p.pairs || 0}</strong>. New slots assigned: <strong>${p.assignments || 0}</strong>.<br>
    Meta/Facebook occupied slots: <strong>${p.metaOccupiedSlotCount || 0}</strong>. Max date checked: <strong>${escapeHtml(maxDate)}</strong>.<br>
    <span class="muted">This prevents duplicate scheduling. New videos will upload when an empty slot exists.</span>`;
}

function setSimpleScheduleCheck(html, kind = '') {
  const root = document.getElementById('simpleScheduleCheck');
  if (!root) return;
  root.className = `simple-schedule-check ${kind}`.trim();
  root.innerHTML = `<div class="check-title">Schedule check</div><div class="check-body">${html}</div>`;
}

function renderCalendar() {
  const root = document.getElementById('calendarGrid');
  const now = new Date();
  const days = [];
  for (let i = 0; i < 35; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    days.push(date);
  }
  const jobsByDate = groupJobsByDate(state.jobs || []);
  root.innerHTML = days.map(date => {
    const key = date.toISOString().slice(0, 10);
    const jobs = jobsByDate[key] || [];
    const today = key === now.toISOString().slice(0, 10);
    return `<div class="day-card ${today ? 'today' : ''}">
      <div class="day-date"><strong>${date.toLocaleDateString(undefined, { weekday: 'short' })}</strong><span>${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span></div>
      ${jobs.map(job => `<div class="cal-job ${escapeHtml(job.status)}"><strong>${escapeHtml(timeFromIso(job.scheduledAtISO))}</strong><br>${escapeHtml(job.videoName)}<br><span class="muted">${escapeHtml(statusLabel(job.status))}</span></div>`).join('') || '<span class="muted">No jobs</span>'}
    </div>`;
  }).join('');
}

function renderMetaScheduled(posts) {
  const box = document.getElementById('metaScheduledBox');
  box.classList.remove('hidden');
  box.innerHTML = `<div class="panel-head"><h3>Meta scheduled posts</h3><p>Fetched live from Facebook Page scheduled_posts edge.</p></div>` +
    (posts.length ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Message</th><th>Scheduled</th><th>Published?</th></tr></thead><tbody>${posts.map(post => `
      <tr><td class="code">${escapeHtml(post.id)}</td><td>${escapeHtml(post.message || '')}</td><td>${escapeHtml(post.scheduled_publish_time || '')}</td><td>${escapeHtml(String(post.is_published))}</td></tr>
    `).join('')}</tbody></table></div>` : '<div class="empty">Meta returned no scheduled posts.</div>');
}

function groupJobsByDate(jobs) {
  const grouped = {};
  for (const job of jobs) {
    if (!job.scheduledAtISO) continue;
    const key = new Date(job.scheduledAtISO).toISOString().slice(0, 10);
    grouped[key] = grouped[key] || [];
    grouped[key].push(job);
  }
  for (const key of Object.keys(grouped)) grouped[key].sort((a, b) => a.scheduledUnix - b.scheduledUnix);
  return grouped;
}

function renderLogs() {
  const logs = state.logs || [];
  const target = document.getElementById('logsTable');
  if (!target) return;
  if (!logs.length) {
    target.innerHTML = '<div class="empty">No logs yet.</div>';
    return;
  }
  target.innerHTML = `<table><thead><tr><th>Time</th><th>Type</th><th>Message</th><th>Backend details</th></tr></thead><tbody>${logs.map(log => `
    <tr>
      <td>${formatDate(log.createdAt)}</td>
      <td>${escapeHtml(log.type)}</td>
      <td>${escapeHtml(log.message)}</td>
      <td><pre class="log-extra">${escapeHtml(formatLogExtra(log.extra))}</pre></td>
    </tr>
  `).join('')}</tbody></table>`;
}

function formatLogExtra(extra) {
  if (!extra || (typeof extra === 'object' && !Object.keys(extra).length)) return '';
  try {
    return JSON.stringify(extra, null, 2);
  } catch (_) {
    return String(extra);
  }
}

function fillSettings() {
  const s = state.settings;
  document.getElementById('settingPageId').value = s.pageId || '';
  const appIdField = document.getElementById('settingFacebookAppId');
  if (appIdField) appIdField.value = s.facebookAppId || '969283649323618';
  renderFacebookConnectStatus(s);
  document.getElementById('settingGraphVersion').value = s.graphVersion || 'v25.0';
  document.getElementById('settingTimezone').value = s.timezone || 'Europe/London';
  document.getElementById('settingSlots').value = (s.dailySlots || []).join('\n');
  document.getElementById('settingMaxDays').value = s.maxScheduleDays || 29;
  document.getElementById('settingLead').value = s.minLeadMinutes || 20;
  document.getElementById('settingRetries').value = s.maxRetries || 3;
  document.getElementById('settingRetryDelay').value = s.retryBaseDelayMs || 5000;
  document.getElementById('settingExact').checked = Boolean(s.preferExactFilenameMatch);
  document.getElementById('settingCopy').checked = Boolean(s.copyImportedFiles);
  document.getElementById('settingCaptionSplitMode').value = s.captionSplitMode || 'auto';
  const theme = document.getElementById('settingUiTheme');
  if (theme) theme.value = s.uiTheme || 'aurora';
}

function applyThemePreviewFromControls() {
  const theme = document.getElementById('settingUiTheme');
  if (theme) document.body.dataset.theme = theme.value || 'aurora';
  document.body.dataset.density = 'comfortable';
  document.body.classList.remove('motion-off');
}

function applyThemeSettings() {
  const s = state.settings || {};
  document.body.dataset.theme = s.uiTheme || 'aurora';
  document.body.dataset.density = 'comfortable';
  document.body.classList.remove('motion-off');
}



function normaliseBrandText(ui) {
  const output = { ...(ui || {}) };
  if (!output.appTitle || output.appTitle === 'Facebook Reels Scheduler') output.appTitle = 'INX Social';
  if (!output.appSubtitle || ['Auto and manual Reel scheduling', 'Facebook Reels & Page Scheduler'].includes(output.appSubtitle)) output.appSubtitle = 'Content Scheduler';
  if (!output.dashboardSubtitle || output.dashboardSubtitle === 'Schedule Facebook Reels using Auto or Manual Scheduler.') output.dashboardSubtitle = 'Plan and schedule content across your connected Pages.';
  if (!output.testFacebookButton || ['Test Facebook Connection', 'Test Connection'].includes(output.testFacebookButton)) output.testFacebookButton = 'Test Active Page';
  return output;
}

function fillInterfaceSettings() {
  const ui = normaliseBrandText(state.uiTexts || {});
  for (const key of UI_TEXT_FIELDS) {
    const el = document.getElementById(`uiText_${key}`);
    if (el) el.value = ui[key] || '';
  }
}

function applyUITexts() {
  const ui = normaliseBrandText(state.uiTexts || {});
  const textMap = {
    brandTitle: ui.appTitle,
    brandSubtitle: ui.appSubtitle,
    btnRefresh: ui.refreshButton,
    btnRunScheduler: ui.runSchedulerButton,
    btnStopScheduler: ui.stopSchedulerButton,
    btnPreviewPlan: ui.checkSlotsButton,
    btnTestFacebook: ui.testFacebookButton,
    btnTestFacebook2: ui.testFacebookButton,
    btnOpenUserData: ui.openLocalDataButton,
    btnPickVideos: ui.uploadVideosButton,
    btnPickVideos2: ui.uploadVideosButton,
    btnPickVideoFolder: ui.importVideoFolderButton,
    btnPickCaptions: ui.uploadCaptionsButton,
    btnPickCaptions2: ui.uploadCaptionsButton,
    btnPickCaptionFolder: ui.importCaptionFolderButton,
    btnPickCaptionFolder2: ui.importCaptionFolderButton,
    btnImportPastedCaptions: ui.importPastedCaptionsButton,
    btnClearPaste: ui.clearTextButton,
    btnClearAll: ui.clearLocalLibraryButton,
    btnListMeta: ui.fetchMetaButton,
    btnSaveSettings: ui.saveSettingsButton
  };
  for (const [id, text] of Object.entries(textMap)) {
    const el = document.getElementById(id);
    if (el && text) el.textContent = text;
  }
  if (ui.dashboardTitle) views.dashboard[0] = ui.dashboardTitle;
  if (ui.dashboardSubtitle) views.dashboard[1] = ui.dashboardSubtitle;
  const active = document.querySelector('.nav.active');
  if (active) {
    document.getElementById('viewTitle').textContent = views[active.dataset.view][0];
    document.getElementById('viewSubtitle').textContent = views[active.dataset.view][1];
  }
}

function setProgress(message) {
  const box = document.getElementById('progressBox');
  box.textContent = message || 'No active upload.';
}

function updateProgress(payload = {}) {
  const percent = payload.percent === null || payload.percent === undefined ? null : Math.max(0, Math.min(100, Number(payload.percent ?? 0)));
  const fill = document.getElementById('progressFill');
  const pct = document.getElementById('progressPercent');
  const phase = document.getElementById('progressPhase');
  const current = document.getElementById('progressCurrent');
  const uploaded = document.getElementById('progressUploaded');
  const failed = document.getElementById('progressFailed');

  if (percent !== null && fill) fill.style.width = `${percent}%`;
  if (percent !== null && pct) pct.textContent = `${Math.round(percent)}%`;
  const ring = document.getElementById('dashboardProgressRing');
  const ringText = document.getElementById('dashboardRingPercent');
  if (percent !== null && ring) ring.style.setProperty('--p', Math.round(percent));
  if (percent !== null && ringText) ringText.textContent = `${Math.round(percent)}%`;
  if (phase) phase.textContent = payload.phase || payload.type || 'Working';
  if (current) current.textContent = `${Number(payload.current || 0)}/${Number(payload.total || 0)}`;
  if (uploaded) uploaded.textContent = Number(payload.uploaded || 0);
  if (failed) failed.textContent = Number(payload.failed || 0);

  setProgress(payload.message || payload.type || 'Working...');
  addFeedItem(payload);
  if (String(payload.type || '').includes('draft') || String(payload.phase || '').includes('Draft')) {
    updateDraftPanel(payload);
  }
  if (String(payload.type || '').includes('reel') || String(payload.phase || '').includes('Reels')) {
    updateReelsPanel(payload);
  }
}


function addFeedItem(payload = {}) {
  const feed = document.getElementById('liveFeed');
  if (!feed) return;
  const message = payload.message || payload.type;
  if (!message) return;
  const cls = payload.type && String(payload.type).includes('failed') ? 'failed'
    : payload.type && String(payload.type).includes('stopped') ? 'warning'
    : payload.type && String(payload.type).includes('stop') ? 'warning'
    : payload.type && String(payload.type).includes('warning') ? 'warning'
    : payload.type && String(payload.type).includes('success') ? 'success'
    : '';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const row = document.createElement('div');
  row.className = `feed-item ${cls}`.trim();
  row.textContent = `${time} — ${message}`;
  feed.prepend(row);
  while (feed.children.length > 12) feed.removeChild(feed.lastElementChild);
}

function toast(message, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  const title = isError ? 'Action needed' : 'Update complete';
  const icon = isError ? '!' : '✓';
  el.className = `toast ${isError ? 'error' : 'success'}`;
  el.innerHTML = `
    <div class="toast-icon" aria-hidden="true">${icon}</div>
    <div class="toast-body">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), isError ? 7000 : 4200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function shorten(value, max = 80) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function timeFromIso(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function to12(slot) {
  const [h, m] = slot.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function renderFacebookConnectStatus(settings) {
  const box = document.getElementById('facebookConnectStatus');
  if (!box) return;
  const hasPage = Boolean(settings.pageId && settings.hasPageAccessToken);
  if (!hasPage) {
    box.className = 'connect-status warning';
    box.textContent = 'Page access not connected. Use Connect Facebook Page to authorise the Page for scheduling.';
    return;
  }
  const name = settings.connectedPageName || settings.pageId;
  box.className = 'connect-status ok';
  box.textContent = `Active Page: ${name} • credentials protected`;
}


async function refreshWorkspaceV2(options = {}) {
  if (!state?.account?.authenticated) {
    cloudWorkspace = { accounts: [], pages: [], activePage: null, pageUsage: null, plan: null };
    renderWorkspaceV2();
    return;
  }
  try {
    const result = await window.schedulerApi.refreshWorkspace();
    state = result.state;
    cloudWorkspace = result.workspace || state.workspace || cloudWorkspace;
    renderWorkspaceV2();
    if (!options.silent) {
      toast(result.workspace?.syncWarning
        ? `Using the Facebook Page saved on this device. Cloud sync is pending: ${result.workspace.syncWarning}`
        : 'Facebook Pages refreshed.',
      Boolean(result.workspace?.syncWarning));
    }
  } catch (error) {
    if (!options.silent) toast(error.message, true);
  }
}

function renderPageAvatar(elementId, page) {
  const target = document.getElementById(elementId);
  if (!target) return;
  const picture = String(page?.facebookPagePicture || '').trim();
  if (!picture) {
    target.innerHTML = '<span>F</span>';
    return;
  }
  const image = document.createElement('img');
  image.src = picture;
  image.alt = `${page?.facebookPageName || 'Facebook Page'} profile picture`;
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', () => {
    target.innerHTML = '<span>F</span>';
  }, { once: true });
  target.replaceChildren(image);
}

function renderWorkspaceV2() {
  if (!state) return;
  const workspace = cloudWorkspace || state.workspace || {};
  const accounts = workspace.accounts || [];
  const pages = workspace.pages || accounts.flatMap(a => a.pages || []);
  const active = workspace.activePage || pages.find(p => p.isSelected) || null;
  const usage = workspace.pageUsage || { connected: pages.filter(p => p.status === 'ACTIVE').length, limit: state.account?.license?.limits?.pages || 0 };
  cloudWorkspace = { ...workspace, accounts, pages, activePage: active, pageUsage: usage };

  setText('activeWorkspaceName', active?.facebookPageName || 'No Page selected');
  renderPageAvatar('activeWorkspaceAvatar', active);
  renderActiveWorkspaceMenu(pages, active);
  renderReelsPageSelector(pages, active);
  const disconnectActivePage = document.getElementById('btnDisconnectActivePage');
  if (disconnectActivePage) disconnectActivePage.disabled = !active && !state.settings?.pageId;
  const connectFacebookPage = document.getElementById('btnAddMetaAccount');
  if (connectFacebookPage && !connectFacebookPage.disabled) connectFacebookPage.textContent = '+ Connect Facebook Page';

  const accountUsageText = document.getElementById('accountUsageText');
  if (accountUsageText) accountUsageText.textContent = `${usage.connected || 0} Page${Number(usage.connected || 0) === 1 ? '' : 's'} connected · ${Math.max(0, Number(usage.limit || 0) - Number(usage.connected || 0))} available on this plan`;
  const usageBar = document.getElementById('accountUsageBar');
  if (usageBar) usageBar.style.width = `${Math.min(100, usage.limit ? (usage.connected / usage.limit) * 100 : 0)}%`;
  setText('accountPlanBadge', workspace.plan || state.account?.license?.plan || 'TRIAL');

  renderPagesV2();
  renderAnalyticsV2();
  bindWorkspaceDynamicActions();
}

function renderReelsPageSelector(pages, active) {
  const select = document.getElementById('reelsPageSelect');
  const name = document.getElementById('reelsActivePageName');
  const hint = document.getElementById('reelsActivePageHint');
  const availablePages = (pages || []).filter(page => page.status !== 'REVOKED');

  if (name) name.textContent = active?.facebookPageName || 'No Page selected';
  renderPageAvatar('reelsActivePageAvatar', active);
  if (hint) hint.textContent = active
    ? `Videos selected in this session will publish only to ${active.facebookPageName}.`
    : 'Connect and choose a Facebook Page before selecting videos.';
  if (!select) return;

  select.innerHTML = availablePages.length
    ? availablePages.map(page => `<option value="${escapeHtml(page.id)}">${escapeHtml(page.facebookPageName)}</option>`).join('')
    : '<option value="">No connected Pages</option>';
  select.disabled = isSchedulerRunning || !availablePages.length;
  select.value = active?.id || '';
}

function renderPagesV2() {
  const grid = document.getElementById('connectedPageGrid');
  if (!grid) return;
  const search = String(document.getElementById('pageSearchInput')?.value || '').trim().toLowerCase();
  const pages = (cloudWorkspace.pages || []).filter(page => {
    const matchesSearch = !search || `${page.facebookPageName || ''} ${page.facebookCategory || ''}`.toLowerCase().includes(search);
    return matchesSearch;
  });
  grid.innerHTML = pages.length ? pages.map(page => pageCardMarkup(page, false)).join('') : '<div class="workspace-empty">No connected Page matches this filter.</div>';
  bindWorkspaceDynamicActions();
}

function pageCardMarkup(page, large) {
  return `<article class="connected-page-card ${page.isSelected ? 'active' : ''} ${large ? 'large' : ''}"><div class="page-picture">${page.facebookPagePicture ? `<img src="${escapeHtml(page.facebookPagePicture)}">` : '<span>F</span>'}</div><div class="page-card-copy"><span>${escapeHtml(page.facebookCategory || 'Facebook Page')}</span><h3>${escapeHtml(page.facebookPageName)}</h3><p>${page.localOnly ? 'Saved on this device · reconnect once to sync' : escapeHtml(accountNameForPage(page))}</p></div><div class="page-card-state">${page.isSelected ? '<b>Active Page</b>' : '<button class="btn secondary compact" data-select-page="'+escapeHtml(page.id)+'">Use this Page</button>'}${!large && !page.localOnly ? `<button class="icon-danger" data-revoke-page="${escapeHtml(page.id)}" title="Disconnect Page">×</button>` : ''}</div></article>`;
}

function accountNameForPage(page) {
  return cloudWorkspace.accounts?.find(a => a.id === page.metaAccountId)?.facebookUserName || 'Connected Meta account';
}

function bindWorkspaceDynamicActions() {
  document.querySelectorAll('[data-select-page]').forEach(button => button.onclick = () => selectPageV2(button.dataset.selectPage));
  document.querySelectorAll('[data-revoke-page]').forEach(button => button.onclick = () => revokePageV2(button.dataset.revokePage));
}

async function selectPageV2(pageId) {
  try {
    closeActiveWorkspaceMenu();
    const result = await window.schedulerApi.selectWorkspacePage(pageId);
    state = result.state; cloudWorkspace = result.workspace;
    renderWorkspaceV2();
    renderReelsSessionSummary();
    toast('Active Facebook Page changed.');
  } catch (error) {
    toast(error.message, true);
  } finally {
    renderReelsPageSelector(cloudWorkspace?.pages || [], cloudWorkspace?.activePage || null);
  }
}

function toggleActiveWorkspaceMenu(event) {
  event?.stopPropagation();
  const menu = document.getElementById('activeWorkspaceMenu');
  const chip = document.getElementById('activeWorkspaceChip');
  if (!menu || !chip) return;
  const willOpen = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !willOpen);
  chip.setAttribute('aria-expanded', String(willOpen));
}

function closeActiveWorkspaceMenu() {
  document.getElementById('activeWorkspaceMenu')?.classList.add('hidden');
  document.getElementById('activeWorkspaceChip')?.setAttribute('aria-expanded', 'false');
}

function renderActiveWorkspaceMenu(pages, active) {
  const menu = document.getElementById('activeWorkspaceMenu');
  if (!menu) return;
  const availablePages = (pages || []).filter(page => page.status !== 'REVOKED');
  if (!availablePages.length) {
    menu.innerHTML = '<div class="active-menu-empty"><strong>No connected Pages</strong><span>Connect Facebook from the Pages menu first.</span><button type="button" id="btnTopOpenPages" class="btn secondary compact">Open Pages</button></div>';
    const openPages = document.getElementById('btnTopOpenPages');
    if (openPages) openPages.onclick = () => { closeActiveWorkspaceMenu(); switchView('pages'); };
    return;
  }
  menu.innerHTML = '<div class="active-menu-heading">Switch active Page</div>' + availablePages.map(page => `
    <button type="button" class="active-menu-page ${active?.id === page.id ? 'selected' : ''}" data-top-select-page="${escapeHtml(page.id)}" role="menuitem">
      <span>${page.facebookPagePicture ? `<img src="${escapeHtml(page.facebookPagePicture)}" alt="">` : 'F'}</span>
      <em><strong>${escapeHtml(page.facebookPageName)}</strong><small>${escapeHtml(page.facebookCategory || 'Facebook Page')}</small></em>
      <b>${active?.id === page.id ? '✓' : ''}</b>
    </button>`).join('') + '<button type="button" id="btnTopManagePages" class="active-menu-manage">Manage Pages</button>';
  menu.querySelectorAll('[data-top-select-page]').forEach(button => {
    button.onclick = () => {
      if (active?.id === button.dataset.topSelectPage) return closeActiveWorkspaceMenu();
      selectPageV2(button.dataset.topSelectPage);
    };
  });
  const managePages = document.getElementById('btnTopManagePages');
  if (managePages) managePages.onclick = () => { closeActiveWorkspaceMenu(); switchView('pages'); };
}

async function revokePageV2(pageId) {
  if (!confirm('Disconnect this Facebook Page from INX Social?')) return;
  try { const result = await window.schedulerApi.revokeWorkspacePage(pageId); state = result.state; cloudWorkspace = result.workspace; renderWorkspaceV2(); renderReelsSessionSummary(); toast('Facebook Page disconnected.'); }
  catch (error) { toast(error.message, true); }
}

async function connectFacebookWorkspaceV2() {
  const button = document.getElementById('btnAddMetaAccount');
  if (button) { button.disabled = true; button.textContent = 'Connecting Page…'; }
  try {
    const result = await window.schedulerApi.connectFacebookWorkspace();
    state = result.state;
    cloudWorkspace = result.workspace;
    renderWorkspaceV2();
    toast(result.warning
      ? `${result.page?.name || 'Facebook Page'} is connected on this device, but cloud sync still needs attention: ${result.warning}`
      : `${result.page?.name || 'Facebook Page'} connected and synced successfully.`,
      Boolean(result.warning));
  } catch (error) {
    toast(error.message, true);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '+ Connect Facebook Page';
    }
  }
}

async function disconnectActiveWorkspacePage() {
  const active = cloudWorkspace.activePage || (cloudWorkspace.pages || []).find(page => page.isSelected) || null;
  const savedPageName = active?.facebookPageName || state.settings?.connectedPageName || 'the active Facebook Page';
  if (!active && !state.settings?.pageId) return toast('No Facebook Page is currently connected.', true);
  if (!confirm(`Disconnect ${savedPageName} from INX Social?\n\nThis removes only this Page. Other connected Pages stay available. Use Facebook permissions if you also want to remove INX Social from your Facebook account.`)) return;

  if (active && !active.localOnly && !String(active.id || '').startsWith('local-')) {
    try {
      const result = await window.schedulerApi.revokeWorkspacePage(active.id);
      state = result.state;
      cloudWorkspace = result.workspace || state.workspace || { accounts: [], pages: [], activePage: null, pageUsage: null, plan: null };
      renderWorkspaceV2();
      renderReelsSessionSummary();
      toast(`${savedPageName} disconnected from INX Social.`);
    } catch (error) {
      toast(error.message, true);
    }
    return;
  }

  try {
    const result = await window.schedulerApi.disconnectFacebookPage();
    state = result.state;
    cloudWorkspace = state.workspace || { accounts: [], pages: [], activePage: null, pageUsage: null, plan: null };
    renderWorkspaceV2();
    renderReelsSessionSummary();
    toast(`${savedPageName} disconnected from INX Social.`);
  } catch (error) {
    toast(error.message, true);
  }
}

function renderAnalyticsV2() {
  const jobs = state.jobs || [];
  const successful = jobs.filter(j => ['scheduled','reel_scheduled','reel_published','published'].includes(j.status)).length;
  const failed = jobs.filter(j => String(j.status || '').includes('failed')).length;
  const totalFinished = successful + failed;
  setText('analyticsMedia', (state.videos?.length || 0) + (state.captions?.length || 0));
  setText('analyticsScheduled', successful);
  setText('analyticsFailed', failed);
  setText('analyticsSuccessRate', `${totalFinished ? Math.round(successful/totalFinished*100) : 0}%`);
  const bars=document.getElementById('analyticsHealthBars');
  if(bars) bars.innerHTML=[['Successful',successful,'success'],['Failed',failed,'failed'],['Queued',Math.max(0,jobs.length-totalFinished),'queued']].map(([label,value,cls])=>`<div><span>${label}<b>${value}</b></span><i><em class="${cls}" style="width:${jobs.length?Math.max(4,value/jobs.length*100):0}%"></em></i></div>`).join('');
  const summary=document.getElementById('analyticsAccountSummary');
  if(summary) summary.innerHTML=`<div><span>Plan</span><strong>${escapeHtml(cloudWorkspace.plan || state.account?.license?.plan || 'TRIAL')}</strong></div><div><span>Meta accounts</span><strong>${cloudWorkspace.accounts?.length || 0}</strong></div><div><span>Connected Pages</span><strong>${cloudWorkspace.pageUsage?.connected || cloudWorkspace.pages?.length || 0}</strong></div><div><span>Active Page</span><strong>${escapeHtml(cloudWorkspace.activePage?.facebookPageName || 'None')}</strong></div>`;
}

function setText(id, value) { const el=document.getElementById(id); if(el) el.textContent=String(value ?? ''); }
// Phase 10.1 Studio account controls
(() => {
  const byId = id => document.getElementById(id);
  const openDelete = () => {
    byId('studioDeleteAccountModal')?.classList.remove('hidden');
    byId('studioDeletePassword')?.focus();
  };
  const closeDelete = () => {
    byId('studioDeleteAccountModal')?.classList.add('hidden');
    byId('studioDeleteAccountForm')?.reset();
    if (byId('studioDeleteAccountMessage')) byId('studioDeleteAccountMessage').textContent = '';
  };
  const bind = () => {
    byId('btnStudioManageBilling')?.addEventListener('click', async () => {
      try { await window.schedulerApi.openBillingPortal(); }
      catch (error) { toast(error.message, true); }
    });
    byId('btnStudioDeleteAccount')?.addEventListener('click', openDelete);
    byId('studioKeepAccount')?.addEventListener('click', closeDelete);
    byId('studioDeleteAccountModal')?.addEventListener('click', event => {
      if (event.target.id === 'studioDeleteAccountModal') closeDelete();
    });
    byId('studioDeleteAccountForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const message = byId('studioDeleteAccountMessage');
      const button = byId('studioConfirmDeleteAccount');
      const confirmation = byId('studioDeleteConfirmation')?.value.trim();
      if (confirmation !== 'DELETE') {
        message.textContent = 'Type DELETE exactly to confirm.';
        return;
      }
      try {
        button.disabled = true;
        button.textContent = 'Deleting account…';
        const result = await window.schedulerApi.deleteAccount({
          password: byId('studioDeletePassword')?.value || '',
          confirmation
        });
        const warning = result.warnings?.length ? '&warning=meta' : '';
        location.href = '/portal/login.html?account=deleted' + warning;
      } catch (error) {
        message.textContent = error.message;
      } finally {
        button.disabled = false;
        button.textContent = 'Permanently delete';
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
