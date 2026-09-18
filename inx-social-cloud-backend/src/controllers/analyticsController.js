const { getPostForMeAnalytics } = require('../services/postForMeAnalyticsService');
const { getLicenseStatus } = require('../services/licenseService');
const postForMe = require('../services/postForMeService');

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
    const platform = postForMe.publicPlatform(String(req.query.platform || '').trim().toLowerCase());
    const profileId = String(req.query.profileId || '').trim();
    const days = Number(req.query.days || 30);
    if (!profileId) return res.status(400).json({ error: 'Choose a connected account.' });
    if (!postForMe.SUPPORTED_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: 'This analytics source is not supported.' });
    }

    const summaryMode = ['1', 'true', 'summary'].includes(String(req.query.summary || req.query.mode || '').toLowerCase());
    const analytics = await getPostForMeAnalytics(
      req.user.id,
      platform,
      profileId,
      days,
      summaryMode
        ? { feedMaxPages: 1, feedMaxPosts: 100, cacheVariant: 'summary' }
        : { cacheVariant: 'full' }
    );
    return res.json({ analytics });
  } catch (error) {
    return next(error);
  }
}

module.exports = { socialAnalytics };
