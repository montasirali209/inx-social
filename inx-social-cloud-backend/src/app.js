const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const authRoutes = require('./routes/authRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const licenseRoutes = require('./routes/licenseRoutes');
const pageRoutes = require('./routes/pageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const portalRoutes = require('./routes/portalRoutes');
const billingRoutes = require('./routes/billingRoutes');
const systemRoutes = require('./routes/systemRoutes');
const billingController = require('./controllers/billingController');
const aiContentStudioController = require('./controllers/aiContentStudioController');
const errorHandler = require('./middleware/errorHandler');
const releaseRoutes = require('./routes/releaseRoutes');
const studioRoutes = require('./routes/studioRoutes');
const aiContentStudioRoutes = require('./routes/aiContentStudioRoutes');
const agentRoutes = require('./routes/agentRoutes');
const socialPlatformRoutes = require('./routes/socialPlatformRoutes');
const socialConnectionRoutes = require('./routes/socialConnectionRoutes');
const socialPublicationRoutes = require('./routes/socialPublicationRoutes');
const packageInfo = require('../package.json');
const env = require('./config/env');

const app = express();
app.set('trust proxy', 1);
const reactAppRoot = path.join(__dirname, '..', 'frontend', 'dist');
const reactAppIndex = path.join(reactAppRoot, 'index.html');
const publicRoot = path.join(__dirname, '..', 'public');
const portalRoot = path.join(__dirname, '..', 'portal');
const adminIndex = path.join(publicRoot, 'index.html');
const landingPath = path.join(publicRoot, 'landing.html');
const LANDING_DASHBOARD_ASSET_PATH = '/assets/landing-dashboard-20260919.webp';
const SOCIAL_PREVIEW_ASSET_PATH = '/assets/inxsocial-social-preview-v3.jpg';
const landingDashboardPartPaths = Array.from({ length: 7 }, (_, index) =>
  path.join(publicRoot, 'assets', `landing-dashboard-20260919.part${String(index + 1).padStart(3, '0')}.b64`)
);
const loadLandingDashboardAsset = () => {
  try {
    const encoded = landingDashboardPartPaths
      .map(filePath => fs.readFileSync(filePath, 'utf8').trim())
      .join('');
    const decoded = Buffer.from(encoded, 'base64');
    const isWebp =
      decoded.length > 10000 &&
      decoded.toString('ascii', 0, 4) === 'RIFF' &&
      decoded.toString('ascii', 8, 12) === 'WEBP';
    if (!isWebp) throw new Error('decoded landing dashboard asset is not a valid WebP');
    return decoded;
  } catch (error) {
    console.warn('[landing] dashboard preview asset unavailable', { error: error?.message });
    return null;
  }
};
const landingDashboardAsset = loadLandingDashboardAsset();
let socialPreviewAssetPromise = null;

async function buildSocialPreviewAsset() {
  if (!landingDashboardAsset) return null;
  if (socialPreviewAssetPromise) return socialPreviewAssetPromise;

  socialPreviewAssetPromise = (async () => {
    const dashboard = await sharp(landingDashboardAsset)
      .resize(720, 405, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
      .toBuffer();

    const wordmarkPath = path.join(publicRoot, 'assets', 'inx-social-wordmark.png');
    const wordmark = await sharp(wordmarkPath)
      .resize({ width: 270, withoutEnlargement: true })
      .png()
      .toBuffer();

    const background = Buffer.from(`<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#04131d"/>
          <stop offset="0.52" stop-color="#082334"/>
          <stop offset="1" stop-color="#041019"/>
        </linearGradient>
        <radialGradient id="glowA" cx="0.18" cy="0.20" r="0.66">
          <stop offset="0" stop-color="#14b8a6" stop-opacity="0.20"/>
          <stop offset="1" stop-color="#14b8a6" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowB" cx="0.92" cy="0.08" r="0.56">
          <stop offset="0" stop-color="#2563eb" stop-opacity="0.16"/>
          <stop offset="1" stop-color="#2563eb" stop-opacity="0"/>
        </radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.40"/>
        </filter>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <rect width="1200" height="630" fill="url(#glowA)"/>
      <rect width="1200" height="630" fill="url(#glowB)"/>

      <circle cx="1125" cy="90" r="220" fill="#2dd4bf" opacity="0.045"/>
      <circle cx="80" cy="605" r="230" fill="#2563eb" opacity="0.045"/>

      <rect x="60" y="170" width="268" height="18" rx="9" fill="#1dd3c0" opacity="0.92"/>
      <rect x="60" y="205" width="226" height="12" rx="6" fill="#7dd3fc" opacity="0.48"/>
      <rect x="60" y="236" width="190" height="12" rx="6" fill="#94a3b8" opacity="0.28"/>
      <rect x="60" y="267" width="238" height="12" rx="6" fill="#94a3b8" opacity="0.22"/>

      <rect x="60" y="325" width="178" height="54" rx="16" fill="#14b8a6"/>
      <circle cx="82" cy="432" r="10" fill="#2dd4bf"/>
      <rect x="104" y="425" width="128" height="12" rx="6" fill="#cbd5e1" opacity="0.42"/>
      <circle cx="82" cy="474" r="10" fill="#60a5fa"/>
      <rect x="104" y="467" width="154" height="12" rx="6" fill="#cbd5e1" opacity="0.36"/>
      <circle cx="82" cy="516" r="10" fill="#a78bfa"/>
      <rect x="104" y="509" width="116" height="12" rx="6" fill="#cbd5e1" opacity="0.30"/>

      <rect x="398" y="82" width="742" height="466" rx="28" fill="#071a27" stroke="#2dd4bf" stroke-opacity="0.30" filter="url(#shadow)"/>
      <rect x="414" y="98" width="710" height="434" rx="18" fill="#03111a" stroke="#ffffff" stroke-opacity="0.08"/>

      <rect x="430" y="118" width="142" height="12" rx="6" fill="#22d3ee" opacity="0.55"/>
      <rect x="430" y="144" width="92" height="10" rx="5" fill="#94a3b8" opacity="0.30"/>
      <rect x="1000" y="118" width="86" height="12" rx="6" fill="#2dd4bf" opacity="0.48"/>
      <rect x="60" y="575" width="1080" height="1" fill="#ffffff" opacity="0.07"/>
    </svg>`);

    return sharp(background)
      .composite([
        { input: wordmark, left: 60, top: 62 },
        { input: dashboard, left: 408, top: 112 }
      ])
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4', progressive: true })
      .toBuffer();
  })().catch((error) => {
    console.warn('[landing] social preview asset unavailable', { error: error?.message });
    socialPreviewAssetPromise = null;
    return null;
  });

  return socialPreviewAssetPromise;
}
const CANONICAL_BROWSER_HOST = 'www.inxsocial.co.uk';
const MIGRATION_BROWSER_HOSTS = new Set(['social.inaxx.co.uk', 'inxsocial.co.uk']);
const ANALYTICS_SCRIPT_TAG = '<script src="/analytics-consent.js?v=20260926a" defer></script>';
const TRACKED_PUBLIC_HTML = [
  '/privacy.html',
  '/terms.html',
  '/data-deletion.html'
];

const SEO_MARKETING_ROUTES = new Map([
  ['/social-media-scheduler', '/#workflow'],
  ['/bulk-social-media-scheduler', '/#workflow'],
  ['/social-media-content-calendar', '/#capabilities'],
  ['/social-media-analytics', '/#capabilities'],
  ['/ai-social-media-tools', '/#ai'],
  ['/ai-social-media-campaign-generator', '/#ai'],
  ['/ai-social-media-post-generator', '/#ai'],
  ['/ai-carousel-post-generator', '/#ai'],
  ['/ai-video-post-generator', '/#ai'],
  ['/ai-ugc-ad-generator', '/#ai'],
  ['/pricing', '/#pricing']
]);

const LEGACY_MARKETING_REDIRECTS = {
  '/social-media-scheduler.html': '/social-media-scheduler',
  '/bulk-social-media-scheduler.html': '/bulk-social-media-scheduler',
  '/social-media-content-calendar.html': '/social-media-content-calendar',
  '/social-media-analytics.html': '/social-media-analytics',
  '/ai-social-media-tools.html': '/ai-social-media-tools',
  '/ai-social-media-campaign-generator.html': '/ai-social-media-campaign-generator',
  '/ai-social-media-post-generator.html': '/ai-social-media-post-generator',
  '/generate-and-schedule-social-media-posts.html': '/social-media-scheduler',
  '/pricing.html': '/pricing',
  '/free-social-media-tools.html': '/ai-social-media-tools',
  '/social-media-caption-generator.html': '/ai-social-media-post-generator',
  '/30-day-social-media-content-planner.html': '/social-media-content-calendar',
  '/ai-video-post-generator.html': '/ai-video-post-generator',
  '/ai-carousel-post-generator.html': '/ai-carousel-post-generator',
  '/ai-ugc-ad-generator.html': '/ai-ugc-ad-generator'
};
const isAdminHost = req => Boolean(env.adminHost && String(req.hostname || '').toLowerCase() === env.adminHost);
const secureAdminDocument = res => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
};

const injectAnalyticsConsent = source => {
  if (!source || source.includes('/analytics-consent.js')) return source;
  if (source.includes('</head>')) return source.replace('</head>', `  ${ANALYTICS_SCRIPT_TAG}\n</head>`);
  return `${source}\n${ANALYTICS_SCRIPT_TAG}`;
};

const buildSeoFallbackDocuments = () => {
  const documents = new Map();

  for (const routePath of SEO_MARKETING_ROUTES.keys()) {
    const fallbackPath = path.join(publicRoot, `${routePath.slice(1)}.html`);
    try {
      let source = fs.readFileSync(fallbackPath, 'utf8');
      const canonicalUrl = `https://www.inxsocial.co.uk${routePath}`;
      const legacyUrl = `${canonicalUrl}.html`;

      source = source
        .split(legacyUrl).join(canonicalUrl)
        .split('/assets/inx-social-dashboard.jpg').join(LANDING_DASHBOARD_ASSET_PATH);

      for (const [legacyPath, cleanPath] of Object.entries(LEGACY_MARKETING_REDIRECTS)) {
        source = source
          .split(`href="${legacyPath}"`).join(`href="${cleanPath}"`)
          .split(`https://www.inxsocial.co.uk${legacyPath}`).join(`https://www.inxsocial.co.uk${cleanPath}`);
      }

      documents.set(routePath, injectAnalyticsConsent(source));
    } catch (error) {
      console.warn('[seo-fallback] unable to build fallback page', {
        routePath,
        error: error?.message
      });
    }
  }

  return documents;
};

const seoFallbackDocuments = buildSeoFallbackDocuments();

const sendTrackedHtml = (filePath, res, next, options = {}) => {
  fs.readFile(filePath, 'utf8', (error, source) => {
    if (error) {
      if (error.code === 'ENOENT' && options.unavailableMessage) {
        return res.status(503).json({ error: options.unavailableMessage });
      }
      return next(error);
    }
    res.setHeader('Cache-Control', options.cacheControl || 'public, max-age=0, must-revalidate');
    res.setHeader('Vary', 'Accept-Encoding');
    return res.type('html').send(injectAnalyticsConsent(source));
  });
};

const guardAdminSurface = (req, res, next) => {
  if (env.adminHost && !isAdminHost(req)) return res.status(404).json({ error: 'Route not found' });

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = String(req.headers.origin || '').trim();
    if (origin) {
      try {
        const parsed = new URL(origin);
        if (parsed.host !== String(req.get('host') || '')) {
          return res.status(403).json({ error: 'Cross-origin administrator request blocked' });
        }
      } catch {
        return res.status(403).json({ error: 'Invalid administrator request origin' });
      }
    }
  }

  next();
};

const buildLandingDocument = () => {
  const source = fs.readFileSync(landingPath, 'utf8');
  return injectAnalyticsConsent(source);
};

const landingDocument = buildLandingDocument();

const isNextLandingEnabled = () => /^(?:1|true|yes|on)$/i.test(String(process.env.NEXT_LANDING_ENABLED || '').trim());
const getNextLandingOrigin = () => String(process.env.NEXT_LANDING_ORIGIN || '').trim().replace(/\/+$/, '');

const fetchNextLanding = async (requestPath, options = {}) => {
  const origin = getNextLandingOrigin();
  if (!isNextLandingEnabled() || !origin) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${origin}${requestPath}`, {
      method: options.method || 'GET',
      headers: {
        accept: options.accept || '*/*',
        'user-agent': 'INXSocial-Landing-Proxy/1.0'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      console.warn('[landing-proxy] upstream returned non-success; using legacy landing', {
        path: requestPath,
        status: response.status
      });
      return null;
    }

    return response;
  } catch (error) {
    console.warn('[landing-proxy] upstream unavailable; using legacy landing', {
      path: requestPath,
      error: error?.message
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
};

app.use((req, res, next) => {
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const host = forwardedHost.split(',')[0].trim().split(':')[0].toLowerCase();
  const isSafeNavigation = req.method === 'GET' || req.method === 'HEAD';
  const isApiRequest = req.path === '/api' || req.path.startsWith('/api/');

  if (MIGRATION_BROWSER_HOSTS.has(host) && isSafeNavigation && !isApiRequest) {
    const destination = new URL(req.originalUrl || req.url || '/', `https://${CANONICAL_BROWSER_HOST}`);
    return res.redirect(308, destination.toString());
  }

  if (host.endsWith('.up.railway.app')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  next();
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
morgan.token('safe-url', req => String(req.originalUrl || req.url || '').replace(/([?&]access=)[^&]+/g, '$1[redacted]'));
app.use(morgan(':method :safe-url :status :response-time ms - :res[content-length]'));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 240 }));
app.use('/api/admin-auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many administrator sign-in attempts. Try again later.' }
}));
app.use('/api/admin-auth', guardAdminSurface);
app.use('/api/admin', rateLimit({ windowMs: 60 * 1000, limit: 90 }), guardAdminSurface);

