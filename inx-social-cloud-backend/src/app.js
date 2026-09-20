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
const SOCIAL_PREVIEW_ASSET_PATH = '/assets/inxsocial-social-preview.jpg';
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

function escapeSvgText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function buildSocialPreviewAsset() {
  if (!landingDashboardAsset) return null;
  if (socialPreviewAssetPromise) return socialPreviewAssetPromise;

  socialPreviewAssetPromise = (async () => {
    const dashboard = await sharp(landingDashboardAsset)
      .resize(620, 349, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
      .toBuffer();

    const headline = ['Create. Schedule.', 'Analyse. Grow.'];
    const description = [
      'Manage social content, bulk scheduling, analytics',
      'and AI creation from one connected workspace.'
    ];

    const overlay = Buffer.from(`<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#04131d"/>
          <stop offset="0.52" stop-color="#082334"/>
          <stop offset="1" stop-color="#041019"/>
        </linearGradient>
        <radialGradient id="glow" cx="0.82" cy="0.22" r="0.7">
          <stop offset="0" stop-color="#22d3c5" stop-opacity="0.20"/>
          <stop offset="1" stop-color="#22d3c5" stop-opacity="0"/>
        </radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.42"/>
        </filter>
      </defs>
      <rect width="1200" height="630" rx="0" fill="url(#bg)"/>
      <rect width="1200" height="630" fill="url(#glow)"/>
      <circle cx="1050" cy="52" r="220" fill="#0ea5a4" opacity="0.06"/>
      <circle cx="1180" cy="590" r="260" fill="#2563eb" opacity="0.05"/>

      <g font-family="Arial, Helvetica, sans-serif">
        <rect x="58" y="52" width="178" height="46" rx="13" fill="#e7f9ff"/>
        <rect x="67" y="61" width="28" height="28" rx="8" fill="#062633"/>
        <path d="M74 68h14v14H74z" fill="#19c8b2" opacity=".22"/>
        <path d="M77 71h8v8h-8z" fill="#ffffff"/>
        <text x="106" y="83" font-size="22" font-weight="700" fill="#0c3345">INXSocial</text>

        <rect x="58" y="126" width="328" height="34" rx="17" fill="#0f3442" stroke="#1ec9b7" stroke-opacity=".35"/>
        <text x="74" y="148" font-size="13" font-weight="700" fill="#77eadc" letter-spacing="1.2">ALL-IN-ONE SOCIAL MEDIA + AI</text>

        <text x="58" y="225" font-size="53" font-weight="800" fill="#ffffff">${escapeSvgText(headline[0])}</text>
        <text x="58" y="287" font-size="53" font-weight="800" fill="#ffffff">Analyse. <tspan fill="#2dd4bf">Grow.</tspan></text>

        <text x="58" y="344" font-size="20" fill="#b8c9d4">${escapeSvgText(description[0])}</text>
        <text x="58" y="375" font-size="20" fill="#b8c9d4">${escapeSvgText(description[1])}</text>

        <rect x="58" y="418" width="186" height="52" rx="13" fill="#19bdaa"/>
        <text x="91" y="451" font-size="18" font-weight="700" fill="#ffffff">Start free trial</text>
        <text x="218" y="451" font-size="22" font-weight="700" fill="#ffffff">→</text>

        <text x="58" y="515" font-size="15" fill="#90a7b4">✓ 7-day trial</text>
        <text x="173" y="515" font-size="15" fill="#90a7b4">✓ 9 supported platforms</text>
        <text x="365" y="515" font-size="15" fill="#90a7b4">✓ No card required</text>

        <rect x="506" y="112" width="664" height="397" rx="24" fill="#071a27" stroke="#2dd4bf" stroke-opacity=".28" filter="url(#shadow)"/>
        <rect x="522" y="128" width="632" height="365" rx="15" fill="#03111a" stroke="#ffffff" stroke-opacity=".07"/>

        <rect x="515" y="83" width="170" height="42" rx="12" fill="#0a2c39" stroke="#2dd4bf" stroke-opacity=".38"/>
        <text x="531" y="101" font-size="12" fill="#8aa8b5">Bulk Scheduler</text>
        <text x="531" y="117" font-size="13" font-weight="700" fill="#ffffff">Campaign ready</text>

        <rect x="955" y="480" width="186" height="44" rx="12" fill="#0a2c39" stroke="#2dd4bf" stroke-opacity=".38"/>
        <text x="971" y="499" font-size="12" fill="#8aa8b5">AI Content Studio</text>
        <text x="971" y="515" font-size="13" font-weight="700" fill="#ffffff">Create faster</text>

        <text x="58" y="590" font-size="16" font-weight="700" fill="#d7e7ed">www.inxsocial.co.uk</text>
      </g>
    </svg>`);

    return sharp(overlay)
      .composite([{ input: dashboard, left: 528, top: 136 }])
      .jpeg({ quality: 91, chromaSubsampling: '4:4:4', progressive: true })
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
const ANALYTICS_SCRIPT_TAG = '<script src="/analytics-consent.js?v=20260916a" defer></script>';
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