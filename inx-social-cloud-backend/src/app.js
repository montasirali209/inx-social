const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
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
const packageInfo = require('../package.json');
const env = require('./config/env');

const app = express();
app.set('trust proxy', 1);
const reactAppRoot = path.join(__dirname, '..', 'frontend', 'dist');
const reactAppIndex = path.join(reactAppRoot, 'index.html');
const adminIndex = path.join(__dirname, '..', 'public', 'index.html');
const landingPath = path.join(__dirname, '..', 'public', 'landing.html');
const isAdminHost = req => Boolean(env.adminHost && String(req.hostname || '').toLowerCase() === env.adminHost);
const secureAdminDocument = res => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
};

const buildLandingDocument = () => {
  const source = fs.readFileSync(landingPath, 'utf8');
  return source
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
    );
};

const landingDocument = buildLandingDocument();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
morgan.token('safe-url', req => String(req.originalUrl || req.url || '').replace(/([?&]access=)[^&]+/g, '$1[redacted]'));
app.use(morgan(':method :safe-url :status :response-time ms - :res[content-length]'));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 240 }));
app.use('/api/admin', rateLimit({ windowMs: 60 * 1000, limit: 90 }), (req, res, next) => {
  if (env.adminHost && !isAdminHost(req)) return res.status(404).json({ error: 'Route not found' });
  next();
});

app.use(['/admin', '/api', '/portal', '/studio', '/app'], (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

// Stripe signatures require the exact raw request bytes. Keep both Stripe webhooks before express.json().
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingController.webhook);
app.post('/api/ai-content-studio/credits/webhook', express.raw({ type: 'application/json' }), aiContentStudioController.creditWebhook);

app.use(express.json({ limit: '2mb' }));
app.use('/api/releases', releaseRoutes);

app.use('/admin.css', express.static(path.join(__dirname, '..', 'public', 'admin.css'), { setHeaders: res => res.setHeader('Content-Type', 'text/css') }));
app.use('/admin.js', express.static(path.join(__dirname, '..', 'public', 'admin.js'), { setHeaders: res => res.setHeader('Content-Type', 'application/javascript') }));
app.use(express.static(path.join(__dirname, '..', 'public'), {
  index: false,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (/\.(?:css|js|png|jpe?g|webp|svg|woff2?)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  }
}));
app.use('/portal', express.static(path.join(__dirname, '..', 'portal')));
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
    customerPortal: '/portal/',
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

app.get('/inx-social/data-deletion.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'data-deletion.html'));
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

app.use('/api/auth', authRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/system', systemRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/ai-content-studio', rateLimit({ windowMs: 60 * 1000, limit: 60 }), aiContentStudioRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/social-platforms', socialPlatformRoutes);
app.use('/api/social-connections', socialConnectionRoutes);

app.get('/app/*', (req, res, next) => {
  res.sendFile(reactAppIndex, error => {
    if (!error) return;
    if (error.code === 'ENOENT') {
      return res.status(503).json({ error: 'React application build is not available.' });
    }
    return next(error);
  });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

module.exports = app;