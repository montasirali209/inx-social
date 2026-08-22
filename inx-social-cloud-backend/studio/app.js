let state = null;
let lastPreview = null;
let isSchedulerRunning = false;
let draftSessionVideos = [];
let draftSelectedTimes = [];
let draftSessionRunning = false;
let reelsSessionVideos = [];
let reelsSelectedTimes = [];
let settingsDailySlots = [];
let labVideoPath = '';
let accountMode = 'login';
let cloudWorkspace = { accounts: [], pages: [], activePage: null, pageUsage: null, plan: null };
let studioActionModalResolver = null;
let metaScheduledPosts = [];
let metaScheduleLoaded = false;
let metaScheduleLoading = false;
let analyticsPlatform = 'facebook';
let analyticsPage = '';
let analyticsRange = '30';
let liveFacebookAnalytics = null;
let analyticsLoading = false;
let analyticsLastKey = '';
let agentOverview = null;
let agentLoading = false;
let activeAgentPlanId = '';
let agentLiveTimer = null;

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
  agent: ['Social Agent', 'Ollama-first organic automation with Autopilot and Hybrid control.'],
  pages: ['Pages', 'Connect and choose the Page that receives your next scheduled content.'],
  media: ['Old Auto Scheduler', 'Hidden old Page Video scheduler.'],
  reels: ['Auto Scheduler', 'Upload videos to Meta now and schedule them as Facebook Reels for future times.'],
  lab: ['Hidden Test Tools', 'Hidden technical test tools.'],
  draft: ['Hidden Draft Tools', 'Hidden old draft tools.'],
  manual: ['Manual Scheduler', 'Upload one Reel to Meta now and schedule it for a future time.'],
  health: ['Health Check', 'Check video, caption, schedule, and Meta connection risks before posting.'],
  calendar: ['Calendar', 'See what is planned locally and what has been published.'],
  analytics: ['Analytics', 'Facebook publishing performance, reliability and content activity.'],
  logs: ['Logs', 'Track imports, scheduled uploads, publishing, retries, and errors.'],
  settings: ['Settings', 'Facebook Connect and scheduler rules.']
};

window.addEventListener('DOMContentLoaded', async () => {
  bindStudioActionModal();
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
  resetReelsTimingSelection();
  buildDraftTimePicker();
  buildReelsTimePicker();
});

function bindStudioActionModal() {
  const modal = document.getElementById('studioActionModal');
  if (!modal) return;
  document.getElementById('studioActionConfirm')?.addEventListener('click', () => closeStudioActionModal(true));
  document.getElementById('studioActionCancel')?.addEventListener('click', () => closeStudioActionModal(false));
  document.getElementById('studioActionClose')?.addEventListener('click', () => closeStudioActionModal(false));
  modal.addEventListener('click', event => {
    if (event.target === modal) closeStudioActionModal(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeStudioActionModal(false);
  });
  window.addEventListener('inx:studio-notice', event => {
    showStudioConfirm({
      eyebrow: 'INX Social',
      title: 'Browser privacy',
      message: event.detail?.message || 'Your current browser selections remain private.',
      details: event.detail?.details || [],
      icon: 'i',
      tone: 'info',
      confirmText: 'Got it',
      cancelText: ''
    });
  });
}

function closeStudioActionModal(result) {
  const modal = document.getElementById('studioActionModal');
  if (!modal || modal.classList.contains('hidden')) return;
  modal.classList.remove('is-visible');
  const resolve = studioActionModalResolver;
  studioActionModalResolver = null;
  window.setTimeout(() => modal.classList.add('hidden'), 180);
  if (resolve) resolve(Boolean(result));
}

function showStudioConfirm(options = {}) {
  const modal = document.getElementById('studioActionModal');
  if (!modal) return Promise.resolve(false);
  if (studioActionModalResolver) {
    const previous = studioActionModalResolver;
    studioActionModalResolver = null;
    previous(false);
  }
  const card = document.getElementById('studioActionCard');
  const eyebrow = document.getElementById('studioActionEyebrow');
  const title = document.getElementById('studioActionTitle');
  const message = document.getElementById('studioActionMessage');
  const icon = document.getElementById('studioActionIcon');
  const metrics = document.getElementById('studioActionMetrics');
  const details = document.getElementById('studioActionDetails');
  const cancel = document.getElementById('studioActionCancel');
  const confirmButton = document.getElementById('studioActionConfirm');
  if (card) card.dataset.tone = options.tone || 'info';
  if (eyebrow) eyebrow.textContent = options.eyebrow || 'INX Social';
  if (title) title.textContent = options.title || 'Please confirm';
  if (message) message.textContent = options.message || '';
  if (icon) icon.textContent = options.icon || '!';
  if (metrics) {
    metrics.innerHTML = (options.metrics || []).map(item => `
      <div class="studio-action-metric">
        <span>${escapeHtml(String(item.label || ''))}</span>
        <strong>${escapeHtml(String(item.value ?? ''))}</strong>
      </div>`).join('');
    metrics.classList.toggle('hidden', !(options.metrics || []).length);
  }
  if (details) {
    details.innerHTML = (options.details || []).filter(Boolean).map(item => `<p>${escapeHtml(String(item))}</p>`).join('');
    details.classList.toggle('hidden', !(options.details || []).filter(Boolean).length);
  }
  if (cancel) {
    cancel.textContent = options.cancelText || 'Cancel';
    cancel.classList.toggle('hidden', options.cancelText === '');
  }
  if (confirmButton) confirmButton.textContent = options.confirmText || 'Continue';
  modal.classList.remove('hidden');
  window.requestAnimationFrame(() => {
    modal.classList.add('is-visible');
    confirmButton?.focus();
  });
  return new Promise(resolve => { studioActionModalResolver = resolve; });
}


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
  const socialAgentVisible = Boolean(account.features?.socialAgent?.visible);
  const agentNav = document.querySelector('.agent-nav');
  agentNav?.classList.toggle('hidden', !loggedIn || !socialAgentVisible);
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
  if (!socialAgentVisible && document.body.dataset.activeView === 'agent') switchView('dashboard');
}

function bindNavigation() {
  document.querySelectorAll('.nav').forEach(button => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
}

function switchView(viewName) {
  if (viewName === 'agent' && !state?.account?.features?.socialAgent?.visible) {
    toast('Social Agent is not currently enabled for this account.', true);
    viewName = 'dashboard';
  }
  document.body.dataset.activeView = viewName;
  document.querySelectorAll('.nav').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === viewName));
  document.getElementById('viewTitle').textContent = views[viewName][0];
  document.getElementById('viewSubtitle').textContent = views[viewName][1];
  if (viewName === 'pages') refreshWorkspaceV2({ silent: true });
  if (agentLiveTimer) {
    clearInterval(agentLiveTimer);
    agentLiveTimer = null;
  }
  if (viewName === 'agent') {
    loadAgentOverview(false);
    agentLiveTimer = setInterval(() => loadAgentOverview(false), 4000);
  }
  if (viewName === 'analytics') {
    refreshWorkspaceV2({ silent: true }).then(() => loadFacebookAnalytics(false)).catch(error => renderAnalyticsError(error));
  }
  if (viewName === 'calendar') {
    renderCalendar();
    if (!metaScheduleLoaded && !metaScheduleLoading) listMetaScheduled({ silent: true });
  }
}

