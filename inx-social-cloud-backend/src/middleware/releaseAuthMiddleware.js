const crypto = require('crypto');

function safeEqual(valueA, valueB) {
  const a = Buffer.from(String(valueA || ''), 'utf8');
  const b = Buffer.from(String(valueB || ''), 'utf8');

  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

function requireReleaseApiKey(req, res, next) {
  const configuredKey = process.env.RELEASE_API_KEY;

  if (!configuredKey) {
    console.error('[RELEASE AUTH] RELEASE_API_KEY is not configured');
    return res.status(503).json({
      error: 'Release publishing is not configured'
    });
  }

  const suppliedKey =
    req.headers['x-release-api-key'] ||
    req.headers['x-api-key'];

  if (!suppliedKey || !safeEqual(suppliedKey, configuredKey)) {
    return res.status(401).json({
      error: 'Invalid release API key'
    });
  }

  next();
}

module.exports = {
  requireReleaseApiKey
};