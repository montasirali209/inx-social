const adapters = require('./ugcProviderAdapters');
const creators = require('./ugcCreatorEngine');

const ROUTER_VERSION = 'ugc-router-v1';

const ROUTE_KEYS = Object.freeze({
  STANDARD: 'H3_MAX_STANDARD_V1',
  LEGACY_PREMIUM: 'KLING_PREMIUM_V1',
  PROFESSIONAL_CREATOR: 'OMNIHUMAN_CREATOR_V1',
  PREMIUM_DYNAMIC: 'SEEDANCE_DYNAMIC_V1',
  DYNAMIC_FALLBACK: 'KLING_OMNI_DYNAMIC_V1'
});

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function routerMode() {
  // New generation always uses the capability router. Legacy provider adapters
  // remain available only to finish or inspect already-persisted historical jobs.
  return 'adaptive';
}

function isCreatorLike(kind) {
  return adapters.isCreatorLike(kind);
}

function supportsDuration(cap, duration) {
  const value = Number(duration || 0);
  if (cap.adapterKey === adapters.ADAPTER_KEYS.OMNIHUMAN_15) return true;
  if (!Number.isFinite(value) || value <= 0) return false;
  if (Array.isArray(cap.supportedDurations) && !cap.supportedDurations.map(Number).includes(value)) return false;
  if (typeof cap.supportedDurations === 'string' && cap.supportedDurations.startsWith('INTEGER_') && !Number.isInteger(value)) return false;
  if (typeof cap.minDuration === 'number' && value < cap.minDuration) return false;
  if (typeof cap.maxDuration === 'number' && value > cap.maxDuration) return false;
  return true;
}

function routeForScene({
  quality,
  kind,
  providerDuration,
  playbackDuration,
  hasActor,
  hasProductReference,
  hasNarration = true,
  allowedRoutes = null,
  mode = routerMode()
}) {
  const normalizedQuality = clean(quality || 'STANDARD', 30).toUpperCase();
  const normalizedKind = clean(kind || 'CREATOR', 40).toUpperCase();
  let routeKey;
  let reason;
  let fallbacks = [];

  if (normalizedQuality !== 'PREMIUM') {
    routeKey = ROUTE_KEYS.STANDARD;
    reason = 'STANDARD_COST_EFFICIENT_ROUTE';
  } else if (isCreatorLike(normalizedKind)) {
    if (hasActor && hasNarration) {
      routeKey = ROUTE_KEYS.PROFESSIONAL_CREATOR;
      reason = 'PREMIUM_AUDIO_DRIVEN_CREATOR';
      fallbacks = [ROUTE_KEYS.STANDARD];
    } else {
      routeKey = ROUTE_KEYS.STANDARD;
      reason = 'CREATOR_INPUT_FALLBACK';
      fallbacks = [];
    }
  } else if (['PRODUCT','LIFESTYLE'].includes(normalizedKind) && hasProductReference) {
    routeKey = ROUTE_KEYS.PREMIUM_DYNAMIC;
    reason = 'PREMIUM_REFERENCE_GUIDED_PRODUCT';
    fallbacks = [ROUTE_KEYS.STANDARD];
  } else {
    routeKey = ROUTE_KEYS.STANDARD;
    reason = 'GENERAL_PREMIUM_STANDARD_FALLBACK';
    fallbacks = [];
  }

  const allowed = Array.isArray(allowedRoutes) && allowedRoutes.length ? new Set(allowedRoutes) : null;
  const duration = Number(providerDuration || 0);
  if (allowed && !allowed.has(routeKey)) {
    const compatible = [routeKey, ...fallbacks].find(candidate => {
      if (!allowed.has(candidate)) return false;
      try { return supportsDuration(adapters.getAdapter(candidate), duration); } catch (_) { return false; }
    });
    if (!compatible) {
      const error = new Error('No compatible UGC creator route is available for this scene.');
      error.code = 'UGC_ROUTER_CREATOR_INCOMPATIBLE';
      throw error;
    }
    routeKey = compatible;
    reason += '_CREATOR_COMPATIBILITY_FALLBACK';
  }

  const adapter = adapters.getAdapter(routeKey);
  if (!supportsDuration(adapter, duration)) {
    const fallback = fallbacks.find(candidate => {
      if (allowed && !allowed.has(candidate)) return false;
      try {
        return supportsDuration(adapters.getAdapter(candidate), duration);
      } catch (_) {
        return false;
      }
    });
    if (!fallback) {
      const error = new Error('No UGC provider route supports this scene duration.');
      error.code = 'UGC_ROUTER_NO_DURATION_ROUTE';
      throw error;
    }
    routeKey = fallback;
    reason += '_DURATION_FALLBACK';
  }

  const selected = adapters.getAdapter(routeKey);
  const referenceRole = isCreatorLike(normalizedKind) ? 'ACTOR' : 'PRODUCT';
  const audioStrategy = selected.adapterKey === adapters.ADAPTER_KEYS.H3_MAX
    ? 'NATIVE_SYNC_AUDIO'
    : selected.adapterKey === adapters.ADAPTER_KEYS.OMNIHUMAN_15
      ? 'AUDIO_DRIVEN_NATIVE'
      : isCreatorLike(normalizedKind) ? 'TTS_THEN_LIP_SYNC' : 'TTS_THEN_LOCAL_MUX';

  return {
    routerVersion: ROUTER_VERSION,
    mode: 'adaptive',
    routeKey,
    adapterKey: selected.adapterKey,
    provider: selected.provider,
    model: selected.model,
    kind: normalizedKind,
    quality: normalizedQuality,
    reason,
    referenceRole,
    audioStrategy,
    nativeLipSync: Boolean(selected.nativeLipSync),
    providerDuration: duration,
    playbackDuration: Number(playbackDuration || duration),
    resolution: selected.resolution,
    aspectRatio: selected.aspectRatio,
    fallbacks,
    capability: {
      modes: [...selected.modes],
      minDuration: selected.minDuration,
      maxDuration: selected.maxDuration,
      supportedDurations: Array.isArray(selected.supportedDurations) ? [...selected.supportedDurations] : selected.supportedDurations,
      maxReferenceImages: selected.maxReferenceImages,
      referenceMode: selected.referenceMode
    }
  };
}

