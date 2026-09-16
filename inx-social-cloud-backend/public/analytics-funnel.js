(() => {
  if (window.__inxSocialAnalyticsFunnelPatched) return;
  window.__inxSocialAnalyticsFunnelPatched = true;

  const nativeFetch = window.fetch.bind(window);

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

  window.fetch = async (...args) => {
    const details = requestDetails(args[0], args[1]);
    const response = await nativeFetch(...args);
    if (response.ok) queueMicrotask(() => trackSuccessfulAction(details));
    return response;
  };
})();
