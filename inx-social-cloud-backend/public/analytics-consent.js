(() => {
  const MEASUREMENT_ID = 'G-XXLQ35FQ6L';
  const STORAGE_KEY = 'inxsocial_analytics_consent_v1';
  const SCRIPT_MARKER = 'data-inxsocial-ga';
  let tagLoaded = false;
  let lastTrackedUrl = '';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };

  // Keep all non-essential storage denied unless the visitor explicitly opts in.
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  function readChoice() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  function saveChoice(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch {}
    document.cookie = `${STORAGE_KEY}=${value}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
  }

  function trackPageView() {
    if (!tagLoaded || readChoice() !== 'accepted') return;
    const current = `${location.pathname}${location.search}${location.hash}`;
    if (current === lastTrackedUrl) return;
    lastTrackedUrl = current;
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: location.href,
      page_path: current
    });
  }

  function loadGoogleTag() {
    if (tagLoaded || document.querySelector(`script[${SCRIPT_MARKER}]`)) return;
    tagLoaded = true;
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, { send_page_view: true });
    lastTrackedUrl = `${location.pathname}${location.search}${location.hash}`;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    script.setAttribute(SCRIPT_MARKER, MEASUREMENT_ID);
    document.head.appendChild(script);
  }

  function applyChoice(value) {
    const accepted = value === 'accepted';
    saveChoice(accepted ? 'accepted' : 'rejected');
    window.gtag('consent', 'update', {
      analytics_storage: accepted ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    if (accepted) loadGoogleTag();
    document.getElementById('inxsocial-analytics-consent')?.remove();
    renderSettingsButton();
  }

  function injectStyles() {
    if (document.getElementById('inxsocial-consent-styles')) return;
    const style = document.createElement('style');
    style.id = 'inxsocial-consent-styles';
    style.textContent = `
      #inxsocial-analytics-consent{position:fixed;left:18px;right:18px;bottom:18px;z-index:2147483000;max-width:900px;margin:auto;padding:18px 20px;border:1px solid rgba(148,163,184,.28);border-radius:18px;background:rgba(5,14,26,.97);color:#e8f2ff;box-shadow:0 18px 60px rgba(0,0,0,.38);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;gap:20px;align-items:center;justify-content:space-between}
      #inxsocial-analytics-consent strong{display:block;font-size:15px;margin-bottom:4px}#inxsocial-analytics-consent p{margin:0;color:#aebfd2;font-size:13px;line-height:1.55;max-width:620px}#inxsocial-analytics-consent a{color:#72e6d4;text-decoration:none}
      #inxsocial-analytics-consent .actions{display:flex;gap:9px;flex:0 0 auto}#inxsocial-analytics-consent button,#inxsocial-cookie-settings{font:inherit;cursor:pointer;border-radius:11px;border:1px solid rgba(148,163,184,.32);padding:10px 13px;background:#0b1a2c;color:#e8f2ff;font-weight:700}#inxsocial-analytics-consent button.accept{background:#5eead4;color:#05201d;border-color:#5eead4}
      #inxsocial-cookie-settings{position:fixed;right:14px;bottom:14px;z-index:90;padding:7px 10px;font-size:11px;background:rgba(5,14,26,.88);color:#bdcad8;box-shadow:0 6px 24px rgba(0,0,0,.18)}
      @media(max-width:680px){#inxsocial-analytics-consent{left:10px;right:10px;bottom:max(10px,env(safe-area-inset-bottom));max-height:calc(100dvh - 20px);overflow-y:auto;align-items:stretch;flex-direction:column;padding:16px}#inxsocial-analytics-consent .actions{display:grid;grid-template-columns:1fr 1fr}#inxsocial-analytics-consent button{width:100%}#inxsocial-cookie-settings{right:10px;bottom:max(10px,env(safe-area-inset-bottom));max-width:calc(100vw - 20px)}}
    `;
    document.head.appendChild(style);
  }

  function isWorkspaceRoute() {
    return location.pathname === '/app' || location.pathname.startsWith('/app/');
  }

  function renderSettingsButton() {
    const existing = document.getElementById('inxsocial-cookie-settings');
    if (isWorkspaceRoute()) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const button = document.createElement('button');
    button.id = 'inxsocial-cookie-settings';
    button.type = 'button';
    button.textContent = 'Cookie settings';
    button.addEventListener('click', renderBanner);
    document.body.appendChild(button);
  }

  function renderBanner() {
    injectStyles();
    document.getElementById('inxsocial-analytics-consent')?.remove();
    const settings = document.getElementById('inxsocial-cookie-settings');
    if (settings) settings.remove();
    const panel = document.createElement('aside');
    panel.id = 'inxsocial-analytics-consent';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Analytics cookie choice');
    panel.innerHTML = `<div><strong>Help us improve INXSocial</strong><p>With your permission, Google Analytics helps us understand which pages and product journeys are useful. Optional analytics stays off unless you accept. <a href="/privacy.html">Privacy details</a></p></div><div class="actions"><button type="button" data-consent="rejected">Reject optional analytics</button><button type="button" class="accept" data-consent="accepted">Accept analytics</button></div>`;
    panel.querySelectorAll('[data-consent]').forEach(button => button.addEventListener('click', () => applyChoice(button.dataset.consent)));
    document.body.appendChild(panel);
  }

  window.inxTrack = (name, parameters = {}) => {
    if (readChoice() !== 'accepted') return;
    loadGoogleTag();
    window.gtag('event', name, parameters);
  };
  window.inxCookieSettings = renderBanner;

  function initialise() {
    injectStyles();
    const choice = readChoice();
    if (choice === 'accepted') {
      window.gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      loadGoogleTag();
      renderSettingsButton();
    } else if (choice === 'rejected') {
      renderSettingsButton();
    } else {
      renderBanner();
    }

    const syncRouteUi = () => {
      trackPageView();
      const choice = readChoice();
      if (choice === 'accepted' || choice === 'rejected') renderSettingsButton();
    };
    const pushState = history.pushState.bind(history);
    const replaceState = history.replaceState.bind(history);
    history.pushState = (...args) => { pushState(...args); queueMicrotask(syncRouteUi); };
    history.replaceState = (...args) => { replaceState(...args); queueMicrotask(syncRouteUi); };
    addEventListener('popstate', () => queueMicrotask(syncRouteUi));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
