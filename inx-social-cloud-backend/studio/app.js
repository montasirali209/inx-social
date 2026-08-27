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
let studioActionModalResultFactory = null;
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
const openAgentTaskOutputs = new Set();
let agentPageTargetsInitialized = false;
const agentSelectedAssetIds = new Set();
let agentTimelineSignature = '';
let agentMonitorSignature = '';
let agentEditingPostId = '';
let agentPreparingMission = false;
let postsWorkspaceFilter = 'all';
let directPostMedia = null;
const directPostPageIds = new Set();
const reelsSelectedPageIds = new Set();

const UI_TEXT_FIELDS = [
  'appTitle', 'appSubtitle', 'dashboardTitle', 'dashboardSubtitle',
  'refreshButton', 'runSchedulerButton', 'stopSchedulerButton',
  'checkSlotsButton', 'testFacebookButton', 'openLocalDataButton',
  'uploadVideosButton', 'importVideoFolderButton', 'uploadCaptionsButton',
  'importCaptionFolderButton', 'importPastedCaptionsButton', 'clearTextButton',
  'clearLocalLibraryButton', 'fetchMetaButton', 'saveSettingsButton'
];

const views = {
  dashboard: ['Dashboard', 'Your publishing performance and activity at a glance.'],
  agent: ['AI Content Studio', 'Create campaigns with Social Agent, Autopilot and Hybrid approval control.'],
  pages: ['Connected Accounts & Pages', 'Manage official social connections and publishing destinations.'],
  posts: ['Posts', 'Review drafts, approvals, schedules, publications and failed attempts.'],
  media: ['Media Library', 'Manage videos, captions and reusable publishing assets.'],
  reels: ['Bulk Scheduler', 'Publish video batches across one or several connected Facebook Pages.'],
  lab: ['Hidden Test Tools', 'Hidden technical test tools.'],
  draft: ['Hidden Draft Tools', 'Hidden old draft tools.'],
  manual: ['Manual Scheduler', 'Upload one Reel to Meta now and schedule it for a future time.'],
  health: ['Health Check', 'Check video, caption, schedule, and Meta connection risks before posting.'],
  calendar: ['Content Calendar', 'See upcoming and completed publishing activity by date.'],
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
  if (cloudWorkspace?.activePage && !metaScheduleLoaded) listMetaScheduled({ silent: true });
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
  const resultFactory = studioActionModalResultFactory;
  studioActionModalResolver = null;
  studioActionModalResultFactory = null;
  window.setTimeout(() => modal.classList.add('hidden'), 180);
  if (resolve) resolve(result && resultFactory ? resultFactory() : Boolean(result));
}