function bindButtons() {
  on('btnRefresh', refresh);
  on('btnAgentRefresh', () => loadAgentOverview(true));
  document.getElementById('agentPlanForm')?.addEventListener('submit', createAgentPlan);
  document.querySelectorAll('.agent-operation-mode').forEach(input => input.addEventListener('change', renderAgentModeSummary));
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
  on('btnSettingAddSlot', addSettingDailySlot);
  const settingSlotPicker = document.getElementById('settingSlotPicker');
  if (settingSlotPicker) {
    settingSlotPicker.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      addSettingDailySlot();
    });
  }
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
  if (reelsMode) reelsMode.addEventListener('change', handleReelsTimingModeChange);
  const reelsStartDate = document.getElementById('reelsStartDate');
  if (reelsStartDate) reelsStartDate.addEventListener('change', renderReelsSessionSummary);
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
  on('btnManualPublishNow', publishManualPostNow);
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
  const analyticsPlatformSelect = document.getElementById('analyticsPlatformSelect');
  if (analyticsPlatformSelect) analyticsPlatformSelect.addEventListener('change', event => {
    analyticsPlatform = event.target.value;
    renderAnalyticsV2();
  });
  const analyticsPageSelect = document.getElementById('analyticsPageSelect');
  if (analyticsPageSelect) analyticsPageSelect.addEventListener('change', event => {
    analyticsPage = event.target.value;
    liveFacebookAnalytics = null;
    loadFacebookAnalytics(false);
  });
  const analyticsRangeSelect = document.getElementById('analyticsRangeSelect');
  if (analyticsRangeSelect) analyticsRangeSelect.addEventListener('change', event => {
    analyticsRange = event.target.value;
    liveFacebookAnalytics = null;
    loadFacebookAnalytics(false);
  });
  on('btnRefreshAnalytics', () => loadFacebookAnalytics(true));
  on('btnCopyAnalyticsReviewSteps', copyAnalyticsReviewSteps);
  document.addEventListener('click', event => {
    const settingSlotButton = event.target.closest('[data-remove-setting-slot]');
    if (settingSlotButton) removeSettingDailySlot(settingSlotButton.dataset.removeSettingSlot);

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
  resetReelsTimingSelection();
  renderReelsSessionSummary();
  updateReelsPanel({ phase: 'Idle', percent: 0, current: 0, total: 0, uploaded: 0, failed: 0, message: 'Auto Scheduler session cleared.' });
}

function resetReelsTimingSelection() {
  const mode = document.getElementById('reelsTimingMode');
  const startDate = document.getElementById('reelsStartDate');
  if (mode) mode.value = '';
  if (startDate) {
    startDate.value = '';
    startDate.disabled = true;
  }
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
  const mode = document.getElementById('reelsTimingMode')?.value || '';
  if (mode === 'immediate') return [];
  if (mode === 'custom') return reelsSelectedTimes;
  return mode === 'settings' && state?.settings ? state.settings.dailySlots || [] : [];
}

function handleReelsTimingModeChange() {
  const mode = document.getElementById('reelsTimingMode')?.value || '';
  const startDate = document.getElementById('reelsStartDate');
  const scheduled = mode === 'settings' || mode === 'custom';
  if (startDate) {
    startDate.disabled = !scheduled;
    if (!scheduled) startDate.value = '';
  }
  renderReelsSessionSummary();
}

function renderReelsSessionSummary() {
  const mode = document.getElementById('reelsTimingMode')?.value || '';
  const immediate = mode === 'immediate';
  const scheduled = mode === 'settings' || mode === 'custom';
  const dateBox = document.getElementById('reelsScheduleDateBox');
  if (dateBox) dateBox.classList.toggle('hidden', !scheduled);
  const customBox = document.getElementById('reelsCustomTimesBox');
  if (customBox) customBox.classList.toggle('hidden', mode !== 'custom');
  const description = document.getElementById('reelsUploadDescription');
  if (description) {
    description.textContent = !mode
      ? 'Choose a timing mode before uploading. Nothing is published or scheduled by default.'
      : immediate
        ? 'Upload Now publishes every selected video to the active Facebook Page immediately.'
        : 'Upload Now sends every selected video to Meta now, and Facebook publishes each Reel at its assigned date and time.';
  }
  const selectedTimes = document.getElementById('reelsSelectedTimes');
  if (selectedTimes) {
    selectedTimes.innerHTML = reelsSelectedTimes.length
      ? reelsSelectedTimes.map(t => `<span class="pill">${to12(t)} <button type="button" data-remove-reels-time="${escapeHtml(t)}" aria-label="Remove ${escapeHtml(to12(t))}">×</button></span>`).join('')
      : '<span class="muted">No custom times selected.</span>';
  }
  const captions = getReelsCaptionBlocks();
  const times = getReelsTimesForSummary();
  const pairs = Math.min(reelsSessionVideos.length, captions.length);
  const unusedCaptions = Math.max(0, captions.length - reelsSessionVideos.length);
  const box = document.getElementById('reelsSessionSummary');
  const activePage = cloudWorkspace?.activePage || (cloudWorkspace?.pages || []).find(page => page.isSelected) || null;
  if (box) {
    box.className = pairs && activePage ? 'simple-check success' : 'simple-check muted';
    if (!mode) {
      box.innerHTML = `${reelsSessionVideos.length} video(s) selected · ${captions.length} caption(s) · choose a timing mode to continue.${unusedCaptions ? ` The first ${reelsSessionVideos.length} captions will be used and ${unusedCaptions} extra caption(s) ignored.` : ''}`;
    } else if (immediate) {
      box.innerHTML = `${reelsSessionVideos.length} video(s) selected · ${captions.length} caption(s) · ${pairs} ready to publish now.${unusedCaptions ? ` First ${reelsSessionVideos.length} captions used; ${unusedCaptions} extra ignored.` : ''}<br><span class="muted">Destination: ${escapeHtml(activePage?.facebookPageName || 'No Page selected')}. Upload Now publishes every ready pair immediately.</span>`;
    } else {
      const perDay = Math.max(1, times.length || 0);
      const days = pairs ? Math.ceil(pairs / perDay) : 0;
      box.innerHTML = `${reelsSessionVideos.length} video(s) selected · ${captions.length} caption(s) · ${pairs} ready pair(s) · ${times.length || 0} slot(s)/day · estimated ${days} day(s).${unusedCaptions ? ` First ${reelsSessionVideos.length} captions used; ${unusedCaptions} extra ignored.` : ''}<br><span class="muted">Destination: ${escapeHtml(activePage?.facebookPageName || 'No Page selected')}. Upload Now sends every item to Meta and schedules it for the assigned time.</span>`;
    }
  }
  renderReelsSchedulePreview();
}

function renderReelsSchedulePreview() {
  const target = document.getElementById('reelsSchedulePreview');
  if (!target) return;
  const captions = getReelsCaptionBlocks();
  const mode = document.getElementById('reelsTimingMode')?.value || '';
  const times = getReelsTimesForSummary();
  const pairs = Math.min(reelsSessionVideos.length, captions.length);
  if (!mode) {
    target.innerHTML = '<div class="empty">Choose a timing mode to preview the upload.</div>';
    return;
  }
  if (mode === 'immediate') {
    if (!pairs) {
      target.innerHTML = '<div class="empty">Select videos and add matching captions to preview immediate publishing.</div>';
      return;
    }
    const rows = reelsSessionVideos.slice(0, Math.min(pairs, 20)).map((file, index) =>
      `<div class="draft-preview-row"><strong>${index + 1}.</strong> <span>${escapeHtml(file.split(/[\\/]/).pop())}</span><em>Publish immediately</em></div>`
    );
    target.innerHTML = `<h4>Immediate upload preview</h4>${rows.join('')}${pairs > rows.length ? `<p class="muted">Showing first ${rows.length} of ${pairs} videos.</p>` : ''}`;
    return;
  }
  if (!pairs || !times.length) {
    target.innerHTML = '<div class="empty">Select videos, captions, and at least one time slot to preview Reel assignments.</div>';
    return;
  }
  const start = document.getElementById('reelsStartDate')?.value || '';
  if (!start) {
    target.innerHTML = '<div class="empty">Choose a schedule start date to preview Reel assignments.</div>';
    return;
  }
  target.innerHTML = '<div class="empty">Checking existing scheduled slots...</div>';
  window.schedulerApi.previewReelsSchedule({ count: pairs, startDate: start, times }).then(schedule => {
    if (document.getElementById('reelsStartDate')?.value !== start) return;
    const rows = schedule.slots.slice(0, 20).map((value, index) => {
      const file = reelsSessionVideos[index] || '';
      const date = new Date(value);
      return `<div class="draft-preview-row"><strong>${index + 1}.</strong> <span>${escapeHtml(file.split(/[\\/]/).pop())}</span><em>${date.toLocaleString([], { weekday:'short', month:'short', day:'2-digit', hour:'numeric', minute:'2-digit' })}</em></div>`;
    });
    const adjustment = schedule.skippedOccupied
      ? `<p class="simple-check warning">${schedule.skippedOccupied} occupied slot(s) will be skipped. First available: ${escapeHtml(new Date(schedule.firstAvailableAt).toLocaleString())}.</p>`
      : '';
    const capacity = Number(schedule.deferredTotal || 0)
      ? `<p class="simple-check warning">Facebook currently has ${Number(schedule.metaScheduledCount || 0)} future scheduled post(s). INX Social can prepare ${Number(schedule.acceptedByMetaCapacity || schedule.slots.length)} of ${Number(schedule.requestedCount || pairs)} selected new video(s) now; ${Number(schedule.deferredTotal || 0)} must wait.</p>`
      : `<p class="simple-check success">Facebook currently has ${Number(schedule.metaScheduledCount || 0)} future scheduled post(s). All ${Number(schedule.slots.length || 0)} selected new video(s) fit the available schedule.</p>`;
    target.innerHTML = `<h4>Studio upload preview</h4>${capacity}${adjustment}${rows.join('')}${schedule.slots.length > rows.length ? `<p class="muted">Showing first ${rows.length} of ${schedule.slots.length} assignments.</p>` : ''}`;
  }).catch(error => {
    target.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  });
}

async function confirmDuplicateReels(videoPaths) {
  const inspection = await window.schedulerApi.inspectReelsSelection(videoPaths);
  if (!inspection.duplicates.length) return inspection;
  if (!inspection.acceptedCount) throw new Error('Every selected filename matches a Reel that is processing, scheduled, or published for this Page. Failed attempts can be retried and are not treated as duplicates.');
  const names = inspection.duplicates.slice(0, 8).map(item => item.name);
  if (inspection.duplicates.length > 8) names.push(`and ${inspection.duplicates.length - 8} more`);
  const proceed = await showStudioConfirm({
    eyebrow: 'Duplicate protection',
    title: 'Duplicate videos found',
    message: 'INX Social will skip filenames already confirmed on Facebook and upload only the new videos.',
    icon: '≠',
    tone: 'warning',
    metrics: [
      { label: 'Duplicates skipped', value: inspection.duplicates.length },
      { label: 'New videos ready', value: inspection.acceptedCount }
    ],
    details: names,
    confirmText: `Upload ${inspection.acceptedCount} new video${inspection.acceptedCount === 1 ? '' : 's'}`,
    cancelText: 'Cancel'
  });
  return proceed ? inspection : null;
}

async function confirmScheduleAdjustment(schedule) {
  const first = schedule.firstAvailableAt ? new Date(schedule.firstAvailableAt).toLocaleString() : 'the next available slot';
  const last = schedule.lastAvailableAt ? new Date(schedule.lastAvailableAt).toLocaleString() : 'unknown';
  const reasons = [];
  if (schedule.skippedOccupied) reasons.push(`${schedule.skippedOccupied} slot(s) already contain scheduled videos`);
  if (schedule.skippedPast) reasons.push(`${schedule.skippedPast} slot(s) are already past the minimum lead time`);
  const requested = Number(schedule.requestedCount || 0);
  const accepted = Number(schedule.acceptedByMetaCapacity || schedule.slots?.length || 0);
  const deferred = Number(schedule.deferredTotal || Math.max(0, requested - accepted));
  return showStudioConfirm({
    eyebrow: 'Facebook schedule check',
    title: deferred ? 'Some videos need a later upload' : 'Your schedule is ready',
    message: deferred
      ? `Facebook can accept ${accepted} of the ${requested} selected videos in this run. The remaining ${deferred} will stay in your browser and will not be uploaded.`
      : `All ${accepted} selected videos fit the available Facebook schedule.`,
    icon: deferred ? '!' : '✓',
    tone: deferred ? 'warning' : 'success',
    metrics: [
      { label: 'Facebook future posts', value: Number(schedule.metaScheduledCount || 0) },
      { label: 'Safety limit', value: Number(schedule.metaGuardrailLimit || 60) },
      { label: 'Available now', value: Number(schedule.metaRemainingCapacity || 0) },
      { label: 'Videos in this run', value: accepted }
    ],
    details: [
      reasons.length ? `${reasons.join(' and ')}. Those times will be skipped.` : '',
      `First new slot: ${first}`,
      `Last new slot: ${last}`
    ],
    confirmText: deferred ? `Upload ${accepted} videos` : 'Continue upload',
    cancelText: 'Cancel'
  });
}

async function createReelsQueue() {
  const activePage = cloudWorkspace?.activePage || (cloudWorkspace?.pages || []).find(page => page.isSelected) || null;
  if (!activePage) return toast('Choose a Facebook Page before preparing this Auto Scheduler session.', true);
  const captions = getReelsCaptionBlocks();
  const mode = document.getElementById('reelsTimingMode')?.value || '';
  const immediate = mode === 'immediate';
  const times = mode === 'custom' ? reelsSelectedTimes : [];
  if (!mode) return toast('Choose a timing mode before preparing the upload.', true);
  if (!reelsSessionVideos.length || !captions.length) return toast('Select at least one Reel video and one caption.', true);
  if (captions.length < reelsSessionVideos.length) return toast(`Add ${reelsSessionVideos.length - captions.length} more caption(s) so every selected video has one.`, true);
  if (mode === 'custom' && !times.length) return toast('Choose at least one custom time, or switch to Settings slots.', true);
  const startDate = document.getElementById('reelsStartDate')?.value || '';
  if (!immediate && !startDate) return toast('Choose a schedule start date.', true);
  try {
    const duplicateCheck = await confirmDuplicateReels(reelsSessionVideos);
    if (!duplicateCheck) return;
    const result = await window.schedulerApi.createReelsQueue({
      videoPaths: reelsSessionVideos,
      captionText: document.getElementById('reelsCaptionText').value,
      startDate: immediate ? null : startDate,
      times,
      publishMode: immediate ? 'NOW' : 'SCHEDULED',
      skipDuplicateVideos: duplicateCheck.duplicates.length > 0
    });
    state = result.state || state;
    reelsSessionVideos = [];
    reelsSelectedTimes = [];
    const text = document.getElementById('reelsCaptionText');
    if (text) text.value = '';
    resetReelsTimingSelection();
    render();
    const duplicateNote = result.skippedDuplicates?.length ? ` Skipped ${result.skippedDuplicates.length} duplicate video(s).` : '';
    toast((immediate
      ? `Prepared ${result.jobs.length} Reel item(s) to publish immediately.`
      : `Prepared ${result.jobs.length} Reel item(s) for their scheduled times.`) + duplicateNote);
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
  updateReelsPanel({ phase: 'Preparing', percent: 3, message: 'Preparing the selected Reels...', current: 0, total: 0, uploaded: 0, failed: 0 });
  try {
    const captions = getReelsCaptionBlocks();
    const mode = document.getElementById('reelsTimingMode')?.value || '';
    const immediate = mode === 'immediate';
    const times = mode === 'custom' ? reelsSelectedTimes : [];
    if (!mode) throw new Error('Choose a timing mode before clicking Upload Now.');
    if (!reelsSessionVideos.length || !captions.length) {
      throw new Error('Select at least one video and add one matching caption before clicking Upload Now.');
    }
    if (captions.length < reelsSessionVideos.length) {
      throw new Error(`Add ${reelsSessionVideos.length - captions.length} more caption(s) so every selected video has one.`);
    }
    if (mode === 'custom' && !times.length) throw new Error('Choose at least one custom time, or switch to Settings slots.');
    const startDate = document.getElementById('reelsStartDate')?.value || '';
    if (!immediate && !startDate) throw new Error('Choose a schedule start date before clicking Upload Now.');
    const duplicateCheck = await confirmDuplicateReels(reelsSessionVideos);
    if (!duplicateCheck) throw new Error('Upload cancelled. No videos were queued.');
    if (!immediate) {
      const schedule = await window.schedulerApi.previewReelsSchedule({
        count: duplicateCheck.acceptedCount,
        startDate,
        times
      });
      if (!await confirmScheduleAdjustment(schedule)) {
        throw new Error('Upload cancelled. No videos were queued.');
      }
    }

    const created = await window.schedulerApi.createReelsQueue({
      videoPaths: reelsSessionVideos,
      captionText: document.getElementById('reelsCaptionText').value,
      startDate: immediate ? null : startDate,
      times,
      publishMode: immediate ? 'NOW' : 'SCHEDULED',
      skipDuplicateVideos: duplicateCheck.duplicates.length > 0
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
    resetReelsTimingSelection();
    render();
    const capacityNote = created.deferredVideos?.length
      ? ` ${created.deferredVideos.length} video(s) were not queued because the current Facebook schedule capacity or date window was full.`
      : '';
    const fallback = immediate
      ? `Upload finished. Published ${result.uploaded || result.published || 0}, failed ${result.failed || 0}.`
      : `Upload finished. Scheduled ${result.uploaded || result.published || 0}, failed ${result.failed || 0}.${capacityNote}`;
    updateReelsPanel({ phase: 'Done', percent: 100, message: result.message || fallback, current: 0, total: 0, uploaded: result.uploaded || result.published || 0, failed: result.failed || 0 });
    toast(result.message || fallback);
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
    reel_uploading: 'Processing at Facebook',
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

    toast('Opening Facebook in a secure connection popup.');
    const result = await window.schedulerApi.connectFacebookPage();
    state = result.state;
    cloudWorkspace = result.workspace || state.workspace || cloudWorkspace;
    render();
    renderWorkspaceV2();
    toast(result.notice || 'Facebook connected. Pages refreshed automatically.');
  } catch (err) {
    toast(err.message, true);
  }
}

async function disconnectFacebookPage() {
  if (!await showStudioConfirm({ eyebrow: 'Facebook connection', title: 'Clear the saved connection?', message: 'This removes the saved Facebook Page connection from INX Social.', icon: '×', tone: 'danger', confirmText: 'Clear connection', cancelText: 'Keep connected' })) return;
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

async function listMetaScheduled(options = {}) {
  if (metaScheduleLoading) return;
  metaScheduleLoading = true;
  const button = document.getElementById('btnListMeta');
  if (button) {
    button.disabled = true;
    button.textContent = 'Syncing Facebook…';
  }
  try {
    const result = await window.schedulerApi.listScheduledPosts();
    state = result.state;
    metaScheduledPosts = Array.isArray(result.result?.data) ? result.result.data : [];
    metaScheduleLoaded = true;
    renderCalendar();
    renderMetaScheduled(metaScheduledPosts);
    if (!options.silent) toast(`Calendar synced with ${metaScheduledPosts.length} Facebook scheduled post(s).`);
  } catch (err) {
    if (!options.silent) toast(`Could not sync the Facebook schedule: ${err.message}`, true);
  } finally {
    metaScheduleLoading = false;
    if (button) {
      button.disabled = false;
      button.textContent = 'Refresh Facebook Schedule';
    }
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

async function publishManualPostNow() {
  const activePage = cloudWorkspace?.activePage || (cloudWorkspace?.pages || []).find(page => page.isSelected);
  if (!activePage) return toast('Connect and select a Facebook Page first.', true);
  if (!await showStudioConfirm({ eyebrow: 'Publish immediately', title: `Publish to ${activePage.facebookPageName}?`, message: 'This Reel will become public on Facebook immediately.', icon: '↑', tone: 'success', confirmText: 'Publish now', cancelText: 'Cancel' })) return;

  try {
    updateManualProgress({ phase: 'Publishing now', percent: 5, message: 'Uploading the selected Reel to Facebook for immediate publishing…' });
    const result = await window.schedulerApi.manualPublishNow(manualPayload());
    state = result.state;
    render();
    const failed = result.upload && (result.upload.failed || 0);
    if (failed) {
      updateManualProgress({ phase: 'Failed', percent: 100, message: result.upload.message || 'Facebook publishing failed.' });
      setManualHealth('The Reel could not be published. Check Logs for the exact backend error.', 'error');
      toast(result.upload.message || 'Facebook publishing failed.', true);
    } else {
      updateManualProgress({ phase: 'Published', percent: 100, message: `Published to ${activePage.facebookPageName}.` });
      setManualHealth(`Published immediately to <strong>${escapeHtml(activePage.facebookPageName)}</strong>.<br>Status: <span class="code">Published on Facebook</span>`, 'success');
      toast('Reel published to Facebook.');
    }
  } catch (err) {
    updateManualProgress({ phase: 'Failed', percent: 100, message: err.message });
    setManualHealth(`Immediate publishing failed: ${escapeHtml(err.message)}`, 'error');
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
  setManualHealth('Choose a video and caption, then post now or select a date and time to schedule it.', '');
  updateManualProgress({ phase: 'Idle', percent: 0, message: 'No manual publish action is running.' });
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
  if (!await showStudioConfirm({ eyebrow: 'Local browser data', title: 'Clear the local session?', message: 'This clears local videos, captions, jobs, and logs. It will not delete posts already scheduled on Facebook.', icon: '×', tone: 'danger', confirmText: 'Clear local data', cancelText: 'Cancel' })) return;
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
  if (!await showStudioConfirm({ eyebrow: 'Interface settings', title: 'Reset interface labels?', message: 'All customised button names and labels will return to their defaults.', icon: '↺', tone: 'warning', confirmText: 'Reset labels', cancelText: 'Cancel' })) return;
  const result = await window.schedulerApi.resetUITexts();
  state = result.state;
  render();
  toast('Interface text reset.');
}

function val(id) {
  return document.getElementById(id).value.trim();
}

async function loadAgentOverview(showNotice = false) {
  if (agentLoading || !state?.account?.authenticated) return;
  agentLoading = true;
  const workspace = document.getElementById('agentPlanWorkspace');
  if (workspace && !agentOverview) workspace.innerHTML = '<div class="workspace-empty">Loading Social Agent…</div>';
  try {
    agentOverview = await window.schedulerApi.getAgentOverview();
    const plans = agentOverview.plans || [];
    if (!activeAgentPlanId && plans.length) activeAgentPlanId = plans[0].id;
    renderAgentWorkspace();
    if (showNotice) toast('Social Agent plans refreshed.');
  } catch (error) {
    if (workspace) workspace.innerHTML = `<div class="workspace-empty error">${escapeHtml(error.message)}</div>`;
    if (showNotice) toast(error.message, true);
  } finally { agentLoading = false; }
}

function renderAgentModeSummary() {
  const mode = document.querySelector('.agent-operation-mode:checked')?.value || 'HYBRID';
  const target = document.getElementById('agentModeSummary');
  if (target) target.textContent = mode === 'AUTOPILOT' ? 'Autopilot' : 'Hybrid';
}

async function createAgentPlan(event) {
  event.preventDefault();
  const prompt = document.getElementById('agentPrompt')?.value.trim() || '';
  const platforms = [...document.querySelectorAll('.agent-platform:checked')].map(input => input.value);
  if (!platforms.length) return toast('Select at least one publishing platform.', true);
  const button = document.getElementById('btnAgentCreatePlan');
  if (button) { button.disabled = true; button.textContent = 'Launching mission…'; }
  try {
    const operationMode = document.querySelector('.agent-operation-mode:checked')?.value || 'HYBRID';
    const result = await window.schedulerApi.createAgentPlan({ prompt, platforms, operationMode, executionMode: document.getElementById('agentExecutionMode')?.value });
    agentOverview = agentOverview || { plans: [] };
    agentOverview.plans = [result.plan, ...(agentOverview.plans || []).filter(plan => plan.id !== result.plan.id)];
    activeAgentPlanId = result.plan.id;
    renderAgentWorkspace();
    toast(result.notice || (operationMode === 'AUTOPILOT' ? 'Autopilot mission started.' : 'Hybrid mission created for review.'));
  } catch (error) { toast(error.message, true); }
  finally { if (button) { button.disabled = false; button.textContent = 'Launch mission'; } }
}

function selectedAgentPlan() {
  const plans = agentOverview?.plans || [];
  return plans.find(plan => plan.id === activeAgentPlanId) || plans[0] || null;
}

function renderAgentWorkspace() {
  const workspace = document.getElementById('agentPlanWorkspace');
  if (!workspace) return;
  const plans = agentOverview?.plans || [];
  renderAgentIntelligence();
  if (!plans.length) {
    workspace.innerHTML = '<div class="workspace-empty">Mission Control is online. Enter an instruction to begin.</div>';
    return;
  }
  const plan = selectedAgentPlan();
  activeAgentPlanId = plan.id;
  const mode = plan.operationMode === 'AUTOPILOT' ? 'Autopilot' : 'Hybrid';
  const canApprove = plan.operationMode !== 'AUTOPILOT' && plan.status === 'AWAITING_APPROVAL';
  const canResume = !['CANCELLED', 'COMPLETED', 'RUNNING', 'QUEUED', 'AWAITING_APPROVAL'].includes(plan.status);
  const completed = (plan.tasks || []).filter(item => item.status === 'COMPLETED').length;
  const running = (plan.tasks || []).filter(item => ['RUNNING', 'QUEUED'].includes(item.status)).length;
  const waiting = (plan.tasks || []).filter(item => String(item.status).startsWith('WAITING') || item.status === 'ACTION_REQUIRED').length;
  const queueIds = agentOverview?.runtime?.queuedPlanIds || [];
  const queuePosition = queueIds.indexOf(plan.id) + 1;
  const usage = agentOverview?.usage || state?.account?.features?.socialAgent?.usage || {};
  const usageLimit = usage.limit === null ? 'Unlimited' : Number(usage.limit || 0).toLocaleString();
  const usageRemaining = usage.remaining === null ? 'Unlimited' : Number(usage.remaining || 0).toLocaleString();
  const periodEnd = usage.periodEnd ? new Date(usage.periodEnd).toLocaleDateString() : 'Plan period';
  const missionQueue = plans
    .filter(item => !['CANCELLED'].includes(item.status))
    .slice(0, 8);
  const missionStatus = document.getElementById('agentMissionStatus');
  if (missionStatus) missionStatus.textContent = `${mode} · ${String(plan.status).replaceAll('_', ' ')}`;
  workspace.innerHTML = `
    <div class="agent-plan-summary">
      <div class="agent-queue-strip"><span><b>${escapeHtml(String(agentOverview?.runtime?.queueLength || 0))}</b> queued</span><span><b>${agentOverview?.runtime?.activePlanId ? '1' : '0'}</b> active</span><span>Mac-safe FIFO · one mission at a time</span>${queuePosition ? `<strong>Selected position ${queuePosition}</strong>` : ''}</div>
      <div class="agent-mission-queue" aria-label="Mission queue">${missionQueue.map((item, index) => {
        const itemQueuePosition = queueIds.indexOf(item.id) + 1;
        const itemCompleted = (item.tasks || []).filter(task => task.status === 'COMPLETED').length;
        const isActive = agentOverview?.runtime?.activePlanId === item.id;
        return `<button type="button" data-agent-plan-id="${escapeHtml(item.id)}" class="agent-queue-card ${item.id === plan.id ? 'selected' : ''} ${isActive ? 'active' : ''}"><span>${isActive ? 'LIVE' : itemQueuePosition ? `Q${itemQueuePosition}` : String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(item.prompt.slice(0, 72))}</strong><small>${escapeHtml(String(item.status).replaceAll('_', ' '))} · ${itemCompleted}/${item.tasks?.length || 0} tasks</small></div><i></i></button>`;
      }).join('')}</div>
      <label>Recent plans<select id="agentPlanSelect">${plans.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === plan.id ? 'selected' : ''}>${escapeHtml(new Date(item.createdAt).toLocaleDateString())} — ${escapeHtml(item.prompt.slice(0, 58))}</option>`).join('')}</select></label>
      <div class="agent-plan-top"><div><strong>${escapeHtml(plan.prompt)}</strong><p>${escapeHtml((plan.platforms || []).join(', '))} · ${escapeHtml(mode)} organic automation</p></div><div class="agent-plan-badges"><span class="agent-mode-badge">${mode}</span><span class="agent-plan-status status-${escapeHtml(String(plan.status).toLowerCase())}">${escapeHtml(plan.status.replaceAll('_', ' '))}</span></div></div>
      <div class="agent-plan-metrics"><div><span>Current plan</span><strong>${escapeHtml(agentOverview?.license?.plan || 'TRIAL')}</strong><small>Social Agent access</small></div><div><span>Agent missions used</span><strong>${Number(usage.used || 0).toLocaleString()} / ${usageLimit}</strong><small>this plan period</small></div><div><span>Remaining</span><strong>${usageRemaining}</strong><small>new missions available</small></div><div><span>Usage resets</span><strong>${escapeHtml(periodEnd)}</strong><small>${completed}/${plan.tasks?.length || 0} tasks complete · ${running} active · ${waiting} waiting</small></div></div>
      ${plan.lastError ? `<div class="agent-runtime-error">${escapeHtml(plan.lastError)}</div>` : ''}
      <div class="agent-task-list">${(plan.tasks || []).map(item => {
        const output = item.output?.content || item.output?.message || '';
        return `<article class="agent-task status-${escapeHtml(String(item.status).toLowerCase())}"><span>${item.sequence}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p>${output ? `<details><summary>View saved output</summary><pre>${escapeHtml(output)}</pre></details>` : ''}</div><span class="agent-task-state">${escapeHtml(String(item.status).replaceAll('_', ' '))}</span></article>`;
      }).join('')}</div>
      <div class="agent-plan-actions"><button id="btnAgentCancelPlan" class="btn ghost subtle-danger" type="button" ${['CANCELLED','COMPLETED'].includes(plan.status) ? 'disabled' : ''}>Cancel mission</button>${canResume ? '<button id="btnAgentResumePlan" class="btn secondary" type="button">Resume mission</button>' : ''}${canApprove ? '<button id="btnAgentApprovePlan" class="btn primary" type="button">Approve &amp; run</button>' : ''}</div>
    </div>`;
  document.getElementById('agentPlanSelect')?.addEventListener('change', event => { activeAgentPlanId = event.target.value; renderAgentWorkspace(); });
  workspace.querySelectorAll('[data-agent-plan-id]').forEach(button => button.addEventListener('click', () => { activeAgentPlanId = button.dataset.agentPlanId; renderAgentWorkspace(); }));
  document.getElementById('btnAgentApprovePlan')?.addEventListener('click', approveAgentPlan);
  document.getElementById('btnAgentResumePlan')?.addEventListener('click', resumeAgentPlan);
  document.getElementById('btnAgentCancelPlan')?.addEventListener('click', cancelAgentPlan);
}

function renderAgentIntelligence() {
  const brain = agentOverview?.capabilities?.brain || {};
  const brainStatus = document.getElementById('agentBrainStatus');
  if (brainStatus) brainStatus.textContent = brain.configured ? 'INX Agent is online' : 'INX Agent connection required';
  const plan = selectedAgentPlan();
  const deck = document.querySelector('.jarvis-command-deck');
  deck?.classList.toggle('brain-offline', !brain.configured);
  ['running','queued','waiting','completed','failed'].forEach(name => deck?.classList.remove(`brain-${name}`));
  const visualState = String(plan?.status || '').toLowerCase().replace('_provider','').replace('_review','');
  if (visualState) deck?.classList.add(`brain-${visualState}`);
  const core = document.getElementById('agentMissionCore');
  if (core) core.querySelector('small').textContent = plan?.status ? String(plan.status).replaceAll('_', ' ') : (brain.configured ? 'READY' : 'OFFLINE');
  const feed = document.getElementById('agentLiveFeed');
  const events = plan?.events || [];
  if (feed) feed.innerHTML = events.length ? events.map((item,index) => `<article class="agent-feed-event status-${escapeHtml(String(item.status).toLowerCase())} ${index===0?'latest':''}"><i></i><div><header><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(String(item.status))}</span></header><p>${escapeHtml(item.message)}</p><time>${escapeHtml(new Date(item.createdAt).toLocaleString())}</time></div></article>`).join('') : '<div class="workspace-empty">No runtime events yet.</div>';
  const tasks = plan?.tasks || [];
  const activeTask = tasks.find(item => item.status === 'RUNNING') || tasks.find(item => ['QUEUED','PENDING'].includes(item.status)) || tasks.find(item => String(item.status).startsWith('WAITING') || item.status === 'ACTION_REQUIRED');
  const completedTasks = tasks.filter(item => item.status === 'COMPLETED').slice(-3).reverse();
  const count = document.getElementById('agentMemoryCount');
  if (count) count.textContent = activeTask ? String(activeTask.status).replaceAll('_', ' ') : (plan ? 'IDLE' : 'READY');
  const grid = document.getElementById('agentMemoryGrid');
  if (grid) grid.innerHTML = plan ? `
    ${activeTask ? `<article class="thinking-now"><header><span>NOW</span><b>${escapeHtml(String(activeTask.status).replaceAll('_', ' '))}</b></header><strong>${escapeHtml(activeTask.title)}</strong><p>${escapeHtml(activeTask.output?.message || activeTask.description)}</p><small>${String(activeTask.status).startsWith('WAITING') || activeTask.status === 'ACTION_REQUIRED' ? 'The mission will continue with every independent AI task.' : 'This is a factual activity summary, not hidden model reasoning.'}</small></article>` : '<div class="workspace-empty">No active step. The mission has finished its available AI work.</div>'}
    ${completedTasks.map(item => `<article class="thinking-done"><header><span>COMPLETED</span><b>✓</b></header><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.output?.content || item.output?.message || 'Output saved successfully.')}</p><small>Saved result · reusable learning requires administrator approval</small></article>`).join('')}
    ${agentOverview?.pendingMemoryCount ? `<div class="thinking-learning">${agentOverview.pendingMemoryCount} learning candidate(s) are awaiting administrator review.</div>` : ''}` : '<div class="workspace-empty">Launch a mission to see what the agent is doing step by step.</div>';
}

async function approveAgentPlan() {
  const plan = selectedAgentPlan();
  if (!plan) return;
  const confirmed = await showStudioConfirm({ eyebrow: 'Hybrid checkpoint', title: 'Approve and run this mission?', message: 'Ollama will start the approved organic-content tasks. No paid advertising or account-security action is permitted.', metrics: [{ label: 'Tasks', value: plan.tasks?.length || 0 }, { label: 'Mode', value: 'Hybrid' }], tone: 'warning', confirmText: 'Approve & run' });
  if (!confirmed) return;
  try {
    const result = await window.schedulerApi.approveAgentPlan(plan.id);
    agentOverview.plans = agentOverview.plans.map(item => item.id === result.plan.id ? result.plan : item);
    renderAgentWorkspace();
    toast(result.notice || 'Social Agent plan approved.');
  } catch (error) { toast(error.message, true); }
}

async function resumeAgentPlan() {
  const plan = selectedAgentPlan();
  if (!plan) return;
  try {
    const result = await window.schedulerApi.resumeAgentPlan(plan.id);
    agentOverview.plans = agentOverview.plans.map(item => item.id === result.plan.id ? result.plan : item);
    renderAgentWorkspace();
    toast(result.notice || 'Mission resumed.');
  } catch (error) { toast(error.message, true); }
}

async function cancelAgentPlan() {
  const plan = selectedAgentPlan();
  if (!plan) return;
  const confirmed = await showStudioConfirm({ eyebrow: 'Social Agent', title: 'Cancel this plan?', message: 'The plan and its tasks will stay in your audit history but cannot be executed.', tone: 'danger', confirmText: 'Cancel plan' });
  if (!confirmed) return;
  try {
    const result = await window.schedulerApi.cancelAgentPlan(plan.id);
    agentOverview.plans = agentOverview.plans.map(item => item.id === result.plan.id ? result.plan : item);
    renderAgentWorkspace();
    toast('Social Agent plan cancelled.');
  } catch (error) { toast(error.message, true); }
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
    else hint.textContent = 'Create an Auto Scheduler upload to begin.';
  }
}

function renderSlotPills() {
  const target = document.getElementById('slotPills');
  if (!target) return;
  target.innerHTML = state.settings.dailySlots
    .map(slot => `<span class="pill">${escapeHtml(to12(slot))}</span>`)
    .join('');
}

function renderTables() {
  const jobsSorted = [...state.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  document.getElementById('recentJobs').innerHTML = renderJobTable(jobsSorted);
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
  if (!jobs.length) return '<div class="empty">No upload attempts have been recorded yet.</div>';
  const successful = jobs.filter(job => ['reel_scheduled', 'reel_published', 'scheduled', 'published'].includes(String(job.status || ''))).length;
  const failed = jobs.filter(job => String(job.status || '').includes('failed')).length;
  const pending = Math.max(0, jobs.length - successful - failed);
  return `
    <div class="history-summary">
      <span>All attempts: <strong>${jobs.length}</strong></span>
      <span>Successful: <strong>${successful}</strong></span>
      <span>Failed: <strong>${failed}</strong></span>
      <span>Pending: <strong>${pending}</strong></span>
    </div>
    <table><thead><tr><th>Status</th><th>Video</th><th>Queued at</th><th>Accepted by Meta</th><th>Facebook publish time</th><th>Meta ID</th><th>Error</th><th></th></tr></thead><tbody>${jobs.map(job => `
      <tr>
        <td><span class="status ${escapeHtml(job.status)}">${escapeHtml(statusLabel(job.status))}</span></td>
        <td>${escapeHtml(job.videoName)}</td>
        <td>${escapeHtml(formatDate(job.createdAt))}</td>
        <td>${escapeHtml(job.uploadedAt ? formatDate(job.uploadedAt) : '-')}</td>
        <td>${escapeHtml(job.publishMode === 'NOW' ? 'Published immediately' : (job.slotLabel || formatDate(job.scheduledAtISO)))}</td>
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
  if (!root || !state) return;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 35; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    days.push(date);
  }
  const jobsByDate = groupJobsByDate(state.jobs || []);
  const metaByDate = groupMetaPostsByDate(metaScheduledPosts);
  root.innerHTML = days.map(date => {
    const key = localDateKey(date);
    const jobs = jobsByDate[key] || [];
    const localMetaIds = new Set(jobs.flatMap(job => [job.metaPostId, job.metaVideoId]).filter(Boolean).map(String));
    const metaPosts = (metaByDate[key] || []).filter(post => !localMetaIds.has(String(post.id || '')));
    const today = key === localDateKey(now);
    const itemCount = jobs.length + metaPosts.length;
    return `<div class="day-card ${today ? 'today' : ''}">
      <div class="day-date"><span><strong>${date.toLocaleDateString(undefined, { weekday: 'short' })}</strong>${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>${itemCount ? `<b>${itemCount}</b>` : ''}</div>
      <div class="calendar-day-items">
        ${jobs.map(job => `<div class="cal-job local ${escapeHtml(job.status)}"><span class="calendar-source local">INX</span><strong>${escapeHtml(timeFromIso(job.scheduledAtISO))}</strong><p>${escapeHtml(job.videoName)}</p><small>${escapeHtml(statusLabel(job.status))}</small></div>`).join('')}
        ${metaPosts.map(post => `<div class="cal-job facebook"><span class="calendar-source facebook">Facebook</span><strong>${escapeHtml(formatMetaScheduleTime(post))}</strong><p>${escapeHtml(calendarPostLabel(post))}</p><small>Scheduled on Facebook</small></div>`).join('')}
        ${itemCount ? '' : '<span class="calendar-empty">No scheduled content</span>'}
      </div>
    </div>`;
  }).join('');
  const sync = document.getElementById('calendarSyncStatus');
  if (sync) sync.textContent = metaScheduleLoaded
    ? `${metaScheduledPosts.length} current Facebook scheduled post${metaScheduledPosts.length === 1 ? '' : 's'} synced.`
    : 'Facebook schedule syncs automatically when you open Calendar.';
}

function renderMetaScheduled(posts) {
  const box = document.getElementById('metaScheduledBox');
  if (!box) return;
  box.classList.remove('hidden');
  const sorted = [...posts].sort((a, b) => scheduledPostDate(a) - scheduledPostDate(b));
  box.innerHTML = `<div class="panel-head"><h3>Facebook schedule details</h3><p>Current upcoming content returned directly by your active Facebook Page.</p></div>` +
    (sorted.length ? `<div class="table-wrap"><table><thead><tr><th>Scheduled date &amp; time</th><th>Content</th><th>Status</th><th>Facebook ID</th></tr></thead><tbody>${sorted.map(post => `
      <tr><td><strong>${escapeHtml(formatMetaScheduleDate(post))}</strong></td><td>${escapeHtml(post.message || 'Scheduled Facebook post')}</td><td><span class="status scheduled">Scheduled</span></td><td class="code">${escapeHtml(post.id || '')}</td></tr>
    `).join('')}</tbody></table></div>` : '<div class="empty">Facebook returned no upcoming scheduled posts for this Page.</div>');
}

function scheduledPostDate(post) {
  const raw = Number(post?.scheduled_publish_time || 0);
  return raw ? new Date(raw < 1000000000000 ? raw * 1000 : raw) : new Date(NaN);
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function groupMetaPostsByDate(posts) {
  const grouped = {};
  for (const post of posts || []) {
    if (post.is_published === true) continue;
    const date = scheduledPostDate(post);
    const key = localDateKey(date);
    if (!key) continue;
    grouped[key] = grouped[key] || [];
    grouped[key].push(post);
  }
  for (const key of Object.keys(grouped)) grouped[key].sort((a, b) => scheduledPostDate(a) - scheduledPostDate(b));
  return grouped;
}

function formatMetaScheduleTime(post) {
  const date = scheduledPostDate(post);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatMetaScheduleDate(post) {
  const date = scheduledPostDate(post);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function calendarPostLabel(post) {
  const message = String(post?.message || '').trim();
  return message ? (message.length > 86 ? `${message.slice(0, 83)}…` : message) : 'Scheduled Facebook post';
}

function groupJobsByDate(jobs) {
  const grouped = {};
  for (const job of jobs) {
    if (!job.scheduledAtISO) continue;
    const key = localDateKey(job.scheduledAtISO);
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


function normaliseSettingSlot(value) {
  const match = String(value || '').trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : '';
}

function setSettingDailySlots(slots) {
  const source = Array.isArray(slots)
    ? slots
    : String(slots || '').split(/\r?\n|,/);
  settingsDailySlots = [...new Set(source.map(normaliseSettingSlot).filter(Boolean))].sort();
  renderSettingDailySlots();
}

function renderSettingDailySlots() {
  const hidden = document.getElementById('settingSlots');
  const list = document.getElementById('settingSlotsList');
  const count = document.getElementById('settingSlotsCount');
  if (hidden) hidden.value = settingsDailySlots.join('\n');
  if (count) count.textContent = `${settingsDailySlots.length} ${settingsDailySlots.length === 1 ? 'time' : 'times'}`;
  if (!list) return;
  if (!settingsDailySlots.length) {
    list.innerHTML = '<span class="settings-slot-empty">No schedule times added yet.</span>';
    return;
  }
  list.innerHTML = settingsDailySlots.map(slot => `
    <span class="settings-slot-chip">
      <span><strong>${escapeHtml(to12(slot))}</strong><small>${escapeHtml(slot)}</small></span>
      <button type="button" data-remove-setting-slot="${escapeHtml(slot)}" aria-label="Remove ${escapeHtml(to12(slot))}" title="Remove time">&times;</button>
    </span>
  `).join('');
}

function addSettingDailySlot() {
  const picker = document.getElementById('settingSlotPicker');
  const slot = normaliseSettingSlot(picker ? picker.value : '');
  if (!slot) {
    toast('Choose a valid schedule time first.', true);
    return;
  }
  if (settingsDailySlots.includes(slot)) {
    toast(`${to12(slot)} is already in the daily schedule.`, true);
    return;
  }
  if (settingsDailySlots.length >= 24) {
    toast('You can save up to 24 daily schedule times.', true);
    return;
  }
  settingsDailySlots = [...settingsDailySlots, slot].sort();
  renderSettingDailySlots();
}

function removeSettingDailySlot(slot) {
  settingsDailySlots = settingsDailySlots.filter(value => value !== normaliseSettingSlot(slot));
  renderSettingDailySlots();
}

function fillSettings() {
  const s = state.settings;
  document.getElementById('settingPageId').value = s.pageId || '';
  const appIdField = document.getElementById('settingFacebookAppId');
  if (appIdField) appIdField.value = s.facebookAppId || '969283649323618';
  renderFacebookConnectStatus(s);
  document.getElementById('settingGraphVersion').value = s.graphVersion || 'v25.0';
  document.getElementById('settingTimezone').value = s.timezone || 'Europe/London';
  setSettingDailySlots(s.dailySlots || []);
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
    await window.schedulerApi.clearPagePictureCache?.();
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
  target.innerHTML = '<span>F</span>';
  target.dataset.pagePictureId = page?.id || '';
  hydratePagePictures(target);
}

function hydratePagePictures(root = document) {
  const targets = [
    ...(root.matches?.('[data-page-picture-id]') ? [root] : []),
    ...(root.querySelectorAll?.('[data-page-picture-id]') || [])
  ];
  targets.forEach(async target => {
    const pageId = target.dataset.pagePictureId;
    if (!pageId || target.dataset.pictureLoading === 'true') return;
    target.dataset.pictureLoading = 'true';
    try {
      const url = await window.schedulerApi.getPagePictureUrl(pageId);
      if (!url || !target.isConnected || target.dataset.pagePictureId !== pageId) return;
      const image = document.createElement('img');
      image.src = url;
      image.alt = 'Facebook Page profile picture';
      image.addEventListener('error', () => target.replaceChildren(document.createTextNode('F')), { once: true });
      target.replaceChildren(image);
    } catch (_) {
      target.replaceChildren(document.createTextNode('F'));
    } finally {
      delete target.dataset.pictureLoading;
    }
  });
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
  hydratePagePictures(grid);
  bindWorkspaceDynamicActions();
}

function pageCardMarkup(page, large) {
  return `<article class="connected-page-card ${page.isSelected ? 'active' : ''} ${large ? 'large' : ''}"><div class="page-picture" data-page-picture-id="${escapeHtml(page.id)}"><span>F</span></div><div class="page-card-copy"><span>${escapeHtml(page.facebookCategory || 'Facebook Page')}</span><h3>${escapeHtml(page.facebookPageName)}</h3><p>${page.localOnly ? 'Saved on this device · reconnect once to sync' : escapeHtml(accountNameForPage(page))}</p></div><div class="page-card-state">${page.isSelected ? '<b>Active Page</b>' : '<button class="btn secondary compact" data-select-page="'+escapeHtml(page.id)+'">Use this Page</button>'}${!large && !page.localOnly ? `<button class="icon-danger" data-revoke-page="${escapeHtml(page.id)}" title="Disconnect Page">×</button>` : ''}</div></article>`;
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
      <span data-page-picture-id="${escapeHtml(page.id)}">F</span>
      <em><strong>${escapeHtml(page.facebookPageName)}</strong><small>${escapeHtml(page.facebookCategory || 'Facebook Page')}</small></em>
      <b>${active?.id === page.id ? '✓' : ''}</b>
    </button>`).join('') + '<button type="button" id="btnTopManagePages" class="active-menu-manage">Manage Pages</button>';
  hydratePagePictures(menu);
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
  if (!await showStudioConfirm({ eyebrow: 'Connected Pages', title: 'Disconnect this Facebook Page?', message: 'The Page will no longer be available as an INX Social publishing destination.', icon: '×', tone: 'danger', confirmText: 'Disconnect Page', cancelText: 'Keep connected' })) return;
  try { const result = await window.schedulerApi.revokeWorkspacePage(pageId); state = result.state; cloudWorkspace = result.workspace; renderWorkspaceV2(); renderReelsSessionSummary(); toast('Facebook Page disconnected.'); }
  catch (error) { toast(error.message, true); }
}

async function connectFacebookWorkspaceV2() {
  const button = document.getElementById('btnAddMetaAccount');
  if (button) { button.disabled = true; button.textContent = 'Connecting Page…'; }
  try {
    const result = await window.schedulerApi.connectFacebookWorkspace();
    state = result.state;
    cloudWorkspace = result.workspace || state.workspace || cloudWorkspace;
    render();
    renderWorkspaceV2();
    renderReelsSessionSummary();
    toast(result.notice || 'Facebook connected. Pages refreshed automatically.');
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
  if (!await showStudioConfirm({ eyebrow: 'Connected Pages', title: `Disconnect ${savedPageName}?`, message: 'This removes only this Page. Other connected Pages stay available.', details: ['Use Facebook permissions if you also want to remove INX Social from your Facebook account.'], icon: '×', tone: 'danger', confirmText: 'Disconnect Page', cancelText: 'Keep connected' })) return;

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
  if (!state) return;
  const pages = cloudWorkspace.pages || [];
  const active = cloudWorkspace.activePage || pages.find(page => page.isSelected) || null;
  if (!analyticsPage || !pages.some(page => page.id === analyticsPage)) analyticsPage = active?.id || pages[0]?.id || '';
  const pageSelect = document.getElementById('analyticsPageSelect');
  if (pageSelect) {
    pageSelect.innerHTML = pages.length ? pages.map(page =>
      `<option value="${escapeHtml(page.id)}">${escapeHtml(page.facebookPageName || 'Facebook Page')}</option>`
    ).join('') : '<option value="">Connect a Facebook Page first</option>';
    pageSelect.value = analyticsPage;
    pageSelect.disabled = analyticsLoading || !pages.length;
  }
  const platformSelect = document.getElementById('analyticsPlatformSelect');
  if (platformSelect) platformSelect.value = analyticsPlatform;
  const rangeSelect = document.getElementById('analyticsRangeSelect');
  if (rangeSelect) { rangeSelect.value = analyticsRange; rangeSelect.disabled = analyticsLoading; }
  const refresh = document.getElementById('btnRefreshAnalytics');
  if (refresh) { refresh.disabled = analyticsLoading || !analyticsPage; refresh.textContent = analyticsLoading ? 'Loading Meta data…' : 'Refresh analytics'; }
  if (!liveFacebookAnalytics) return;
  renderFacebookAnalytics(liveFacebookAnalytics);
}

async function loadFacebookAnalytics(force = false) {
  if (analyticsLoading) return;
  renderAnalyticsV2();
  if (!analyticsPage) {
    renderAnalyticsError(new Error('Connect and select a Facebook Page before opening Analytics.'));
    return;
  }
  const key = `${analyticsPage}:${analyticsRange}`;
  if (!force && liveFacebookAnalytics && analyticsLastKey === key) return renderFacebookAnalytics(liveFacebookAnalytics);
  analyticsLoading = true;
  renderAnalyticsLoading();
  try {
    const result = await window.schedulerApi.getFacebookAnalytics({ connectedPageId: analyticsPage, days: Number(analyticsRange || 30), force });
    liveFacebookAnalytics = result.analytics;
    analyticsLastKey = key;
    renderFacebookAnalytics(liveFacebookAnalytics);
  } catch (error) {
    renderAnalyticsError(error);
  } finally {
    analyticsLoading = false;
    renderAnalyticsV2();
  }
}

function renderAnalyticsLoading() {
  setText('analyticsLivePill', 'Loading');
  const trend = document.getElementById('analyticsTrend');
  if (trend) trend.innerHTML = '<div class="analytics-loading"><i></i><span>Requesting the selected Page analytics from Meta…</span></div>';
  const content = document.getElementById('analyticsRecentContent');
  if (content) content.innerHTML = '<div class="analytics-loading"><i></i><span>Loading Facebook content performance…</span></div>';
  renderAnalyticsV2();
}

function renderAnalyticsError(error) {
  setText('analyticsLivePill', 'Unavailable');
  setText('analyticsFollowers', '—');
  setText('analyticsPosts', '—');
  setText('analyticsEngagements', '—');
  setText('analyticsViews', '—');
  const message = escapeHtml(error?.message || 'Facebook analytics could not be loaded.');
  const trend = document.getElementById('analyticsTrend');
  if (trend) trend.innerHTML = `<div class="analytics-error"><strong>Analytics not available</strong><span>${message}</span></div>`;
  const capabilities = document.getElementById('analyticsCapabilities');
  if (capabilities) capabilities.innerHTML = `<div class="capability-row unavailable"><span>Meta analytics request</span><strong>Unavailable</strong><small>${message}</small></div>`;
  setText('analyticsReviewStatus', 'Unavailable');
  const evidence = document.getElementById('analyticsReviewEvidence');
  if (evidence) evidence.innerHTML = `<div class="analytics-error"><strong>Review evidence could not be generated</strong><span>${message}</span></div>`;
}

function formatMetric(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat(undefined, { notation: Number(value) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Number(value));
}

function renderFacebookAnalytics(data) {
  if (!data) return;
  setText('analyticsPageName', data.page?.name || 'Facebook Page analytics');
  setText('analyticsScopeText', `${data.page?.name || 'Facebook Page'} · Last ${data.period?.days || analyticsRange} days · ${data.cache?.hit ? 'Cached safely' : 'Live Meta refresh'}`);
  setText('analyticsLivePill', data.cache?.hit ? 'Cached' : 'Live');
  setText('analyticsFollowers', formatMetric(data.summary?.followers));
  setText('analyticsPosts', formatMetric(data.summary?.posts));
  setText('analyticsEngagements', formatMetric(data.summary?.engagements));
  setText('analyticsViews', formatMetric(data.summary?.views));
  setText('analyticsResultCount', `${data.content?.length || 0} item${data.content?.length === 1 ? '' : 's'}`);
  const pagePicture = document.getElementById('analyticsPagePicture');
  const pageFallback = document.getElementById('analyticsPageFallback');
  if (pagePicture) {
    if (data.page?.pictureUrl) {
      pagePicture.src = data.page.pictureUrl;
      pagePicture.hidden = false;
      if (pageFallback) pageFallback.hidden = true;
    } else {
      pagePicture.removeAttribute('src');
      pagePicture.hidden = true;
      if (pageFallback) pageFallback.hidden = false;
    }
  }
  renderAnalyticsTrend(data.series || {});
  renderAnalyticsCapabilities(data.capabilities || {}, data.warnings || []);
  renderAnalyticsReviewEvidence(data.reviewEvidence || {});
  const recent = document.getElementById('analyticsRecentContent');
  if (recent) {
    const content = data.content || [];
    recent.innerHTML = content.length ? `<table><thead><tr><th>Content</th><th>Published</th><th>Reactions</th><th>Comments</th><th>Shares</th><th>Facebook</th></tr></thead><tbody>${content.map(item => `
      <tr><td><div class="analytics-content-cell">${item.thumbnailUrl ? `<img src="${escapeHtml(item.thumbnailUrl)}" alt="" loading="lazy">` : '<span class="analytics-content-placeholder">f</span>'}<div><strong>${escapeHtml((item.message || 'Facebook content').slice(0, 110))}</strong><small>${escapeHtml(item.contentType || 'post')}</small></div></div></td><td>${escapeHtml(formatDate(item.createdTime))}</td><td>${formatMetric(item.reactions)}</td><td>${formatMetric(item.comments)}</td><td>${formatMetric(item.shares)}</td><td>${item.permalinkUrl ? `<a class="analytics-open-link" href="${escapeHtml(item.permalinkUrl)}" target="_blank" rel="noopener noreferrer">View post</a>` : '—'}</td></tr>
    `).join('')}</tbody></table>` : data.reviewEvidence?.reconnectRequired ? '<div class="analytics-reconnect"><strong>Reconnect required for content analytics</strong><p>This Page token was created before <code>pages_read_user_content</code> was requested. Meta permissions do not update an existing token automatically.</p><button class="btn primary" type="button" data-analytics-reconnect>Reconnect Facebook Page</button></div>' : '<div class="empty">Meta returned no published content in this period.</div>';
    recent.querySelector('[data-analytics-reconnect]')?.addEventListener('click', () => switchView('pages'));
  }
  const notice = document.getElementById('analyticsNotice');
  if (notice) notice.querySelector('p').textContent = data.capabilities?.pageInsights?.available
    ? 'Meta Page Insights are available for this connection. Unsupported individual metrics remain blank and are listed in Data availability.'
    : 'Basic post engagement is available. Meta did not provide the tested Page Insights metrics for this token; the exact reason is shown above.';
}

function renderAnalyticsReviewEvidence(evidence) {
  const target = document.getElementById('analyticsReviewEvidence');
  if (!target) return;
  const ready = evidence.status === 'ready';
  setText('analyticsReviewStatus', ready ? 'Ready to demonstrate' : 'Partial data');
  const checks = evidence.endpointChecks || [];
  const permissions = evidence.requiredPermissions || [];
  target.innerHTML = `
    <div class="analytics-evidence-summary">
      <article><span>Selected Page</span><strong>${escapeHtml(evidence.pageName || '—')}</strong><small>ID ${escapeHtml(evidence.pageId || '—')}</small></article>
      <article><span>Graph API</span><strong>${escapeHtml(evidence.graphVersion || '—')}</strong><small>${escapeHtml(evidence.dateRange?.days ? `Last ${evidence.dateRange.days} days` : 'No range')}</small></article>
      <article><span>Last verified</span><strong>${escapeHtml(evidence.fetchedAt ? formatDate(evidence.fetchedAt) : '—')}</strong><small>${ready ? 'Insights returned' : 'Basic engagement only'}</small></article>
      <article><span>Permission evidence</span><strong>Live endpoints</strong><small>${escapeHtml(evidence.permissionEvidence || 'Verified from successful Page responses')}</small></article>
    </div>
    <div class="analytics-evidence-columns">
      <div><h4>Permission use</h4>${permissions.map(item => `<div class="analytics-evidence-line"><strong>${escapeHtml(item.permission)}</strong><span>${escapeHtml(item.purpose)}</span><small>${escapeHtml(String(item.verification || '').replaceAll('_', ' '))}</small></div>`).join('')}</div>
      <div><h4>Live endpoint checks</h4>${checks.map(item => `<div class="analytics-evidence-line ${item.ok ? 'ok' : 'warn'}"><strong>${item.ok ? 'Passed' : escapeHtml(String(item.state || 'Unavailable').replaceAll('_', ' '))}</strong><span>${escapeHtml(item.purpose)}</span><small>${escapeHtml(item.endpoint)}</small></div>`).join('')}</div>
    </div>
    ${evidence.reconnectRequired ? '<div class="analytics-reconnect"><strong>Fresh Page token needed</strong><p>The permission is enabled in Meta, but this saved token predates it. Go to Connected Pages, disconnect, then reconnect the review Page.</p><button class="btn primary" type="button" data-evidence-reconnect>Open Connected Pages</button></div>' : ''}
    <p class="analytics-privacy-proof">${escapeHtml(evidence.privacy || 'Tokens are never shown in Analytics.')}</p>`;
  target.querySelector('[data-evidence-reconnect]')?.addEventListener('click', () => switchView('pages'));
}

async function copyAnalyticsReviewSteps() {
  const steps = liveFacebookAnalytics?.reviewEvidence?.reviewerSteps || [];
  if (!steps.length) return toast('Refresh analytics before copying reviewer steps.', true);
  const text = ['INX Social — Facebook Analytics reviewer steps', '', ...steps.map((step, index) => `${index + 1}. ${step}`)].join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast('Meta reviewer steps copied.');
  } catch (_) {
    toast('Clipboard access was blocked. The reviewer steps remain available in Analytics.', true);
  }
}

function renderAnalyticsCapabilities(capabilities, warnings) {
  const target = document.getElementById('analyticsCapabilities');
  if (!target) return;
  const rows = [
    ['Page and post engagement', capabilities.basicEngagement],
    ['Published Page content', capabilities.publishedContent],
    ['Page Insights', capabilities.pageInsights],
    ['Content views', capabilities.metrics?.views],
    ['Post engagements trend', capabilities.metrics?.engagements],
    ['Page follows trend', capabilities.metrics?.follows]
  ];
  target.innerHTML = rows.map(([label, capability]) => {
    const available = Boolean(capability?.available);
    const state = String(capability?.state || 'unavailable').replaceAll('_', ' ');
    return `<div class="capability-row ${available ? 'available' : 'unavailable'}"><span>${escapeHtml(label)}</span><strong>${available ? 'Available' : escapeHtml(state)}</strong><small>${escapeHtml(capability?.reason || 'Not returned by Meta.')}</small></div>`;
  }).join('') + (warnings.length ? `<details class="analytics-warnings"><summary>${warnings.length} unavailable metric note${warnings.length === 1 ? '' : 's'}</summary>${warnings.map(item => `<p>${escapeHtml(item)}</p>`).join('')}</details>` : '');
}

function renderAnalyticsTrend(series) {
  const target = document.getElementById('analyticsTrend');
  if (!target) return;
  const preferred = ['views', 'engagements', 'follows'].find(key => (series[key] || []).length);
  const values = preferred ? series[preferred] : [];
  if (!values.length) {
    target.innerHTML = '<div class="empty">Meta did not return a daily Page Insights series for this connection.</div>';
    return;
  }
  const maximum = Math.max(1, ...values.map(item => Number(item.value || 0)));
  const label = preferred === 'views' ? 'Content views' : preferred === 'follows' ? 'Page follows' : 'Post engagements';
  target.innerHTML = `<div class="analytics-chart-key"><span><i class="success"></i>${label}</span></div><div class="analytics-chart-bars">${values.map(item => {
    const height = Number(item.value || 0) / maximum * 100;
    const date = new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    return `<div class="analytics-chart-column" title="${escapeHtml(date)}: ${formatMetric(item.value)}"><div class="analytics-chart-stack"><i class="success" style="height:${height}%"></i></div><span>${escapeHtml(date)}</span></div>`;
  }).join('')}</div>`;
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
