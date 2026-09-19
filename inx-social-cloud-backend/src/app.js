const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

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
const CANONICAL_BROWSER_HOST = 'www.inxsocial.co.uk';
const MIGRATION_BROWSER_HOSTS = new Set(['social.inaxx.co.uk', 'inxsocial.co.uk']);
const ANALYTICS_SCRIPT_TAG = '<script src="/analytics-consent.js?v=20260916a" defer></script>';
const TRACKED_PUBLIC_HTML = [
  '/privacy.html',
  '/terms.html',
  '/data-deletion.html'
];

const LEGACY_MARKETING_REDIRECTS = {
  '/social-media-scheduler.html': '/#workflows',
  '/bulk-social-media-scheduler.html': '/#workflows',
  '/social-media-content-calendar.html': '/#product',
  '/social-media-analytics.html': '/#intelligence',
  '/ai-social-media-tools.html': '/#intelligence',
  '/ai-social-media-post-generator.html': '/#intelligence',
  '/generate-and-schedule-social-media-posts.html': '/#workflows',
  '/pricing.html': '/#pricing',
  '/free-social-media-tools.html': '/',
  '/social-media-caption-generator.html': '/',
  '/30-day-social-media-content-planner.html': '/#product',
  '/ai-video-post-generator.html': '/#intelligence',
  '/ai-carousel-post-generator.html': '/#intelligence',
  '/ai-ugc-ad-generator.html': '/#intelligence'
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

const buildLandingDashboardAsset = () => {
  try {
    const assetRoot = path.join(publicRoot, 'assets');
    const encoded = [
      'landing-dashboard-webp.part01.b64',
      'landing-dashboard-webp.part02.b64'
    ].map(fileName => fs.readFileSync(path.join(assetRoot, fileName), 'utf8').trim()).join('');
    return Buffer.from(encoded, 'base64');
  } catch (error) {
    console.warn('[landing-dashboard] custom dashboard preview unavailable; legacy asset remains available', {
      error: error?.message
    });
    return null;
  }
};

const landingDashboardAsset = buildLandingDashboardAsset();

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

app.get(LANDING_DASHBOARD_ASSET_PATH, (req, res, next) => {
  if (!landingDashboardAsset) return next();
  res.type('image/webp');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.send(landingDashboardAsset);
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