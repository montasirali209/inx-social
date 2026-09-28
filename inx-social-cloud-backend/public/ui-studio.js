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
  const STAGE_COPY = {
    DESIGN: ['Design','Add your reference design','Upload the original Desktop, Tablet or Mobile design you want UI Studio to reconstruct.'],
    UNDERSTAND: ['Understand','Review what UI Studio sees','Analyse layout, typography, colours, components and responsive behaviour before reconstruction.'],
    PREVIEW: ['Preview','Inspect the reconstruction','Build a private internal preview. Implementation code stays hidden until you approve the visual result.'],
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
      $('uiStudioViewerFrame').innerHTML = '<div class="ui-studio-viewer-empty"><span>▣</span><b>No '+esc(state.viewport.toLowerCase())+' reference yet</b><small>Upload the original PNG, JPEG, WebP or AVIF. UI Studio stores the file without resizing or recompressing it.</small></div>';
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
      summary.textContent = 'Configure the UI Studio analysis model before running Phase 2.';
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
    const button = $('uiStudioGenerateBtn');
    const status = $('uiStudioCodegenStatus');
    const summary = $('uiStudioCodegenSummary');
    const output = $('uiStudioCodegenOutput');
    if (!button || !status || !summary || !output) return;

    const analysis = state.project?.latestAnalysis || null;
    const analysisReady = Boolean(analysis && analysis.status === 'COMPLETED' && !analysis.stale && analysis.result);
    const configured = Boolean(state.codegenConfig?.configured);
    const generationSummary = latestGenerationSummary();
    const generation = currentGeneration();

    button.disabled = !state.canEdit || !configured || !analysisReady || state.generating;
    button.textContent = state.generating
      ? 'Generating responsive UI…'
      : generationSummary
        ? '⌘ Regenerate responsive UI'
        : '⌘ Generate responsive UI';

    if (state.generating) {
      status.textContent = 'Generating…';
      status.className = 'status-chip ui-studio-codegen-running';
      summary.textContent = 'Building reusable responsive implementation files from the current analysis and high-resolution reference set.';
      output.innerHTML = '<div class="ui-studio-codegen-progress"><span></span><b>Generating components, responsive styles and media slots</b><small>This creates a saved code version only. It does not modify the live INXSocial application.</small></div>';
      return;
    }

    if (!configured) {
      status.textContent = 'AI unavailable';
      status.className = 'status-chip';
      summary.textContent = 'Configure the UI Studio code-generation model before running Phase 3.';
      output.innerHTML = '';
      return;
    }

    if (!analysisReady) {
      status.textContent = 'Needs current analysis';
      status.className = 'status-chip';
      summary.textContent = analysis?.stale
        ? 'The reference set changed. Re-run Phase 2 analysis before generating code.'
        : 'Complete Phase 2 design analysis before generating responsive code.';
      output.innerHTML = '';
      return;
    }

    if (!generationSummary) {
      status.textContent = 'Ready';
      status.className = 'status-chip ui-studio-codegen-ready';
      summary.textContent = 'Generate a reusable ' + state.project.framework.replaceAll('_',' ') + ' / ' + state.project.styling.replaceAll('_',' ') + ' implementation from the current design analysis.';
      output.innerHTML = '<div class="ui-studio-codegen-empty"><b>No code generation yet</b><small>Generated code is versioned and kept separate from the live application until you explicitly integrate it.</small></div>';
      return;
    }

    if (generationSummary.status === 'FAILED') {
      status.textContent = 'Failed';
      status.className = 'status-chip ui-studio-codegen-failed';
      summary.textContent = generationSummary.errorMessage || 'The previous code generation did not complete.';
      output.innerHTML = '<div class="ui-studio-codegen-empty"><small>Retry creates a new generation version from the latest valid analysis.</small></div>';
      return;
    }

    if (generationSummary.stale) {
      status.textContent = 'Stale';
      status.className = 'status-chip ui-studio-codegen-stale';
      summary.textContent = 'The uploaded references changed after this code was generated. Re-analyse and regenerate before integration.';
    } else {
      status.textContent = generationSummary.status === 'READY_WITH_WARNINGS' ? 'Ready · warnings' : 'Code ready';
      status.className = 'status-chip ' + (generationSummary.status === 'READY_WITH_WARNINGS' ? 'ui-studio-codegen-stale' : 'ui-studio-codegen-ready');
      summary.textContent = generationSummary.summary || 'Responsive implementation generated.';
    }

    if (!generation?.result) {
      output.innerHTML = '<div class="ui-studio-codegen-loading">Loading generated files…</div>';
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
        <small>Model: ${esc(generation.model || 'configured model')} · generated ${esc(fmtDate(generation.completedAt))}</small>
        <small>Phase 3 saves code only; Phase 4 will render and visually compare it with the source reference.</small>
      </div>
    `;
    bindGeneratedFileActions();
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
    const button = $('uiStudioRenderBtn');
    const status = $('uiStudioVisualStatus');
    const summary = $('uiStudioVisualSummary');
    const output = $('uiStudioVisualOutput');
    const auto = $('uiStudioAutoRepair');
    if (!button || !status || !summary || !output || !auto) return;

    auto.checked = state.autoRepairEnabled;
    auto.disabled = state.visualRunning;
    const runtimeReady = Boolean(state.visualConfig?.ready);
    const aiReady = Boolean(state.visualConfig?.visualAiConfigured);
    const generationReady = visualGenerationReady();
    const referenceReady = Boolean(latest(state.project, state.viewport));
    const render = currentVisualRender();
    const current = visualRenderIsCurrent(render);

    button.disabled = !state.canEdit || !runtimeReady || !generationReady || !referenceReady || state.visualRunning;
    button.textContent = state.visualRunning ? 'Rendering + comparing…' : (render && current ? '◫ Re-render + compare' : '◫ Render + compare');

    if (!runtimeReady) {
      status.textContent = 'Renderer unavailable';
      status.className = 'status-chip';
      summary.textContent = 'The isolated preview renderer is not available on this runtime.';
      output.innerHTML = '<div class="ui-studio-codegen-empty"><small>Phase 4 requires the locked frontend Vite runtime already shipped with INXSocial.</small></div>';
      return;
    }
    if (!generationReady) {
      status.textContent = 'Needs current code';
      status.className = 'status-chip';
      summary.textContent = 'Generate current Phase 3 code before visual comparison.';
      output.innerHTML = '<div class="ui-studio-codegen-empty"><small>Phase 4 always compares a saved, current Phase 3 generation.</small></div>';
      return;
    }
    if (!referenceReady) {
      status.textContent = 'Needs reference';
      status.className = 'status-chip';
      summary.textContent = 'Upload a ' + state.viewport.toLowerCase() + ' reference before visual comparison.';
      output.innerHTML = '';
      return;
    }

    if (state.visualRunning) {
      status.textContent = 'Working…';
      status.className = 'status-chip ui-studio-visual-running';
      summary.textContent = 'Building the isolated preview, capturing the browser render and comparing it with the original pixels.';
      const iframe = state.visualRender?.previewUrl
        ? '<div class="ui-studio-preview-stage"><iframe id="uiStudioPreviewFrame" title="Generated UI preview" sandbox="allow-scripts"></iframe></div>'
        : '';
      output.innerHTML = '<div class="ui-studio-visual-progress"><span></span><b>Phase 4 visual pipeline is running</b><small>' +
        (state.autoRepairEnabled && aiReady ? 'Automatic repair is enabled for mismatches below the target score.' : 'Automatic repair is off or visual AI is unavailable.') +
        '</small></div>' + iframe;
      if (state.visualRender?.previewUrl) mountPreviewFrame(state.visualRender);
      return;
    }

    if (!render) {
      status.textContent = 'Ready';
      status.className = 'status-chip ui-studio-visual-ready';
      summary.textContent = 'Render the current code at the exact selected reference ratio, calculate a pixel diff and run visual QA.';
      output.innerHTML = '<div class="ui-studio-codegen-empty"><b>No Phase 4 render yet</b><small>The preview is sandboxed, network calls are blocked and the generated code is never written into the live application.</small></div>';
      return;
    }

    if (render.status === 'FAILED') {
      status.textContent = 'Failed';
      status.className = 'status-chip ui-studio-visual-failed';
      summary.textContent = render.errorMessage || 'The previous visual comparison did not complete.';
      output.innerHTML = '<div class="ui-studio-codegen-empty"><small>Fix or regenerate Phase 3 code, then run the comparison again.</small></div>';
      return;
    }

    if (!current) {
      status.textContent = 'Stale render';
      status.className = 'status-chip ui-studio-visual-stale';
      summary.textContent = 'This visual result belongs to an older code generation. Render the current version again.';
    } else if (render.status === 'COMPLETED') {
      const target = Number(state.visualConfig?.targetScore || 90);
      status.textContent = Number(render.score || 0) >= target ? 'Target met' : 'Needs repair';
      status.className = 'status-chip ' + (Number(render.score || 0) >= target ? 'ui-studio-visual-ready' : 'ui-studio-visual-stale');
      summary.textContent = render.critique?.summary || 'Visual comparison completed.';
    } else {
      status.textContent = render.status;
      status.className = 'status-chip ui-studio-visual-running';
      summary.textContent = 'Visual render is waiting for its browser capture.';
    }

    if (render.status !== 'COMPLETED') {
      output.innerHTML = '<div class="ui-studio-visual-progress"><span></span><b>' + esc(render.status) + '</b><small>Render session ' + esc(render.id) + '</small></div>';
      return;
    }

    const metrics = render.metrics || {};
    const critique = render.critique || {};
    const issues = critique.issues || [];
    const canRepair = state.canEdit && aiReady && current && Number(render.score || 0) < Number(state.visualConfig?.targetScore || 90) && Number(render.repairDepth || 0) < Number(state.visualConfig?.maxRepairPasses || 3);
    output.innerHTML = `
      <div class="ui-studio-visual-score-row">
        <div class="ui-studio-match-score ${scoreClass(render.score)}"><b>${esc(render.score ?? '—')}</b><span>visual match</span></div>
        <div><span>Pixel score</span><b>${esc(render.pixelScore ?? '—')}</b></div>
        <div><span>Structure</span><b>${esc(metrics.structuralScore ?? '—')}</b></div>
        <div><span>Mismatch</span><b>${esc(metrics.mismatchPercent != null ? metrics.mismatchPercent + '%' : '—')}</b></div>
        <div><span>Repair pass</span><b>${esc(render.repairDepth || 0)}/${esc(state.visualConfig?.maxRepairPasses || 3)}</b></div>
      </div>
      <div class="ui-studio-compare-grid">
        <figure><figcaption>Original</figcaption><img src="${esc(render.originalUrl)}" alt="Original UI reference"></figure>
        <figure><figcaption>Rendered</figcaption><img src="${esc(render.renderedUrl)}" alt="Generated UI render"></figure>
        <figure><figcaption>Diff heatmap</figcaption><img src="${esc(render.diffUrl)}" alt="Visual difference heatmap"></figure>
      </div>
      <details class="ui-studio-live-preview">
        <summary>Open sandboxed live preview</summary>
        <div class="ui-studio-preview-stage"><iframe id="uiStudioPreviewFrame" title="Generated UI preview" sandbox="allow-scripts"></iframe></div>
      </details>
      <div class="ui-studio-visual-lower">
        <div class="ui-studio-visual-issues">
          <div class="ui-studio-visual-mini-head"><b>Visual QA issues</b><small>${esc(issues.length)} detected</small></div>
          ${issues.length ? issues.slice(0,12).map(issue => `<article class="${esc(String(issue.severity || '').toLowerCase())}"><div><b>${esc(issue.category)}</b><span>${esc(issue.severity)}</span></div><p>${esc(issue.description)}</p><small>${esc(issue.repairInstruction)}</small></article>`).join('') : '<div class="ui-studio-codegen-empty"><small>No AI visual issues were returned. Pixel metrics are still available.</small></div>'}
        </div>
        <div class="ui-studio-visual-controls">
          <div><b>Repair loop</b><small>Repairs create a new Phase 3 code version, then Phase 4 renders it again. Nothing is deployed automatically.</small></div>
          <button class="secondary" id="uiStudioManualRepairBtn" type="button" ${canRepair ? '' : 'disabled'}>✦ Repair code + re-test</button>
        </div>
      </div>
    `;
    mountPreviewFrame(render);
    $('uiStudioManualRepairBtn')?.addEventListener('click', () => void repairAndRepeat(render));
  }

  function mountPreviewFrame(render) {
    const frame = $('uiStudioPreviewFrame');
    if (!frame || !render?.previewUrl) return;
    state.visualFrame = frame;
    frame.style.width = Math.max(1, Number(render.width || 1)) + 'px';
    frame.style.height = Math.max(1, Number(render.height || 1)) + 'px';
    frame.src = render.previewUrl + '?v=' + encodeURIComponent(render.updatedAt || Date.now());
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
      host.innerHTML = '<div class="ui-studio-phase5-empty">No generated media slots were declared by the current Phase 3 code.</div>';
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
      summary.textContent = 'Loading Phase 5 convergence state…';
      scoreboard.innerHTML = '';
      batchHost.innerHTML = '';
      return;
    }

    status.textContent = !config.rendererConfigured
      ? 'Renderer offline'
      : state.phase5Running
        ? 'Converging…'
        : (config.acceptedGenerationId ? 'Accepted' : config.bestGenerationId ? 'Best candidate ready' : 'Ready');
    status.className = 'status-chip ' + (config.acceptedGenerationId ? 'ui-studio-visual-ready' : state.phase5Running ? 'ui-studio-visual-running' : 'ui-studio-phase5-ready');
    summary.textContent = !config.rendererConfigured
      ? 'The dedicated Chromium renderer is not configured. Phase 5 runs are disabled until the renderer service is healthy.'
      : state.phase5Running
        ? 'The dedicated worker is rendering every available viewport in real Chromium. Repairs are re-tested across all viewports and regressions are rejected.'
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
        batchHost.innerHTML = `<div class="ui-studio-phase5-progress"><div><b>Chromium convergence batch</b><small>${esc(completed + '/' + total)} viewport renders complete</small></div><span></span></div>
          <div class="ui-studio-phase5-viewport-grid" style="margin-top:10px">${(batch.renders || []).map(phase5ViewportCard).join('')}</div>`;
      } else {
        batchHost.innerHTML = `<div class="ui-studio-phase5-viewport-grid">${(batch.renders || []).map(phase5ViewportCard).join('')}</div>`;
      }
    } else {
      batchHost.innerHTML = '<div class="ui-studio-phase5-empty">Run Phase 5 to test the same generated code against every available Desktop, Tablet and Mobile reference.</div>';
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
      notify(data.batch.status === 'FAILED' ? 'Phase 5 convergence stopped because a viewport render failed.' : 'Phase 5 convergence cycle completed.');
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
      notify('Best responsive generation accepted.');
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
      status.textContent = 'Needs acceptance';
      status.className = 'status-chip';
    } else if (gate?.passed) {
      status.textContent = delivery ? delivery.status.replaceAll('_',' ') : 'Ready';
      status.className = 'status-chip ui-studio-analysis-ready';
    } else {
      status.textContent = 'Gate blocked';
      status.className = 'status-chip ui-studio-analysis-failed';
    }

    const viewportLabel = viewportResults.length
      ? viewportResults.map(item => item.viewport + ' ' + (Number.isFinite(Number(item.score)) ? Math.round(Number(item.score)) + '%' : '—')).join(' · ')
      : 'No Phase 5 viewport evidence yet';
    gateHost.innerHTML = [
      ['Accepted generation', acceptedId ? acceptedId.slice(-10) : 'None', Boolean(acceptedId)],
      ['Regression gate', gate?.passed ? 'Passed' : (gate?.message || 'Not ready'), Boolean(gate?.passed)],
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
        policy.textContent = 'Repository deliveries are PR-first. A separate human approval is required before the approved PR can be merged for deployment.';
      } else {
        policy.className = 'ui-studio-phase6-policy warning';
        policy.textContent = 'ZIP export and regression gating are available. Repository PR/deploy automation is disabled until UI_STUDIO_GITHUB_TOKEN is configured on the production service.';
      }
    }

    deliveriesHost.innerHTML = (cfg.deliveries || []).length
      ? cfg.deliveries.map(item => `<article class="ui-studio-phase6-delivery ${item.id === delivery?.id ? 'active' : ''}" data-phase6-delivery="${esc(item.id)}">
          <div><b>${esc(item.targetMode.replaceAll('_',' '))} · ${esc(item.status.replaceAll('_',' '))}</b>
          <small>${esc(item.repository || item.artifactFileName || 'Delivery package')} · ${esc(fmtDate(item.createdAt))}</small></div>
          <aside><span>${esc(item.regression?.passed ? 'Gate passed' : 'Review')}</span>${item.pullRequestUrl ? `<a href="${esc(item.pullRequestUrl)}" target="_blank" rel="noopener">PR #${esc(item.pullRequestNumber)} ↗</a>` : ''}</aside>
        </article>`).join('')
      : '<div class="ui-studio-phase6-empty">No delivery package yet. Accept the Phase 5 best generation, pass the regression gate, then create the first immutable delivery package.</div>';

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
      notify('Phase 6 delivery package created after regression validation.');
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

  function renderWorkspace() {
    const project = state.project;
    if (!project) {
      $('uiStudioWorkspace').hidden = true;
      $('uiStudioProjectsArea').hidden = false;
      return;
    }

    $('uiStudioProjectsArea').hidden = true;
    $('uiStudioWorkspace').hidden = false;
    $('uiStudioProjectName').textContent = project.name;
    $('uiStudioProjectMeta').textContent = `${project.framework.replaceAll('_',' ')} · ${project.styling.replaceAll('_',' ')} · ${project.outputType.replaceAll('_',' ')}`;

    document.querySelectorAll('[data-ui-viewport]').forEach(button => {
      button.classList.toggle('active', button.dataset.uiViewport === state.viewport);
    });

    const refs = (project.references || []).filter(item => item.viewport === state.viewport);
    const current = refs[0] || null;
    const local = state.localObjectUrl;
    const imageUrl = local || current?.contentUrl || '';
    const viewportAnalysis = local ? null : currentViewportAnalysis();

    $('uiStudioViewerMeta').innerHTML = state.selectedFile
      ? `<b>${esc(state.selectedFile.name)}</b><small>${esc((state.selectedDimensions?.width || '—') + ' × ' + (state.selectedDimensions?.height || '—') + ' · ' + bytes(state.selectedFile.size))} · not uploaded yet</small>`
      : current
        ? `<b>${esc(current.originalName)}</b><small>${esc(current.width + ' × ' + current.height + ' · ' + bytes(current.byteSize))} · uploaded ${esc(fmtDate(current.createdAt))}</small>`
        : '<b>No reference uploaded</b><small>Choose an original image below.</small>';

    renderViewer(imageUrl, project.name + ' ' + state.viewport.toLowerCase() + ' UI reference', viewportAnalysis);

    $('uiStudioOpenOriginal').hidden = !current || Boolean(local);
    if (current && !local) $('uiStudioOpenOriginal').href = current.contentUrl;

    $('uiStudioProjectFacts').innerHTML = [
      ['Created', fmtDate(project.createdAt)],
      ['Framework', project.framework.replaceAll('_',' ')],
      ['Styling', project.styling.replaceAll('_',' ')],
      ['Output target', project.outputType.replaceAll('_',' ')],
      ['References', String(project.referenceCount || 0)],
      ['Analyses', String(project.analysisCount || 0)],
      ['Code versions', String(project.generationCount || 0)],
      ['Visual renders', String(project.renderCount || 0)],
      ['Repair passes', String(project.repairCount || 0)]
    ].map(item => `<div><span>${esc(item[0])}</span><b>${esc(item[1])}</b></div>`).join('');

    $('uiStudioReferenceHistory').innerHTML = refs.length
      ? refs.map(reference => `<div class="ui-studio-history-row">
          <img src="${esc(reference.contentUrl)}" alt="" loading="lazy">
          <div><b>${esc(reference.originalName)}</b><small>${esc(reference.width + ' × ' + reference.height + ' · ' + bytes(reference.byteSize))}</small><small>${esc(fmtDate(reference.createdAt))}</small><a href="${esc(reference.contentUrl)}" target="_blank" rel="noopener">Open original ↗</a></div>
        </div>`).join('')
      : '<p class="muted">No '+esc(state.viewport.toLowerCase())+' upload history yet.</p>';

    const uploadDisabled = !state.canEdit || !state.selectedFile;
    $('uiStudioFile').disabled = !state.canEdit;
    $('uiStudioUploadBtn').disabled = uploadDisabled;
    $('uiStudioUploadCopy').innerHTML = state.selectedFile
      ? `<b>${esc(state.selectedFile.name)}</b><small>${esc((state.selectedDimensions?.width || 'Reading') + (state.selectedDimensions ? ' × ' + state.selectedDimensions.height : '') + ' · ' + bytes(state.selectedFile.size))}</small>`
      : '<b>Choose '+esc(state.viewport.toLowerCase())+' UI image</b><small>PNG, JPEG, WebP or AVIF · up to 50 MB · original preserved</small>';
    $('uiStudioUploadNote').textContent = state.canEdit
      ? 'The uploaded source is stored untouched in Cloudflare R2. No resize, quality conversion or compression is applied.'
      : 'Viewing only. Upload access requires Super Admin.';
    $('uiStudioUploadNote').className = 'ui-studio-upload-note';

    renderAnalysisPanel();
    renderCodegenPanel();
    renderVisualPanel();
    renderPhase5Panel();
    renderPhase6Panel();
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
    await loadLatestGeneration().catch(error => notify(error.message));
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
      state.zoom = 'fit';
      renderWorkspace();
    } catch (error) {
      notify(error.message);
      renderWorkspace();
    }
  }

  async function uploadReference() {
    if (!state.canEdit || !state.project || !state.selectedFile) return;
    const button = $('uiStudioUploadBtn');
    const file = state.selectedFile;
    button.disabled = true;
    button.textContent = 'Uploading original…';
    try {
      const response = await fetch(
        '/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/references/' + encodeURIComponent(state.viewport) + '/upload',
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
      notify('Original UI reference stored in R2 without recompression.');
      clearLocalPreview();
      state.overlay = false;
      state.visualRender = null;
      state.phase5Config = null;
      state.phase5Batch = null;
      await Promise.all([refreshProject(), loadProjects()]);
      await loadPhase5().catch(() => {});
    } catch (error) {
      notify(error.message);
    } finally {
      button.textContent = 'Upload original';
      button.disabled = !state.canEdit || !state.selectedFile;
    }
  }

  async function analyseProject() {
    if (!state.project || !state.canEdit || state.analysing) return;
    state.analysing = true;
    state.overlay = false;
    renderAnalysisPanel();
    try {
      const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id) + '/analyse', {
        method: 'POST',
        body: JSON.stringify({})
      });
      state.project = data.project;
      state.overlay = true;
      state.visualRender = null;
      state.phase5Config = null;
      state.phase5Batch = null;
      notify('Design analysis complete. Region overlay is ready.');
      await loadProjects();
      await loadPhase5().catch(() => {});
      renderWorkspace();
    } catch (error) {
      notify(error.message);
      await refreshProject().catch(() => {});
    } finally {
      state.analysing = false;
      renderWorkspace();
    }
  }

  async function generateResponsiveUi() {
    if (!state.project || !state.canEdit || state.generating) return;
    state.generating = true;
    renderCodegenPanel();
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
      state.selectedGeneratedFile = data.generation?.result?.entryFile || data.generation?.result?.files?.[0]?.path || null;
      notify('Responsive UI code generated and saved as a new version.');
      await loadProjects();
      await loadPhase5().catch(() => {});
    } catch (error) {
      notify(error.message);
      await refreshProject().catch(() => {});
      await loadLatestGeneration().catch(() => {});
    } finally {
      state.generating = false;
      renderWorkspace();
    }
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
  $('uiStudioGenerateBtn')?.addEventListener('click', () => void generateResponsiveUi());
  $('uiStudioRenderBtn')?.addEventListener('click', () => void startVisualCompare());
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
