(() => {
  'use strict';

  const TOKEN_KEY = 'inx-social-cloud-token';
  const title = document.querySelector('h1');
  const detail = document.querySelector('p');
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const accessToken = hash.get('access_token') || '';
  const returnedState = hash.get('state') || query.get('state') || '';
  let expectedState = sessionStorage.getItem('inx-facebook-oauth-state') || '';
  try {
    expectedState = expectedState || window.opener?.sessionStorage.getItem('inx-facebook-oauth-state') || '';
  } catch (_) {}
  const facebookError = hash.get('error_description')
    || query.get('error_description')
    || query.get('error_message')
    || query.get('error')
    || '';

  if (location.hash) history.replaceState(null, '', location.pathname + location.search);

  function notifyOpener(message) {
    const payload = {
      type: 'inx-facebook-oauth-result',
      state: returnedState || expectedState,
      ...message
    };
    let saved = false;
    if (payload.state) {
      try {
        localStorage.setItem(`inx-facebook-oauth-result:${payload.state}`, JSON.stringify(payload));
        saved = true;
      } catch (_) {}
    }
    if (!window.opener || window.opener.closed) return saved;
    try {
      window.opener.postMessage(payload, location.origin);
      return true;
    } catch (_) {
      return saved;
    }
  }

  function showError(message) {
    sessionStorage.removeItem('inx-facebook-oauth-state');
    notifyOpener({ ok: false, error: message });
    title.textContent = 'Facebook connection failed';
    detail.textContent = message;
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Close this window';
    closeButton.style.cssText = 'margin-top:18px;border:1px solid #2dd4bf;border-radius:10px;background:#0f766e;color:white;padding:10px 16px;font:700 14px system-ui;cursor:pointer';
    closeButton.addEventListener('click', () => window.close());
    document.body.appendChild(closeButton);
  }

  async function api(url, options = {}) {
    const inxToken = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('inxToken') || '';
    if (!inxToken) throw new Error('Your INX Social login session was not found. Close this window, then sign in again.');
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${inxToken}`);
    if (options.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, { ...options, headers });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || `Request failed (HTTP ${response.status}).`);
    }
    return payload;
  }

  async function finishConnection() {
    if (facebookError) throw new Error(facebookError);
    if (!expectedState || !returnedState || returnedState !== expectedState) {
      throw new Error('Facebook returned an invalid or expired login state. Close this window and try again.');
    }
    if (!accessToken) throw new Error('Facebook did not return an access token.');

    title.textContent = 'Connecting Facebook Pages';
    detail.textContent = 'Discovering the Pages you manage…';

    const stateResult = await api('/api/studio/desktop-state');
    const desktopState = stateResult.state || {};
    const workspace = desktopState.workspace || {};
    const discovery = await api('/api/pages/accounts/discover', {
      method: 'POST',
      body: JSON.stringify({ accessToken })
    });

    const currentIds = new Set((workspace.pages || []).map(page => page.facebookPageId));
    const connectedCount = Number(workspace.pageUsage?.connected || 0);
    const limit = Number(workspace.pageUsage?.limit || 0);
    const available = Math.max(0, limit - connectedCount);
    const selectedPageIds = (discovery.pages || [])
      .map(page => page.facebookPageId || page.id)
      .filter(Boolean)
      .filter(id => !currentIds.has(id))
      .slice(0, available);

    let notice;
    if (!selectedPageIds.length) {
      if ((workspace.pages || []).length) {
        notice = 'Facebook is already connected. Pages refreshed automatically.';
      } else {
        throw new Error(available
          ? 'Facebook did not return a manageable Page. Check your Facebook Page access.'
          : 'Your current plan has no remaining Facebook Page slots.');
      }
    } else {
      await api('/api/pages/accounts/connect', {
        method: 'POST',
        body: JSON.stringify({
          accessToken,
          selectedPageIds,
          metaAppId: '969283649323618'
        })
      });
      notice = `${selectedPageIds.length} Facebook Page(s) connected. Pages refreshed automatically.`;
    }

    let instagramCount = 0;
    let instagramNotice = '';
    detail.textContent = 'Finding Instagram professional accounts linked to your Pages…';
    try {
      const instagramResult = await api('/api/social-connections/instagram/sync', {
        method: 'POST',
        body: '{}'
      });
      instagramCount = Number(instagramResult.connections?.length || 0);
      if (instagramCount) {
        instagramNotice = ` ${instagramCount} linked Instagram professional account(s) imported.`;
      }
      if (instagramResult.errors?.length) {
        instagramNotice += ` Some Pages could not be checked: ${instagramResult.errors.join(' ')}`;
      }
    } catch (error) {
      // A Facebook Page can be valid without a linked Instagram profile. Keep
      // Facebook connected and give the parent window an actionable notice.
      instagramNotice = ` No linked Instagram professional account was imported: ${error.message}`;
    }

    notice += instagramNotice;
    sessionStorage.removeItem('inx-facebook-oauth-state');
    title.textContent = 'Meta accounts connected';
    detail.textContent = 'Connection complete. This window will close automatically…';
    notifyOpener({ ok: true, notice, connectedCount: selectedPageIds.length, instagramCount });
    setTimeout(() => window.close(), 250);
  }

  finishConnection().catch(error => showError(error.message || 'Facebook connection failed.'));
})();
