const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const licenseRoutes = require('./routes/licenseRoutes');
const pageRoutes = require('./routes/pageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const portalRoutes = require('./routes/portalRoutes');
const billingRoutes = require('./routes/billingRoutes');
const systemRoutes = require('./routes/systemRoutes');
const billingController = require('./controllers/billingController');
const errorHandler = require('./middleware/errorHandler');
const releaseRoutes = require('./routes/releaseRoutes');
const studioRoutes = require('./routes/studioRoutes');
const agentRoutes = require('./routes/agentRoutes');
const socialPlatformRoutes = require('./routes/socialPlatformRoutes');
const packageInfo = require('../package.json');

const app = express();
const reactAppRoot = path.join(__dirname, '..', 'frontend', 'dist');
const reactAppIndex = path.join(reactAppRoot, 'index.html');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 240 }));

// Account, API and administration screens must not compete with the public
// product pages in search results.
app.use(['/admin', '/api', '/portal', '/studio', '/app'], (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

// Cloud Studio opens Facebook in a popup and receives the OAuth result through
// window.opener. Helmet's default "same-origin" COOP policy severs that popup
// relationship when it navigates to facebook.com. Override the policy only for
// Studio routes while keeping Helmet's stricter default everywhere else.
app.use('/studio', (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// This must be registered before express.json(). Stripe verifies the exact raw bytes.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingController.webhook);

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
    adminPanel: '/admin',
    customerPortal: '/portal/',
    cloudStudio: '/studio/',
    reactApp: '/app/'
  });
});

app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/studio', (req, res) => res.redirect(308, '/studio/'));
app.get(/^\/app$/, (req, res) => res.redirect(308, '/app/'));

app.get('/privacy', (req, res) => res.redirect(308, '/privacy.html'));
app.get('/terms', (req, res) => res.redirect(308, '/terms.html'));
app.get('/data-deletion', (req, res) => res.redirect(308, '/data-deletion.html'));

// Preserve the legacy path previously submitted to Meta when the owner points
// that URL at this service. The canonical public document remains at the root.
app.get('/inx-social/data-deletion.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'data-deletion.html'));
});

app.get('/', (req, res) => {
  const landing = path.join(__dirname, '..', 'public', 'landing.html');
  res.sendFile(landing, error => {
    if (error) res.redirect('/portal/');
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/system', systemRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/social-platforms', socialPlatformRoutes);

// The React application is migrated route by route. Keep this fallback after
// every API route so client-side navigation can never intercept /api requests.
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