app.use(['/admin', '/index.html', '/api', '/portal', '/studio', '/app', '/health', '/oauth-callback.html'], (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

app.use(['/privacy.html', '/terms.html', '/data-deletion.html', '/inx-social/data-deletion.html'], (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, follow');
  next();
});

// Stripe signatures require the exact raw request bytes. Keep both Stripe webhooks before express.json().
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingController.webhook);
app.post('/api/ai-content-studio/credits/webhook', express.raw({ type: 'application/json' }), aiContentStudioController.creditWebhook);

app.use(express.json({ limit: '2mb' }));
app.use('/api/releases', releaseRoutes);

app.use('/_next', async (req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method) || !isNextLandingEnabled()) return next();

  const upstream = await fetchNextLanding(req.originalUrl, {
    method: req.method,
    accept: req.headers.accept
  });
  if (!upstream) return next();

  for (const header of ['content-type', 'cache-control', 'etag', 'last-modified']) {
    const value = upstream.headers.get(header);
    if (value) res.setHeader(header, value);
  }

  res.status(upstream.status);
  if (req.method === 'HEAD') return res.end();

  const payload = Buffer.from(await upstream.arrayBuffer());
  return res.send(payload);
});

app.use('/blog', async (req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method) || !isNextLandingEnabled()) return next();

  const upstream = await fetchNextLanding(req.originalUrl, {
    method: req.method,
    accept: req.headers.accept
  });
  if (!upstream) return next();

  try {
    for (const header of ['content-type', 'cache-control', 'etag', 'last-modified']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    res.setHeader('X-INX-Landing', 'next-blog');
    res.status(upstream.status);
    if (req.method === 'HEAD') return res.end();

    const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html')) {
      const source = await upstream.text();
      return res.type('html').send(injectAnalyticsConsent(source));
    }

    const payload = Buffer.from(await upstream.arrayBuffer());
    return res.send(payload);
  } catch (error) {
    console.warn('[blog-proxy] failed to relay Next.js blog response', {
      path: req.originalUrl,
      error: error?.message
    });
    return next(error);
  }
});