function showStudioConfirm(options = {}) {
  const modal = document.getElementById('studioActionModal');
  if (!modal) return Promise.resolve(false);
  if (studioActionModalResolver) {
    const previous = studioActionModalResolver;
    studioActionModalResolver = null;
    previous(false);
  }
  studioActionModalResultFactory = null;
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
  document.querySelectorAll('.nav[data-view]').forEach(button => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
}

function switchView(viewName) {
  if (!views[viewName]) return;
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
  if (viewName === 'posts') renderPostsWorkspace();
  if (viewName === 'dashboard') {
    renderDashboardQueue();
    renderDashboardCalendar();
    if (cloudWorkspace?.activePage && !metaScheduleLoaded && !metaScheduleLoading) listMetaScheduled({ silent: true });
  }
}

function openNewPostWorkspace() {
  switchView('posts');
  document.getElementById('postComposer')?.classList.remove('hidden');
  renderDirectPostComposer();
  document.getElementById('directPostCaption')?.focus();
  document.getElementById('postComposer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openAIContentStudio() {
  if (!state?.account?.features?.socialAgent?.visible) return toast('AI Content Studio is not currently enabled for this account.', true);
  switchView('agent');
  document.getElementById('agentPrompt')?.focus();
}

function bindButtons() {
  on('btnRefresh', refresh);
  on('btnCreateNewPost', openNewPostWorkspace);
  on('btnPostsCreate', openNewPostWorkspace);
  on('btnPostComposerClose', () => document.getElementById('postComposer')?.classList.add('hidden'));
  on('btnDirectPostAI', openAIContentStudio);
  on('btnDirectPostMedia', chooseDirectPostMedia);
  on('btnDirectPagesAll', () => setDirectPostPages(true));
  on('btnDirectPagesClear', () => setDirectPostPages(false));
  on('btnDirectPostClear', clearDirectPostComposer);
  on('btnDirectPostPublish', publishDirectPost);
  on('btnReelsPagesAll', () => setReelsPageTargets(true));
  on('btnReelsPagesClear', () => setReelsPageTargets(false));
  document.querySelectorAll('input[name="directPostType"]').forEach(input => input.addEventListener('change', handleDirectPostTypeChange));
  document.querySelectorAll('input[name="directPublishMode"]').forEach(input => input.addEventListener('change', renderDirectPostComposer));
  document.getElementById('directPostCaption')?.addEventListener('input', renderDirectPostComposer);
  document.getElementById('directPostDate')?.addEventListener('change', renderDirectPostComposer);
  document.getElementById('directPostTime')?.addEventListener('change', renderDirectPostComposer);
  on('btnAgentRefresh', () => loadAgentOverview(true));
  document.getElementById('agentPlanForm')?.addEventListener('submit', createAgentPlan);
  document.querySelectorAll('.agent-operation-mode').forEach(input => input.addEventListener('change', renderAgentModeSummary));
  document.querySelectorAll('.agent-platform').forEach(input => input.addEventListener('change', renderAgentPageTargets));
  on('btnAgentPagesAll', () => setAgentPageTargets(true));
  on('btnAgentPagesClear', () => setAgentPageTargets(false));
  on('btnAgentUploadAsset', uploadAgentBrandAsset);
  on('btnAgentPostEditorClose', closeAgentPostEditor);
  on('btnAgentPostCancel', closeAgentPostEditor);
  on('btnAgentPostSave', saveAgentCampaignPost);
  on('btnAgentPostApprove', () => approveAgentCampaignPost());
  on('btnAgentPostRegenerate', regenerateAgentCampaignPostImage);
  document.getElementById('agentPostEditorDate')?.addEventListener('change', refreshAgentPostApproveAvailability);
  document.getElementById('agentPostEditorClock')?.addEventListener('change', refreshAgentPostApproveAvailability);
  document.getElementById('agentPostEditor')?.addEventListener('click', event => { if (event.target.id === 'agentPostEditor') closeAgentPostEditor(); });
  document.getElementById('agentBrandAssetFile')?.addEventListener('change', updateAgentBrandFileName);
  document.querySelectorAll('.agent-output-type').forEach(input => input.addEventListener('change', updateAgentContentControls));
  document.getElementById('agentExecutionMode')?.addEventListener('change', updateAgentCreditPreview);
  document.getElementById('agentPrompt')?.addEventListener('input', updateAgentCreditPreview);
  document.getElementById('postsSearchInput')?.addEventListener('input', renderPostsWorkspace);
  document.querySelectorAll('[data-post-filter]').forEach(button => button.addEventListener('click', () => {
    postsWorkspaceFilter = button.dataset.postFilter || 'all';
    document.querySelectorAll('[data-post-filter]').forEach(item => item.classList.toggle('active', item === button));
    renderPostsWorkspace();
  }));
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
  on('btnDashboardQueueScheduler', () => switchView('reels'));
  on('btnDashboardCalendar', () => switchView('calendar'));
  on('btnDashboardPages', () => switchView('pages'));
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

  on('btnAddMetaAccount', connectFacebookWorkspaceV2);
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
    toast(`${reelsSessionVideos.length} Scheduler video(s) selected.`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function pickReelsSessionCaptions() {
  try {
    const result = await window.schedulerApi.pickReelsCaptionFile();
    if (result.text) document.getElementById('reelsCaptionText').value = result.text;
    renderReelsSessionSummary();
    toast(result.path ? 'Scheduler caption file loaded.' : 'No caption file selected.');
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
  updateReelsPanel({ phase: 'Idle', percent: 0, current: 0, total: 0, uploaded: 0, failed: 0, message: 'Scheduler session cleared.' });
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
        ? 'Upload Now publishes every selected video to each selected Facebook Page immediately.'
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
  const selectedPages = (cloudWorkspace?.pages || []).filter(page => reelsSelectedPageIds.has(page.id));
  const destinationText = selectedPages.length ? selectedPages.map(page => page.facebookPageName).join(', ') : 'No Pages selected';
  if (box) {
    box.className = pairs && selectedPages.length ? 'simple-check success' : 'simple-check muted';
    if (!mode) {
      box.innerHTML = `${reelsSessionVideos.length} video(s) selected · ${captions.length} caption(s) · choose a timing mode to continue.${unusedCaptions ? ` The first ${reelsSessionVideos.length} captions will be used and ${unusedCaptions} extra caption(s) ignored.` : ''}`;
    } else if (immediate) {
      box.innerHTML = `${reelsSessionVideos.length} video(s) selected · ${captions.length} caption(s) · ${pairs} ready per Page.${unusedCaptions ? ` First ${reelsSessionVideos.length} captions used; ${unusedCaptions} extra ignored.` : ''}<br><span class="muted">Destinations: ${escapeHtml(destinationText)}. ${pairs * selectedPages.length} total Page upload${pairs * selectedPages.length === 1 ? '' : 's'}.</span>`;
    } else {
      const perDay = Math.max(1, times.length || 0);
      const days = pairs ? Math.ceil(pairs / perDay) : 0;
      box.innerHTML = `${reelsSessionVideos.length} video(s) selected · ${captions.length} caption(s) · ${pairs} ready pair(s) per Page · ${times.length || 0} slot(s)/day · estimated ${days} day(s).${unusedCaptions ? ` First ${reelsSessionVideos.length} captions used; ${unusedCaptions} extra ignored.` : ''}<br><span class="muted">Destinations: ${escapeHtml(destinationText)}. Each Page receives its own checked schedule.</span>`;
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
  window.schedulerApi.previewReelsSchedule({ count: pairs, startDate: start, times, connectedPageIds: [...reelsSelectedPageIds] }).then(schedule => {
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
  const inspection = await window.schedulerApi.inspectReelsSelection(videoPaths, [...reelsSelectedPageIds]);
  if (!inspection.duplicates.length) return inspection;
  if (!inspection.acceptedCount) throw new Error('Every selected filename matches a Reel that is processing, scheduled, or published for this Page. Failed attempts can be retried and are not treated as duplicates.');
  const names = inspection.duplicates.slice(0, 8).map(item => `${item.pageName}: ${item.name}`);
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
  if (!reelsSelectedPageIds.size) return toast('Choose at least one destination Page before preparing this Bulk Scheduler session.', true);
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
      connectedPageIds: [...reelsSelectedPageIds],
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
  if (!reelsSelectedPageIds.size) return toast('Choose at least one destination Page before starting Bulk Scheduler.', true);
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
        count: duplicateCheck.acceptedVideoCount,
        startDate,
        times,
        connectedPageIds: [...reelsSelectedPageIds]
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
      connectedPageIds: [...reelsSelectedPageIds],
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
  if (draftSession) draftSession.disabled = isSchedulerRunning;
  if (stopDraft) stopDraft.disabled = !draftSessionRunning;
  if (studioStart) studioStart.disabled = isSchedulerRunning;
  if (studioStop) studioStop.disabled = !isSchedulerRunning;
  document.querySelectorAll('#reelsPageTargetGrid input').forEach(input => { input.disabled = isSchedulerRunning; });
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
    toast(`Facebook connection verified: ${result.activePage?.name || result.result.name || result.result.id}`);
  } catch (err) {
    toast(`Facebook connection test failed: ${err.message}`, true);
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
    renderDashboardCalendar();
    renderPostsWorkspace();
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
    if (activeAgentPlanId === '' && plans.length) activeAgentPlanId = plans.find(plan => plan.status !== 'CANCELLED')?.id || '__none__';
    const activeElement = document.activeElement;
    const nativeMenuOpen = activeElement?.matches?.('#agentPlanSelect, #agentExecutionMode');
    if (nativeMenuOpen) renderAgentIntelligence();
    else renderAgentWorkspace();
    renderAgentPageTargets();
    renderAgentBrandAssets();
    updateAgentContentControls();
    renderPostsWorkspace();
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

function availableAgentPages() {
  const source = agentOverview?.connectedPages?.length ? agentOverview.connectedPages : (cloudWorkspace?.pages || state?.workspace?.pages || []);
  return source.filter(page => page.status !== 'REVOKED' && page.status !== 'DISCONNECTED');
}

function selectedAgentPageIds() {
  return [...document.querySelectorAll('.agent-page-target:checked')].map(input => input.value);
}

function updateAgentPageTargetCount() {
  const count = selectedAgentPageIds().length;
  const target = document.getElementById('agentPageTargetCount');
  if (target) target.textContent = `${count} Page${count === 1 ? '' : 's'} selected for this mission`;
}

function setAgentPageTargets(checked) {
  document.querySelectorAll('.agent-page-target').forEach(input => { input.checked = checked; });
  updateAgentPageTargetCount();
}

function renderAgentPageTargets() {
  const container = document.getElementById('agentPageTargetGrid');
  const fieldset = document.getElementById('agentFacebookTargets');
  if (!container || !fieldset) return;
  const facebookSelected = Boolean(document.querySelector('.agent-platform[value="facebook"]:checked'));
  fieldset.hidden = !facebookSelected;
  if (!facebookSelected) return;
  const preserved = new Set(selectedAgentPageIds());
  const pages = availableAgentPages();
  if (!agentPageTargetsInitialized && !preserved.size) {
    const preferred = pages.find(page => page.isSelected) || pages[0];
    if (preferred) preserved.add(preferred.id);
    agentPageTargetsInitialized = true;
  }
  container.innerHTML = pages.length ? pages.map(page => `<label class="agent-page-target-card"><input class="agent-page-target" type="checkbox" value="${escapeHtml(page.id)}" ${preserved.has(page.id) ? 'checked' : ''}><span class="agent-page-target-body"><span class="agent-page-avatar" data-page-picture-id="${escapeHtml(page.id)}"><b>F</b></span><span><strong>${escapeHtml(page.name || page.facebookPageName || 'Facebook Page')}</strong><small>${escapeHtml(page.category || page.facebookCategory || 'Connected Facebook Page')}</small></span><i aria-hidden="true">✓</i></span></label>`).join('') : '<div class="workspace-empty">No active Facebook Pages are connected. Connect a Page in Connected Pages first.</div>';
  container.querySelectorAll('.agent-page-target').forEach(input => input.addEventListener('change', updateAgentPageTargetCount));
  hydratePagePictures(container);
  updateAgentPageTargetCount();
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
}

function showMissionClarification(analysis) {
  const modal = document.getElementById('studioActionModal');
  if (!modal) return Promise.resolve('');
  const pending = showStudioConfirm({
    eyebrow: 'One quick question',
    title: 'One detail before I start',
    message: analysis.question || 'What outcome should this mission prioritise?',
    icon: '?', tone: 'info', confirmText: 'Continue mission', cancelText: 'Cancel'
  });
  const details = document.getElementById('studioActionDetails');
  if (details) {
    details.innerHTML = `<div class="agent-clarification-options">${(analysis.options || []).map((option, index) => `<label><input type="radio" name="agentClarification" value="${escapeHtml(option)}" ${index === 0 ? 'checked' : ''}><span>${escapeHtml(option)}</span></label>`).join('')}<label class="agent-clarification-custom"><span>Write a different answer</span><input id="agentClarificationCustom" maxlength="500" placeholder="Type one short instruction"></label></div>`;
    details.classList.remove('hidden');
  }
  studioActionModalResultFactory = () => document.getElementById('agentClarificationCustom')?.value.trim() || document.querySelector('input[name="agentClarification"]:checked')?.value || '';
  return pending;
}

function updateAgentBrandFileName() {
  const file = document.getElementById('agentBrandAssetFile')?.files?.[0];
  const target = document.getElementById('agentBrandAssetFileName');
  if (target) target.textContent = file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : 'PNG, JPEG or WebP · maximum 1 MB';
}

function selectedAgentContentOutput() {
  return document.querySelector('.agent-output-type:checked')?.value || 'AUTO';
}

function compatibleAgentModels(outputType) {
  const kind = outputType === 'TEXT' ? 'text' : ['IMAGE', 'CAROUSEL'].includes(outputType) ? 'image' : 'video';
  const catalog = agentOverview?.mediaModels || [
    { code: 'TEXT_ONLY', label: 'No media model', kind: 'text', creditsPerAsset: 0, eligible: true },
    { code: 'IMAGE_FAST', label: 'Fast generation', description: 'Quicker results for everyday social posts.', kind: 'image', creditsPerAsset: 0, eligible: true },
    { code: 'IMAGE_QUALITY', label: 'Quality generation', description: 'Takes longer and prioritises detail.', kind: 'image', creditsPerAsset: 0, eligible: true },
    { code: 'VIDEO_FAST', label: 'Fast video generation', kind: 'template', creditsPerAsset: 1, eligible: true },
    { code: 'VIDEO_QUALITY', label: 'Quality video generation', kind: 'generative-video', creditsPerAsset: 3, eligible: true }
  ];
  return catalog.filter(model => kind === 'video' ? ['template', 'generative-video'].includes(model.kind) : model.kind === kind);
}

function updateAgentContentControls() {
  const outputType = selectedAgentContentOutput();
  const field = document.getElementById('agentMediaModelField');
  const select = document.getElementById('agentExecutionMode');
  if (!field || !select) return;
  field.classList.toggle('hidden', outputType === 'AUTO');
  if (outputType === 'AUTO') return;
  const models = compatibleAgentModels(outputType);
  const previous = select.value;
  select.innerHTML = models.map(model => `<option value="${escapeHtml(model.code)}" ${model.eligible === false ? 'disabled' : ''}>${escapeHtml(model.label)}${model.eligible === false ? ` — ${escapeHtml(model.minimumPlan || 'higher plan')} required` : ` — ${Number(model.creditsPerAsset || 0)} credit${Number(model.creditsPerAsset || 0) === 1 ? '' : 's'} / asset`}</option>`).join('');
  if (models.some(model => model.code === previous && model.eligible !== false)) select.value = previous;
  else select.value = models.find(model => model.code === 'IMAGE_QUALITY' && model.eligible !== false)?.code || models.find(model => model.eligible !== false)?.code || models[0]?.code || '';
  field.classList.toggle('text-output', outputType === 'TEXT');
  updateAgentCreditPreview();
}

function updateAgentCreditPreview() {
  const preview = document.getElementById('agentCreditPreview');
  const modelCode = document.getElementById('agentExecutionMode')?.value;
  const model = compatibleAgentModels(selectedAgentContentOutput()).find(item => item.code === modelCode);
  if (!preview || !model) return;
  const prompt = document.getElementById('agentPrompt')?.value || '';
  const countMatch = prompt.match(/\b(\d{1,3})(?:\s+[a-z-]+){0,3}\s+(?:posts?|videos?|reels?|shorts?|assets?|days?)\b/i);
  const assetCount = Math.max(1, Math.min(100, Number(countMatch?.[1] || 1)));
  const credits = Number(model.creditsPerAsset || 0) * assetCount;
  preview.querySelector('strong').textContent = `${credits} estimated`;
  preview.querySelector('small').textContent = model.creditsPerAsset ? `${model.creditsPerAsset} per asset. Deduction activates when provider billing is enabled.` : `${model.description || 'Included local processing.'} No paid media credits.`;
}

async function uploadAgentBrandAsset() {
  const fileInput = document.getElementById('agentBrandAssetFile');
  const file = fileInput?.files?.[0];
  if (!file) return toast('Choose a logo, profile picture or reference image first.', true);
  if (file.size > 1024 * 1024) return toast('Brand images must be 1 MB or smaller.', true);
  const button = document.getElementById('btnAgentUploadAsset');
  if (button) { button.disabled = true; button.textContent = 'Adding…'; }
  try {
    const result = await window.schedulerApi.uploadAgentAsset({ kind: document.getElementById('agentBrandAssetKind')?.value, name: file.name, dataUrl: await fileAsDataUrl(file) });
    agentOverview = agentOverview || { assets: [] };
    agentOverview.assets = [result.asset, ...(agentOverview.assets || []).filter(asset => asset.id !== result.asset.id)];
    agentSelectedAssetIds.add(result.asset.id);
    if (fileInput) fileInput.value = '';
    updateAgentBrandFileName();
    renderAgentBrandAssets();
    toast('Brand image added securely.');
  } catch (error) { toast(error.message, true); }
  finally { if (button) { button.disabled = false; button.textContent = 'Add image'; } }
}

async function removeAgentBrandAsset(id) {
  try {
    await window.schedulerApi.deleteAgentAsset(id);
    agentSelectedAssetIds.delete(id);
    agentOverview.assets = (agentOverview.assets || []).filter(asset => asset.id !== id);
    renderAgentBrandAssets();
    toast('Brand image removed.');
  } catch (error) { toast(error.message, true); }
}

function renderAgentBrandAssets() {
  const container = document.getElementById('agentBrandAssetGrid');
  if (!container) return;
  const assets = (agentOverview?.assets || []).filter(asset => asset.source === 'UPLOAD');
  container.innerHTML = assets.length ? assets.map(asset => `<article class="agent-brand-asset ${agentSelectedAssetIds.has(asset.id) ? 'selected' : ''}" data-agent-asset-card="${escapeHtml(asset.id)}"><button class="agent-brand-preview" type="button" data-agent-asset-select="${escapeHtml(asset.id)}" aria-pressed="${agentSelectedAssetIds.has(asset.id)}"><span data-agent-asset-image="${escapeHtml(asset.id)}">IMG</span><b>${escapeHtml(asset.kind.replaceAll('_', ' '))}</b><small>${escapeHtml(asset.originalName || 'Brand image')}</small><i>✓</i></button>${!asset.planId && asset.source === 'UPLOAD' ? `<button class="agent-brand-remove" type="button" data-agent-asset-remove="${escapeHtml(asset.id)}" aria-label="Remove ${escapeHtml(asset.originalName || 'image')}">&times;</button>` : ''}</article>`).join('') : '<div class="workspace-empty">No brand images uploaded.</div>';
  container.querySelectorAll('[data-agent-asset-select]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.agentAssetSelect;
    if (agentSelectedAssetIds.has(id)) agentSelectedAssetIds.delete(id); else if (agentSelectedAssetIds.size < 10) agentSelectedAssetIds.add(id); else return toast('Select no more than 10 images for one mission.', true);
    renderAgentBrandAssets();
  }));
  container.querySelectorAll('[data-agent-asset-remove]').forEach(button => button.addEventListener('click', () => removeAgentBrandAsset(button.dataset.agentAssetRemove)));
  container.querySelectorAll('[data-agent-asset-image]').forEach(async target => {
    const url = await window.schedulerApi.getAgentAssetUrl(target.dataset.agentAssetImage).catch(() => '');
    if (url && target.isConnected) target.innerHTML = `<img src="${escapeHtml(url)}" alt="">`;
  });
}

async function createAgentPlan(event) {
  event.preventDefault();
  const prompt = document.getElementById('agentPrompt')?.value.trim() || '';
  const platforms = [...document.querySelectorAll('.agent-platform:checked')].map(input => input.value);
  if (!platforms.length) return toast('Select at least one publishing platform.', true);
  const targetPageIds = selectedAgentPageIds();
  if (platforms.includes('facebook') && !targetPageIds.length) return toast('Select at least one connected Facebook Page for this mission.', true);
  const button = document.getElementById('btnAgentCreatePlan');
  const previousPlan = selectedAgentPlan();
  const previousPlanId = previousPlan && previousPlan.status !== 'CANCELLED' ? previousPlan.id : '__none__';
  agentPreparingMission = true;
  activeAgentPlanId = '__none__';
  renderAgentWorkspace();
  if (button) { button.disabled = true; button.textContent = 'Launching mission…'; }
  try {
    const operationMode = document.querySelector('.agent-operation-mode:checked')?.value || 'HYBRID';
    const requestedOutput = selectedAgentContentOutput();
    const preflight = await window.schedulerApi.preflightAgentMission({ prompt, platforms });
    let finalPrompt = prompt;
    if (preflight.analysis?.needsClarification) {
      const answer = await showMissionClarification(preflight.analysis);
      if (!answer) { activeAgentPlanId = previousPlanId; return; }
      finalPrompt = `${prompt}\n\nCustomer clarification: ${answer}`;
    }
    const contentOutput = requestedOutput === 'AUTO' ? preflight.analysis?.inferredContentOutput || 'IMAGE' : requestedOutput;
    const mediaModel = contentOutput === 'TEXT' ? 'TEXT_ONLY' : ['IMAGE','CAROUSEL'].includes(contentOutput) ? (preflight.analysis?.generationPreference === 'FAST' ? 'IMAGE_FAST' : 'IMAGE_QUALITY') : (preflight.analysis?.generationPreference === 'QUALITY' ? 'VIDEO_QUALITY' : 'VIDEO_FAST');
    const result = await window.schedulerApi.createAgentPlan({ prompt: finalPrompt, platforms, targetPageIds, referenceAssetIds: [...agentSelectedAssetIds], operationMode, contentOutput, mediaModel: requestedOutput === 'AUTO' ? mediaModel : document.getElementById('agentExecutionMode')?.value });
    agentOverview = agentOverview || { plans: [] };
    agentOverview.plans = [result.plan, ...(agentOverview.plans || []).filter(plan => plan.id !== result.plan.id)];
    activeAgentPlanId = result.plan.id;
    renderAgentWorkspace();
    toast(result.notice || (operationMode === 'AUTOPILOT' ? 'Autopilot mission started.' : 'Hybrid mission created for review.'));
  } catch (error) { activeAgentPlanId = previousPlanId; toast(error.message, true); }
  finally {
    agentPreparingMission = false;
    renderAgentWorkspace();
    if (button) { button.disabled = false; button.textContent = 'Launch mission'; }
  }
}

function selectedAgentPlan() {
  const plans = agentOverview?.plans || [];
  if (activeAgentPlanId === '__none__') return null;
  return plans.find(plan => plan.id === activeAgentPlanId) || plans.find(plan => plan.status !== 'CANCELLED') || null;
}

function agentTaskStatusLabel(status) {
  const labels = {
    ACTION_REQUIRED: 'Action required',
    WAITING_PROVIDER: 'Agent connection required',
    WAITING_MEDIA_WORKER: 'Media worker required',
    WAITING_REVIEW: 'Review required',
    WAITING_ASSETS: 'Waiting for approved assets',
    WAITING_PLATFORM: 'Waiting for platform results',
    WAITING_DEPENDENCY: 'Dependency required',
    WAITING_RESEARCH: 'Research unavailable',
    WAITING_COPY_REVIEW: 'Copy quality review required',
    WAITING_CAMPAIGN_REVIEW: 'Campaign assembly required',
    COMPLETED: 'Completed',
    RUNNING: 'In progress',
    QUEUED: 'Queued',
    PENDING: 'Not started',
    FAILED: 'Failed'
  };
  return labels[String(status || '').toUpperCase()] || String(status || 'Pending').replaceAll('_', ' ');
}

function agentTaskGuidance(task) {
  const status = String(task?.status || '').toUpperCase();
  const type = String(task?.type || '').toUpperCase();
  const savedMessage = task?.output?.message || '';
  const provider = agentOverview?.capabilities?.brain || {};
  if (type === 'PAGE_SETUP' && status === 'ACTION_REQUIRED') return {
    title: 'Complete the Facebook Page setup',
    body: savedMessage || 'Open Connected Pages, confirm the correct Facebook Page is connected, then complete the Page profile, ownership and security fields directly in Facebook. Return here and resume the mission.',
    steps: ['Open Connected Pages and verify the destination Page.', 'Complete the requested Page profile changes in Facebook.', 'Return to this mission and select Resume mission.'],
    actionView: 'pages', actionLabel: 'Open Connected Pages'
  };
  if (status === 'WAITING_PROVIDER') return {
    title: provider.ready ? 'Private agent restored — retry mission' : 'Connect the private INX Agent',
    body: provider.message || savedMessage || 'Railway cannot complete an authenticated request through the private gateway.',
    steps: provider.ready
      ? ['The Railway-to-Mac connection is responding.', 'Select Retry mission to continue from the saved task.']
      : ['Mac local health alone is not enough; Railway must reach the public gateway.', 'Check the current ngrok HTTPS URL and matching token in Railway.', 'Use Retry mission to test the full route before resuming.'], actionResume: true
  };
  if (status === 'WAITING_MEDIA_WORKER') return {
    title: 'Choose or connect a visual-content worker',
    body: savedMessage || 'The strategy work is ready, but the requested image or video cannot be produced until the selected visual-content method is available.',
    steps: ['Confirm the private visual worker is online.', 'Ask an administrator to enable the requested route if needed.', 'Select Resume mission after the worker is available.'], actionResume: true
  };
  if (status === 'WAITING_RESEARCH') return {
    title: 'Current-web research unavailable',
    body: savedMessage || 'Current research was not available, so the agent did not claim to have searched the web.',
    steps: ['No action is required from you.', 'The agent will continue without claiming live research.', 'An administrator can enable the governed research connection later.'], passive: true
  };
  if (status === 'WAITING_COPY_REVIEW') return {
    title: 'Copy was withheld by the quality gate',
    body: savedMessage || 'The draft did not meet the senior social strategy standard after one automatic repair. Resume the mission to regenerate it from the saved research.',
    steps: ['No weak copy has been delivered or scheduled.', 'Review the mission and saved research if needed.', 'Resume to generate a new draft.'], actionResume: true
  };
  if (type === 'PUBLISH' && ['WAITING_REVIEW', 'WAITING_ASSETS', 'WAITING_CAMPAIGN_REVIEW'].includes(status)) return {
    title: 'Open Campaign Review',
    body: savedMessage || 'The prepared posts are waiting for your review. Open the campaign workspace to edit captions, replace images, approve posts and schedule them.',
    steps: ['Open Campaign Review.', 'Check every caption, image and publishing time.', 'Approve individual posts or approve all and schedule.'],
    actionCampaign: true, actionLabel: 'Review posts'
  };
  if (status === 'WAITING_REVIEW') return {
    title: 'Review the prepared work',
    body: savedMessage || 'Hybrid mode has reached its owner checkpoint. Review the saved output and choose the next action.',
    steps: ['Open the completed output.', 'Check the prepared work.', 'Continue when it is ready.']
  };
  if (status === 'WAITING_ASSETS') return {
    title: 'Approve the required content assets',
    body: savedMessage || 'Publishing is paused until the mission has approved media and copy.',
    steps: ['Review the generated copy and media.', 'Replace or approve the required assets.', 'Resume the mission to continue publishing.']
  };
  if (status === 'WAITING_PLATFORM') return {
    title: 'No action needed yet',
    body: savedMessage || 'This step will continue after content is published and the connected platform returns analytics.',
    steps: ['Keep the platform connected.', 'Allow the published content time to collect results.', 'Sync the mission later to refresh analytics.'], passive: true
  };
  if (status === 'FAILED') return {
    title: 'This task failed',
    body: savedMessage || task?.error || 'Review the saved error, correct the reported problem and retry the mission.',
    steps: ['Open the saved output for the exact error.', 'Correct the failed dependency.', 'Resume the mission.']
  };
  if (status.startsWith('WAITING') || status === 'ACTION_REQUIRED') return {
    title: 'A dependency needs attention',
    body: savedMessage || 'Complete the dependency shown for this task, then resume the mission.',
    steps: ['Review this task output.', 'Complete the displayed dependency.', 'Resume the mission.']
  };
  return null;
}

function captureAgentWorkspaceUi(workspace) {
  if (!workspace) return {};
  workspace.querySelectorAll('details[data-agent-task-id]').forEach(details => {
    if (details.open) openAgentTaskOutputs.add(details.dataset.agentTaskId);
    else openAgentTaskOutputs.delete(details.dataset.agentTaskId);
  });
  const view = document.getElementById('agent');
  return {
    taskScrollTop: workspace.querySelector('.agent-task-list')?.scrollTop || 0,
    workspaceScrollTop: workspace.scrollTop || 0,
    viewScrollTop: view?.scrollTop || 0
  };
}

function restoreAgentWorkspaceUi(workspace, snapshot) {
  workspace.querySelectorAll('details[data-agent-task-id]').forEach(details => {
    details.open = openAgentTaskOutputs.has(details.dataset.agentTaskId);
    details.addEventListener('toggle', () => {
      if (details.open) openAgentTaskOutputs.add(details.dataset.agentTaskId);
      else openAgentTaskOutputs.delete(details.dataset.agentTaskId);
    });
  });
  requestAnimationFrame(() => {
    const taskList = workspace.querySelector('.agent-task-list');
    if (taskList) taskList.scrollTop = snapshot.taskScrollTop || 0;
    workspace.scrollTop = snapshot.workspaceScrollTop || 0;
    const view = document.getElementById('agent');
    if (view) view.scrollTop = snapshot.viewScrollTop || 0;
  });
}

function renderAgentActionCentre(tasks) {
  const blockers = tasks.map(task => ({ task, guidance: agentTaskGuidance(task) })).filter(item => item.guidance && !item.guidance.passive);
  if (!blockers.length) return '';
  return `<section class="agent-action-centre"><header><div><span>ACTION CENTER</span><strong>${blockers.length} task${blockers.length === 1 ? '' : 's'} need attention</strong></div><b>${blockers.length}</b></header>${blockers.map(({ task, guidance }) => `<article role="button" tabindex="0" data-agent-task-detail="${escapeHtml(task.id)}"><div class="agent-action-icon">!</div><div><strong>${escapeHtml(guidance.title)}</strong><p>${escapeHtml(guidance.body)}</p><small>${guidance.actionCampaign ? 'Review and approve the prepared posts' : 'Click to review the exact task and next action'}</small></div>${guidance.actionView ? `<button type="button" class="btn secondary compact" data-agent-action-view="${escapeHtml(guidance.actionView)}">${escapeHtml(guidance.actionLabel)}</button>` : guidance.actionResume ? '<button type="button" class="btn secondary compact" data-agent-action-resume>Retry mission</button>' : guidance.actionCampaign ? `<button type="button" class="btn primary compact" data-agent-campaign-review>${escapeHtml(guidance.actionLabel || 'Review posts')}</button>` : '<span class="agent-action-open">Open →</span>'}</article>`).join('')}</section>`;
}

async function openAgentCampaignReview() {
  const plan = selectedAgentPlan();
  if (!plan) return;
  try {
    if (!plan.campaign) {
      const result = await window.schedulerApi.prepareAgentCampaignReview(plan.id);
      setSelectedAgentCampaign(result.campaign);
      toast(result.notice || 'Campaign Review is ready.');
    }
    renderAgentWorkspace();
    requestAnimationFrame(() => document.querySelector('.agent-campaign-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  } catch (error) { toast(error.message, true); }
}

async function openAgentTaskDetail(taskId) {
  const task = selectedAgentPlan()?.tasks?.find(item => item.id === taskId);
  if (!task) return;
  const guidance = agentTaskGuidance(task);
  if (guidance?.actionCampaign) return openAgentCampaignReview();
  const output = task.output?.content || task.output?.summary || task.output?.message || 'No saved output is available yet.';
  const sources = (task.output?.sources || []).map(source => `${source.title}: ${source.url}`);
  showStudioConfirm({
    eyebrow: `Mission task ${task.sequence}`,
    title: task.title,
    message: `${agentTaskStatusLabel(task.status)} — ${task.description}`,
    icon: task.status === 'COMPLETED' ? '✓' : String(task.status).startsWith('WAITING') || task.status === 'ACTION_REQUIRED' ? '!' : 'i',
    tone: task.status === 'COMPLETED' ? 'success' : guidance ? 'warning' : 'info',
    metrics: [{ label: 'Status', value: agentTaskStatusLabel(task.status) }, { label: 'Risk', value: task.riskLevel || 'LOW' }],
    details: [...(guidance?.steps || []), output, ...sources],
    confirmText: guidance ? 'Understood' : 'Close',
    cancelText: ''
  });
}

function setSelectedAgentCampaign(campaign) {
  if (!campaign || !agentOverview?.plans) return;
  agentOverview.plans = agentOverview.plans.map(plan => plan.id === campaign.planId ? { ...plan, campaign } : plan);
}

function campaignPostStatusLabel(status) {
  const labels = {
    READY_FOR_REVIEW: 'Ready for review',
    CHANGES_REQUESTED: 'Changes requested',
    WAITING_MEDIA: 'Media required',
    APPROVED: 'Approved',
    SCHEDULING: 'Scheduling',
    SCHEDULED: 'Scheduled',
    SCHEDULE_FAILED: 'Scheduling failed',
    PUBLISHED: 'Published'
  };
  return labels[status] || String(status || 'Draft').replaceAll('_', ' ');
}

function localDateTimeValue(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function localScheduleParts(value) {
  const localValue = localDateTimeValue(value);
  const [date = '', time = ''] = localValue.split('T');
  return { date, time };
}

function editorScheduleIso() {
  const date = document.getElementById('agentPostEditorDate')?.value || '';
  const time = document.getElementById('agentPostEditorClock')?.value || '';
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function agentPostEditorUpdate() {
  const scheduledAt = editorScheduleIso();
  if (!scheduledAt) throw new Error('Choose both a publishing date and time.');
  return {
    title: document.getElementById('agentPostEditorTitle').value,
    caption: document.getElementById('agentPostEditorCaption').value,
    altText: document.getElementById('agentPostEditorAlt').value,
    visualBrief: document.getElementById('agentPostEditorVisualBrief').value,
    scheduledAt
  };
}

function refreshAgentPostApproveAvailability() {
  const plan = selectedAgentPlan();
  const post = plan?.campaign?.posts?.find(item => item.id === agentEditingPostId);
  const button = document.getElementById('btnAgentPostApprove');
  if (!post || !button) return;
  const scheduledAt = editorScheduleIso();
  const scheduleReady = scheduledAt && new Date(scheduledAt).getTime() >= Date.now() + 10 * 60 * 1000;
  const qualityReview = post.asset?.qualityReview;
  const mediaReady = post.format === 'TEXT' || (post.asset && post.status !== 'WAITING_MEDIA' && qualityReview?.approved === true);
  const locked = ['APPROVED', 'SCHEDULING', 'SCHEDULED', 'PUBLISHED'].includes(post.status);
  button.disabled = locked || !mediaReady || !scheduleReady;
}

function renderAgentCampaignReview(campaign) {
  if (!campaign) return '';
  const posts = campaign.posts || [];
  const readyToSchedule = posts.some(post => ['APPROVED', 'SCHEDULE_FAILED'].includes(post.status));
  const allScheduled = posts.length && posts.every(post => ['SCHEDULED', 'PUBLISHED'].includes(post.status));
  return `<section class="agent-campaign-review" aria-label="Campaign review">
    <header class="agent-campaign-head">
      <div><span>CAMPAIGN REVIEW</span><h3>${escapeHtml(campaign.name)}</h3><p>Review every caption, visual and ${escapeHtml(campaign.timezone)} publishing time. Nothing is sent to Facebook until you approve and schedule it.</p></div>
      <div class="agent-campaign-counts"><strong>${campaign.counts?.scheduled || 0}/${campaign.counts?.total || posts.length}</strong><small>scheduled</small></div>
    </header>
    <div class="agent-campaign-summary"><span>${posts.length} complete posts</span><span>${campaign.counts?.approved || 0} approved</span><span>${campaign.counts?.needsAttention || 0} need review</span><span>${escapeHtml(campaign.status.replaceAll('_', ' '))}</span></div>
    <div class="agent-campaign-post-grid">${posts.map(post => `<article class="agent-campaign-post status-${escapeHtml(String(post.status).toLowerCase())}" data-agent-campaign-post="${escapeHtml(post.id)}" tabindex="0" role="button">
      <button class="agent-campaign-visual" type="button" data-agent-post-open="${escapeHtml(post.id)}" aria-label="Open post ${post.sequence}">${post.asset ? `<span data-agent-campaign-asset="${escapeHtml(post.asset.id)}">Loading image…</span>` : '<span class="agent-text-post-art">Aa</span>'}<i>${escapeHtml(post.format)}</i></button>
      <div class="agent-campaign-post-body"><div class="agent-post-meta"><b>POST ${post.sequence}</b><span>${escapeHtml(campaignPostStatusLabel(post.status))}</span></div><h4>${escapeHtml(post.title || `Post ${post.sequence}`)}</h4><p>${escapeHtml(post.caption).replaceAll('\n', '<br>')}</p><small>${escapeHtml(post.page?.name || 'Facebook Page')} · ${escapeHtml(new Date(post.scheduledAt).toLocaleString())}</small></div>
      <footer><button type="button" class="btn ghost compact" data-agent-post-open="${escapeHtml(post.id)}">Review &amp; edit</button>${!['SCHEDULED','PUBLISHED','SCHEDULING'].includes(post.status) ? `<button type="button" class="btn secondary compact" data-agent-post-approve="${escapeHtml(post.id)}">${post.status === 'APPROVED' ? 'Approved ✓' : 'Approve'}</button>` : '<span class="agent-post-scheduled">Scheduled ✓</span>'}</footer>
    </article>`).join('')}</div>
    <footer class="agent-campaign-actions"><div><strong>${allScheduled ? 'Campaign scheduled' : 'Final owner checkpoint'}</strong><span>${allScheduled ? 'All posts were accepted by Facebook.' : 'You can edit and approve posts individually, or approve every review-ready post and schedule the campaign.'}</span></div>${allScheduled ? '<button class="btn primary" type="button" disabled>Scheduled ✓</button>' : `<button id="btnAgentApproveScheduleCampaign" class="btn primary" type="button">${readyToSchedule ? 'Schedule approved posts' : 'Approve all &amp; schedule'}</button>`}</footer>
  </section>`;
}

function findAgentCampaignPost(postId) {
  return selectedAgentPlan()?.campaign?.posts?.find(post => post.id === postId) || null;
}

async function hydrateAgentCampaignImages(root) {
  root?.querySelectorAll('[data-agent-campaign-asset]').forEach(async target => {
    const url = await window.schedulerApi.getAgentAssetUrl(target.dataset.agentCampaignAsset).catch(() => '');
    if (url && target.isConnected) target.innerHTML = `<img src="${escapeHtml(url)}" alt="Generated post visual">`;
  });
}

async function openAgentPostEditor(postId) {
  const post = findAgentCampaignPost(postId);
  const modal = document.getElementById('agentPostEditor');
  if (!post || !modal) return;
  agentEditingPostId = post.id;
  modal.dataset.campaignId = selectedAgentPlan().campaign.id;
  document.getElementById('agentPostEditorNumber').textContent = `Post ${post.sequence}`;
  document.getElementById('agentPostEditorStatus').textContent = campaignPostStatusLabel(post.status);
  document.getElementById('agentPostEditorTitle').value = post.title || '';
  document.getElementById('agentPostEditorCaption').value = post.caption || '';
  document.getElementById('agentPostEditorAlt').value = post.altText || '';
  document.getElementById('agentPostEditorVisualBrief').value = post.visualBrief || '';
  const schedule = localScheduleParts(post.scheduledAt);
  document.getElementById('agentPostEditorDate').value = schedule.date;
  document.getElementById('agentPostEditorClock').value = schedule.time;
  document.getElementById('agentPostEditorPage').textContent = post.page?.name || 'Facebook Page';
  const scheduledTime = new Date(post.scheduledAt).getTime();
  const scheduleExpired = !Number.isFinite(scheduledTime) || scheduledTime < Date.now() + 10 * 60 * 1000;
  const campaignTimezone = selectedAgentPlan()?.campaign?.timezone || 'Europe/London';
  document.getElementById('agentPostEditorReason').textContent = scheduleExpired ? 'Choose a new future publishing date and time before approval.' : `Timezone: ${campaignTimezone}. You can change this schedule before approval.`;
  document.getElementById('agentPostImagePrompt').value = post.asset?.customerPrompt || '';
  document.getElementById('agentPostImageOverlay').value = post.asset?.exactOverlayText || '';
  document.getElementById('agentPostImageQuality').value = post.asset?.generationChoice === 'IMAGE_FAST' ? 'IMAGE_FAST' : 'IMAGE_QUALITY';
  const qualityStatus = document.getElementById('agentPostImageQualityStatus');
  const qualityReview = post.asset?.qualityReview;
  if (qualityStatus) {
    const waitingMessage = post.status === 'WAITING_MEDIA' ? post.lastError : '';
    const issues = qualityReview?.issues?.join('; ') || '';
    const legacyReviewRequired = post.format !== 'TEXT' && post.asset && !qualityReview ? 'Regenerate this earlier image once under the new visual quality gate before approval.' : '';
    qualityStatus.textContent = waitingMessage || legacyReviewRequired || (qualityReview?.approved ? `Visual review passed${Number.isFinite(qualityReview.score) ? ` · ${qualityReview.score}/100` : ''}.` : issues);
    qualityStatus.className = `agent-image-quality-status${qualityStatus.textContent ? ` visible ${qualityReview?.approved && !waitingMessage ? 'pass' : 'fail'}` : ''}`;
  }
  const visual = document.getElementById('agentPostEditorVisual');
  visual.innerHTML = post.asset ? '<span>Loading full preview…</span>' : '<span class="agent-text-post-art">Aa</span>';
  if (post.asset) {
    const url = await window.schedulerApi.getAgentAssetUrl(post.asset.id).catch(() => '');
    if (url && agentEditingPostId === post.id) visual.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(post.altText || 'Generated campaign visual')}">`;
  }
  const locked = ['SCHEDULED', 'PUBLISHED', 'SCHEDULING'].includes(post.status);
  modal.querySelectorAll('input, textarea, select').forEach(field => { field.disabled = locked; });
  document.getElementById('btnAgentPostSave').disabled = locked;
  document.getElementById('btnAgentPostRegenerate').disabled = locked;
  const mediaNeedsReview = post.format !== 'TEXT' && (!post.asset || post.status === 'WAITING_MEDIA' || qualityReview?.approved !== true);
  document.getElementById('btnAgentPostApprove').disabled = locked || post.status === 'APPROVED' || mediaNeedsReview || scheduleExpired;
  document.getElementById('btnAgentPostApprove').textContent = post.status === 'APPROVED' ? 'Approved ✓' : 'Approve post';
  modal.classList.remove('hidden');
}

function closeAgentPostEditor() {
  document.getElementById('agentPostEditor')?.classList.add('hidden');
  agentEditingPostId = '';
}

async function saveAgentCampaignPost() {
  const plan = selectedAgentPlan();
  if (!plan?.campaign || !agentEditingPostId) return;
  const button = document.getElementById('btnAgentPostSave');
  button.disabled = true;
  try {
    const result = await window.schedulerApi.updateAgentCampaignPost(plan.campaign.id, agentEditingPostId, agentPostEditorUpdate());
    setSelectedAgentCampaign(result.campaign);
    renderAgentWorkspace();
    await openAgentPostEditor(agentEditingPostId);
    toast(result.notice || 'Post saved.');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

async function approveAgentCampaignPost(postId = agentEditingPostId) {
  const plan = selectedAgentPlan();
  if (!plan?.campaign || !postId) return;
  try {
    if (agentEditingPostId === postId) {
      const saved = await window.schedulerApi.updateAgentCampaignPost(plan.campaign.id, postId, agentPostEditorUpdate());
      setSelectedAgentCampaign(saved.campaign);
    }
    const result = await window.schedulerApi.approveAgentCampaignPost(plan.campaign.id, postId);
    setSelectedAgentCampaign(result.campaign);
    renderAgentWorkspace();
    if (agentEditingPostId) await openAgentPostEditor(postId);
    toast(result.notice || 'Post approved.');
  } catch (error) { toast(error.message, true); }
}

async function regenerateAgentCampaignPostImage() {
  const plan = selectedAgentPlan();
  if (!plan?.campaign || !agentEditingPostId) return;
  const customerPrompt = document.getElementById('agentPostImagePrompt')?.value?.trim() || '';
  const overlayText = document.getElementById('agentPostImageOverlay')?.value?.trim() || '';
  const generationChoice = document.getElementById('agentPostImageQuality')?.value || 'IMAGE_QUALITY';
  const confirmed = await showStudioConfirm({ eyebrow: 'Creative replacement', title: 'Regenerate with these instructions?', message: customerPrompt || 'The AI visual plan will be used with strict text-free generation and brand safeguards. The current image remains until the replacement passes visual review.', tone: 'warning', confirmText: 'Generate replacement' });
  if (!confirmed) return;
  const postId = agentEditingPostId;
  const button = document.getElementById('btnAgentPostRegenerate');
  button.disabled = true;
  button.textContent = 'Creating and checking…';
  try {
    const result = await window.schedulerApi.regenerateAgentCampaignPostImage(plan.campaign.id, postId, { customerPrompt, overlayText, generationChoice });
    setSelectedAgentCampaign(result.campaign);
    renderAgentWorkspace();
    await openAgentPostEditor(postId);
    toast(result.notice || 'New image generated.');
  } catch (error) { toast(error.message, true); }
  finally {
    button.disabled = false;
    button.textContent = 'Create image';
  }
}

async function approveAndScheduleAgentCampaign() {
  const plan = selectedAgentPlan();
  const campaign = plan?.campaign;
  if (!campaign) return;
  const confirmed = await showStudioConfirm({
    eyebrow: 'Final publishing checkpoint',
    title: 'Approve and schedule this campaign?',
    message: `INX Social will approve review-ready posts and send the approved ${campaign.posts?.length || 0}-post schedule to the selected Facebook Page connections. This creates real scheduled posts.`,
    metrics: [{ label: 'Posts', value: campaign.posts?.length || 0 }, { label: 'Timezone', value: campaign.timezone }],
    tone: 'warning', confirmText: 'Approve & schedule'
  });
  if (!confirmed) return;
  const button = document.getElementById('btnAgentApproveScheduleCampaign');
  if (button) { button.disabled = true; button.textContent = 'Scheduling…'; }
  try {
    let current = campaign;
    if (campaign.posts.some(post => !['APPROVED','SCHEDULED','PUBLISHED','SCHEDULE_FAILED'].includes(post.status))) {
      const approved = await window.schedulerApi.approveAgentCampaign(campaign.id);
      current = approved.campaign;
      setSelectedAgentCampaign(current);
    }
    const result = await window.schedulerApi.scheduleAgentCampaign(current.id);
    setSelectedAgentCampaign(result.campaign);
    renderAgentWorkspace();
    toast(result.notice || 'Campaign scheduling completed.', Boolean(result.results?.some(item => !item.ok)));
  } catch (error) { toast(error.message, true); }
  finally { if (button?.isConnected) { button.disabled = false; button.textContent = 'Approve all & schedule'; } }
}

function renderAgentWorkspace() {
  const workspace = document.getElementById('agentPlanWorkspace');
  if (!workspace) return;
  const uiSnapshot = captureAgentWorkspaceUi(workspace);
  const plans = agentOverview?.plans || [];
  renderAgentIntelligence();
  if (!plans.length) {
    workspace.innerHTML = '<div class="workspace-empty">Mission Control is online. Enter an instruction to begin.</div>';
    return;
  }
  const plan = selectedAgentPlan();
  if (!plan) {
    const missionStatus = document.getElementById('agentMissionStatus');
    if (missionStatus) missionStatus.textContent = agentPreparingMission ? 'Preparing new mission' : 'Ready for a mission';
    workspace.innerHTML = `<section class="agent-cleared-state"><span>${agentPreparingMission ? 'PREPARING' : 'WORKSPACE CLEARED'}</span><h3>${agentPreparingMission ? 'Understanding your new mission…' : 'The cancelled mission has been cleared'}</h3><p>${agentPreparingMission ? 'INX Agent is checking whether it has enough information to begin. Detailed instructions continue automatically without unnecessary questions.' : 'Its audit record remains available, but its old task list and action warnings are no longer shown as active work.'}</p>${agentPreparingMission ? '<div class="agent-preflight-progress"><i></i></div>' : ''}</section>`;
    return;
  }
  activeAgentPlanId = plan.id;
  const mode = plan.operationMode === 'AUTOPILOT' ? 'Autopilot' : 'Hybrid';
  const canApprove = plan.operationMode !== 'AUTOPILOT' && plan.status === 'AWAITING_APPROVAL';
  const canResume = !['CANCELLED', 'COMPLETED', 'RUNNING', 'QUEUED', 'AWAITING_APPROVAL'].includes(plan.status);
  const completed = (plan.tasks || []).filter(item => item.status === 'COMPLETED').length;
  const running = (plan.tasks || []).filter(item => ['RUNNING', 'QUEUED'].includes(item.status)).length;
  const waiting = (plan.tasks || []).filter(item => String(item.status).startsWith('WAITING') || item.status === 'ACTION_REQUIRED').length;
  const totalTasks = plan.tasks?.length || 0;
  const progressPercent = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;
  const queueIds = agentOverview?.runtime?.queuedPlanIds || [];
  const queuePosition = queueIds.indexOf(plan.id) + 1;
  const usage = agentOverview?.usage || state?.account?.features?.socialAgent?.usage || {};
  const usageLimit = usage.limit === null ? 'Unlimited' : Number(usage.limit || 0).toLocaleString();
  const usageRemaining = usage.remaining === null ? 'Unlimited' : Number(usage.remaining || 0).toLocaleString();
  const periodEnd = usage.periodEnd ? new Date(usage.periodEnd).toLocaleDateString() : 'Plan period';
  const pageTargets = plan.strategy?.pageTargets || [];
  const recoverableCampaign = !plan.campaign && (plan.tasks || []).some(task => task.type === 'COPY_GENERATION' && task.status === 'COMPLETED');
  const missionComplete = item => item.status === 'COMPLETED' || ['SCHEDULED', 'PUBLISHED'].includes(item.campaign?.status);
  const missionQueue = plans
    .filter(item => !['CANCELLED'].includes(item.status) && !missionComplete(item))
    .slice(0, 8);
  const completedMissions = plans.filter(missionComplete).slice(0, 12);
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
      <details class="agent-completed-missions" ${missionComplete(plan) ? 'open' : ''}><summary><span>Completed missions</span><b>${completedMissions.length}</b><small>Scheduled campaigns remain saved and reopenable</small></summary><div class="agent-mission-queue completed">${completedMissions.length ? completedMissions.map(item => `<button type="button" data-agent-plan-id="${escapeHtml(item.id)}" class="agent-queue-card completed ${item.id === plan.id ? 'selected' : ''}"><span>✓</span><div><strong>${escapeHtml(item.prompt.slice(0, 72))}</strong><small>${escapeHtml(new Date(item.completedAt || item.updatedAt).toLocaleString())} · ${item.campaign?.posts?.length || 0} post${item.campaign?.posts?.length === 1 ? '' : 's'}</small></div><i></i></button>`).join('') : '<div class="workspace-empty">Successfully scheduled Autopilot and Hybrid missions will appear here.</div>'}</div></details>
      <label>Recent plans<select id="agentPlanSelect">${plans.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === plan.id ? 'selected' : ''}>${escapeHtml(new Date(item.createdAt).toLocaleDateString())} — ${escapeHtml(item.prompt.slice(0, 58))}</option>`).join('')}</select></label>
      <div class="agent-plan-top"><div><strong>${escapeHtml(plan.prompt)}</strong><p>${escapeHtml((plan.platforms || []).join(', '))} · ${escapeHtml(mode)} organic automation</p>${pageTargets.length ? `<div class="agent-plan-page-chips">${pageTargets.map(page => `<span>${escapeHtml(page.name)}</span>`).join('')}</div>` : ''}</div><div class="agent-plan-badges"><span class="agent-mode-badge">${mode}</span><span class="agent-plan-status status-${escapeHtml(String(plan.status).toLowerCase())}">${escapeHtml(plan.status.replaceAll('_', ' '))}</span></div></div>
      <div class="agent-plan-metrics"><div><span>Current plan</span><strong>${escapeHtml(agentOverview?.license?.plan || 'TRIAL')}</strong><small>Social Agent access</small></div><div><span>Agent missions used</span><strong>${Number(usage.used || 0).toLocaleString()} / ${usageLimit}</strong><small>this plan period</small></div><div><span>Remaining</span><strong>${usageRemaining}</strong><small>new missions available</small></div><div><span>Usage resets</span><strong>${escapeHtml(periodEnd)}</strong><small>${completed}/${plan.tasks?.length || 0} tasks complete · ${running} active · ${waiting} waiting</small></div></div>
      ${plan.lastError ? `<div class="agent-runtime-error">${escapeHtml(plan.lastError)}</div>` : ''}
      ${recoverableCampaign ? '<section class="agent-action-centre"><header><div><span>POST READY TO RECOVER</span><strong>Open the completed customer-facing post</strong></div><b>!</b></header><article><div class="agent-action-icon">!</div><div><strong>Campaign Review was not assembled</strong><p>The earlier mission completed internal AI tasks without displaying its caption and image. Open Campaign Review to recover the saved work.</p><small>This mission will not be treated as successfully delivered until its post is visible.</small></div><button type="button" class="btn primary compact" data-agent-campaign-review>Open Campaign Review</button></article></section>' : ''}
      ${renderAgentActionCentre(plan.tasks || [])}
      ${renderAgentCampaignReview(plan.campaign)}
      <section class="agent-task-board"><header><div><span>MISSION TASKS</span><strong>${escapeHtml(plan.prompt.slice(0, 90))}</strong></div><div class="agent-overall-progress"><b>${progressPercent}%</b><small>${completed} of ${totalTasks} complete</small></div></header><div class="agent-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}"><i style="width:${progressPercent}%"></i></div>
      <div class="agent-task-list">${(plan.tasks || []).map(item => {
        const status = String(item.status || 'PENDING').toLowerCase();
        return `<button type="button" class="agent-task agent-task-row status-${escapeHtml(status)}" data-agent-task-detail="${escapeHtml(item.id)}"><span>${item.sequence}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(agentTaskStatusLabel(item.status))}</small><i aria-hidden="true">›</i></button>`;
      }).join('')}</div></section>
      <div class="agent-plan-actions"><button id="btnAgentCancelPlan" class="btn ghost subtle-danger" type="button" ${['CANCELLED','COMPLETED'].includes(plan.status) ? 'disabled' : ''}>Cancel mission</button>${canResume ? '<button id="btnAgentResumePlan" class="btn secondary" type="button">Resume mission</button>' : ''}${canApprove ? '<button id="btnAgentApprovePlan" class="btn primary" type="button">Approve &amp; run</button>' : ''}</div>
    </div>`;
  document.getElementById('agentPlanSelect')?.addEventListener('change', event => { activeAgentPlanId = event.target.value; renderAgentWorkspace(); });
  workspace.querySelectorAll('[data-agent-plan-id]').forEach(button => button.addEventListener('click', () => { activeAgentPlanId = button.dataset.agentPlanId; renderAgentWorkspace(); }));
  workspace.querySelectorAll('[data-agent-action-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.agentActionView)));
  workspace.querySelectorAll('[data-agent-action-resume]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); resumeAgentPlan(); }));
  workspace.querySelectorAll('[data-agent-campaign-review]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); openAgentCampaignReview(); }));
  workspace.querySelectorAll('[data-agent-task-detail]').forEach(target => {
    target.addEventListener('click', event => { if (!event.target.closest('[data-agent-action-view],[data-agent-action-resume],[data-agent-campaign-review]')) openAgentTaskDetail(target.dataset.agentTaskDetail); });
    target.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') openAgentTaskDetail(target.dataset.agentTaskDetail); });
  });
  document.getElementById('btnAgentApprovePlan')?.addEventListener('click', approveAgentPlan);
  document.getElementById('btnAgentResumePlan')?.addEventListener('click', resumeAgentPlan);
  document.getElementById('btnAgentCancelPlan')?.addEventListener('click', cancelAgentPlan);
  document.getElementById('btnAgentApproveScheduleCampaign')?.addEventListener('click', approveAndScheduleAgentCampaign);
  workspace.querySelectorAll('[data-agent-post-open]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); openAgentPostEditor(button.dataset.agentPostOpen); }));
  workspace.querySelectorAll('[data-agent-post-approve]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); approveAgentCampaignPost(button.dataset.agentPostApprove); }));
  workspace.querySelectorAll('[data-agent-campaign-post]').forEach(card => {
    card.addEventListener('click', () => openAgentPostEditor(card.dataset.agentCampaignPost));
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') openAgentPostEditor(card.dataset.agentCampaignPost); });
  });
  hydrateAgentCampaignImages(workspace);
  workspace.querySelectorAll('[data-agent-generated-asset]').forEach(async target => {
    const url = await window.schedulerApi.getAgentAssetUrl(target.dataset.agentGeneratedAsset).catch(() => '');
    if (url && target.isConnected) target.innerHTML = `<img src="${escapeHtml(url)}" alt="Generated campaign image"><span>Open generated image</span>`;
    target.addEventListener('click', () => { if (url) window.open(url, '_blank', 'noopener,noreferrer'); });
  });
  restoreAgentWorkspaceUi(workspace, uiSnapshot);
}

function renderAgentIntelligence() {
  const brain = agentOverview?.capabilities?.brain || {};
  const brainStatus = document.getElementById('agentBrainStatus');
  if (brainStatus) brainStatus.textContent = brain.ready ? 'INX Agent is online' : (brain.message || 'INX Agent connection required');
  const plan = selectedAgentPlan();
  const deck = document.querySelector('.jarvis-command-deck');
  deck?.classList.toggle('brain-offline', !brain.ready);
  ['running','queued','waiting','completed','failed'].forEach(name => deck?.classList.remove(`brain-${name}`));
  const visualState = String(plan?.status || '').toLowerCase().replace('_provider','').replace('_review','');
  if (visualState) deck?.classList.add(`brain-${visualState}`);
  const core = document.getElementById('agentMissionCore');
  if (core) core.querySelector('small').textContent = plan?.status ? String(plan.status).replaceAll('_', ' ') : (brain.ready ? 'READY' : 'OFFLINE');
  const feed = document.getElementById('agentLiveFeed');
  const events = [...(plan?.events || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (feed) {
    const signature = `${plan?.id || 'none'}:${events.map(item => `${item.id}:${item.status}`).join('|')}`;
    if (signature !== agentTimelineSignature) {
      const previousScroll = feed.scrollTop;
      const nearBottom = feed.scrollHeight - feed.clientHeight - feed.scrollTop < 32;
      feed.innerHTML = events.length ? events.map((item,index) => `<article class="agent-feed-event timeline-event status-${escapeHtml(String(item.status).toLowerCase())} ${index===events.length-1?'latest':''}"><div class="timeline-stamp"><time>${escapeHtml(new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</time><i></i></div><div class="timeline-content"><header><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(agentTaskStatusLabel(item.status))}</span></header><p>${escapeHtml(item.message)}</p><footer><b>${escapeHtml(String(item.type || 'MISSION').replaceAll('_', ' '))}</b><small>${escapeHtml(new Date(item.createdAt).toLocaleDateString())}</small></footer></div></article>`).join('') : '<div class="workspace-empty">No runtime events yet.</div>';
      agentTimelineSignature = signature;
      requestAnimationFrame(() => { feed.scrollTop = nearBottom ? feed.scrollHeight : previousScroll; });
    }
  }
  const tasks = plan?.tasks || [];
  const intelligence = document.getElementById('agentMissionIntelligence');
  if (intelligence) {
    const research = tasks.find(item => item.type === 'WEB_RESEARCH');
    const created = tasks.filter(item => item.status === 'COMPLETED');
    const remaining = tasks.find(item => !['COMPLETED','CANCELLED'].includes(item.status));
    const sources = research?.output?.sources || [];
    intelligence.innerHTML = plan ? `<div class="mission-intelligence-grid">
      <article><span>AI UNDERSTOOD</span><p>${escapeHtml(plan.prompt.split('Customer clarification:')[0].trim().slice(0, 240))}</p></article>
      <article><span>CURRENT RESEARCH</span><p>${escapeHtml(research?.output?.summary || research?.output?.message || 'Research has not completed yet.')}</p>${sources.length ? `<small>${sources.length} source link${sources.length === 1 ? '' : 's'} saved</small>` : ''}</article>
      <article><span>CREATED</span><p>${created.length ? escapeHtml(created.map(item => item.title).slice(-3).join(' · ')) : 'No task output saved yet.'}</p></article>
      <article><span>NEXT DECISION</span><p>${escapeHtml(remaining?.title || 'Review the completed mission outputs.')}</p></article>
    </div>` : '<div class="workspace-empty">Launch a mission to see its intelligence summary.</div>';
  }
  const activeTask = tasks.find(item => item.status === 'RUNNING') || tasks.find(item => ['QUEUED','PENDING'].includes(item.status)) || tasks.find(item => String(item.status).startsWith('WAITING') || item.status === 'ACTION_REQUIRED');
  const activeIndex = activeTask ? tasks.indexOf(activeTask) : -1;
  const nextTask = activeIndex >= 0 ? tasks.slice(activeIndex + 1).find(item => !['COMPLETED','CANCELLED'].includes(item.status)) : tasks.find(item => !['COMPLETED','CANCELLED'].includes(item.status));
  const completedCount = tasks.filter(item => item.status === 'COMPLETED').length;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const blocked = activeTask && (String(activeTask.status).startsWith('WAITING') || activeTask.status === 'ACTION_REQUIRED');
  const phases = [
    ['Plan', ['BRAND_REVIEW','CONTENT_STRATEGY','PAGE_SETUP']],
    ['Create', ['MEDIA_GENERATION','IMAGE_GENERATION','VIDEO_GENERATION','COPY_GENERATION','PLATFORM_VARIANT']],
    ['Schedule', ['SCHEDULE']],
    ['Publish', ['PUBLISH']],
    ['Learn', ['ANALYTICS']]
  ];
  const count = document.getElementById('agentMemoryCount');
  if (count) count.textContent = activeTask ? String(activeTask.status).replaceAll('_', ' ') : (plan ? 'IDLE' : 'READY');
  const grid = document.getElementById('agentMemoryGrid');
  const monitorSignature = `${plan?.id || 'none'}:${activeTask?.id || 'none'}:${activeTask?.status || 'idle'}:${nextTask?.id || 'none'}:${progress}`;
  if (grid && monitorSignature !== agentMonitorSignature) grid.innerHTML = plan ? `<div class="agent-monitor-hud">
    <div class="agent-progress-orb" style="--mission-progress:${progress * 3.6}deg"><span>${progress}%</span><small>complete</small></div>
    <div class="agent-monitor-state"><span>${blocked ? 'BLOCKED' : activeTask ? 'WORKING' : progress === 100 ? 'COMPLETE' : 'READY'}</span><strong>${escapeHtml(activeTask?.title || (progress === 100 ? 'Mission completed' : 'Awaiting the next runnable step'))}</strong><p>${escapeHtml(activeTask?.output?.message || activeTask?.description || 'Mission Control is synchronized.')}</p></div>
  </div>
  <div class="agent-phase-track">${phases.map(([label, types]) => { const related = tasks.filter(item => types.includes(item.type)); const done = related.length && related.every(item => item.status === 'COMPLETED'); const current = activeTask && types.includes(activeTask.type); return `<span class="${done ? 'done' : current ? 'current' : ''}"><i></i><b>${label}</b></span>`; }).join('')}</div>
  <div class="agent-monitor-cards">
    <article class="monitor-now"><span>NOW</span><strong>${escapeHtml(activeTask?.title || 'No active task')}</strong><p>${escapeHtml(activeTask ? (blocked ? 'Independent AI work continues while this dependency waits.' : 'The agent is executing this task now.') : 'All currently available work has been processed.')}</p></article>
    <article class="monitor-next"><span>NEXT</span><strong>${escapeHtml(nextTask?.title || (progress === 100 ? 'Review saved results' : 'Await runtime update'))}</strong><p>${escapeHtml(nextTask?.description || 'Mission outputs remain available in the task list and timeline.')}</p></article>
  </div>${agentOverview?.pendingMemoryCount ? `<div class="thinking-learning">${agentOverview.pendingMemoryCount} reusable learning candidate(s) await administrator review.</div>` : ''}` : '<div class="workspace-empty">Launch a mission to see live execution progress.</div>';
  if (grid) agentMonitorSignature = monitorSignature;
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
    toast('Checking the full Railway-to-Mac agent connection…');
    const providerResult = await window.schedulerApi.getAgentProviderHealth(true);
    agentOverview.capabilities.brain = providerResult.health;
    renderAgentWorkspace();
    if (!providerResult.health?.ready) {
      toast(providerResult.health?.message || 'The private INX Agent is not ready.', true);
      return;
    }
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
    activeAgentPlanId = '__none__';
    renderAgentWorkspace();
    toast('Mission cancelled and cleared from the active workspace.');
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
  renderPostsWorkspace();
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
  renderDashboardQueue();
  renderDashboardCalendar();
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
    else if (!stats.videos || !stats.captions) hint.textContent = 'Open Bulk Scheduler to select videos and captions.';
    else hint.textContent = 'Create a Bulk Scheduler upload to begin.';
  }
}

function renderDashboardQueue() {
  const root = document.getElementById('dashboardContentQueue');
  if (!root || !state) return;
  const jobs = [...(state.jobs || [])]
    .sort((a, b) => new Date(b.scheduledAtISO || b.createdAt || 0) - new Date(a.scheduledAtISO || a.createdAt || 0))
    .slice(0, 6);
  if (!jobs.length) {
    root.innerHTML = '<div class="dashboard-empty-state"><span>＋</span><strong>Your queue is clear</strong><p>Create a post, import files in Bulk Scheduler or ask AI Content Studio to prepare a campaign.</p></div>';
    return;
  }
  root.innerHTML = jobs.map(job => {
    const status = String(job.status || 'planned');
    const statusClass = status.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const when = job.publishMode === 'NOW'
      ? 'Publish immediately'
      : (job.slotLabel || formatDate(job.scheduledAtISO));
    const name = job.videoName || job.title || 'Scheduled Facebook content';
    return `<article class="dashboard-queue-item">
      <span class="dashboard-queue-media" aria-hidden="true">▶</span>
      <div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(when)}</small></div>
      <span class="dashboard-queue-type">Facebook</span>
      <span class="status ${escapeHtml(statusClass)}">${escapeHtml(statusLabel(status))}</span>
    </article>`;
  }).join('');
}

function dashboardCalendarItems() {
  const localJobs = (state?.jobs || []).filter(job => job.scheduledAtISO).map(job => ({
    date: new Date(job.scheduledAtISO),
    title: job.videoName || job.title || 'Scheduled content',
    status: statusLabel(job.status),
    source: 'INX',
    metaId: String(job.metaPostId || job.metaVideoId || '')
  }));
  const localMetaIds = new Set(localJobs.map(item => item.metaId).filter(Boolean));
  const facebookItems = (metaScheduledPosts || [])
    .filter(post => post.is_published !== true && !localMetaIds.has(String(post.id || '')))
    .map(post => ({ date: scheduledPostDate(post), title: calendarPostLabel(post), status: 'Scheduled', source: 'Facebook' }));
  return [...localJobs, ...facebookItems]
    .filter(item => !Number.isNaN(item.date.getTime()))
    .sort((a, b) => a.date - b.date);
}

function renderDashboardCalendar() {
  const root = document.getElementById('dashboardCalendarMini');
  if (!root || !state) return;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7));
  const items = dashboardCalendarItems();
  const counts = items.reduce((result, item) => {
    const key = localDateKey(item.date);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const monthTitle = document.getElementById('dashboardCalendarMonth');
  if (monthTitle) monthTitle.textContent = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const dayCells = Array.from({ length: 35 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = localDateKey(date);
    const count = counts[key] || 0;
    const classes = [date.getMonth() !== now.getMonth() ? 'outside' : '', key === localDateKey(now) ? 'today' : '', count ? 'has-content' : ''].filter(Boolean).join(' ');
    return `<span class="${classes}" title="${count ? `${count} scheduled item${count === 1 ? '' : 's'}` : 'No scheduled content'}"><b>${date.getDate()}</b>${count ? `<i>${count}</i>` : ''}</span>`;
  }).join('');
  const upcoming = items.filter(item => item.date >= now).slice(0, 4);
  root.innerHTML = `<div class="dashboard-calendar-weekdays"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
    <div class="dashboard-calendar-days">${dayCells}</div>
    <div class="dashboard-upcoming-list">${upcoming.length ? upcoming.map(item => `<article><time>${escapeHtml(item.date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }))}<strong>${escapeHtml(item.date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))}</strong></time><div><strong>${escapeHtml(shorten(item.title, 54))}</strong><small>${escapeHtml(item.source)} · ${escapeHtml(item.status)}</small></div></article>`).join('') : '<p>No upcoming scheduled content.</p>'}</div>`;
}

function renderDashboardPage() {
  const pages = (cloudWorkspace?.pages || []).filter(page => page.status !== 'REVOKED');
  setText('dashboardPageName', pages.length ? `${pages.length} connected Page${pages.length === 1 ? '' : 's'}` : 'No Pages connected');
  setText('dashboardPageCategory', 'Choose destinations separately for every post');
  renderPageAvatar('dashboardPageAvatar', pages[0] || null);
  const status = document.getElementById('dashboardPageStatus');
  if (!status) return;
  status.className = `dashboard-connected-state ${pages.length ? 'connected' : 'waiting'}`;
  status.innerHTML = pages.length ? '<i></i> Ready for multi-Page publishing' : '<i></i> Connect a Page';
}

function renderDirectPostPageTargets(pages = cloudWorkspace?.pages || []) {
  const grid = document.getElementById('directPostPageGrid');
  const available = (pages || []).filter(page => page.status !== 'REVOKED');
  for (const id of [...directPostPageIds]) if (!available.some(page => page.id === id)) directPostPageIds.delete(id);
  if (!directPostPageIds.size && available.length === 1) directPostPageIds.add(available[0].id);
  if (grid) {
    grid.innerHTML = available.length ? available.map(page => `<label class="direct-post-page ${directPostPageIds.has(page.id) ? 'selected' : ''}"><input type="checkbox" value="${escapeHtml(page.id)}" ${directPostPageIds.has(page.id) ? 'checked' : ''}><span data-page-picture-id="${escapeHtml(page.id)}"><b>f</b></span><em><strong>${escapeHtml(page.facebookPageName)}</strong><small>${escapeHtml(page.facebookCategory || 'Facebook Page')}</small></em><i>✓</i></label>`).join('') : '<div class="workspace-empty">Connect a Facebook Page before creating a post.</div>';
    grid.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      if (input.checked) directPostPageIds.add(input.value); else directPostPageIds.delete(input.value);
      renderDirectPostPageTargets();
      renderDirectPostComposer();
    }));
    hydratePagePictures(grid);
  }
  setText('directPostPageCount', `${directPostPageIds.size} selected`);
}

function setDirectPostPages(selectAll) {
  directPostPageIds.clear();
  if (selectAll) (cloudWorkspace?.pages || []).filter(page => page.status !== 'REVOKED').forEach(page => directPostPageIds.add(page.id));
  renderDirectPostPageTargets();
  renderDirectPostComposer();
}

function directPostType() {
  return document.querySelector('input[name="directPostType"]:checked')?.value || 'TEXT';
}

function renderDirectPostComposer() {
  const type = directPostType();
  const mode = document.querySelector('input[name="directPublishMode"]:checked')?.value || 'NOW';
  const caption = String(document.getElementById('directPostCaption')?.value || '');
  setText('directPostCharacterCount', `${caption.length.toLocaleString()} / 5,000`);
  document.getElementById('directPostMediaBox')?.classList.toggle('hidden', type === 'TEXT');
  document.getElementById('directPostScheduleFields')?.classList.toggle('hidden', mode !== 'SCHEDULED');
  const mediaPreview = document.getElementById('directPostMediaPreview');
  if (mediaPreview && type !== 'TEXT') {
    if (directPostMedia) {
      mediaPreview.innerHTML = `${type === 'IMAGE' ? `<img src="${escapeHtml(directPostMedia.previewUrl)}" alt="Selected post image preview">` : `<video src="${escapeHtml(directPostMedia.previewUrl)}" muted controls preload="metadata"></video>`}<div><strong>${escapeHtml(directPostMedia.name)}</strong><small>${formatBytes(directPostMedia.size)}</small></div>`;
    } else {
      mediaPreview.innerHTML = `<span>＋</span><strong>Add ${type === 'IMAGE' ? 'an image' : 'a video'}</strong><small>${type === 'IMAGE' ? 'PNG, JPG or WebP · maximum 15 MB' : 'MP4, MOV, M4V, AVI, MKV or WebM'}</small>`;
    }
  }
  const summary = document.getElementById('directPostSummary');
  const publish = document.getElementById('btnDirectPostPublish');
  const ready = directPostPageIds.size > 0 && caption.trim().length > 0 && (type === 'TEXT' || directPostMedia);
  if (summary) summary.textContent = !directPostPageIds.size ? 'Choose at least one destination Page.' : !caption.trim() ? 'Write the caption your audience will see.' : type !== 'TEXT' && !directPostMedia ? `Choose ${type === 'IMAGE' ? 'an image' : 'a video'} for this post.` : `${mode === 'NOW' ? 'Ready to publish' : 'Ready to schedule'} ${type.toLowerCase()} content to ${directPostPageIds.size} Page${directPostPageIds.size === 1 ? '' : 's'}.`;
  if (publish) { publish.disabled = !ready; publish.textContent = mode === 'NOW' ? 'Publish now' : 'Schedule post'; }
  if (mode === 'SCHEDULED' && !document.getElementById('directPostDate')?.value) {
    const suggested = new Date(Date.now() + 60 * 60 * 1000);
    const date = document.getElementById('directPostDate');
    const time = document.getElementById('directPostTime');
    if (date) date.value = `${suggested.getFullYear()}-${String(suggested.getMonth() + 1).padStart(2, '0')}-${String(suggested.getDate()).padStart(2, '0')}`;
    if (time) time.value = `${String(suggested.getHours()).padStart(2, '0')}:${String(suggested.getMinutes()).padStart(2, '0')}`;
  }
}

function handleDirectPostTypeChange() {
  if (directPostMedia) { try { URL.revokeObjectURL(directPostMedia.previewUrl); } catch (_) {} }
  directPostMedia = null;
  renderDirectPostComposer();
}

async function chooseDirectPostMedia() {
  try {
    const selected = await window.schedulerApi.pickDirectPostMedia(directPostType());
    if (!selected) return;
    if (directPostMedia) { try { URL.revokeObjectURL(directPostMedia.previewUrl); } catch (_) {} }
    directPostMedia = selected;
    renderDirectPostComposer();
  } catch (error) { toast(error.message, true); }
}

function clearDirectPostComposer() {
  if (directPostMedia) { try { URL.revokeObjectURL(directPostMedia.previewUrl); } catch (_) {} }
  directPostMedia = null;
  directPostPageIds.clear();
  const title = document.getElementById('directPostTitle');
  const caption = document.getElementById('directPostCaption');
  if (title) title.value = '';
  if (caption) caption.value = '';
  const textType = document.querySelector('input[name="directPostType"][value="TEXT"]');
  const nowMode = document.querySelector('input[name="directPublishMode"][value="NOW"]');
  if (textType) textType.checked = true;
  if (nowMode) nowMode.checked = true;
  renderDirectPostPageTargets();
  renderDirectPostComposer();
}

async function publishDirectPost() {
  const type = directPostType();
  const mode = document.querySelector('input[name="directPublishMode"]:checked')?.value || 'NOW';
  const caption = String(document.getElementById('directPostCaption')?.value || '').trim();
  if (!directPostPageIds.size) return toast('Choose at least one destination Page.', true);
  if (!caption) return toast('Write a caption before continuing.', true);
  if (type !== 'TEXT' && !directPostMedia) return toast(`Choose ${type === 'IMAGE' ? 'an image' : 'a video'}.`, true);
  let scheduledAt = null;
  if (mode === 'SCHEDULED') {
    const date = document.getElementById('directPostDate')?.value;
    const time = document.getElementById('directPostTime')?.value;
    if (!date || !time) return toast('Choose the publishing date and time.', true);
    scheduledAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(scheduledAt.getTime())) return toast('Choose a valid publishing date and time.', true);
  }
  const pageNames = (cloudWorkspace?.pages || []).filter(page => directPostPageIds.has(page.id)).map(page => page.facebookPageName);
  const confirmed = await showStudioConfirm({ eyebrow: mode === 'NOW' ? 'Publish now' : 'Schedule post', title: `${mode === 'NOW' ? 'Publish' : 'Schedule'} on ${pageNames.length} Page${pageNames.length === 1 ? '' : 's'}?`, message: mode === 'NOW' ? 'This content will become public on every selected Page.' : `This content will be scheduled for ${scheduledAt.toLocaleString()}.`, icon: mode === 'NOW' ? '↑' : '◷', tone: 'success', details: pageNames, confirmText: mode === 'NOW' ? 'Publish now' : 'Schedule post', cancelText: 'Cancel' });
  if (!confirmed) return;
  const button = document.getElementById('btnDirectPostPublish');
  if (button) button.disabled = true;
  try {
    const result = await window.schedulerApi.publishDirectPost({ connectedPageIds: [...directPostPageIds], clientRequestId: `direct-${crypto.randomUUID()}`, title: document.getElementById('directPostTitle')?.value.trim() || null, caption, contentType: type, mediaId: directPostMedia?.id || null, publishMode: mode, scheduledAt: scheduledAt?.toISOString() || null });
    state = result.state || state;
    renderPostsWorkspace();
    const successCount = result.jobs?.length || 0;
    if (result.failures?.length) toast(`${successCount} destination${successCount === 1 ? '' : 's'} completed; ${result.failures.length} need attention in Posts.`, true);
    else toast(`${mode === 'NOW' ? 'Published' : 'Scheduled'} successfully on ${successCount} Page${successCount === 1 ? '' : 's'}.`);
    clearDirectPostComposer();
    document.getElementById('postComposer')?.classList.add('hidden');
  } catch (error) { toast(error.message, true); }
  finally { renderDirectPostComposer(); }
}

function postStatusBucket(value) {
  const status = String(value || 'DRAFT').toUpperCase();
  if (status.includes('FAIL') || status.includes('ERROR')) return 'failed';
  if (status.includes('PUBLISHED') || status === 'COMPLETED') return 'published';
  if (status.includes('SCHEDULED') || status === 'SCHEDULING' || status === 'APPROVED') return 'scheduled';
  if (['READY_FOR_REVIEW', 'WAITING_REVIEW', 'CHANGES_REQUESTED', 'WAITING_MEDIA'].includes(status)) return 'awaiting';
  return 'draft';
}

function postsWorkspaceItems() {
  const local = (state?.jobs || []).map(job => ({
    key: `job-${job.id}`,
    title: job.title || job.videoName || 'Facebook content',
    excerpt: job.caption || job.slotLabel || '',
    platform: 'Facebook',
    destination: job.facebookPageName || 'Facebook Page',
    status: postStatusBucket(job.status),
    statusLabel: statusLabel(job.status),
    date: job.scheduledAtISO || job.uploadedAt || job.createdAt,
    media: String(job.contentType || '').toUpperCase() === 'IMAGE' ? 'Image' : String(job.contentType || '').toUpperCase() === 'VIDEO' || job.videoName ? 'Video' : 'Text'
  }));
  const localMetaIds = new Set((state?.jobs || []).flatMap(job => [job.fbPostId, job.fbVideoId, job.metaPostId, job.metaVideoId]).filter(Boolean).map(String));
  const meta = (metaScheduledPosts || [])
    .filter(post => !localMetaIds.has(String(post.id || '')))
    .map(post => ({
      key: `meta-${post.id}`,
      title: calendarPostLabel(post),
      excerpt: post.message || '',
      platform: 'Facebook',
      destination: cloudWorkspace?.activePage?.facebookPageName || 'Facebook Page',
      status: post.is_published === true ? 'published' : 'scheduled',
      statusLabel: post.is_published === true ? 'Published' : 'Scheduled',
      date: scheduledPostDate(post),
      media: post.attachments?.data?.length ? 'Media' : 'Post'
    }));
  const campaign = (agentOverview?.plans || []).flatMap(plan => (plan.campaign?.posts || []).map(post => ({
    key: `campaign-${post.id}`,
    title: post.title || shorten(post.caption || plan.prompt || 'AI-created post', 76),
    excerpt: post.caption || '',
    platform: String(post.platform || 'facebook').replace(/^./, letter => letter.toUpperCase()),
    destination: post.page?.name || 'Selected destination',
    status: postStatusBucket(post.status),
    statusLabel: String(post.status || 'DRAFT').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
    date: post.scheduledAt || plan.updatedAt || plan.createdAt,
    media: post.format || 'Post'
  })));
  return [...campaign, ...local, ...meta]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function renderPostsWorkspace() {
  const root = document.getElementById('postsTable');
  if (!root) return;
  const items = postsWorkspaceItems();
  const counts = items.reduce((result, item) => {
    result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, {});
  setText('postsCountAll', items.length);
  setText('postsCountAwaiting', counts.awaiting || 0);
  setText('postsCountScheduled', counts.scheduled || 0);
  setText('postsCountPublished', counts.published || 0);
  setText('postsCountFailed', counts.failed || 0);
  const query = String(document.getElementById('postsSearchInput')?.value || '').trim().toLowerCase();
  const visible = items.filter(item => (postsWorkspaceFilter === 'all' || item.status === postsWorkspaceFilter)
    && (!query || `${item.title} ${item.excerpt} ${item.destination} ${item.platform}`.toLowerCase().includes(query)));
  if (!visible.length) {
    root.innerHTML = `<div class="posts-empty-state"><span>✦</span><strong>${items.length ? 'No posts match this view' : 'Create your first post'}</strong><p>${items.length ? 'Choose another status or clear your search.' : 'Write a direct post, add your media, choose one or several Pages and publish from this workspace.'}</p>${items.length ? '' : '<button class="btn primary compact" type="button" data-empty-create-post>+ Create New Post</button>'}</div>`;
    root.querySelector('[data-empty-create-post]')?.addEventListener('click', openNewPostWorkspace);
    return;
  }
  root.innerHTML = `<div class="posts-table-head"><span>Post</span><span>Platform</span><span>Destination</span><span>Publishing time</span><span>Status</span></div>${visible.map(item => `<article class="posts-table-row">
    <div class="posts-item-main"><span class="posts-media-icon">${escapeHtml(String(item.media || 'P').slice(0, 1).toUpperCase())}</span><div><strong>${escapeHtml(shorten(item.title, 82))}</strong><small>${escapeHtml(shorten(item.excerpt, 100))}</small></div></div>
    <span class="posts-platform"><i>f</i>${escapeHtml(item.platform)}</span>
    <span>${escapeHtml(item.destination)}</span>
    <time>${escapeHtml(item.date ? formatDate(item.date) : 'Not scheduled')}</time>
    <span class="posts-status ${escapeHtml(item.status)}"><i></i>${escapeHtml(item.statusLabel)}</span>
  </article>`).join('')}`;
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
  if (!output.dashboardTitle || ['Home', 'Overview'].includes(output.dashboardTitle)) output.dashboardTitle = 'Dashboard';
  if (!output.dashboardSubtitle || output.dashboardSubtitle === 'Schedule Facebook Reels using Auto or Manual Scheduler.') output.dashboardSubtitle = 'Plan and schedule content across your connected Pages.';
  if (!output.testFacebookButton || ['Test Active Page', 'Test Connection'].includes(output.testFacebookButton)) output.testFacebookButton = 'Test Facebook Connection';
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
  box.textContent = `Facebook connection verified: ${name} • credentials protected`;
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
  renderDashboardPage(active);
  renderReelsPageSelector(pages);
  renderDirectPostPageTargets(pages);
  const connectFacebookPage = document.getElementById('btnAddMetaAccount');
  if (connectFacebookPage && !connectFacebookPage.disabled) connectFacebookPage.textContent = '+ Connect Facebook Page';

  const accountUsageText = document.getElementById('accountUsageText');
  if (accountUsageText) accountUsageText.textContent = `${usage.connected || 0} Page${Number(usage.connected || 0) === 1 ? '' : 's'} connected · ${Math.max(0, Number(usage.limit || 0) - Number(usage.connected || 0))} available on this plan`;
  const usageBar = document.getElementById('accountUsageBar');
  if (usageBar) usageBar.style.width = `${Math.min(100, usage.limit ? (usage.connected / usage.limit) * 100 : 0)}%`;
  setText('accountPlanBadge', workspace.plan || state.account?.license?.plan || 'TRIAL');

  renderPagesV2();
  renderAnalyticsV2();
  renderAgentPageTargets();
  bindWorkspaceDynamicActions();
}

function renderReelsPageSelector(pages) {
  const grid = document.getElementById('reelsPageTargetGrid');
  const name = document.getElementById('reelsActivePageName');
  const hint = document.getElementById('reelsActivePageHint');
  const availablePages = (pages || []).filter(page => page.status !== 'REVOKED');
  for (const id of [...reelsSelectedPageIds]) if (!availablePages.some(page => page.id === id)) reelsSelectedPageIds.delete(id);
  if (!reelsSelectedPageIds.size && availablePages.length === 1) reelsSelectedPageIds.add(availablePages[0].id);
  const selected = availablePages.filter(page => reelsSelectedPageIds.has(page.id));
  if (name) name.textContent = selected.length ? `${selected.length} Page${selected.length === 1 ? '' : 's'} selected` : 'Choose one or several Pages';
  if (hint) hint.textContent = selected.length ? selected.map(page => page.facebookPageName).join(' · ') : 'This selection belongs only to this bulk session.';
  if (!grid) return;
  grid.innerHTML = availablePages.length ? availablePages.map(page => `<label class="multi-page-target ${reelsSelectedPageIds.has(page.id) ? 'selected' : ''}"><input type="checkbox" value="${escapeHtml(page.id)}" ${reelsSelectedPageIds.has(page.id) ? 'checked' : ''} ${isSchedulerRunning ? 'disabled' : ''}><span data-page-picture-id="${escapeHtml(page.id)}"><b>f</b></span><em><strong>${escapeHtml(page.facebookPageName)}</strong><small>${escapeHtml(page.facebookCategory || 'Facebook Page')}</small></em><i>✓</i></label>`).join('') : '<div class="workspace-empty">Connect a Facebook Page to start.</div>';
  grid.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
    if (input.checked) reelsSelectedPageIds.add(input.value); else reelsSelectedPageIds.delete(input.value);
    renderReelsPageSelector(cloudWorkspace?.pages || []);
    renderReelsSessionSummary();
  }));
  hydratePagePictures(grid);
}

function setReelsPageTargets(selectAll) {
  reelsSelectedPageIds.clear();
  if (selectAll) (cloudWorkspace?.pages || []).filter(page => page.status !== 'REVOKED').forEach(page => reelsSelectedPageIds.add(page.id));
  renderReelsPageSelector(cloudWorkspace?.pages || []);
  renderReelsSessionSummary();
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
  return `<article class="connected-page-card ${large ? 'large' : ''}"><div class="page-picture" data-page-picture-id="${escapeHtml(page.id)}"><span>F</span></div><div class="page-card-copy"><span>${escapeHtml(page.facebookCategory || 'Facebook Page')}</span><h3>${escapeHtml(page.facebookPageName)}</h3><p>${page.localOnly ? 'Saved on this device · reconnect once to sync' : escapeHtml(accountNameForPage(page))}</p></div><div class="page-card-state"><b>Connected</b>${!large && !page.localOnly ? `<button class="icon-danger" data-revoke-page="${escapeHtml(page.id)}" title="Disconnect Page">×</button>` : ''}</div></article>`;
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
    renderReelsPageSelector(cloudWorkspace?.pages || []);
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
