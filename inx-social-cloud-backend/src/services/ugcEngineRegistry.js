const env = require('../config/env');
const adapters = require('./ugcProviderAdapters');

const ENGINE_VERSION = 'ugc-engine-v1';
const CONTRACT_VERSION = '1.1';

const ROUTE_KEYS = Object.freeze({
  STANDARD: 'HAILUO_STANDARD_V1',
  PREMIUM: 'KLING_PREMIUM_V1',
  PROFESSIONAL_CREATOR: 'OMNIHUMAN_CREATOR_V1',
  PREMIUM_DYNAMIC: 'SEEDANCE_DYNAMIC_V1',
  DYNAMIC_FALLBACK: 'KLING_OMNI_DYNAMIC_V1'
});

function modelIds() {
  return {
    standardVideo: env.runware.ugcStandardModel || 'minimax:4@1',
    premiumVideo: env.runware.ugcPremiumModel || 'klingai:kling-video@3-standard',
    omniHumanVideo: env.runware.ugcOmniHumanModel || 'bytedance:5@2',
    seedanceVideo: env.runware.ugcSeedanceModel || 'bytedance:seedance@2.5',
    klingOmniVideo: env.runware.ugcKlingOmniModel || 'klingai:kling-video@o3-standard',
    lipSync: env.runware.ugcLipSyncModel || 'klingai:7@1',
    tts: env.runware.ugcTtsModel || 'inworld:tts@2'
  };
}

function routeKeyForQuality(quality) {
  return String(quality || 'STANDARD').toUpperCase() === 'PREMIUM' ? ROUTE_KEYS.PREMIUM : ROUTE_KEYS.STANDARD;
}

function legacyDbRoute(quality) {
  return routeKeyForQuality(quality) === ROUTE_KEYS.PREMIUM ? 'KLING' : 'HAILUO';
}

function describeSceneRoute({ quality, kind, providerDuration, playbackDuration }) {
  const ids = modelIds();
  const routeKey = routeKeyForQuality(quality);
  const normalizedKind = String(kind || 'CREATOR').toUpperCase();
  const creator = normalizedKind === 'CREATOR';

  return {
    routeKey,
    legacyDbRoute: legacyDbRoute(quality),
    provider: 'runware',
    videoModel: routeKey === ROUTE_KEYS.PREMIUM ? ids.premiumVideo : ids.standardVideo,
    narrator: {
      provider: 'runware',
      model: ids.tts,
      strategy: 'EXTERNAL_TTS'
    },
    lipSync: creator ? {
      provider: 'runware',
      model: ids.lipSync,
      strategy: 'POST_VIDEO_LIP_SYNC'
    } : null,
    audioStrategy: creator ? 'TTS_THEN_LIP_SYNC' : 'TTS_THEN_LOCAL_MUX',
    resolution: '720p',
    aspectRatio: '9:16',
    providerDuration: Number(providerDuration || 0),
    playbackDuration: Number(playbackDuration || providerDuration || 0)
  };
}

function registrySnapshot() {
  const ids = modelIds();
  return {
    engineVersion: ENGINE_VERSION,
    contractVersion: CONTRACT_VERSION,
    routes: {
      [ROUTE_KEYS.STANDARD]: {
        userTier: 'STANDARD',
        legacyDbRoute: 'HAILUO',
        provider: 'runware',
        videoModel: ids.standardVideo,
        narratorModel: ids.tts,
        lipSyncModel: ids.lipSync,
        resolution: '720p',
        aspectRatio: '9:16',
        status: 'ACTIVE'
      },
      [ROUTE_KEYS.PREMIUM]: {
        userTier: 'PREMIUM',
        legacyDbRoute: 'KLING',
        provider: 'runware',
        videoModel: ids.premiumVideo,
        narratorModel: ids.tts,
        lipSyncModel: ids.lipSync,
        resolution: '720p',
        aspectRatio: '9:16',
        status: 'COMPATIBILITY'
      },
      [ROUTE_KEYS.PROFESSIONAL_CREATOR]: {
        userTier: 'PREMIUM',
        provider: 'runware',
        videoModel: ids.omniHumanVideo,
        narratorModel: ids.tts,
        lipSyncModel: null,
        resolution: 'source-driven',
        aspectRatio: 'source-driven',
        status: 'ACTIVE'
      },
      [ROUTE_KEYS.PREMIUM_DYNAMIC]: {
        userTier: 'PREMIUM',
        provider: 'runware',
        videoModel: ids.seedanceVideo,
        narratorModel: ids.tts,
        lipSyncModel: null,
        resolution: '720p',
        aspectRatio: '9:16',
        status: 'ACTIVE'
      },
      [ROUTE_KEYS.DYNAMIC_FALLBACK]: {
        userTier: 'PREMIUM',
        provider: 'runware',
        videoModel: ids.klingOmniVideo,
        narratorModel: ids.tts,
        lipSyncModel: ids.lipSync,
        resolution: '720p',
        aspectRatio: '9:16',
        status: 'FALLBACK'
      }
    },
    adapters: adapters.adapterSnapshot()
  };
}

module.exports = {
  ENGINE_VERSION,
  CONTRACT_VERSION,
  ROUTE_KEYS,
  modelIds,
  routeKeyForQuality,
  legacyDbRoute,
  describeSceneRoute,
  registrySnapshot
};
