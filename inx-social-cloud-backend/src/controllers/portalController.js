const prisma = require('../db/prisma');
const env = require('../config/env');
const { getLicenseStatus } = require('../services/licenseService');
const stripeService = require('../services/stripeService');

async function dashboard(req, res, next) {
  try {
    const [license, devices, pages, downloads, subscription] = await Promise.all([
      getLicenseStatus(req.user.id),
      prisma.device.findMany({ where: { userId: req.user.id }, orderBy: { lastSeenAt: 'desc' } }),
      prisma.connectedPage.findMany({ where: { userId: req.user.id }, select: { id: true, facebookPageId: true, facebookPageName: true, status: true, connectedAt: true } }),
      prisma.downloadHistory.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.subscription.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } })
    ]);

    res.json({
      user: req.user,
      license,
      devices,
      pages,
      downloads,
      billing: {
        configured: stripeService.isConfigured(),
        webhookConfigured: stripeService.isWebhookConfigured(),
        provider: subscription?.provider || null,
        canManage: Boolean(subscription?.providerCustomerId),
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
        currentPeriodStart: subscription?.currentPeriodStart || null,
        currentPeriodEnd: subscription?.currentPeriodEnd || null,
        providerSubId: subscription?.providerSubId || null
      },
      release: { version: env.latestVersion, installerAvailable: Boolean(env.installerUrl) }
    });
  } catch (error) { next(error); }
}

async function plans(req, res) {
  res.json({
    checkoutEnabled: stripeService.isConfigured(),
    webhookEnabled: stripeService.isWebhookConfigured(),
    plans: [
      {
        id: 'STARTER', name: 'Starter', price: 9.99, currency: 'GBP', interval: 'month',
        limits: { batchPosts: 100, pages: 10, devices: 1 },
        features: ['Up to 100 posts or videos per batch', 'Manage up to 10 Facebook Pages', '1 authorised device', 'Smart scheduling and duplicate protection']
      },
      {
        id: 'PRO', name: 'Pro', price: 15.99, currency: 'GBP', interval: 'month',
        limits: { batchPosts: null, pages: 50, devices: 3 },
        features: ['Unlimited posts and videos per batch', 'Manage up to 50 Facebook Pages', 'Up to 3 authorised devices', 'Priority publishing tools and higher limits']
      }
    ]
  });
}

async function download(req, res, next) {
  try {
    const license = await getLicenseStatus(req.user.id);
    if (!license.allowed) return res.status(403).json({ error: 'An active trial or subscription is required to download INX Social.' });
    if (!env.installerUrl) return res.status(404).json({ error: 'The Windows installer has not been published yet.' });
    await prisma.downloadHistory.create({ data: { userId: req.user.id, version: env.latestVersion, ip: req.ip, userAgent: req.get('user-agent') } });
    res.json({ version: env.latestVersion, url: env.installerUrl });
  } catch (error) { next(error); }
}

async function preferences(req, res, next) {
  try {
    const marketingOptIn = Boolean(req.body.marketingOptIn);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { marketingOptIn, marketingOptInAt: marketingOptIn ? new Date() : null }
    });
    res.json({ marketingOptIn: user.marketingOptIn });
  } catch (error) { next(error); }
}

module.exports = { dashboard, plans, download, preferences };
