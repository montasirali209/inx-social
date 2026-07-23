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
const packageInfo = require('../package.json');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 240 }));

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
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));
app.use('/portal', express.static(path.join(__dirname, '..', 'portal')));
app.use('/studio', express.static(path.join(__dirname, '..', 'studio')));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'INX Social Cloud Backend',
    version: packageInfo.version,
    adminPanel: '/admin',
    customerPortal: '/portal/',
    cloudStudio: '/studio/'
  });
});

app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/studio', (req, res) => res.redirect(308, '/studio/'));

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

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
