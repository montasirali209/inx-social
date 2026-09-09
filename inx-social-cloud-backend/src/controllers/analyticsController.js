const { getSocialAnalytics } = require('../services/socialAnalyticsService');
const { getLicenseStatus } = require('../services/licenseService');
const { ensureFreshYouTubeToken, forceRefreshYouTubeToken } = require('../services/youtubeTokenService');

async function requireAnalyticsAccess(userId) {
  const license = await getLicenseStatus(userId);
  if (!license.allowed) {
    throw Object.assign(new Error('Analytics is not available on the current subscription.'), { status: 403 });
  }
  return license;
}

function youtubeAuthenticationFailed(analytics) {
  const capability = analytics?.capabilities?.pageInsights;
  if (capability?.available) return false;
  return /invalid authentication credentials|invalid credentials|invalid token|access token|oauth 2/i.test(String(capability?.reason || ''));
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

    if (platform === 'youtube') await ensureFreshYouTubeToken(req.user.id, profileId);
    let analytics = await getSocialAnalytics(req.user.id, platform, profileId, days);

    // Google can invalidate an access token before its recorded expiry. Recover
    // once with the encrypted refresh token instead of exposing the provider's
    // raw OAuth error in the Analytics UI.
    if (platform === 'youtube' && youtubeAuthenticationFailed(analytics)) {
      await forceRefreshYouTubeToken(req.user.id, profileId);
      analytics = await getSocialAnalytics(req.user.id, platform, profileId, days);
    }

    return res.json({ analytics });
  } catch (error) {
    return next(error);
  }
}

module.exports = { socialAnalytics };
