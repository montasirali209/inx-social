const PLATFORM_DEFINITIONS = Object.freeze([
  {
    code: 'facebook', label: 'Facebook', provider: 'meta', availability: 'LIVE',
    profileTypes: ['PAGE'],
    capabilities: { publishText: true, publishImage: true, publishVideo: true, publishShortVideo: true, carousel: true, scheduling: true, analytics: true }
  },
  {
    code: 'instagram', label: 'Instagram', provider: 'meta', availability: 'PLANNED',
    profileTypes: ['BUSINESS', 'CREATOR'],
    capabilities: { publishText: false, publishImage: true, publishVideo: true, publishShortVideo: true, carousel: true, scheduling: true, analytics: true }
  },
  {
    code: 'threads', label: 'Threads', provider: 'meta', availability: 'PLANNED',
    profileTypes: ['PROFILE'],
    capabilities: { publishText: true, publishImage: true, publishVideo: true, publishShortVideo: false, carousel: true, scheduling: true, analytics: true }
  },
  {
    code: 'linkedin', label: 'LinkedIn', provider: 'linkedin', availability: 'PLANNED',
    profileTypes: ['MEMBER', 'ORGANIZATION'],
    capabilities: { publishText: true, publishImage: true, publishVideo: true, publishShortVideo: false, carousel: false, scheduling: true, analytics: true }
  },
  {
    code: 'tiktok', label: 'TikTok', provider: 'tiktok', availability: 'PLANNED',
    profileTypes: ['CREATOR', 'BUSINESS'],
    capabilities: { publishText: false, publishImage: true, publishVideo: true, publishShortVideo: true, carousel: true, scheduling: true, analytics: true }
  },
  {
    code: 'youtube', label: 'YouTube', provider: 'google', availability: 'PLANNED',
    profileTypes: ['CHANNEL'],
    capabilities: { publishText: false, publishImage: false, publishVideo: true, publishShortVideo: true, carousel: false, scheduling: true, analytics: true }
  },
  {
    code: 'pinterest', label: 'Pinterest', provider: 'pinterest', availability: 'PLANNED',
    profileTypes: ['BUSINESS'],
    capabilities: { publishText: false, publishImage: true, publishVideo: true, publishShortVideo: false, carousel: true, scheduling: true, analytics: true }
  },
  {
    code: 'x', label: 'X', provider: 'x', availability: 'PLANNED',
    profileTypes: ['PROFILE'],
    capabilities: { publishText: true, publishImage: true, publishVideo: true, publishShortVideo: false, carousel: false, scheduling: true, analytics: false }
  }
]);

function listPlatforms() {
  return PLATFORM_DEFINITIONS.map(platform => ({
    ...platform,
    profileTypes: [...platform.profileTypes],
    capabilities: { ...platform.capabilities }
  }));
}

function getPlatform(code) {
  const normalized = String(code || '').trim().toLowerCase();
  const platform = PLATFORM_DEFINITIONS.find(item => item.code === normalized);
  return platform ? { ...platform, profileTypes: [...platform.profileTypes], capabilities: { ...platform.capabilities } } : null;
}

module.exports = { listPlatforms, getPlatform };