function routePlan({
  input,
  plan,
  hasProductReference,
  availableAvatars = [],
  mode = routerMode()
}) {
  const routedAds = (plan.ads || []).map((ad, adIndex) => {
    const avatar = availableAvatars[Number(ad.avatarIndex || adIndex) % Math.max(1, availableAvatars.length)] || availableAvatars[0] || null;
    return {
      ...ad,
      scenes: (ad.scenes || []).map(scene => ({
        ...scene,
        routeDecision: routeForScene({
          quality: input.quality,
          kind: scene.kind,
          providerDuration: scene.duration,
          playbackDuration: scene.playbackDuration || scene.duration,
          hasActor: Boolean(avatar),
          hasProductReference,
          hasNarration: clean(scene.script, 5000).length >= 2,
          allowedRoutes: avatar && isCreatorLike(scene.kind) ? creators.profileFromRow(avatar).routeCompatibility : null,
          mode: routerMode()
        })
      }))
    };
  });

  return {
    ...plan,
    routerVersion: ROUTER_VERSION,
    routerMode: routerMode(),
    routingSummary: summarizeRoutes(routedAds),
    ads: routedAds
  };
}

function summarizeRoutes(ads) {
  const counts = {};
  for (const ad of ads || []) {
    for (const scene of ad.scenes || []) {
      const key = scene.routeDecision?.routeKey || 'UNROUTED';
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

function routerSnapshot() {
  return {
    version: ROUTER_VERSION,
    mode: routerMode(),
    policy: {
      standard: ROUTE_KEYS.STANDARD,
      premiumCreator: ROUTE_KEYS.PROFESSIONAL_CREATOR,
      premiumProduct: ROUTE_KEYS.PREMIUM_DYNAMIC,
      dynamicFallback: ROUTE_KEYS.DYNAMIC_FALLBACK,
      compatibilityPremium: ROUTE_KEYS.LEGACY_PREMIUM
    },
    adapters: adapters.adapterSnapshot()
  };
}

module.exports = {
  ROUTER_VERSION,
  ROUTE_KEYS,
  routerMode,
  supportsDuration,
  routeForScene,
  routePlan,
  summarizeRoutes,
  routerSnapshot
};
