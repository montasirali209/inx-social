const { getSocialAnalytics } = require('../services/socialAnalyticsService');
const { getLicenseStatus } = require('../services/licenseService');

async function requireAnalyticsAccess(userId) {
  const license = await getLicenseStatus(userId);
  if (!license.allowed) {
    throw Object.assign(new Error('Analytics is not available on the current subscription.'), { status: 403 });
  }
  return license;
}

async function socialAnalytics(req, res, next) {
  try {
    await requireAnalyticsAccess(req.user.id);
    const platform = String(req.query.platform || '').trim().toLowerCase();
    const profileId = String(req.query.profileId || '').trim();
    const days = Number(req.query.days || 30);
    if (!profileId) return res.status(400).json({ error: 'Choose a connected account.' });
    if (!['instagram', 'youtube', 'linkedin'].includes(platform)) {
      return res.status(400).json({ error: 'This analytics source is not supported.' });
    }
    const analytics = await getSocialAnalytics(req.user.id, platform, profileId, days);
    return res.json({ analytics });
  } catch (error) {
    return next(error);
  }
}

module.exports = { socialAnalytics };
