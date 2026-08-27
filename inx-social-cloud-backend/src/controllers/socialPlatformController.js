const registry = require('../services/socialPlatformRegistry');

function list(req, res) {
  const platforms = registry.listPlatforms();
  res.json({
    phase: '12.0',
    live: platforms.filter(platform => platform.availability === 'LIVE').map(platform => platform.code),
    platforms
  });
}

module.exports = { list };