app.get([...SEO_MARKETING_ROUTES.keys()], async (req, res) => {
  const cleanPath = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;

  if (req.path !== cleanPath) {
    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
    return res.redirect(308, `${cleanPath}${query}`);
  }

  if (isNextLandingEnabled()) {
    const upstream = await fetchNextLanding(cleanPath, {
      accept: req.headers.accept
    });

    if (upstream) {
      try {
        const source = await upstream.text();
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('X-INX-Landing', 'next-seo');
        return res.type('html').send(injectAnalyticsConsent(source));
      } catch (error) {
        console.warn('[seo-proxy] failed to read upstream page; using canonical static fallback', {
          path: cleanPath,
          error: error?.message
        });
      }
    }
  }

  const fallback = seoFallbackDocuments.get(cleanPath);
  if (fallback) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('X-INX-Landing', 'legacy-seo-fallback');
    return res.type('html').send(fallback);
  }

  return res.status(404).json({ error: 'Route not found' });
});

app.get(LANDING_DASHBOARD_ASSET_PATH, (req, res, next) => {
  if (!landingDashboardAsset) return next();
  res.type('image/webp');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.send(landingDashboardAsset);
});

app.get(SOCIAL_PREVIEW_ASSET_PATH, async (req, res, next) => {
  try {
    const asset = await buildSocialPreviewAsset();
    if (!asset) return next();
    res.type('image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(asset);
  } catch (error) {
    console.warn('[landing] social preview response failed', { error: error?.message });
    return next();
  }
});

app.use('/admin.css', express.static(path.join(publicRoot, 'admin.css'), { setHeaders: res => res.setHeader('Content-Type', 'text/css') }));
app.use('/admin.js', express.static(path.join(publicRoot, 'admin.js'), { setHeaders: res => res.setHeader('Content-Type', 'application/javascript') }));
app.get(Object.keys(LEGACY_MARKETING_REDIRECTS), (req, res) => {
  res.redirect(301, LEGACY_MARKETING_REDIRECTS[req.path] || '/');
});
app.get(TRACKED_PUBLIC_HTML, (req, res, next) => sendTrackedHtml(path.join(publicRoot, req.path.slice(1)), res, next));
app.use(express.static(publicRoot, {
  index: false,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (/\.(?:css|js|png|jpe?g|webp|svg|woff2?)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  }
}));
app.get(['/portal', '/portal/', '/portal/index.html'], (req, res) => {
  const queryIndex = req.originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  res.redirect(308, `/app/billing${query}`);
});
app.get(['/portal/login.html', '/portal/register.html'], (req, res, next) => {
  const fileName = path.basename(req.path);
  sendTrackedHtml(path.join(portalRoot, fileName), res, next, { cacheControl: 'no-store' });
});
app.use('/portal', express.static(portalRoot));
app.get(['/studio', '/studio/', '/studio/index.html'], (req, res) => res.redirect(308, '/app/'));
app.use('/studio', (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});
app.use('/studio', express.static(path.join(__dirname, '..', 'studio')));
app.use('/app', express.static(reactAppRoot, {
  index: false,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (/\.(?:css|js|png|jpe?g|webp|svg|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'INX Social Cloud Backend',
    version: packageInfo.version,
    customerPortal: '/app/billing',
    cloudStudio: '/app/',
    reactApp: '/app/'
  });
});

app.get(['/admin', '/admin/'], (req, res) => {
  if (env.adminHost) return res.status(404).json({ error: 'Route not found' });
  secureAdminDocument(res);
  res.sendFile(adminIndex);
});

app.get(/^\/app$/, (req, res) => res.redirect(308, '/app/'));

app.get('/privacy', (req, res) => res.redirect(308, '/privacy.html'));
app.get('/terms', (req, res) => res.redirect(308, '/terms.html'));
app.get('/data-deletion', (req, res) => res.redirect(308, '/data-deletion.html'));

app.get('/inx-social/data-deletion.html', (req, res, next) => {
  sendTrackedHtml(path.join(publicRoot, 'data-deletion.html'), res, next);
});

app.get('/', async (req, res) => {
  if (isAdminHost(req)) {
    secureAdminDocument(res);
    return res.sendFile(adminIndex);
  }

  if (isNextLandingEnabled()) {
    const upstream = await fetchNextLanding('/');
    if (upstream) {
      try {
        const source = await upstream.text();
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('X-INX-Landing', 'next');
        return res.type('html').send(injectAnalyticsConsent(source));
      } catch (error) {
        console.warn('[landing-proxy] failed to read upstream HTML; using legacy landing', {
          error: error?.message
        });
      }
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('X-INX-Landing', 'legacy');
  return res.type('html').send(landingDocument);
});

app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/system', systemRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/ai-content-studio', rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  // Progress/history reads intentionally poll while background media renders. The
  // global limiter still protects them; reserve this stricter budget for mutations.
  skip: req => ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
}), aiContentStudioRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/social-platforms', socialPlatformRoutes);
app.use('/api/social-connections', socialConnectionRoutes);
app.use('/api/social-publications', socialPublicationRoutes);

app.get('/app/*', (req, res, next) => {
  sendTrackedHtml(reactAppIndex, res, next, {
    cacheControl: 'no-store',
    unavailableMessage: 'React application build is not available.'
  });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
