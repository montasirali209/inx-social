(() => {
  if (window.__inxSocialAnalyticsFunnelPatched) return;
  window.__inxSocialAnalyticsFunnelPatched = true;

  const nativeFetch = window.fetch.bind(window);
  const CONSENT_KEY = 'inxsocial_analytics_consent_v1';
  const TOKEN_KEYS = ['inx-social-cloud-token', 'inxToken'];
  const ACQUISITION_KEY = 'inxsocial_first_touch_v1';

  function hasAnalyticsConsent() {
    try { return localStorage.getItem(CONSENT_KEY) === 'accepted'; } catch { return false; }
  }

  function cleanAcquisitionValue(value, max = 140) {
    return String(value || '').trim().slice(0, max);
  }

  function captureAcquisition() {
    if (!hasAnalyticsConsent()) return null;
    try {
      const existing = JSON.parse(localStorage.getItem(ACQUISITION_KEY) || 'null');
      if (existing && typeof existing === 'object') return existing;
    } catch {}

    const query = new URLSearchParams(location.search);
    let referrerHost = '';
    try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch {}
    if (referrerHost === location.hostname) referrerHost = '';

    const snapshot = {
      landingPath: cleanAcquisitionValue(location.pathname + location.search, 500),
      referrerHost: cleanAcquisitionValue(referrerHost, 180),
      utmSource: cleanAcquisitionValue(query.get('utm_source'), 100),
      utmMedium: cleanAcquisitionValue(query.get('utm_medium'), 100),
      utmCampaign: cleanAcquisitionValue(query.get('utm_campaign'), 140),
      utmContent: cleanAcquisitionValue(query.get('utm_content'), 140),
      utmTerm: cleanAcquisitionValue(query.get('utm_term'), 140)
    };
    try { localStorage.setItem(ACQUISITION_KEY, JSON.stringify(snapshot)); } catch {}
    return snapshot;
  }

  function acquisitionSnapshot() {
    if (!hasAnalyticsConsent()) return null;
    try {
      return JSON.parse(localStorage.getItem(ACQUISITION_KEY) || 'null') || captureAcquisition();
    } catch {
      return captureAcquisition();
    }
  }

  window.inxAcquisitionSnapshot = acquisitionSnapshot;
  captureAcquisition();

  function storedAuthToken() {
    try {
      for (const key of TOKEN_KEYS) {
        const value = localStorage.getItem(key);
        if (value) return value;
      }
    } catch {}
    return '';
  }

  function trackOnce(storageKey, name, parameters = {}) {
    if (!hasAnalyticsConsent() || typeof window.inxTrack !== 'function') return false;
    try {
      if (sessionStorage.getItem(storageKey)) return true;
      window.inxTrack(name, parameters);
      sessionStorage.setItem(storageKey, '1');
      return true;
    } catch {
      window.inxTrack(name, parameters);
      return true;
    }
  }

  function requestDetails(input, init) {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    if (!rawUrl) return null;
    let url;
    try { url = new URL(rawUrl, location.origin); } catch { return null; }
    if (url.origin !== location.origin) return null;
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    const body = url.pathname === '/api/billing/checkout' ? init?.body : null;
    return { path: url.pathname, method, body };
  }

  function safePlan(body) {
    if (typeof body !== 'string' || body.length > 5000) return '';
    try {
      const parsed = JSON.parse(body);
      const plan = String(parsed?.plan || '').toUpperCase();
      return /^[A-Z0-9_-]{1,32}$/.test(plan) ? plan : '';
    } catch { return ''; }
  }

  function generationType(path) {
    const slug = path.split('/').pop() || '';
    const types = {
      'conversational-image-post': 'image_post',
      'conversational-carousel': 'carousel',
      'video-studio': 'ai_video',
      'stock-video': 'stock_video',
      'image-post': 'image_post',
      'carousel-post': 'carousel',
      'short-video': 'short_video',
      'ugc-ad': 'ugc_ad'
    };
    return types[slug] || 'ai_content';
  }

  function trackSuccessfulAction(details) {
    if (!details || details.method !== 'POST' || typeof window.inxTrack !== 'function') return;
    const { path, body } = details;
    if (path === '/api/auth/register') return window.inxTrack('sign_up', { method: 'email' });
    if (path === '/api/billing/checkout') {
      const plan = safePlan(body);
      return window.inxTrack('begin_checkout', plan ? { plan } : {});
    }
    if (/^\/api\/ai-content-studio\/generate\/[a-z0-9-]+$/.test(path)) {
      return window.inxTrack('ai_generation_requested', { content_type: generationType(path) });
    }
    if (/^\/api\/ai-content-studio\/drafts\/[^/]+\/send-to-posts$/.test(path)) {
      return window.inxTrack('ai_content_sent_to_posts');
    }
    if (path === '/api/studio/direct-posts') return window.inxTrack('post_submission_success', { content_type: 'standard_post' });
    if (path === '/api/studio/carousel-posts') return window.inxTrack('post_submission_success', { content_type: 'carousel' });
  }

  async function verifyPurchaseReturn(attempt = 0) {
    if (location.pathname !== '/app/billing') return;
    const query = new URLSearchParams(location.search);
    if (query.get('checkout') !== 'success') return;
    const sessionId = String(query.get('session_id') || '').trim();
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return;

    if (!hasAnalyticsConsent() || typeof window.inxTrack !== 'function') {
      if (attempt < 20) setTimeout(() => void verifyPurchaseReturn(attempt + 1), 1000);
      return;
    }

    const token = storedAuthToken();
    if (!token) {
      if (attempt < 8) setTimeout(() => void verifyPurchaseReturn(attempt + 1), 1200);
      return;
    }

    try {
      const response = await nativeFetch(`/api/billing/checkout/${encodeURIComponent(sessionId)}`, {
        credentials: 'same-origin',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`Checkout verification failed (${response.status})`);
      const data = await response.json();
      const confirmed = data?.paymentStatus === 'paid' || data?.activated === true;
      if (!confirmed) {
        if (attempt < 8) setTimeout(() => void verifyPurchaseReturn(attempt + 1), 1500);
        return;
      }
      const plan = String(data?.plan || '').toUpperCase();
      const amount = Number(data?.amountTotal || 0);
      const currency = String(data?.currency || 'GBP').toUpperCase();
      trackOnce(`inxsocial_ga_purchase_${sessionId}`, 'purchase', {
        transaction_id: sessionId,
        ...(plan ? { plan } : {}),
        ...(Number.isFinite(amount) && amount > 0 ? { value: amount, currency } : {})
      });
    } catch {
      if (attempt < 8) setTimeout(() => void verifyPurchaseReturn(attempt + 1), 1500);
    }
  }

  window.fetch = async (...args) => {
    const details = requestDetails(args[0], args[1]);
    const response = await nativeFetch(...args);
    if (response.ok) queueMicrotask(() => trackSuccessfulAction(details));
    return response;
  };

  setTimeout(() => void verifyPurchaseReturn(), 0);
})();
