'use strict';

(() => {
  const state = {
    projects: [],
    project: null,
    canEdit: false,
    storage: null,
    analysisConfig: null,
    codegenConfig: null,
    visualConfig: null,
    phase5Capability: null,
    phase5Config: null,
    phase5Batch: null,
    phase5Running: false,
    phase5PollTimer: null,
    phase6Capability: null,
    phase6Config: null,
    phase6SelectedDeliveryId: null,
    phase6Busy: false,
    agentConfig: null,
    agentMessages: [],
    agentBusy: false,
    workflowStage: null,
    sideTab: 'INSPECTOR',
    finalizingCode: false,
    pipelineBusy: false,
    pipelineStep: null,
    pipelineError: null,
    analysing: false,
    generating: false,
    visualRunning: false,
    generationDetail: null,
    selectedGeneratedFile: null,
    visualRender: null,
    visualFrame: null,
    autoRepairEnabled: true,
    viewport: 'DESKTOP',
    zoom: 'fit',
    overlay: false,
    localObjectUrl: null,
    selectedFile: null,
    selectedDimensions: null
  };

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const fmtDate = value => value ? new Date(value).toLocaleString() : '—';
  const bytes = value => {
    const size = Number(value || 0);
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
    return (size / 1024 / 1024).toFixed(1) + ' MB';
  };
  const pct = value => Math.max(0, Math.min(100, Number(value || 0)));
  const safeColor = value => /^#[0-9a-f]{3,8}$/i.test(String(value || '').trim()) ? String(value).trim() : '#cbd5e1';
  const FRAMEWORK_LABELS = {
    REACT_TYPESCRIPT:'React + TypeScript', NEXTJS:'Next.js', HTML_CSS:'HTML + CSS + JS',
    VUE_TYPESCRIPT:'Vue 3 + TypeScript', NUXT:'Nuxt 3', SVELTE:'Svelte', SVELTEKIT:'SvelteKit',
    ANGULAR:'Angular', ASTRO:'Astro', SOLIDJS:'SolidJS', REMIX:'Remix'
  };
  const STYLING_LABELS = {
    TAILWIND:'Tailwind CSS', CSS_MODULES:'CSS Modules', PLAIN_CSS:'Plain CSS', SCSS:'Sass / SCSS',
    STYLED_COMPONENTS:'styled-components', EMOTION:'Emotion', BOOTSTRAP:'Bootstrap',
    MATERIAL_UI:'Material UI', CHAKRA_UI:'Chakra UI', UNO_CSS:'UnoCSS', VANILLA_EXTRACT:'vanilla-extract'
  };
  const WORKFLOW_STAGES = ['DESIGN','UNDERSTAND','PREVIEW','MATCH','APPROVE','GENERATE','DELIVER'];
  const RESPONSIVE_PREVIEW_SIZES = {
    DESKTOP: { width: 1440, height: 900, label: 'Desktop' },
    TABLET: { width: 834, height: 1112, label: 'Tablet' },
    MOBILE: { width: 390, height: 844, label: 'Mobile' }
  };
  const STAGE_COPY = {
    DESIGN: ['Design','Choose your reference design','Select one design image. Upload, analysis and responsive preview preparation start automatically.'],
    UNDERSTAND: ['Analyse','Analysing your design','UI Studio is extracting layout, typography, colours, components and responsive behaviour.'],
    PREVIEW: ['Preview','Responsive reconstruction','Inspect the same generated interface at Desktop, Tablet and Mobile sizes. No additional uploads are required.'],
    MATCH: ['Match & Refine','Compare and improve the match','Render every available viewport, compare it with the original and automatically retain the strongest version.'],
    APPROVE: ['Approve','Lock the visual version','Approve the best responsive match before any production code is exposed for delivery.'],
    GENERATE: ['Generate','Prepare production code','Expose the validated implementation only after visual approval.'],
    DELIVER: ['Deliver','Export or connect','Create a portable ZIP bundle, or use an optional connected repository workflow later.']
  };
  const frameworkLabel = value => FRAMEWORK_LABELS[value] || String(value || '').replaceAll('_',' ');
  const stylingLabel = value => STYLING_LABELS[value] || String(value || '').replaceAll('_',' ');

  function notify(message) {
    const element = $('toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => element.classList.remove('show'), 4200);
  }

  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body && typeof options.body === 'string' ? {'Content-Type':'application/json'} : {}),
        ...(options.headers || {})
      }
    });
    const contentType = String(response.headers.get('content-type') || '');
    const data = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
    if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
    return data;
  }

  function clearLocalPreview() {
    if (state.localObjectUrl) URL.revokeObjectURL(state.localObjectUrl);
    state.localObjectUrl = null;
    state.selectedFile = null;
    state.selectedDimensions = null;
    const input = $('uiStudioFile');
    if (input) input.value = '';
  }

  function latest(project, viewport) {
    return project?.latestReferences?.[viewport] || null;
  }

  function inferReferenceViewport(dimensions) {
    const width = Number(dimensions?.width || 0);
    const height = Number(dimensions?.height || 0);
    if (!width || !height) return 'DESKTOP';
    if (width > height || width >= 1000) return 'DESKTOP';
    if (width >= 600) return 'TABLET';
    return 'MOBILE';
  }

  function primaryReference(project = state.project) {
    if (!project) return null;
    return latest(project, 'DESKTOP') || latest(project, 'TABLET') || latest(project, 'MOBILE') || (project.references || [])[0] || null;
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function pollProjectUntil(predicate, options = {}) {
    const timeoutMs = Number(options.timeoutMs || 12 * 60 * 1000);
    const intervalMs = Number(options.intervalMs || 1800);
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id));
      state.project = data.project;
      state.canEdit = Boolean(data.canEdit);
      state.analysisConfig = data.analysis || state.analysisConfig;
      state.codegenConfig = data.codegen || state.codegenConfig;
      state.visualConfig = data.visual || state.visualConfig;
      state.phase5Capability = data.phase5 || state.phase5Capability;
      state.phase6Capability = data.phase6 || state.phase6Capability;
      state.agentConfig = data.agent || state.agentConfig;
      renderWorkspace();
      if (predicate(state.project)) return state.project;
      await sleep(intervalMs);
    }
    throw new Error(options.timeoutMessage || 'UI Studio processing took too long. You can reopen the project and it will resume from the current state.');
  }

  function currentViewportAnalysis() {
    const analysis = state.project?.latestAnalysis;
    if (!analysis || analysis.status !== 'COMPLETED' || analysis.stale || !analysis.result) return null;
    return (analysis.result.viewportAnalyses || []).find(item => item.viewport === state.viewport) || null;
  }

  function projectThumb(reference, label) {
    if (!reference) return `<div class="ui-studio-thumb"><span>No ${esc(label.toLowerCase())}</span></div>`;
    return `<div class="ui-studio-thumb"><img src="${esc(reference.contentUrl)}" alt="" loading="lazy"><em>${esc(label)}</em></div>`;
  }

  function projectAnalysisBadge(project) {
    const analysis = project.latestAnalysis;
    if (!analysis) return '<span class="ui-studio-analysis-badge idle">Not analysed</span>';
    if (analysis.status === 'COMPLETED' && analysis.stale) return '<span class="ui-studio-analysis-badge stale">Analysis stale</span>';
    if (analysis.status === 'COMPLETED') return `<span class="ui-studio-analysis-badge ready">${esc(analysis.confidence)}% analysed</span>`;
    if (analysis.status === 'FAILED') return '<span class="ui-studio-analysis-badge failed">Analysis failed</span>';
    return '<span class="ui-studio-analysis-badge running">Analysing</span>';
  }

  function projectCard(project) {
    return `<article class="ui-studio-project-card" data-ui-project="${esc(project.id)}" tabindex="0" role="button" aria-label="Open ${esc(project.name)}">
      <div>
        <div class="ui-studio-card-kicker"><span class="kicker">UI reconstruction project</span>${projectAnalysisBadge(project)}</div>
        <h3>${esc(project.name)}</h3>
        <p>${esc((project.frameworkTargets || [project.framework]).map(frameworkLabel).join(' + '))} · ${esc((project.stylingTargets || [project.styling]).map(stylingLabel).join(' + '))}</p>
      </div>
      <div class="ui-studio-project-thumbs">
        ${projectThumb(latest(project,'DESKTOP'),'Desktop')}
        ${projectThumb(latest(project,'TABLET'),'Tablet')}
        ${projectThumb(latest(project,'MOBILE'),'Mobile')}
      </div>
      <div class="ui-studio-project-foot">
        <small>${Number(project.referenceCount || 0).toLocaleString('en-GB')} reference${Number(project.referenceCount || 0) === 1 ? '' : 's'}</small>
        <small>Updated ${esc(fmtDate(project.updatedAt))}</small>
      </div>
    </article>`;
  }

  function renderProjects() {
    const projects = state.projects || [];
    $('uiStudioProjectGrid').innerHTML = projects.length
      ? projects.map(projectCard).join('')
      : '<div class="ui-studio-empty"><b>No UI projects yet</b><p>Create the first project, then upload the original desktop, tablet or mobile UI image at full resolution.</p></div>';

    const referenceCount = projects.reduce((sum, item) => sum + Number(item.referenceCount || 0), 0);
    const analysed = projects.filter(item => item.latestAnalysis?.status === 'COMPLETED' && !item.latestAnalysis?.stale).length;
    $('uiStudioSummary').innerHTML = [
      ['Projects', projects.length, 'Saved reconstruction workspaces'],
      ['References', referenceCount, 'Immutable original uploads'],
      ['Understood', analysed, 'Projects with current design analysis'],
      ['Approved', projects.filter(item => Boolean(item.acceptedGenerationId)).length, 'Projects with an approved visual version']
    ].map(item => `<article><span>${esc(item[0])}</span><b>${esc(item[1])}</b><small>${esc(item[2])}</small></article>`).join('');

    $('uiStudioPermission').textContent = state.canEdit
      ? 'Super Admin · upload, analysis, code generation, visual comparison and repair enabled.'
      : 'Read only · Super Admin is required to modify UI Studio projects.';
    $('newUiStudioProjectBtn').disabled = !state.canEdit;

    document.querySelectorAll('[data-ui-project]').forEach(card => {
      const open = () => void selectProject(card.dataset.uiProject);
      card.addEventListener('click', open);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
      });
    });
  }

  async function loadProjects() {
    const data = await request('/api/admin/ui-studio/projects');
    state.projects = data.projects || [];
    state.canEdit = Boolean(data.canEdit);
    state.storage = data.storage || null;
    state.analysisConfig = data.analysis || state.analysisConfig;
    state.codegenConfig = data.codegen || state.codegenConfig;
    state.visualConfig = data.visual || state.visualConfig;
    state.phase5Capability = data.phase5 || state.phase5Capability;
    state.phase6Capability = data.phase6 || state.phase6Capability;
    state.agentConfig = data.agent || state.agentConfig;
    renderProjects();
    return data;
  }

  function setZoom(value) {
    state.zoom = value;
    const viewer = $('uiStudioViewer');
    if (!viewer) return;
    viewer.classList.remove('fit','zoom-100','zoom-150','zoom-200');
    viewer.classList.add(value === 'fit' ? 'fit' : `zoom-${value}`);
    document.querySelectorAll('[data-ui-zoom]').forEach(button => button.classList.toggle('active', button.dataset.uiZoom === value));
  }

  function regionMarkup(viewportAnalysis) {
    if (!state.overlay || !viewportAnalysis) return '';
    const sections = (viewportAnalysis.sections || []).slice(0, 24).map(item => ({ ...item, regionKind: 'section', confidence: 100 }));
    const components = (viewportAnalysis.components || [])
      .filter(item => Number(item.confidence || 0) >= 55)
      .sort((a,b) => Number(b.confidence || 0) - Number(a.confidence || 0))
      .slice(0, 50)
      .map(item => ({ ...item, regionKind: 'component' }));
    return [...sections, ...components].map(item => {
      const b = item.boundsPct || {};
      const title = [item.label, item.type, item.visibleText].filter(Boolean).join(' · ');
      return `<span class="ui-studio-region ${esc(item.regionKind)}" title="${esc(title)}" style="left:${pct(b.x)}%;top:${pct(b.y)}%;width:${pct(b.width)}%;height:${pct(b.height)}%"><em>${esc(item.label || item.type || 'region')}</em></span>`;
    }).join('');
  }

  function renderViewer(imageUrl, alt, viewportAnalysis) {
    if (!imageUrl) {
      $('uiStudioViewerFrame').innerHTML =
        '<div class="ui-studio-viewer-empty ui-studio-empty-artboard">' +
          '<div class="ui-studio-empty-orb"><span></span><i></i><b>✦</b></div>' +
          '<strong>Start with a reference design</strong>' +
          '<p>Upload the ' + esc(state.viewport.toLowerCase()) + ' design you want UI Studio to understand and reconstruct.</p>' +
          '<label for="uiStudioFile" class="ui-studio-empty-upload">＋ Choose design image</label>' +
          '<small>PNG, JPEG, WebP or AVIF · original bytes preserved</small>' +
        '</div>';
      return;
    }
    $('uiStudioViewerFrame').innerHTML = `<div class="ui-studio-visual-shell"><img src="${esc(imageUrl)}" alt="${esc(alt)}">${regionMarkup(viewportAnalysis)}</div>`;
  }

  function renderAnalysisPanel() {
    const project = state.project;
    const analysis = project?.latestAnalysis || null;
    const hasReferences = Number(project?.referenceCount || 0) > 0;
    const configured = Boolean(state.analysisConfig?.configured);
    const button = $('uiStudioAnalyseBtn');
    const status = $('uiStudioAnalysisStatus');
    const summary = $('uiStudioAnalysisSummary');
    const result = $('uiStudioAnalysisResult');
    const overlayButton = $('uiStudioOverlayBtn');
    if (!button || !status || !summary || !result || !overlayButton) return;

    button.disabled = !state.canEdit || !hasReferences || !configured || state.analysing;
    overlayButton.disabled = !currentViewportAnalysis() || Boolean(state.selectedFile);
    overlayButton.classList.toggle('active', state.overlay && !overlayButton.disabled);
    overlayButton.textContent = state.overlay ? 'Hide regions' : 'Regions';

    if (state.analysing) {
      status.textContent = 'Analysing…';
      status.className = 'status-chip ui-studio-analysis-running';
      summary.textContent = 'Reading the full reference set and high-resolution detail crops. This can take a minute or two.';
      button.textContent = 'Analysing UI…';
      result.innerHTML = '<div class="ui-studio-analysis-progress"><span></span><b>Extracting layout, components and design tokens</b><small>The original R2 files are not modified.</small></div>';
      return;
    }

    button.textContent = analysis?.status === 'COMPLETED' ? '✦ Re-analyse latest references' : '✦ Analyse UI';

    if (!configured) {
      status.textContent = 'AI unavailable';
      status.className = 'status-chip';
      summary.textContent = 'Configure the UI Studio analysis model before running design analysis.';
      result.innerHTML = '';
      return;
    }
    if (!hasReferences) {
      status.textContent = 'Needs reference';
      status.className = 'status-chip';
      summary.textContent = 'Upload at least one desktop, tablet or mobile reference before running analysis.';
      result.innerHTML = '';
      return;
    }
    if (!analysis) {
      status.textContent = 'Not analysed';
      status.className = 'status-chip';
      summary.textContent = 'Analyse the latest references to extract layout regions, components, colours, typography, spacing and responsive behaviour.';
      result.innerHTML = '';
      return;
    }
    if (analysis.status === 'FAILED') {
      status.textContent = 'Failed';
      status.className = 'status-chip ui-studio-analysis-failed';
      summary.textContent = analysis.errorMessage || 'The previous analysis did not complete.';
      result.innerHTML = '<small>Retry uses the latest reference set and creates a new analysis version.</small>';
      return;
    }
    if (analysis.status !== 'COMPLETED') {
      status.textContent = 'Running';
      status.className = 'status-chip ui-studio-analysis-running';
      summary.textContent = 'An analysis run is still marked as active.';
      result.innerHTML = '';
      return;
    }

    const data = analysis.result || {};
    status.textContent = analysis.stale ? 'Stale' : `${Number(analysis.confidence || 0)}% confidence`;
    status.className = 'status-chip ' + (analysis.stale ? 'ui-studio-analysis-stale' : 'ui-studio-analysis-ready');
    summary.textContent = analysis.stale
      ? 'A newer reference has been uploaded since this analysis. Re-analyse before using the region map for code generation.'
      : (analysis.summary || 'Design analysis completed.');

    const current = (data.viewportAnalyses || []).find(item => item.viewport === state.viewport);
    const colors = (data.colorTokens || []).slice(0, 8);
    const type = (data.typography || []).slice(0, 6);
    const components = current?.components || [];
    const responsive = data.responsivePlan || {};

    result.innerHTML = `
      <div class="ui-studio-analysis-kpis">
        <div><span>Confidence</span><b>${esc(Number(analysis.confidence || 0))}%</b></div>
        <div><span>Regions</span><b>${esc((current?.sections || []).length + components.length)}</b></div>
        <div><span>Viewport</span><b>${esc(state.viewport)}</b></div>
      </div>
      ${current ? `<div class="ui-studio-analysis-block"><b>Layout</b><p>${esc(current.layoutMode || 'Detected layout')} · ${esc(current.columns || 1)} column${Number(current.columns || 1) === 1 ? '' : 's'}</p></div>` : ''}
      ${colors.length ? `<div class="ui-studio-analysis-block"><b>Colour tokens</b><div class="ui-studio-color-list">${colors.map(token => `<span title="${esc(token.usage)}"><i style="background:${safeColor(token.value)}"></i><small>${esc(token.value)}</small></span>`).join('')}</div></div>` : ''}
      ${type.length ? `<div class="ui-studio-analysis-block"><b>Typography</b><div class="ui-studio-token-list">${type.map(item => `<span><strong>${esc(item.role)}</strong><small>${esc(Math.round(Number(item.sizePx || 0)) + 'px · ' + item.weight)}</small></span>`).join('')}</div></div>` : ''}
      ${components.length ? `<div class="ui-studio-analysis-block"><b>Detected components</b><div class="ui-studio-component-list">${components.slice(0, 12).map(item => `<span><strong>${esc(item.label)}</strong><small>${esc(item.type)} · ${esc(item.confidence)}%</small></span>`).join('')}</div></div>` : ''}
      <div class="ui-studio-analysis-block"><b>Responsive basis</b><p>${esc(responsive.basis || '—')} · analysed ${esc(analysis.viewportCount || 0)} viewport${Number(analysis.viewportCount || 0) === 1 ? '' : 's'}</p></div>
      <small class="ui-studio-analysis-meta">Model: ${esc(analysis.model || 'configured model')} · completed ${esc(fmtDate(analysis.completedAt))}</small>
    `;
  }

  function latestGenerationSummary() {
    return state.project?.latestGeneration || null;
  }

  function currentGeneration() {
    return state.generationDetail?.id === latestGenerationSummary()?.id ? state.generationDetail : null;
  }

  async function loadLatestGeneration() {
    const summary = latestGenerationSummary();
    if (!summary?.id || !['READY','READY_WITH_WARNINGS'].includes(summary.status)) {
      state.generationDetail = null;
      state.selectedGeneratedFile = null;
      return null;
    }
    if (state.generationDetail?.id === summary.id && state.generationDetail?.result) return state.generationDetail;
    const data = await request('/api/admin/ui-studio/generations/' + encodeURIComponent(summary.id));
    state.generationDetail = data.generation || null;
    state.selectedGeneratedFile = state.generationDetail?.result?.entryFile || state.generationDetail?.result?.files?.[0]?.path || null;
    return state.generationDetail;
  }

  function generationFile() {
    const generation = currentGeneration();
    const files = generation?.result?.files || [];
    return files.find(file => file.path === state.selectedGeneratedFile) || files[0] || null;
  }

  function bindGeneratedFileActions() {
    document.querySelectorAll('[data-generated-file]').forEach(button => {
      button.addEventListener('click', () => {
        state.selectedGeneratedFile = button.dataset.generatedFile;
        renderCodegenPanel();
      });
    });
    $('uiStudioCopyCodeBtn')?.addEventListener('click', async () => {
      const file = generationFile();
      if (!file) return;
      try {
        await navigator.clipboard.writeText(file.content || '');
        notify('Generated code copied.');
      } catch (_) {
        notify('Copy failed. Select the code manually.');
      }
    });
    $('uiStudioDownloadFileBtn')?.addEventListener('click', () => {
      const file = generationFile();
      if (!file) return;
      const blob = new Blob([file.content || ''], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = String(file.path || 'generated-code.txt').split('/').pop();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
    $('uiStudioDownloadBundleBtn')?.addEventListener('click', () => {
      const generation = currentGeneration();
      if (!generation?.result) return;
      const bundle = {
        project: state.project?.name || 'UI Studio project',
        generatedAt: generation.completedAt,
        framework: generation.framework,
        styling: generation.styling,
        outputType: generation.outputType,
        entryFile: generation.result.entryFile,
        files: generation.result.files,
        componentTree: generation.result.componentTree,
        assetSlots: generation.result.assetSlots,
        responsiveStrategy: generation.result.responsiveStrategy,
        usageNotes: generation.result.usageNotes,
        warnings: generation.result.warnings
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = (state.project?.name || 'ui-studio').replace(/[^A-Za-z0-9_-]+/g, '-') + '-generated.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }

  function renderCodegenPanel() {
    const button = $('uiStudioFinalizeCodeBtn');
    const status = $('uiStudioCodegenStatus');
    const summary = $('uiStudioCodegenSummary');
    const output = $('uiStudioCodegenOutput');
    if (!button || !status || !summary || !output) return;

    const project = state.project;
    const acceptedId = project?.acceptedGenerationId || null;
    const productionReady = Boolean(
      acceptedId &&
      project?.productionGenerationId === acceptedId &&
      project?.productionGeneratedAt
    );
    const generation = state.generationDetail?.id === project?.productionGenerationId
      ? state.generationDetail
      : null;

    button.disabled = !state.canEdit || !acceptedId || state.finalizingCode || productionReady;
    button.textContent = state.finalizingCode
      ? 'Preparing production code…'
      : productionReady
        ? '✓ Production code ready'
        : '⌘ Generate production code';

    if (!acceptedId) {
      status.textContent = 'Needs approval';
      status.className = 'status-chip';
      summary.textContent = 'Approve the best visual match before production code is exposed.';
      output.innerHTML = '<div class="ui-studio-codegen-empty"><b>Code stays hidden until approval</b><small>UI Studio may use an internal preview build for rendering, but it is not presented as production output.</small></div>';
      return;
    }

    if (state.finalizingCode) {
      status.textContent = 'Preparing…';
      status.className = 'status-chip ui-studio-codegen-running';
      summary.textContent = 'Revalidating the approved implementation and locking it as the production code version.';
      output.innerHTML = '<div class="ui-studio-codegen-progress"><span></span><b>Finalizing approved code</b><small>The visual version is already locked. This step does not alter the approved design.</small></div>';
      return;
    }

    if (!productionReady) {
      status.textContent = 'Approved · ready';
      status.className = 'status-chip ui-studio-codegen-ready';
      summary.textContent = 'The approved visual version is ready to become production code for ' +
        (project.frameworkTargets || [project.framework]).map(frameworkLabel).join(', ') + '.';
      output.innerHTML = '<div class="ui-studio-codegen-empty"><b>Approved design locked</b><small>Generate production code to expose the validated source bundle and unlock delivery.</small></div>';
      return;
    }

    status.textContent = 'Code ready';
    status.className = 'status-chip ui-studio-codegen-ready';
    summary.textContent = 'Production code is locked to the approved visual version. Primary compiled target: ' +
      frameworkLabel(project.framework) + ' with ' + stylingLabel(project.styling) + '.';

    if (!generation?.result) {
      output.innerHTML = '<div class="ui-studio-codegen-loading">Loading the approved production files…</div>';
      return;
    }

    const result = generation.result;
    const files = result.files || [];
    const selected = generationFile();
    const validation = generation.validation || {};
    const assetSlots = result.assetSlots || [];
    const tabs = files.map(file => `<button type="button" data-generated-file="${esc(file.path)}" class="${file.path === selected?.path ? 'active' : ''}">${esc(file.path)}</button>`).join('');

    output.innerHTML = `
      <div class="ui-studio-codegen-meta">
        <div><span>Files</span><b>${esc(files.length)}</b></div>
        <div><span>Validation</span><b>${esc((validation.passed ?? 0) + '/' + (validation.total ?? 0))}</b></div>
        <div><span>Media slots</span><b>${esc(assetSlots.length)}</b></div>
        <div><span>Entry</span><b title="${esc(result.entryFile || '')}">${esc((result.entryFile || '—').split('/').pop())}</b></div>
      </div>
      <div class="ui-studio-target-summary">
        <span>Framework targets</span>
        <div>${(project.frameworkTargets || [project.framework]).map(item => '<b>' + esc(frameworkLabel(item)) + '</b>').join('')}</div>
        <small>The deterministic preview target is compiled now. Additional targets remain part of the portable project configuration for future export adapters.</small>
      </div>
      <div class="ui-studio-codegen-toolbar">
        <div class="ui-studio-file-tabs">${tabs}</div>
        <div class="ui-studio-file-actions">
          <button class="secondary" id="uiStudioCopyCodeBtn" type="button">Copy</button>
          <button class="secondary" id="uiStudioDownloadFileBtn" type="button">Download file</button>
          <button class="secondary" id="uiStudioDownloadBundleBtn" type="button">Download bundle JSON</button>
        </div>
      </div>
      ${selected ? `<div class="ui-studio-code-file-head"><div><b>${esc(selected.path)}</b><small>${esc(selected.purpose || selected.language || '')}</small></div><span>${esc(selected.language || 'text')}</span></div><pre class="ui-studio-code-view"><code>${esc(selected.content || '')}</code></pre>` : ''}
      <div class="ui-studio-codegen-foot">
        <small>Approved ${esc(fmtDate(project.acceptedAt))} · production code prepared ${esc(fmtDate(project.productionGeneratedAt))}</small>
        <small>Delivery is now unlocked. Export ZIP is the recommended default while repository providers remain optional.</small>
      </div>
    `;
    bindGeneratedFileActions();
  }

  async function loadProductionGeneration() {
    const id = state.project?.productionGenerationId;
    if (!id) return null;
    if (state.generationDetail?.id === id && state.generationDetail?.result) return state.generationDetail;
    const data = await request('/api/admin/ui-studio/generations/' + encodeURIComponent(id));
    state.generationDetail = data.generation || null;
    state.selectedGeneratedFile = state.generationDetail?.result?.entryFile || state.generationDetail?.result?.files?.[0]?.path || null;
    return state.generationDetail;
  }

  function latestRenderForViewport() {
    const renders = state.project?.renders || [];
    return renders.find(item => item.viewport === state.viewport) || null;
  }

  function currentVisualRender() {
    return state.visualRender || latestRenderForViewport();
  }

  function visualGenerationReady() {
    const generation = latestGenerationSummary();
    return Boolean(generation && ['READY','READY_WITH_WARNINGS'].includes(generation.status) && !generation.stale);
  }

  function visualRenderIsCurrent(render) {
    return Boolean(render && render.generationId === latestGenerationSummary()?.id && render.viewport === state.viewport);
  }

  function scoreClass(score) {
    const value = Number(score || 0);
    const target = Number(state.visualConfig?.targetScore || 90);
    if (value >= target) return 'excellent';
    if (value >= 80) return 'good';
    if (value >= 65) return 'fair';
    return 'poor';
  }

  function renderVisualPanel() {
    const status = $('uiStudioVisualStatus');
    const summary = $('uiStudioVisualSummary');
    const output = $('uiStudioVisualOutput');
    const previewButton = $('uiStudioPreviewBtn');
    if (!status || !summary || !output) return;

    const generation = latestGenerationSummary();
    const ready = previewBuildIsCurrent();
    const running = Boolean(
      state.pipelineBusy ||
      state.generating ||
      generation?.status === 'RUNNING'
    );

    if (previewButton) {
      previewButton.hidden = !state.pipelineError;
      previewButton.disabled = !state.canEdit || running || !analysisIsCurrent();
      previewButton.textContent = running ? 'Preparing preview…' : 'Retry preview';
    }

    if (running) {
      status.textContent = state.pipelineStep === 'ANALYSING' ? 'Analysing…' : 'Preparing…';
      status.className = 'status-chip ui-studio-visual-running';
      summary.textContent = state.pipelineStep === 'ANALYSING'
        ? 'UI Studio is analysing the uploaded design before creating the responsive reconstruction.'
        : 'UI Studio is preparing one responsive implementation for desktop, tablet and mobile.';
      output.innerHTML =
        '<div class="ui-studio-responsive-loading">' +
          '<span class="ui-studio-responsive-loader"></span>' +
          '<b>' + esc(state.pipelineStep === 'ANALYSING' ? 'Analysing design' : 'Preparing responsive preview') + '</b>' +
          '<small>This runs automatically. You do not need to click Build Preview again.</small>' +
        '</div>';
      return;
    }

    if (!ready) {
      status.textContent = state.pipelineError ? 'Needs retry' : 'Waiting';
      status.className = 'status-chip ' + (state.pipelineError ? 'ui-studio-visual-failed' : '');
      summary.textContent = state.pipelineError
        ? state.pipelineError
        : 'Upload one design and UI Studio will automatically analyse it and prepare the responsive preview.';
      output.innerHTML =
        '<div class="ui-studio-codegen-empty">' +
          '<b>' + esc(state.pipelineError ? 'Preview preparation stopped' : 'Waiting for a design') + '</b>' +
          '<small>' + esc(state.pipelineError ? 'Use Retry preview after checking the message above.' : 'No separate Desktop, Tablet or Mobile uploads are required.') + '</small>' +
        '</div>';
      return;
    }

    const size = RESPONSIVE_PREVIEW_SIZES[state.viewport] || RESPONSIVE_PREVIEW_SIZES.DESKTOP;
    status.textContent = 'Ready';
    status.className = 'status-chip ui-studio-visual-ready';
    summary.textContent = size.label + ' responsive preview · ' + size.width + ' × ' + size.height +
      '. Switch viewport tabs to inspect the same implementation at another size.';

    output.innerHTML =
      '<div class="ui-studio-responsive-preview-head">' +
        '<div><b>' + esc(size.label) + '</b><span>' + esc(size.width + ' × ' + size.height) + '</span></div>' +
        '<small>Generated from one uploaded reference · additional viewport references are optional for exact comparison later.</small>' +
      '</div>' +
      '<div class="ui-studio-responsive-preview-stage">' +
        '<iframe id="uiStudioResponsivePreviewFrame" title="' + esc(size.label) + ' responsive UI preview" sandbox="allow-scripts"></iframe>' +
      '</div>';

    mountResponsivePreviewFrame(state.viewport);
  }

  function mountResponsivePreviewFrame(viewport) {
    const frame = $('uiStudioResponsivePreviewFrame');
    const size = RESPONSIVE_PREVIEW_SIZES[viewport] || RESPONSIVE_PREVIEW_SIZES.DESKTOP;
    if (!frame || !state.project?.id || !previewBuildIsCurrent()) return;

    frame.style.width = size.width + 'px';
    frame.style.height = size.height + 'px';
    frame.style.transformOrigin = 'top left';
    frame.src =
      '/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) +
      '/responsive-preview/' + encodeURIComponent(viewport) +
      '?generation=' + encodeURIComponent(state.project.latestGeneration?.id || '');

    const fit = () => {
      const stage = frame.parentElement;
      if (!stage) return;
      const availableWidth = Math.max(1, stage.clientWidth - 28);
      const availableHeight = Math.max(360, Math.min(680, window.innerHeight - 300));
      const scale = Math.min(1, availableWidth / size.width, availableHeight / size.height);
      frame.style.transform = 'scale(' + scale + ')';
      stage.style.height = Math.max(360, Math.ceil(size.height * scale) + 28) + 'px';
    };
    requestAnimationFrame(fit);
    frame.addEventListener('load', fit, { once: true });
  }

  function mountPreviewFrame(render) {
    const frame = $('uiStudioPreviewFrame');
    if (!frame || !render?.previewUrl) return;
    state.visualFrame = frame;
    const width = Math.max(1, Number(render.width || 1));
    const height = Math.max(1, Number(render.height || 1));
    frame.style.width = width + 'px';
    frame.style.height = height + 'px';
    frame.style.transformOrigin = 'top left';
    frame.src = render.previewUrl + '?v=' + encodeURIComponent(render.updatedAt || Date.now());
    requestAnimationFrame(() => {
      const stage = frame.parentElement;
      if (!stage) return;
      const available = Math.max(1, stage.clientWidth - 24);
      const scale = Math.min(1, available / width);
      frame.style.transform = 'scale(' + scale + ')';
      stage.style.height = Math.min(620, Math.ceil(height * scale) + 24) + 'px';
      stage.style.overflow = 'hidden';
    });
  }

  async function uploadVisualCapture(render, pngDataUrl) {
    if (!render || !pngDataUrl || !state.visualRunning) return;
    try {
      const captureResponse = await fetch(pngDataUrl);
      const blob = await captureResponse.blob();
      const response = await fetch('/api/admin/ui-studio/renders/' + encodeURIComponent(render.id) + '/capture', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'image/png' },
        body: blob
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Visual comparison failed.');
      state.visualRender = data.render;
      state.project = data.project;
      notify('Visual comparison completed: ' + (data.render.score ?? '—') + '% match.');

      const target = Number(state.visualConfig?.targetScore || 90);
      const maxPasses = Number(state.visualConfig?.maxRepairPasses || 3);
      if (
        state.autoRepairEnabled
        && state.visualConfig?.visualAiConfigured
        && Number(data.render.score || 0) < target
        && Number(data.render.repairDepth || 0) < maxPasses
      ) {
        await repairAndRepeat(data.render, true);
        return;
      }

      state.visualRunning = false;
      await loadProjects().catch(() => {});
      renderWorkspace();
    } catch (error) {
      state.visualRunning = false;
      notify(error.message);
      await refreshProject().catch(() => {});
      renderWorkspace();
    }
  }

  async function startVisualCompare(options = {}) {
    if (!state.project || !state.canEdit || state.visualRunning) return;
    state.autoRepairEnabled = Boolean($('uiStudioAutoRepair')?.checked);
    state.visualRunning = true;
    state.visualRender = null;
    renderVisualPanel();
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/render', {
        method: 'POST',
        body: JSON.stringify({
          viewport: state.viewport,
          generationId: options.generationId || latestGenerationSummary()?.id || null,
          parentRenderId: options.parentRenderId || null,
          repairDepth: Number(options.repairDepth || 0)
        })
      });
      state.project = data.project;
      state.visualRender = data.render;
      renderVisualPanel();
    } catch (error) {
      state.visualRunning = false;
      notify(error.message);
      await refreshProject().catch(() => {});
      renderWorkspace();
    }
  }

  async function repairAndRepeat(render, automatic = false) {
    if (!render || !state.canEdit) return;
    state.visualRunning = true;
    renderVisualPanel();
    try {
      const data = await request('/api/admin/ui-studio/renders/' + encodeURIComponent(render.id) + '/repair', {
        method: 'POST',
        body: JSON.stringify({})
      });
      state.project = data.project;
      state.generationDetail = data.generation;
      state.selectedGeneratedFile = data.generation?.result?.entryFile || data.generation?.result?.files?.[0]?.path || null;
      notify((automatic ? 'Auto repair' : 'Repair') + ' pass ' + data.attemptNumber + ' created a new code version.');
      await loadProjects().catch(() => {});
      state.visualRunning = false;
      await startVisualCompare({
        generationId: data.generation.id,
        parentRenderId: render.id,
        repairDepth: data.attemptNumber
      });
    } catch (error) {
      state.visualRunning = false;
      notify(error.message);
      await refreshProject().catch(() => {});
      renderWorkspace();
    }
  }

  function handlePreviewMessage(event) {
    const frame = state.visualFrame;
    if (!frame || event.source !== frame.contentWindow || !state.visualRunning) return;
    const data = event.data || {};
    if (data.type === 'ui-studio-capture' && data.pngDataUrl) {
      const render = state.visualRender;
      state.visualFrame = null;
      void uploadVisualCapture(render, data.pngDataUrl);
      return;
    }
    if (data.type === 'ui-studio-capture-error' || data.type === 'ui-studio-preview-error') {
      state.visualRunning = false;
      notify(data.message || 'The sandboxed preview could not be captured.');
      renderWorkspace();
    }
  }

  function phase5BindingFor(slotName) {
    return (state.phase5Config?.assetBindings || []).find(item => item.slotName === slotName && item.viewport === 'ALL')
      || (state.phase5Config?.assetBindings || []).find(item => item.slotName === slotName)
      || null;
  }

  function phase5ViewportCard(render) {
    const metrics = render?.metrics || {};
    const score = render?.score;
    const status = render?.status || 'QUEUED';
    const done = status === 'COMPLETED';
    return `<article class="ui-studio-phase5-viewport">
      <header><b>${esc(render.viewport)}</b><span>${done ? esc(score ?? '—') + '% match' : esc(status)}</span></header>
      ${done ? `<div class="shots">
        <figure><figcaption>Original</figcaption><img src="${esc(render.originalUrl)}" alt="${esc(render.viewport)} original"></figure>
        <figure><figcaption>Chromium</figcaption><img src="${esc(render.renderedUrl)}" alt="${esc(render.viewport)} rendered"></figure>
        <figure><figcaption>Diff</figcaption><img src="${esc(render.diffUrl)}" alt="${esc(render.viewport)} diff"></figure>
      </div>
      <footer>
        <span>Pixel<b>${esc(render.pixelScore ?? '—')}</b></span>
        <span>Structure<b>${esc(metrics.structuralScore ?? '—')}</b></span>
        <span>Ignored media<b>${esc(metrics.ignoredPercent != null ? metrics.ignoredPercent + '%' : '0%')}</b></span>
      </footer>` : '<div class="ui-studio-phase5-empty">Waiting for the dedicated renderer worker.</div>'}
    </article>`;
  }

  function renderPhase5Assets() {
    const host = $('uiStudioPhase5Assets');
    if (!host) return;
    const slots = state.phase5Config?.assetSlots || [];
    if (!slots.length) {
      host.innerHTML = '<div class="ui-studio-phase5-empty">No media slots were declared by the current preview build.</div>';
      return;
    }
    host.innerHTML = slots.map((slot, index) => {
      const binding = phase5BindingFor(slot.name);
      const inputId = 'uiStudioAssetFile-' + index;
      return `<div class="ui-studio-asset-row">
        <div><b>${esc(slot.name || 'Media slot')}</b><small>${esc(binding ? binding.originalName + ' · ' + bytes(binding.byteSize) : (slot.kind || 'MEDIA') + ' · ' + (slot.purpose || 'No asset bound'))}</small></div>
        <div class="asset-actions">
          <label for="${esc(inputId)}">${binding ? 'Replace' : 'Bind asset'}</label>
          <input id="${esc(inputId)}" type="file" data-phase5-asset-slot="${esc(slot.name)}" data-phase5-asset-kind="${esc(slot.kind || 'OTHER')}" accept="image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm,video/quicktime">
          ${binding ? `<button type="button" data-phase5-unbind="${esc(binding.id)}">Remove</button>` : ''}
        </div>
      </div>`;
    }).join('');

    document.querySelectorAll('[data-phase5-asset-slot]').forEach(input => {
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) void uploadPhase5Asset(input.dataset.phase5AssetSlot, input.dataset.phase5AssetKind, file);
      });
    });
    document.querySelectorAll('[data-phase5-unbind]').forEach(button => {
      button.addEventListener('click', () => void removePhase5Asset(button.dataset.phase5Unbind));
    });
  }

  function renderPhase5Masks() {
    const host = $('uiStudioPhase5Masks');
    if (!host) return;
    const all = state.phase5Config?.masks || {};
    const masks = VIEWPORT_NAMES.flatMap(viewport => (all[viewport] || []).map(mask => ({ ...mask, viewport })));
    if (!masks.length) {
      host.innerHTML = '<div class="ui-studio-phase5-empty">No masks. Add one for dynamic media if its changing pixels should not affect similarity scoring.</div>';
      return;
    }
    host.innerHTML = masks.map(mask => `<div class="ui-studio-mask-row ${mask.source === 'AUTO' ? 'auto' : ''}">
      <div><b>${esc(mask.label)} · ${esc(mask.viewport)}</b><small>x ${esc(mask.xPct)}% · y ${esc(mask.yPct)}% · ${esc(mask.widthPct)} × ${esc(mask.heightPct)}%</small></div>
      ${mask.source === 'MANUAL' ? `<button class="secondary" type="button" data-phase5-mask-delete="${esc(mask.id)}">Delete</button>` : '<span class="status-chip">Auto</span>'}
    </div>`).join('');
    document.querySelectorAll('[data-phase5-mask-delete]').forEach(button => {
      button.addEventListener('click', () => void deletePhase5Mask(button.dataset.phase5MaskDelete));
    });
  }

  const VIEWPORT_NAMES = ['DESKTOP','TABLET','MOBILE'];

  function renderPhase5Panel() {
    const status = $('uiStudioPhase5Status');
    const summary = $('uiStudioPhase5Summary');
    const run = $('uiStudioPhase5RunBtn');
    const accept = $('uiStudioPhase5AcceptBtn');
    const auto = $('uiStudioPhase5AutoRepair');
    const scoreboard = $('uiStudioPhase5Scoreboard');
    const batchHost = $('uiStudioPhase5Batch');
    if (!status || !summary || !run || !accept || !auto || !scoreboard || !batchHost) return;

    auto.checked = state.autoRepairEnabled;
    auto.disabled = state.phase5Running;
    const config = state.phase5Config;
    const currentGeneration = state.project?.latestGeneration;
    const ready = Boolean(currentGeneration && ['READY','READY_WITH_WARNINGS'].includes(currentGeneration.status) && !currentGeneration.stale);

    run.disabled = !state.canEdit || !ready || !config?.rendererConfigured || state.phase5Running;
    accept.disabled = !state.canEdit || !config?.bestGenerationId || config.bestGenerationId === config.acceptedGenerationId || state.phase5Running;

    if (!config) {
      status.textContent = 'Loading';
      status.className = 'status-chip';
      summary.textContent = 'Loading visual comparison state…';
      scoreboard.innerHTML = '';
      batchHost.innerHTML = '';
      return;
    }

    status.textContent = !config.rendererConfigured
      ? 'Renderer offline'
      : state.phase5Running
        ? 'Improving match…'
        : (config.acceptedGenerationId ? 'Accepted' : config.bestGenerationId ? 'Best candidate ready' : 'Ready');
    status.className = 'status-chip ' + (config.acceptedGenerationId ? 'ui-studio-visual-ready' : state.phase5Running ? 'ui-studio-visual-running' : 'ui-studio-phase5-ready');
    summary.textContent = !config.rendererConfigured
      ? 'The dedicated Chromium renderer is unavailable. Visual comparison is disabled until the renderer service is healthy.'
      : state.phase5Running
        ? 'The dedicated worker is comparing every available viewport in real Chromium. Improvements are re-tested across all viewports and regressions are rejected.'
        : 'Target ' + config.targetScore + '% aggregate · minimum viewport ' + config.minimumViewportScore + '% · regression tolerance ' + config.regressionTolerance + ' points.';

    scoreboard.innerHTML = [
      ['Best aggregate', config.bestAggregateScore != null ? config.bestAggregateScore + '%' : '—', 'Automatically retained', 'best'],
      ['Desktop', config.bestGeneration?.viewportScores?.DESKTOP != null ? config.bestGeneration.viewportScores.DESKTOP + '%' : '—', 'Best candidate', ''],
      ['Tablet', config.bestGeneration?.viewportScores?.TABLET != null ? config.bestGeneration.viewportScores.TABLET + '%' : '—', 'Best candidate', ''],
      ['Mobile', config.bestGeneration?.viewportScores?.MOBILE != null ? config.bestGeneration.viewportScores.MOBILE + '%' : '—', 'Best candidate', ''],
      ['Accepted', config.acceptedGenerationId ? ('v' + String(config.acceptedGeneration?.repairDepth || 0) + ' · ' + (config.acceptedGeneration?.aggregateScore ?? '—') + '%') : 'Not accepted', config.acceptedAt ? fmtDate(config.acceptedAt) : 'Manual approval required', 'accepted']
    ].map(item => `<article class="${item[3]}"><span>${esc(item[0])}</span><b>${esc(item[1])}</b><small>${esc(item[2])}</small></article>`).join('');

    const batch = state.phase5Batch;
    if (batch) {
      const completed = (batch.renders || []).filter(item => item.status === 'COMPLETED').length;
      const total = (batch.renders || []).length;
      if (batch.status === 'RUNNING' || batch.status === 'QUEUED') {
        batchHost.innerHTML = `<div class="ui-studio-phase5-progress"><div><b>Visual comparison run</b><small>${esc(completed + '/' + total)} viewport renders complete</small></div><span></span></div>
          <div class="ui-studio-phase5-viewport-grid" style="margin-top:10px">${(batch.renders || []).map(phase5ViewportCard).join('')}</div>`;
      } else {
        batchHost.innerHTML = `<div class="ui-studio-phase5-viewport-grid">${(batch.renders || []).map(phase5ViewportCard).join('')}</div>`;
      }
    } else {
      batchHost.innerHTML = '<div class="ui-studio-phase5-empty">Compare the reconstruction against every available Desktop, Tablet and Mobile reference.</div>';
    }

    renderPhase5Assets();
    renderPhase5Masks();
  }

  async function loadPhase5() {
    if (!state.project) return null;
    const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase5');
    state.phase5Config = data.phase5 || null;
    if (!state.phase5Batch && state.phase5Config?.activeBatchId) {
      const active = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase5/batches/' + encodeURIComponent(state.phase5Config.activeBatchId)).catch(() => null);
      if (active?.batch) state.phase5Batch = active.batch;
    }
    renderPhase5Panel();
    return state.phase5Config;
  }

  function schedulePhase5Poll() {
    clearTimeout(state.phase5PollTimer);
    state.phase5PollTimer = setTimeout(() => void pollPhase5Batch(), 1800);
  }

  async function pollPhase5Batch() {
    if (!state.project || !state.phase5Batch?.batchId) return;
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase5/batches/' + encodeURIComponent(state.phase5Batch.batchId));
      state.phase5Batch = data.batch;
      renderPhase5Panel();
      if (['RUNNING','QUEUED'].includes(data.batch.status)) {
        schedulePhase5Poll();
        return;
      }
      await refreshProject();
      await loadPhase5();
      if (state.phase5Config?.activeBatchId && state.phase5Config.activeBatchId !== data.batch.batchId) {
        const next = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase5/batches/' + encodeURIComponent(state.phase5Config.activeBatchId));
        state.phase5Batch = next.batch;
        state.phase5Running = true;
        renderPhase5Panel();
        schedulePhase5Poll();
        return;
      }
      state.phase5Running = false;
      notify(data.batch.status === 'FAILED' ? 'Visual comparison stopped because a viewport render failed.' : 'Match & Refine completed. The best regression-safe version was retained.');
      await loadProjects().catch(() => {});
      renderWorkspace();
    } catch (error) {
      state.phase5Running = false;
      notify(error.message);
      renderWorkspace();
    }
  }

  async function startPhase5() {
    if (!state.project || !state.canEdit || state.phase5Running) return;
    state.autoRepairEnabled = Boolean($('uiStudioPhase5AutoRepair')?.checked);
    state.phase5Running = true;
    state.phase5Batch = null;
    renderPhase5Panel();
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase5/run', {
        method: 'POST',
        body: JSON.stringify({
          generationId: state.project.latestGeneration?.id || state.phase5Config?.bestGenerationId || null,
          autoRepair: state.autoRepairEnabled
        })
      });
      state.project = data.project;
      state.phase5Batch = {
        batchId: data.batch.batchId,
        status: 'QUEUED',
        renders: data.batch.renders || []
      };
      await loadPhase5();
      renderWorkspace();
      schedulePhase5Poll();
    } catch (error) {
      state.phase5Running = false;
      notify(error.message);
      renderWorkspace();
    }
  }

  async function uploadPhase5Asset(slotName, kind, file) {
    if (!state.project || !state.canEdit || !file) return;
    if (file.size > 30 * 1024 * 1024) return notify('Bound assets must be 30 MB or smaller.');
    try {
      const response = await fetch('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase5/assets', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Slot-Name': encodeURIComponent(slotName),
          'X-Asset-Kind': encodeURIComponent(kind || 'OTHER'),
          'X-Asset-Viewport': 'ALL',
          'X-File-Name': encodeURIComponent(file.name || 'bound-asset')
        },
        body: file
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Asset binding failed.');
      state.phase5Config = data.phase5;
      notify('Media asset bound to ' + slotName + '.');
      renderPhase5Panel();
    } catch (error) { notify(error.message); }
  }

  async function removePhase5Asset(bindingId) {
    if (!state.project || !state.canEdit) return;
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase5/assets/' + encodeURIComponent(bindingId), { method: 'DELETE' });
      state.phase5Config = data.phase5;
      notify('Media binding removed.');
      renderPhase5Panel();
    } catch (error) { notify(error.message); }
  }

  async function addPhase5Mask(event) {
    event.preventDefault();
    if (!state.project || !state.canEdit) return;
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase5/masks', {
        method: 'POST',
        body: JSON.stringify({
          label: $('uiStudioMaskLabel').value.trim() || 'Dynamic media',
          viewport: $('uiStudioMaskViewport').value,
          xPct: Number($('uiStudioMaskX').value),
          yPct: Number($('uiStudioMaskY').value),
          widthPct: Number($('uiStudioMaskW').value),
          heightPct: Number($('uiStudioMaskH').value)
        })
      });
      state.phase5Config = data.phase5;
      $('uiStudioPhase5MaskForm').reset();
      notify('Comparison mask added.');
      renderPhase5Panel();
    } catch (error) { notify(error.message); }
  }

  async function deletePhase5Mask(maskId) {
    if (!state.project || !state.canEdit) return;
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase5/masks/' + encodeURIComponent(maskId), { method: 'DELETE' });
      state.phase5Config = data.phase5;
      notify('Comparison mask removed.');
      renderPhase5Panel();
    } catch (error) { notify(error.message); }
  }

  async function acceptPhase5Best() {
    const generationId = state.phase5Config?.bestGenerationId;
    if (!state.project || !state.canEdit || !generationId) return;
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase5/accept/' + encodeURIComponent(generationId), {
        method: 'POST',
        body: JSON.stringify({})
      });
      state.project = data.project;
      state.phase5Config = data.phase5;
      notify('Best visual match approved. Production code can now be generated.');
      await loadProjects().catch(() => {});
      await loadPhase6().catch(() => {});
      renderWorkspace();
    } catch (error) { notify(error.message); }
  }


  function selectedPhase6Delivery() {
    const deliveries = state.phase6Config?.deliveries || [];
    return deliveries.find(item => item.id === state.phase6SelectedDeliveryId) || deliveries[0] || null;
  }

  function syncPhase6RepositoryFields() {
    const repositoryMode = $('uiStudioPhase6Mode')?.value === 'REPOSITORY';
    ['uiStudioPhase6Repository','uiStudioPhase6BaseBranch','uiStudioPhase6TargetDir'].forEach(id => {
      if ($(id)) $(id).disabled = !repositoryMode || !state.canEdit || state.phase6Busy;
    });
  }

  function renderPhase6Panel() {
    const status = $('uiStudioPhase6Status');
    const gateHost = $('uiStudioPhase6Gate');
    const deliveriesHost = $('uiStudioPhase6Deliveries');
    if (!status || !gateHost || !deliveriesHost) return;

    const cfg = state.phase6Config || {};
    const capability = state.phase6Capability || cfg || {};
    const gate = cfg.gate || null;
    const delivery = selectedPhase6Delivery();
    const acceptedId = cfg.acceptedGenerationId || state.project?.acceptedGenerationId || null;
    const score = Number(gate?.aggregateScore);
    const viewportResults = Array.isArray(gate?.viewportResults) ? gate.viewportResults : [];

    if (!acceptedId) {
      status.textContent = 'Needs approval';
      status.className = 'status-chip';
    } else if (gate?.passed) {
      status.textContent = delivery ? delivery.status.replaceAll('_',' ') : 'Ready';
      status.className = 'status-chip ui-studio-analysis-ready';
    } else {
      status.textContent = 'Not ready';
      status.className = 'status-chip ui-studio-analysis-failed';
    }

    const viewportLabel = viewportResults.length
      ? viewportResults.map(item => item.viewport + ' ' + (Number.isFinite(Number(item.score)) ? Math.round(Number(item.score)) + '%' : '—')).join(' · ')
      : 'No responsive match evidence yet';
    gateHost.innerHTML = [
      ['Approved visual', acceptedId ? acceptedId.slice(-10) : 'None', Boolean(acceptedId)],
      ['Quality gate', gate?.passed ? 'Passed' : (gate?.message || 'Not ready'), Boolean(gate?.passed)],
      ['Aggregate score', Number.isFinite(score) ? score.toFixed(1) + '%' : '—', Boolean(gate?.passed)],
      ['Viewport evidence', viewportLabel, Boolean(gate?.passed)]
    ].map(item => `<article class="${item[2] ? 'pass' : 'fail'}"><span>${esc(item[0])}</span><b title="${esc(item[1])}">${esc(item[1])}</b></article>`).join('');

    const mode = $('uiStudioPhase6Mode');
    const repo = $('uiStudioPhase6Repository');
    const base = $('uiStudioPhase6BaseBranch');
    const target = $('uiStudioPhase6TargetDir');
    if (mode && !mode.dataset.touched) mode.value = delivery?.targetMode || 'EXPORT_ONLY';
    if (repo && !repo.dataset.touched && !repo.value) repo.value = delivery?.repository || capability.defaultRepository || '';
    if (base && !base.dataset.touched && !base.value) base.value = delivery?.baseBranch || capability.defaultBaseBranch || 'deployment/railway-postgres';
    if (target && !target.dataset.touched && !target.value) target.value = delivery?.targetDirectory || capability.defaultTargetDirectory || '';

    const createBtn = $('uiStudioPhase6CreateBtn');
    const download = $('uiStudioPhase6DownloadBtn');
    const prBtn = $('uiStudioPhase6PrBtn');
    const approveBtn = $('uiStudioPhase6ApproveBtn');
    const deployBtn = $('uiStudioPhase6DeployBtn');
    if (createBtn) createBtn.disabled = !state.canEdit || !gate?.passed || state.phase6Busy;
    if (download) {
      download.hidden = !delivery?.downloadUrl;
      if (delivery?.downloadUrl) {
        download.href = delivery.downloadUrl;
        download.setAttribute('download', delivery.artifactFileName || 'ui-studio-delivery.zip');
      }
    }
    const repoMode = delivery?.targetMode === 'REPOSITORY';
    const githubReady = Boolean(cfg.githubConfigured ?? capability.githubConfigured);
    if (prBtn) prBtn.disabled = !state.canEdit || state.phase6Busy || !delivery || !repoMode || Boolean(delivery.pullRequestNumber) || !githubReady;
    if (approveBtn) approveBtn.disabled = !state.canEdit || state.phase6Busy || !delivery
      || delivery.status === 'APPROVED' || delivery.status === 'DEPLOY_TRIGGERED'
      || (repoMode && !delivery.pullRequestNumber);
    if (deployBtn) deployBtn.disabled = !state.canEdit || state.phase6Busy || !delivery || !repoMode
      || !delivery.pullRequestNumber || delivery.status !== 'APPROVED' || !githubReady;

    const policy = $('uiStudioPhase6Policy');
    if (policy) {
      if (githubReady) {
        policy.className = 'ui-studio-phase6-policy';
        policy.textContent = 'Repository delivery is optional. Connected repositories use a review-first workflow before any merge or deployment.';
      } else {
        policy.className = 'ui-studio-phase6-policy warning';
        policy.textContent = 'Portable ZIP export is ready now. Repository delivery is an optional provider connection and is not required to use UI Studio.';
      }
    }

    deliveriesHost.innerHTML = (cfg.deliveries || []).length
      ? cfg.deliveries.map(item => `<article class="ui-studio-phase6-delivery ${item.id === delivery?.id ? 'active' : ''}" data-phase6-delivery="${esc(item.id)}">
          <div><b>${esc(item.targetMode.replaceAll('_',' '))} · ${esc(item.status.replaceAll('_',' '))}</b>
          <small>${esc(item.repository || item.artifactFileName || 'Delivery package')} · ${esc(fmtDate(item.createdAt))}</small></div>
          <aside><span>${esc(item.regression?.passed ? 'Gate passed' : 'Review')}</span>${item.pullRequestUrl ? `<a href="${esc(item.pullRequestUrl)}" target="_blank" rel="noopener">PR #${esc(item.pullRequestNumber)} ↗</a>` : ''}</aside>
        </article>`).join('')
      : '<div class="ui-studio-phase6-empty">No export yet. Approve the visual match and generate production code, then create a portable delivery bundle.</div>';

    document.querySelectorAll('[data-phase6-delivery]').forEach(card => card.addEventListener('click', event => {
      if (event.target.closest('a')) return;
      state.phase6SelectedDeliveryId = card.dataset.phase6Delivery;
      renderPhase6Panel();
    }));
    syncPhase6RepositoryFields();
  }

  async function loadPhase6() {
    if (!state.project) return null;
    const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase6');
    state.phase6Config = data.phase6 || null;
    if (!state.phase6SelectedDeliveryId || !(state.phase6Config?.deliveries || []).some(item => item.id === state.phase6SelectedDeliveryId)) {
      state.phase6SelectedDeliveryId = state.phase6Config?.deliveries?.[0]?.id || null;
    }
    renderPhase6Panel();
    return state.phase6Config;
  }

  async function createPhase6Delivery() {
    if (!state.project || !state.canEdit || state.phase6Busy) return;
    state.phase6Busy = true;
    renderPhase6Panel();
    try {
      const mode = $('uiStudioPhase6Mode').value;
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase6/deliveries', {
        method: 'POST',
        body: JSON.stringify({
          targetMode: mode,
          repository: mode === 'REPOSITORY' ? $('uiStudioPhase6Repository').value.trim() : null,
          baseBranch: mode === 'REPOSITORY' ? $('uiStudioPhase6BaseBranch').value.trim() : null,
          targetDirectory: $('uiStudioPhase6TargetDir').value.trim()
        })
      });
      state.phase6Config = data.phase6;
      state.phase6SelectedDeliveryId = data.delivery?.id || state.phase6Config?.deliveries?.[0]?.id || null;
      notify('Portable delivery bundle created after the quality gate passed.');
    } catch (error) {
      notify(error.message);
    } finally {
      state.phase6Busy = false;
      renderPhase6Panel();
    }
  }

  async function createPhase6Pr() {
    const delivery = selectedPhase6Delivery();
    if (!state.project || !state.canEdit || !delivery || state.phase6Busy) return;
    state.phase6Busy = true;
    renderPhase6Panel();
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase6/deliveries/' + encodeURIComponent(delivery.id) + '/pr', {
        method: 'POST',
        body: JSON.stringify({})
      });
      state.phase6Config = data.phase6;
      state.phase6SelectedDeliveryId = data.delivery?.id || delivery.id;
      notify('Delivery pull request created. Review it before approval.');
    } catch (error) {
      notify(error.message);
    } finally {
      state.phase6Busy = false;
      renderPhase6Panel();
    }
  }

  async function approvePhase6Delivery() {
    const delivery = selectedPhase6Delivery();
    if (!state.project || !state.canEdit || !delivery || state.phase6Busy) return;
    state.phase6Busy = true;
    renderPhase6Panel();
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase6/deliveries/' + encodeURIComponent(delivery.id) + '/approve', {
        method: 'POST',
        body: JSON.stringify({})
      });
      state.phase6Config = data.phase6;
      state.phase6SelectedDeliveryId = data.delivery?.id || delivery.id;
      notify('Delivery approved. Deployment still requires the separate deploy action.');
    } catch (error) {
      notify(error.message);
    } finally {
      state.phase6Busy = false;
      renderPhase6Panel();
    }
  }

  async function deployPhase6Delivery() {
    const delivery = selectedPhase6Delivery();
    if (!state.project || !state.canEdit || !delivery || state.phase6Busy) return;
    state.phase6Busy = true;
    renderPhase6Panel();
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/phase6/deliveries/' + encodeURIComponent(delivery.id) + '/deploy', {
        method: 'POST',
        body: JSON.stringify({})
      });
      state.phase6Config = data.phase6;
      state.phase6SelectedDeliveryId = data.delivery?.id || delivery.id;
      notify('Approved delivery PR merged. The repository deployment pipeline can now roll it out.');
    } catch (error) {
      notify(error.message);
    } finally {
      state.phase6Busy = false;
      renderPhase6Panel();
    }
  }

  function animateUiStudioElement(element, keyframes, options = {}) {
    if (!element || typeof element.animate !== 'function' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    try {
      element.animate(keyframes, {
        duration: options.duration || 220,
        easing: options.easing || 'cubic-bezier(.2,.8,.2,1)',
        fill: 'both'
      });
    } catch (_) {}
  }

  function animateStageSurface() {
    const stage = state.workflowStage;
    const panel = document.querySelector('[data-ui-stage-panel="' + stage + '"]:not([hidden])');
    const viewer = $('uiStudioViewer');
    const target = panel || (!viewer?.hidden ? viewer : null);
    animateUiStudioElement(target, [
      { opacity: 0, transform: 'translateY(10px) scale(.995)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { duration: 240 });
  }

  function setSideTab(tab) {
    state.sideTab = tab === 'AGENT' ? 'AGENT' : 'INSPECTOR';
    renderAgentPanel();
    const dock = document.querySelector('.ui-studio-workspace-side');
    animateUiStudioElement(dock, [
      { opacity: .82, transform: 'translateX(6px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 180 });
  }

  function renderAgentPanel() {
    const inspector = $('uiStudioInspectorPane');
    const agent = $('uiStudioAgentPane');
    if (!inspector || !agent) return;
    const showAgent = state.sideTab === 'AGENT';
    inspector.hidden = showAgent;
    agent.hidden = !showAgent;
    document.querySelectorAll('[data-ui-side-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.uiSideTab === state.sideTab);
    });

    const status = $('uiStudioAgentStatus');
    const host = $('uiStudioAgentMessages');
    const actionHost = $('uiStudioAgentAction');
    const input = $('uiStudioAgentInput');
    const send = $('uiStudioAgentSend');
    if (!status || !host || !actionHost || !input || !send) return;

    const configured = Boolean(state.agentConfig?.configured);
    status.textContent = !configured ? 'Unavailable' : state.agentBusy ? 'Thinking…' : 'Ready';
    status.className = 'status-chip ' + (configured ? 'ui-studio-analysis-ready' : '');
    input.disabled = !configured || !state.canEdit || state.agentBusy;
    send.disabled = !configured || !state.canEdit || state.agentBusy;
    send.textContent = state.agentBusy ? 'Thinking…' : 'Send';

    const messages = state.agentMessages || [];
    host.innerHTML = messages.length
      ? messages.map(message => {
          const role = message.role === 'ASSISTANT' ? 'assistant' : 'user';
          const name = role === 'assistant' ? 'UI Studio Agent' : 'You';
          return '<article class="ui-studio-agent-message ' + role + '"><span>' + esc(name) + '</span><p>' +
            esc(message.content || '').replace(/\n/g,'<br>') + '</p></article>';
        }).join('')
      : '<div class="ui-studio-agent-empty"><b>Ask about this project</b><span>Try “What should I do next?”, “Why is the mobile match lower?”, or “Is this ready to export?”</span></div>';

    const latestAssistant = [...messages].reverse().find(message => message.role === 'ASSISTANT' && message.action?.type && message.action.type !== 'NONE');
    if (latestAssistant?.action) {
      actionHost.hidden = false;
      actionHost.innerHTML = '<div><span>Recommended next action</span><b>' + esc(latestAssistant.action.label || latestAssistant.action.type) +
        '</b><small>' + esc(latestAssistant.action.reason || '') + '</small></div><button class="secondary" type="button" id="uiStudioAgentActionBtn">Run action</button>';
      $('uiStudioAgentActionBtn')?.addEventListener('click', () => void performAgentAction(latestAssistant.action.type));
    } else {
      actionHost.hidden = true;
      actionHost.innerHTML = '';
    }
    if (showAgent) requestAnimationFrame(() => { host.scrollTop = host.scrollHeight; });
  }

  async function loadAgentMessages() {
    if (!state.project) return [];
    const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/agent/messages');
    state.agentConfig = {
      ...(state.agentConfig || {}),
      configured: Boolean(data.configured),
      version: data.version || state.agentConfig?.version
    };
    state.agentMessages = data.messages || [];
    renderAgentPanel();
    return state.agentMessages;
  }

  async function askAgent(event) {
    event?.preventDefault();
    if (!state.project || !state.canEdit || state.agentBusy || !state.agentConfig?.configured) return;
    const input = $('uiStudioAgentInput');
    const message = String(input?.value || '').trim();
    if (!message) return;
    state.agentBusy = true;
    renderAgentPanel();
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/agent/messages', {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      if (input) input.value = '';
      if (data.user) state.agentMessages.push(data.user);
      if (data.assistant) state.agentMessages.push(data.assistant);
    } catch (error) {
      notify(error.message);
    } finally {
      state.agentBusy = false;
      renderAgentPanel();
    }
  }

  async function performAgentAction(type) {
    if (!state.project || !state.canEdit) return;
    if (type === 'UPLOAD_REFERENCE') {
      setWorkflowStage('DESIGN', { force: true });
      $('uiStudioFile')?.click();
      return;
    }
    if (type === 'ANALYSE') {
      setWorkflowStage('UNDERSTAND', { force: true });
      return analyseProject();
    }
    if (type === 'BUILD_PREVIEW') {
      setWorkflowStage('PREVIEW', { force: true });
      return buildPreview();
    }
    if (type === 'RUN_MATCH') {
      setWorkflowStage('MATCH', { force: true });
      return startPhase5();
    }
    if (type === 'APPROVE') {
      setWorkflowStage('APPROVE', { force: true });
      return acceptPhase5Best();
    }
    if (type === 'GENERATE_CODE') {
      setWorkflowStage('GENERATE', { force: true });
      return finalizeProductionCode();
    }
    if (type === 'EXPORT_BUNDLE') {
      setWorkflowStage('DELIVER', { force: true });
      if ($('uiStudioPhase6Mode')) $('uiStudioPhase6Mode').value = 'EXPORT_ONLY';
      renderPhase6Panel();
      return createPhase6Delivery();
    }
  }

  function analysisIsCurrent() {
    const analysis = state.project?.latestAnalysis;
    return Boolean(analysis && analysis.status === 'COMPLETED' && !analysis.stale && analysis.result);
  }

  function previewBuildIsCurrent() {
    const generation = latestGenerationSummary();
    return Boolean(generation && ['READY','READY_WITH_WARNINGS'].includes(generation.status) && !generation.stale);
  }

  function previewRenderIsReady() {
    const render = currentVisualRender();
    return Boolean(render && visualRenderIsCurrent(render) && render.status === 'COMPLETED');
  }

  function derivedWorkflowStage() {
    const project = state.project;
    if (!project || Number(project.referenceCount || 0) === 0) return 'DESIGN';
    if (!analysisIsCurrent()) return 'UNDERSTAND';
    if (!previewBuildIsCurrent()) return 'PREVIEW';
    if (!project.bestGenerationId) return 'MATCH';
    if (!project.acceptedGenerationId || project.acceptedGenerationId !== project.bestGenerationId) return 'APPROVE';
    if (!project.productionGenerationId || project.productionGenerationId !== project.acceptedGenerationId || !project.productionGeneratedAt) return 'GENERATE';
    return 'DELIVER';
  }

  function maxUnlockedStageIndex() {
    const project = state.project;
    if (!project) return 0;
    if (Number(project.referenceCount || 0) === 0) return 0;
    if (!analysisIsCurrent()) return 1;
    if (!previewBuildIsCurrent()) return 2;
    if (!project.bestGenerationId) return 3;
    if (!project.acceptedGenerationId || project.acceptedGenerationId !== project.bestGenerationId) return 4;
    if (!project.productionGenerationId || project.productionGenerationId !== project.acceptedGenerationId || !project.productionGeneratedAt) return 5;
    return 6;
  }

  function setWorkflowStage(stage, options = {}) {
    if (!WORKFLOW_STAGES.includes(stage)) return;
    const index = WORKFLOW_STAGES.indexOf(stage);
    if (!options.force && index > maxUnlockedStageIndex()) {
      notify('Complete the current UI Studio step first.');
      return;
    }
    state.workflowStage = stage;
    renderWorkspace();
    requestAnimationFrame(animateStageSurface);
  }

  function renderApprovePanel() {
    const host = $('uiStudioApproveSummary');
    const button = $('uiStudioPhase5AcceptBtn');
    if (!host || !button) return;
    const cfg = state.phase5Config || {};
    const bestId = cfg.bestGenerationId || state.project?.bestGenerationId || null;
    const acceptedId = cfg.acceptedGenerationId || state.project?.acceptedGenerationId || null;
    const score = Number(cfg.bestAggregateScore ?? state.project?.bestAggregateScore);
    const best = cfg.bestGeneration || null;
    const scores = best?.viewportScores || {};
    const scoreItems = ['DESKTOP','TABLET','MOBILE']
      .filter(viewport => scores[viewport] != null)
      .map(viewport => '<div><span>' + esc(viewport[0] + viewport.slice(1).toLowerCase()) + '</span><b>' + esc(Math.round(Number(scores[viewport]))) + '%</b></div>');
    host.innerHTML = [
      '<div><span>Best match</span><b>' + (Number.isFinite(score) ? esc(score.toFixed(1)) + '%' : '—') + '</b></div>',
      ...scoreItems,
      '<div><span>Status</span><b>' + esc(acceptedId === bestId && bestId ? 'Approved' : (bestId ? 'Ready to approve' : 'Run Match & Refine first')) + '</b></div>'
    ].join('');
    const currentApproval = Boolean(bestId && acceptedId === bestId);
    button.disabled = !state.canEdit || !bestId || currentApproval;
    button.textContent = currentApproval ? '✓ Approved' : '✓ Approve best match';
  }

  function renderWorkflow() {
    if (!state.project) return;
    const derived = derivedWorkflowStage();
    const maxIndex = maxUnlockedStageIndex();
    if (!state.workflowStage || WORKFLOW_STAGES.indexOf(state.workflowStage) > maxIndex) state.workflowStage = derived;
    const stage = state.workflowStage;

    document.querySelectorAll('[data-ui-stage]').forEach(button => {
      const index = WORKFLOW_STAGES.indexOf(button.dataset.uiStage);
      button.disabled = index > maxIndex;
      button.classList.toggle('active', button.dataset.uiStage === stage);
      button.classList.toggle('complete', index < WORKFLOW_STAGES.indexOf(derived) || (derived === 'DELIVER' && index < 6));
    });
    document.querySelectorAll('[data-ui-stage-panel]').forEach(panel => {
      panel.hidden = panel.dataset.uiStagePanel !== stage;
    });

    const showReferenceCanvas = stage === 'DESIGN' || stage === 'UNDERSTAND';
    const showResponsiveTabs = stage === 'PREVIEW';
    document.querySelector('.ui-studio-viewport-tabs')?.toggleAttribute('hidden', !showResponsiveTabs);
    document.querySelector('.ui-studio-viewer-toolbar')?.toggleAttribute('hidden', !showReferenceCanvas);
    $('uiStudioViewer')?.toggleAttribute('hidden', !showReferenceCanvas);

    const upload = document.querySelector('.ui-studio-upload');
    const uploadNote = $('uiStudioUploadNote');
    if (upload) upload.hidden = stage !== 'DESIGN';
    if (uploadNote) uploadNote.hidden = stage !== 'DESIGN';

    const copy = STAGE_COPY[stage] || STAGE_COPY.DESIGN;
    if ($('uiStudioStageEyebrow')) $('uiStudioStageEyebrow').textContent = copy[0];
    if ($('uiStudioStageTitle')) $('uiStudioStageTitle').textContent = copy[1];
    if ($('uiStudioStageHint')) $('uiStudioStageHint').textContent = copy[2];

    const next = $('uiStudioNextActionBtn');
    if (!next) return;

    next.hidden = stage === 'DESIGN' || stage === 'UNDERSTAND';
    next.disabled = !state.canEdit;

    if (stage === 'PREVIEW') {
      next.hidden = false;
      next.textContent = previewBuildIsCurrent()
        ? 'Continue to Match & Refine →'
        : state.pipelineBusy || state.generating
          ? 'Preparing responsive preview…'
          : 'Retry preview';
      next.disabled = next.disabled || state.pipelineBusy || state.generating || (!previewBuildIsCurrent() && !state.pipelineError);
    } else if (stage === 'MATCH') {
      next.hidden = false;
      next.textContent = state.project.bestGenerationId ? 'Review best match →' : (state.phase5Running ? 'Comparing…' : '◎ Compare uploaded reference');
      next.disabled = next.disabled || state.phase5Running;
    } else if (stage === 'APPROVE') {
      next.hidden = false;
      const currentApproval = Boolean(state.project.bestGenerationId && state.project.acceptedGenerationId === state.project.bestGenerationId);
      next.textContent = currentApproval ? 'Continue to Generate →' : '✓ Approve best match';
      next.disabled = next.disabled || (!currentApproval && !state.project.bestGenerationId);
    } else if (stage === 'GENERATE') {
      next.hidden = false;
      next.textContent = state.project.productionGenerationId ? 'Continue to Deliver →' : (state.finalizingCode ? 'Preparing code…' : '⌘ Generate production code');
      next.disabled = next.disabled || state.finalizingCode || !state.project.acceptedGenerationId;
    } else if (stage === 'DELIVER') {
      next.hidden = false;
      next.textContent = selectedPhase6Delivery()?.downloadUrl ? 'Create another export' : 'Create export bundle';
      next.disabled = next.disabled || state.phase6Busy || !state.project.productionGenerationId;
    }
  }

  async function buildPreview() {
    if (!state.project || !state.canEdit || state.pipelineBusy || state.generating) return;
    await runAutomaticPipeline({ resume: true });
  }

  async function finalizeProductionCode() {
    if (!state.project || !state.canEdit || state.finalizingCode) return;
    state.finalizingCode = true;
    renderWorkspace();
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/production-code', {
        method: 'POST',
        body: JSON.stringify({})
      });
      state.project = data.project;
      state.generationDetail = data.production?.generation || state.generationDetail;
      state.selectedGeneratedFile = state.generationDetail?.result?.entryFile || state.generationDetail?.result?.files?.[0]?.path || null;
      await Promise.all([loadProjects().catch(() => {}), loadPhase6().catch(() => {})]);
      notify('Production code prepared from the approved visual version.');
    } catch (error) {
      notify(error.message);
    } finally {
      state.finalizingCode = false;
      renderWorkspace();
    }
  }

  async function runNextAction() {
    const stage = state.workflowStage || derivedWorkflowStage();
    if (stage === 'DESIGN' || stage === 'UNDERSTAND') return runAutomaticPipeline({ resume: true });
    if (stage === 'PREVIEW') {
      if (previewBuildIsCurrent()) return setWorkflowStage('MATCH');
      return buildPreview();
    }
    if (stage === 'MATCH') {
      if (state.project.bestGenerationId) return setWorkflowStage('APPROVE');
      return startPhase5();
    }
    if (stage === 'APPROVE') {
      if (state.project.bestGenerationId && state.project.acceptedGenerationId === state.project.bestGenerationId) return setWorkflowStage('GENERATE');
      return acceptPhase5Best();
    }
    if (stage === 'GENERATE') {
      if (state.project.productionGenerationId) return setWorkflowStage('DELIVER');
      return finalizeProductionCode();
    }
    if (stage === 'DELIVER') return createPhase6Delivery();
  }

  function renderWorkspace() {
    const project = state.project;
    $('uiStudioPage')?.classList.toggle('workspace-open', Boolean(project));
    if (!project) {
      $('uiStudioWorkspace').hidden = true;
      $('uiStudioProjectsArea').hidden = false;
      return;
    }

    $('uiStudioProjectsArea').hidden = true;
    $('uiStudioWorkspace').hidden = false;
    $('uiStudioProjectName').textContent = project.name;
    $('uiStudioProjectMeta').textContent = (project.frameworkTargets || [project.framework]).map(frameworkLabel).join(' + ') + ' · ' + (project.stylingTargets || [project.styling]).map(stylingLabel).join(' + ');

    document.querySelectorAll('[data-ui-viewport]').forEach(button => {
      button.classList.toggle('active', button.dataset.uiViewport === state.viewport);
    });

    const stage = state.workflowStage || derivedWorkflowStage();
    const sourceReference = primaryReference(project);
    const current = stage === 'DESIGN' || stage === 'UNDERSTAND'
      ? sourceReference
      : latest(project, state.viewport);
    const local = state.localObjectUrl;
    const imageUrl = local || current?.contentUrl || '';
    const analysis = project.latestAnalysis;
    const viewportAnalysis = local || !current || !analysis?.result
      ? null
      : (analysis.result.viewportAnalyses || []).find(item => item.viewport === current.viewport) || null;

    $('uiStudioViewerMeta').innerHTML = state.selectedFile
      ? '<b>' + esc(state.selectedFile.name) + '</b><small>' +
          esc((state.selectedDimensions?.width || '—') + ' × ' + (state.selectedDimensions?.height || '—') + ' · ' + bytes(state.selectedFile.size)) +
          ' · uploading automatically</small>'
      : current
        ? '<b>' + esc(current.originalName) + '</b><small>' +
            esc(current.width + ' × ' + current.height + ' · ' + bytes(current.byteSize)) +
            ' · uploaded ' + esc(fmtDate(current.createdAt)) + '</small>'
        : '<b>No design uploaded</b><small>Choose one reference design below.</small>';

    renderViewer(imageUrl, project.name + ' design reference', viewportAnalysis);

    $('uiStudioOpenOriginal').hidden = !current || Boolean(local);
    if (current && !local) $('uiStudioOpenOriginal').href = current.contentUrl;

    $('uiStudioProjectFacts').innerHTML = [
      ['Created', fmtDate(project.createdAt)],
      ['Preview stack', frameworkLabel(project.framework) + ' · ' + stylingLabel(project.styling)],
      ['Framework targets', (project.frameworkTargets || [project.framework]).map(frameworkLabel).join(', ')],
      ['Styling targets', (project.stylingTargets || [project.styling]).map(stylingLabel).join(', ')],
      ['Source designs', String(project.referenceCount || 0)],
      ['Analysis', analysisIsCurrent() ? 'Ready' : (project.latestAnalysis?.status || 'Waiting')],
      ['Responsive preview', previewBuildIsCurrent() ? 'Ready' : (project.latestGeneration?.status === 'RUNNING' ? 'Preparing' : 'Waiting')],
      ['Production code', project.productionGeneratedAt ? 'Ready · ' + fmtDate(project.productionGeneratedAt) : 'Not generated']
    ].map(item => '<div><span>' + esc(item[0]) + '</span><b>' + esc(item[1]) + '</b></div>').join('');

    const history = project.references || [];
    $('uiStudioReferenceHistory').innerHTML = history.length
      ? history.map(reference => '<div class="ui-studio-history-row">' +
          '<img src="' + esc(reference.contentUrl) + '" alt="" loading="lazy">' +
          '<div><b>' + esc(reference.originalName) + '</b>' +
          '<small>' + esc(reference.viewport[0] + reference.viewport.slice(1).toLowerCase()) + ' source · ' + esc(reference.width + ' × ' + reference.height + ' · ' + bytes(reference.byteSize)) + '</small>' +
          '<small>' + esc(fmtDate(reference.createdAt)) + '</small>' +
          '<a href="' + esc(reference.contentUrl) + '" target="_blank" rel="noopener">Open original ↗</a></div>' +
        '</div>').join('')
      : '<p class="muted">No design source uploaded yet.</p>';

    const fileInput = $('uiStudioFile');
    if (fileInput) fileInput.disabled = !state.canEdit || state.pipelineBusy;
    const uploadButton = $('uiStudioUploadBtn');
    if (uploadButton) uploadButton.disabled = !state.canEdit || !state.selectedFile || state.pipelineBusy;

    $('uiStudioUploadCopy').innerHTML = state.pipelineBusy
      ? '<b>' + esc(
          state.pipelineStep === 'UPLOADING' ? 'Uploading design…' :
          state.pipelineStep === 'ANALYSING' ? 'Analysing design…' :
          'Preparing responsive preview…'
        ) + '</b><small>This continues automatically.</small>'
      : state.selectedFile
        ? '<b>' + esc(state.selectedFile.name) + '</b><small>' +
            esc((state.selectedDimensions?.width || 'Reading') + (state.selectedDimensions ? ' × ' + state.selectedDimensions.height : '') + ' · ' + bytes(state.selectedFile.size)) +
            '</small>'
        : '<b>Choose design</b><small>One image is enough · Desktop, Tablet and Mobile previews are generated automatically</small>';

    $('uiStudioUploadNote').textContent = state.canEdit
      ? 'Your original file is stored untouched. Separate tablet/mobile reference uploads are optional and only needed for exact pixel comparison against dedicated designs.'
      : 'Viewing only. Upload access requires Super Admin.';
    $('uiStudioUploadNote').className = 'ui-studio-upload-note';

    renderAnalysisPanel();
    renderCodegenPanel();
    renderVisualPanel();
    renderPhase5Panel();
    renderApprovePanel();
    renderPhase6Panel();
    renderAgentPanel();
    renderWorkflow();
    setZoom(state.zoom);
  }

  async function selectProject(projectId) {
    clearLocalPreview();
    state.overlay = false;
    const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(projectId));
    state.project = data.project;
    state.canEdit = Boolean(data.canEdit);
    state.storage = data.storage || state.storage;
    state.analysisConfig = data.analysis || state.analysisConfig;
    state.codegenConfig = data.codegen || state.codegenConfig;
    state.visualConfig = data.visual || state.visualConfig;
    state.phase5Capability = data.phase5 || state.phase5Capability;
    state.phase6Capability = data.phase6 || state.phase6Capability;
    state.agentConfig = data.agent || state.agentConfig;
    state.phase5Config = null;
    state.phase5Batch = null;
    state.phase5Running = false;
    clearTimeout(state.phase5PollTimer);
    state.phase6Config = null;
    state.phase6SelectedDeliveryId = null;
    state.agentMessages = [];
    state.workflowStage = null;
    state.sideTab = 'INSPECTOR';
    state.generationDetail = null;
    state.selectedGeneratedFile = null;
    state.visualRender = null;
    state.visualFrame = null;
    state.viewport = latest(data.project, 'DESKTOP') ? 'DESKTOP' : (latest(data.project, 'TABLET') ? 'TABLET' : (latest(data.project, 'MOBILE') ? 'MOBILE' : 'DESKTOP'));
    state.zoom = 'fit';
    state.visualRender = (data.project.renders || []).find(item => item.viewport === state.viewport) || data.project.latestRender || null;
    renderWorkspace();
    const workspace = $('uiStudioWorkspace');
    workspace?.classList.remove('ui-studio-animate-in');
    requestAnimationFrame(() => {
      workspace?.classList.add('ui-studio-animate-in');
      animateStageSurface();
    });
    await loadLatestGeneration().catch(error => notify(error.message));
    if (state.project?.productionGenerationId) await loadProductionGeneration().catch(error => notify(error.message));
    await loadPhase5().catch(error => notify(error.message));
    await loadPhase6().catch(error => notify(error.message));
    await loadAgentMessages().catch(() => {});
    if (state.visualRender?.id && state.visualRender.status === 'COMPLETED') {
      const visual = await request('/api/admin/ui-studio/renders/' + encodeURIComponent(state.visualRender.id)).catch(() => null);
      if (visual?.render) state.visualRender = visual.render;
    }
    renderWorkspace();
  }

  async function refreshProject() {
    if (!state.project) return;
    const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id));
    state.project = data.project;
    state.canEdit = Boolean(data.canEdit);
    state.analysisConfig = data.analysis || state.analysisConfig;
    state.codegenConfig = data.codegen || state.codegenConfig;
    state.visualConfig = data.visual || state.visualConfig;
    state.phase5Capability = data.phase5 || state.phase5Capability;
    state.phase6Capability = data.phase6 || state.phase6Capability;
    state.agentConfig = data.agent || state.agentConfig;
    if (state.generationDetail?.id !== state.project?.latestGeneration?.id) {
      state.generationDetail = null;
      state.selectedGeneratedFile = null;
    }
    if (!state.visualRunning) {
      state.visualRender = (state.project.renders || []).find(item => item.viewport === state.viewport) || state.project.latestRender || state.visualRender;
    }
    if (state.project?.productionGenerationId) await loadProductionGeneration().catch(() => {});
    renderWorkspace();
    if (state.project) await loadPhase6().catch(() => {});
  }

  function readDimensions(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, url });
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be previewed.')); };
      image.src = url;
    });
  }

  async function handleFile(file) {
    clearLocalPreview();
    state.overlay = false;
    state.pipelineError = null;
    if (!file) { renderWorkspace(); return; }
    if (!['image/png','image/jpeg','image/webp','image/avif'].includes(file.type) || file.size > 50 * 1024 * 1024) {
      notify('Choose a PNG, JPEG, WebP or AVIF image no larger than 50 MB.');
      renderWorkspace();
      return;
    }
    try {
      const dimensions = await readDimensions(file);
      state.selectedFile = file;
      state.selectedDimensions = dimensions;
      state.localObjectUrl = dimensions.url;
      state.viewport = inferReferenceViewport(dimensions);
      state.zoom = 'fit';
      renderWorkspace();
      await uploadReference({ autoPipeline: true });
    } catch (error) {
      state.pipelineBusy = false;
      state.pipelineStep = null;
      state.pipelineError = error.message;
      notify(error.message);
      renderWorkspace();
    }
  }

  async function uploadReference(options = {}) {
    if (!state.canEdit || !state.project || !state.selectedFile) return null;
    const button = $('uiStudioUploadBtn');
    const file = state.selectedFile;
    const viewport = inferReferenceViewport(state.selectedDimensions);
    state.viewport = viewport;
    state.pipelineBusy = true;
    state.pipelineStep = 'UPLOADING';
    state.pipelineError = null;
    if (button) {
      button.disabled = true;
      button.textContent = 'Uploading…';
    }
    renderWorkspace();

    try {
      const response = await fetch(
        '/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/references/' + encodeURIComponent(viewport) + '/upload',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': file.type,
            'X-File-Name': encodeURIComponent(file.name)
          },
          body: file
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'UI reference upload failed.');

      clearLocalPreview();
      state.overlay = false;
      state.visualRender = null;
      state.phase5Config = null;
      state.phase5Batch = null;
      await Promise.all([refreshProject(), loadProjects()]);
      await loadPhase5().catch(() => {});

      if (options.autoPipeline !== false) {
        await runAutomaticPipeline({ fromUpload: true });
      } else {
        state.pipelineBusy = false;
        state.pipelineStep = null;
        renderWorkspace();
      }
      return data.reference || null;
    } catch (error) {
      state.pipelineBusy = false;
      state.pipelineStep = null;
      state.pipelineError = error.message;
      notify(error.message);
      renderWorkspace();
      return null;
    } finally {
      if (button) {
        button.textContent = 'Upload';
        button.disabled = !state.canEdit || !state.selectedFile;
      }
    }
  }

  async function analyseProject(options = {}) {
    if (!state.project || !state.canEdit) return null;
    if (state.analysing && !options.followExisting) return null;
    state.analysing = true;
    state.pipelineStep = 'ANALYSING';
    state.pipelineError = null;
    state.overlay = false;
    state.workflowStage = 'UNDERSTAND';
    renderWorkspace();

    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/analyse', {
        method: 'POST',
        body: JSON.stringify({})
      });
      state.project = data.project;

      if (data.alreadyRunning || data.analysis?.status === 'RUNNING') {
        await pollProjectUntil(
          project => project.latestAnalysis?.status !== 'RUNNING',
          {
            timeoutMessage: 'Design analysis is still running. Reopen the project and UI Studio will continue following it.'
          }
        );
      }

      if (!analysisIsCurrent()) {
        const message = state.project?.latestAnalysis?.errorMessage || 'Design analysis did not complete successfully.';
        throw new Error(message);
      }

      state.overlay = true;
      state.visualRender = null;
      state.phase5Config = null;
      state.phase5Batch = null;
      await loadProjects().catch(() => {});
      await loadPhase5().catch(() => {});
      renderWorkspace();
      return state.project.latestAnalysis;
    } catch (error) {
      state.pipelineError = error.message;
      if (!options.quiet) notify(error.message);
      await refreshProject().catch(() => {});
      return null;
    } finally {
      state.analysing = false;
      renderWorkspace();
    }
  }

  async function generateResponsiveUi(previewOnly = false, options = {}) {
    if (!state.project || !state.canEdit) return null;
    if (state.generating && !options.followExisting) return null;
    state.generating = true;
    state.pipelineStep = 'PREPARING_PREVIEW';
    state.pipelineError = null;
    state.workflowStage = 'PREVIEW';
    renderWorkspace();

    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/generate', {
        method: 'POST',
        body: JSON.stringify({})
      });
      state.project = data.project;
      state.generationDetail = data.generation || null;
      state.visualRender = null;
      state.phase5Config = null;
      state.phase5Batch = null;

      if (data.alreadyRunning || data.generation?.status === 'RUNNING') {
        await pollProjectUntil(
          project => project.latestGeneration?.status !== 'RUNNING',
          {
            timeoutMessage: 'Responsive preview preparation is still running. Reopen the project and UI Studio will continue following it.'
          }
        );
      }

      if (!previewBuildIsCurrent()) {
        const message = state.project?.latestGeneration?.errorMessage || 'Responsive preview preparation did not complete successfully.';
        throw new Error(message);
      }

      await loadLatestGeneration().catch(() => {});
      state.selectedGeneratedFile = state.generationDetail?.result?.entryFile || state.generationDetail?.result?.files?.[0]?.path || null;
      await loadProjects().catch(() => {});
      await loadPhase5().catch(() => {});
      renderWorkspace();
      return state.project.latestGeneration || state.generationDetail;
    } catch (error) {
      state.pipelineError = error.message;
      if (!options.quiet) notify(error.message);
      await refreshProject().catch(() => {});
      await loadLatestGeneration().catch(() => {});
      return null;
    } finally {
      state.generating = false;
      renderWorkspace();
    }
  }

  async function runAutomaticPipeline(options = {}) {
    if (!state.project || !state.canEdit || Number(state.project.referenceCount || 0) === 0) return false;
    if (state.pipelineBusy && !options.fromUpload && !options.resume) return false;
    state.pipelineBusy = true;
    state.pipelineError = null;

    try {
      if (!analysisIsCurrent()) {
        state.workflowStage = 'UNDERSTAND';
        renderWorkspace();
        const analysis = await analyseProject({ quiet: true, followExisting: true });
        if (!analysis) throw new Error(state.pipelineError || 'Design analysis could not be completed.');
      }

      if (!previewBuildIsCurrent()) {
        state.workflowStage = 'PREVIEW';
        renderWorkspace();
        const generation = await generateResponsiveUi(true, { quiet: true, followExisting: true });
        if (!generation) throw new Error(state.pipelineError || 'Responsive preview could not be prepared.');
      }

      state.pipelineStep = null;
      state.pipelineBusy = false;
      state.pipelineError = null;
      state.workflowStage = 'PREVIEW';
      state.viewport = 'DESKTOP';
      renderWorkspace();
      if (options.fromUpload) notify('Design analysed and responsive preview ready.');
      return true;
    } catch (error) {
      state.pipelineBusy = false;
      state.pipelineStep = null;
      state.pipelineError = error.message;
      notify(error.message);
      renderWorkspace();
      return false;
    }
  }

  function resumeAutomaticPipeline() {
    if (!state.project || !state.canEdit || Number(state.project.referenceCount || 0) === 0) return;
    if (previewBuildIsCurrent()) return;
    if (state.project.acceptedGenerationId || state.project.productionGenerationId) return;
    void runAutomaticPipeline({ resume: true });
  }

  async function createProject(event) {
    event.preventDefault();
    const submit = $('uiStudioCreateSubmit');
    submit.disabled = true;
    submit.textContent = 'Creating…';
    try {
      const data = await request('/api/admin/ui-studio/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: $('uiStudioProjectNameInput').value.trim(),
          framework: $('uiStudioFramework').value,
          styling: $('uiStudioStyling').value,
          frameworkTargets: [
            $('uiStudioFramework').value,
            ...Array.from(document.querySelectorAll('#uiStudioFrameworkTargets input:checked')).map(input => input.value)
          ].filter((value, index, values) => values.indexOf(value) === index),
          stylingTargets: [
            $('uiStudioStyling').value,
            ...Array.from(document.querySelectorAll('#uiStudioStylingTargets input:checked')).map(input => input.value)
          ].filter((value, index, values) => values.indexOf(value) === index),
          outputType: 'SECTION'
        })
      });
      $('uiStudioCreateDialog').close();
      $('uiStudioCreateForm').reset();
      notify('UI Studio project created.');
      await loadProjects();
      await selectProject(data.project.id);
    } catch (error) {
      notify(error.message);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Create project';
    }
  }

  window.loadUiStudio = async () => {
    try {
      await loadProjects();
      if (state.project) await refreshProject();
    } catch (error) {
      notify(error.message);
      $('uiStudioProjectGrid').innerHTML = '<div class="ui-studio-empty"><b>UI Studio could not load</b><p>'+esc(error.message)+'</p></div>';
    }
  };

  $('newUiStudioProjectBtn')?.addEventListener('click', () => {
    if (!state.canEdit) return;
    $('uiStudioCreateForm').reset();
    $('uiStudioCreateDialog').showModal();
  });
  $('uiStudioCreateForm')?.addEventListener('submit', createProject);
  $('uiStudioCreateCancel')?.addEventListener('click', () => $('uiStudioCreateDialog').close());
  $('uiStudioCreateClose')?.addEventListener('click', () => $('uiStudioCreateDialog').close());
  $('uiStudioCreateDialog')?.addEventListener('click', event => {
    if (event.target === $('uiStudioCreateDialog')) $('uiStudioCreateDialog').close();
  });
  $('refreshUiStudioBtn')?.addEventListener('click', async () => {
    const button = $('refreshUiStudioBtn');
    button.disabled = true;
    button.textContent = 'Refreshing…';
    try { await loadProjects(); if (state.project) { await refreshProject(); await loadPhase5().catch(() => {}); await loadPhase6().catch(() => {}); } notify('UI Studio refreshed'); }
    catch (error) { notify(error.message); }
    finally { button.disabled = false; button.textContent = '↻ Refresh'; }
  });
  $('uiStudioBackBtn')?.addEventListener('click', () => {
    clearLocalPreview();
    state.project = null;
    state.overlay = false;
    state.generationDetail = null;
    state.selectedGeneratedFile = null;
    state.visualRender = null;
    state.visualFrame = null;
    state.phase5Config = null;
    state.phase5Batch = null;
    state.phase5Running = false;
    state.phase6Config = null;
    state.phase6SelectedDeliveryId = null;
    state.phase6Busy = false;
    clearTimeout(state.phase5PollTimer);
    renderWorkspace();
  });
  document.querySelectorAll('[data-ui-viewport]').forEach(button => button.addEventListener('click', () => {
    clearLocalPreview();
    state.viewport = button.dataset.uiViewport;
    state.overlay = false;
    state.visualRender = (state.project?.renders || []).find(item => item.viewport === state.viewport) || null;
    state.visualFrame = null;
    state.zoom = 'fit';
    renderWorkspace();
  }));
  document.querySelectorAll('[data-ui-zoom]').forEach(button => button.addEventListener('click', () => setZoom(button.dataset.uiZoom)));
  $('uiStudioOverlayBtn')?.addEventListener('click', () => {
    if ($('uiStudioOverlayBtn').disabled) return;
    state.overlay = !state.overlay;
    renderWorkspace();
  });
  $('uiStudioAnalyseBtn')?.addEventListener('click', () => void analyseProject());
  $('uiStudioPreviewBtn')?.addEventListener('click', () => void buildPreview());
  $('uiStudioRenderBtn')?.addEventListener('click', () => void startVisualCompare());
  $('uiStudioFinalizeCodeBtn')?.addEventListener('click', () => void finalizeProductionCode());
  $('uiStudioNextActionBtn')?.addEventListener('click', () => void runNextAction());
  document.querySelectorAll('[data-ui-stage]').forEach(button => button.addEventListener('click', () => setWorkflowStage(button.dataset.uiStage)));
  document.querySelectorAll('[data-ui-side-tab]').forEach(button => button.addEventListener('click', () => setSideTab(button.dataset.uiSideTab)));
  $('uiStudioAgentForm')?.addEventListener('submit', event => void askAgent(event));
  $('uiStudioPhase5RunBtn')?.addEventListener('click', () => void startPhase5());
  $('uiStudioPhase5AcceptBtn')?.addEventListener('click', () => void acceptPhase5Best());
  $('uiStudioPhase6Mode')?.addEventListener('change', event => { event.target.dataset.touched = '1'; renderPhase6Panel(); });
  ['uiStudioPhase6Repository','uiStudioPhase6BaseBranch','uiStudioPhase6TargetDir'].forEach(id => $(id)?.addEventListener('input', event => { event.target.dataset.touched = '1'; }));
  $('uiStudioPhase6CreateBtn')?.addEventListener('click', () => void createPhase6Delivery());
  $('uiStudioPhase6PrBtn')?.addEventListener('click', () => void createPhase6Pr());
  $('uiStudioPhase6ApproveBtn')?.addEventListener('click', () => void approvePhase6Delivery());
  $('uiStudioPhase6DeployBtn')?.addEventListener('click', () => void deployPhase6Delivery());
  $('uiStudioPhase5AutoRepair')?.addEventListener('change', event => { state.autoRepairEnabled = Boolean(event.target.checked); });
  $('uiStudioPhase5MaskForm')?.addEventListener('submit', event => void addPhase5Mask(event));
  $('uiStudioAutoRepair')?.addEventListener('change', event => { state.autoRepairEnabled = Boolean(event.target.checked); });
  $('uiStudioFile')?.addEventListener('change', event => void handleFile(event.target.files?.[0]));
  $('uiStudioUploadBtn')?.addEventListener('click', () => void uploadReference());
  window.addEventListener('message', handlePreviewMessage);
})();
