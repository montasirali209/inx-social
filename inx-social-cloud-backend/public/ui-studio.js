'use strict';

(() => {
  const state = {
    projects: [],
    project: null,
    canEdit: false,
    storage: null,
    viewport: 'DESKTOP',
    zoom: 'fit',
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

  function projectThumb(reference, label) {
    if (!reference) return `<div class="ui-studio-thumb"><span>No ${esc(label.toLowerCase())}</span></div>`;
    return `<div class="ui-studio-thumb"><img src="${esc(reference.contentUrl)}" alt="" loading="lazy"><em>${esc(label)}</em></div>`;
  }

  function projectCard(project) {
    return `<article class="ui-studio-project-card" data-ui-project="${esc(project.id)}" tabindex="0" role="button" aria-label="Open ${esc(project.name)}">
      <div>
        <span class="kicker">UI reconstruction project</span>
        <h3>${esc(project.name)}</h3>
        <p>${esc(project.framework.replaceAll('_',' '))} · ${esc(project.styling.replaceAll('_',' '))} · ${esc(project.outputType.replaceAll('_',' '))}</p>
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
    const desktopCount = projects.filter(item => latest(item, 'DESKTOP')).length;
    $('uiStudioSummary').innerHTML = [
      ['Projects', projects.length, 'Saved reconstruction workspaces'],
      ['References', referenceCount, 'Immutable original uploads'],
      ['Desktop sources', desktopCount, 'Projects with desktop reference'],
      ['Storage', state.storage?.provider === 'CLOUDFLARE_R2' ? 'R2' : 'Check', state.storage?.originalsPreserved ? 'Original bytes preserved' : 'Storage unavailable']
    ].map(item => `<article><span>${esc(item[0])}</span><b>${esc(item[1])}</b><small>${esc(item[2])}</small></article>`).join('');

    $('uiStudioPermission').textContent = state.canEdit
      ? 'Super Admin · you can create projects and upload references.'
      : 'Read only · Super Admin is required to create projects or upload references.';
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

    $('uiStudioViewerMeta').innerHTML = state.selectedFile
      ? `<b>${esc(state.selectedFile.name)}</b><small>${esc((state.selectedDimensions?.width || '—') + ' × ' + (state.selectedDimensions?.height || '—') + ' · ' + bytes(state.selectedFile.size))} · not uploaded yet</small>`
      : current
        ? `<b>${esc(current.originalName)}</b><small>${esc(current.width + ' × ' + current.height + ' · ' + bytes(current.byteSize))} · uploaded ${esc(fmtDate(current.createdAt))}</small>`
        : '<b>No reference uploaded</b><small>Choose an original image below.</small>';

    $('uiStudioViewerFrame').innerHTML = imageUrl
      ? `<img src="${esc(imageUrl)}" alt="${esc(project.name + ' ' + state.viewport.toLowerCase() + ' UI reference')}">`
      : '<div class="ui-studio-viewer-empty"><span>▣</span><b>No '+esc(state.viewport.toLowerCase())+' reference yet</b><small>Upload the original PNG, JPEG, WebP or AVIF. UI Studio stores the file without resizing or recompressing it.</small></div>';

    $('uiStudioOpenOriginal').hidden = !current || Boolean(local);
    if (current && !local) $('uiStudioOpenOriginal').href = current.contentUrl;

    $('uiStudioProjectFacts').innerHTML = [
      ['Created', fmtDate(project.createdAt)],
      ['Framework', project.framework.replaceAll('_',' ')],
      ['Styling', project.styling.replaceAll('_',' ')],
      ['Output target', project.outputType.replaceAll('_',' ')],
      ['References', String(project.referenceCount || 0)]
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
    setZoom(state.zoom);
  }

  async function selectProject(projectId) {
    clearLocalPreview();
    const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(projectId));
    state.project = data.project;
    state.canEdit = Boolean(data.canEdit);
    state.storage = data.storage || state.storage;
    state.viewport = latest(data.project, 'DESKTOP') ? 'DESKTOP' : (latest(data.project, 'TABLET') ? 'TABLET' : (latest(data.project, 'MOBILE') ? 'MOBILE' : 'DESKTOP'));
    state.zoom = 'fit';
    renderWorkspace();
  }

  async function refreshProject() {
    if (!state.project) return;
    const data = await request('/api/admin/ui-studio/projects/' + encodeURIComponent(state.project.id));
    state.project = data.project;
    state.canEdit = Boolean(data.canEdit);
    renderWorkspace();
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
      await Promise.all([refreshProject(), loadProjects()]);
    } catch (error) {
      notify(error.message);
    } finally {
      button.textContent = 'Upload original';
      button.disabled = !state.canEdit || !state.selectedFile;
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
          outputType: $('uiStudioOutputType').value
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
    try { await loadProjects(); if (state.project) await refreshProject(); notify('UI Studio refreshed'); }
    catch (error) { notify(error.message); }
    finally { button.disabled = false; button.textContent = '↻ Refresh'; }
  });
  $('uiStudioBackBtn')?.addEventListener('click', () => {
    clearLocalPreview();
    state.project = null;
    renderWorkspace();
  });
  document.querySelectorAll('[data-ui-viewport]').forEach(button => button.addEventListener('click', () => {
    clearLocalPreview();
    state.viewport = button.dataset.uiViewport;
    state.zoom = 'fit';
    renderWorkspace();
  }));
  document.querySelectorAll('[data-ui-zoom]').forEach(button => button.addEventListener('click', () => setZoom(button.dataset.uiZoom)));
  $('uiStudioFile')?.addEventListener('change', event => void handleFile(event.target.files?.[0]));
  $('uiStudioUploadBtn')?.addEventListener('click', () => void uploadReference());
})();
