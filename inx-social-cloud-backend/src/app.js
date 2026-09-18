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
const CANONICAL_BROWSER_HOST = 'www.inxsocial.co.uk';
const MIGRATION_BROWSER_HOSTS = new Set(['social.inaxx.co.uk', 'inxsocial.co.uk']);
const ANALYTICS_SCRIPT_TAG = '<script src="/analytics-consent.js?v=20260916a" defer></script>';
const TRACKED_PUBLIC_HTML = [
  '/social-media-scheduler.html',
  '/bulk-social-media-scheduler.html',
  '/social-media-content-calendar.html',
  '/social-media-analytics.html',
  '/ai-social-media-tools.html',
  '/ai-social-media-post-generator.html',
  '/generate-and-schedule-social-media-posts.html',
  '/pricing.html',
  '/free-social-media-tools.html',
  '/social-media-caption-generator.html',
  '/privacy.html',
  '/terms.html',
  '/data-deletion.html'
];
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
  const document = source
    .replace(
      '<title>Social Media Scheduling &amp; Publishing | INXSocial</title>',
      '<title>Social Media Scheduler &amp; Publishing Tool | INXSocial</title>'
    )
    .replace(
      '<meta name="description" content="Connect social accounts, create posts, bulk schedule content, manage a visual calendar, review analytics and use AI-assisted content tools in one secure INXSocial workspace.">',
      '<meta name="description" content="Schedule and publish social media content from one workspace. Connect accounts, bulk schedule posts, manage a content calendar, review analytics and use AI-assisted creation with INXSocial.">'
    )
    .replace(
      '<link rel="stylesheet" href="/landing.css?v=20260909c">',
      '<link rel="stylesheet" href="/landing.css?v=20260909c">\n  <link rel="stylesheet" href="/landing-mobile.css?v=20260910c" media="(max-width: 900px)">\n  <link rel="stylesheet" href="/landing-performance.css?v=20260911b">\n  <link rel="stylesheet" href="/landing-brand.css?v=20260911b">'
    )
    .replace(
      '<link rel="stylesheet" href="/landing-ai-studio.css?v=20260915a">',
      '<link rel="stylesheet" href="/landing-ai-studio.css?v=20260916b">'
    )
    .replace(
      '<script src="/landing.js?v=20260909c"></script>',
      '<script src="/landing.js?v=20260917a"></script>'
    )
    .replace(
      '<nav id="mainNav" aria-label="Main navigation"><a href="#platform">Platform</a><a href="#workflows">Workflows</a><a href="#intelligence">AI Studio</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></nav>',
      '<nav id="mainNav" aria-label="Main navigation"><a href="#platform">Platform</a><a href="#workflows">Workflows</a><a href="#intelligence">AI Studio</a><a href="/free-social-media-tools.html">Free tools</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></nav>'
    )
    .replace(
      '<a href="/pricing.html">Pricing</a></div><div><strong>Account</strong>',
      '<a href="/pricing.html">Pricing</a><a href="/free-social-media-tools.html">Free tools</a></div><div><strong>Account</strong>'
    )
    .replace(
      '<div><strong>Platform</strong><a href="#workflows">Workflows</a><a href="#intelligence">AI &amp; Analytics</a><a href="#pricing">Pricing</a><a href="/app/">Open app</a></div>',
      '<div><strong>Explore</strong><a href="/social-media-scheduler.html">Social media scheduler</a><a href="/bulk-social-media-scheduler.html">Bulk scheduling</a><a href="/social-media-content-calendar.html">Content calendar</a><a href="/ai-social-media-tools.html">AI tools</a><a href="/social-media-analytics.html">Analytics</a><a href="/free-social-media-tools.html">Free tools</a><a href="/pricing.html">Pricing</a></div>'
    )
    .replace(
      '<div class="shell platform-rail" data-animate><span class="rail-label">Connect your channels</span><div class="platform-pill facebook"><b>f</b> Facebook Pages</div><div class="platform-pill instagram"><b>◎</b> Instagram via Meta</div><div class="platform-pill instagram"><b>＠</b> Direct Instagram</div><div class="platform-pill linkedin"><b>in</b> LinkedIn</div><div class="platform-pill youtube"><b>▶</b> YouTube</div><div class="platform-pill more"><b>＋</b> More connectors</div></div>',
      '<div class="shell platform-rail" data-animate><span class="rail-label">9 supported networks</span><div class="platform-pill facebook"><b>f</b> Facebook</div><div class="platform-pill instagram"><b>◎</b> Instagram</div><div class="platform-pill linkedin"><b>in</b> LinkedIn</div><div class="platform-pill more">TikTok</div><div class="platform-pill youtube"><b>▶</b> YouTube</div><div class="platform-pill more">Pinterest</div><div class="platform-pill more">Threads</div><div class="platform-pill more">Bluesky</div><div class="platform-pill more">X</div></div>'
    );
  return injectAnalyticsConsent(document);
};

const landingDocument = buildLandingDocument();

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

app.use('/admin.css', express.static(path.join(publicRoot, 'admin.css'), { setHeaders: res => res.setHeader('Content-Type', 'text/css') }));
app.use('/admin.js', express.static(path.join(publicRoot, 'admin.js'), { setHeaders: res => res.setHeader('Content-Type', 'application/javascript') }));
app.get('/30-day-social-media-content-planner.html', (req, res) => res.redirect(308, '/ai-social-media-tools.html'));
app.get(['/ai-video-post-generator.html', '/ai-carousel-post-generator.html', '/ai-ugc-ad-generator.html'], (req, res) => res.redirect(308, '/ai-social-media-tools.html'));
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

app.get('/', (req, res) => {
  if (isAdminHost(req)) {
    secureAdminDocument(res);
    return res.sendFile(adminIndex);
  }
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Vary', 'Accept-Encoding');
  res.type('html').send(landingDocument);
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