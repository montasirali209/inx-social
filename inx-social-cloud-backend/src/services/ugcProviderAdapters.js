const crypto = require('node:crypto');
const env = require('../config/env');
const runware = require('./runwareService');

const ADAPTERS_VERSION = 'ugc-adapters-v1';

const ADAPTER_KEYS = Object.freeze({
  H3_MAX: 'H3_MAX',
  HAILUO_23: 'HAILUO_23',
  KLING_LEGACY: 'KLING_LEGACY',
  OMNIHUMAN_15: 'OMNIHUMAN_15',
  SEEDANCE_25: 'SEEDANCE_25',
  KLING_OMNI_30: 'KLING_OMNI_30'
});

const ROUTE_ALIASES = new Map([
  ['H3_MAX', ADAPTER_KEYS.H3_MAX],
  ['H3_MAX_STANDARD_V1', ADAPTER_KEYS.H3_MAX],
  ['HAILUO', ADAPTER_KEYS.HAILUO_23],
  ['HAILUO_STANDARD_V1', ADAPTER_KEYS.HAILUO_23],
  ['KLING', ADAPTER_KEYS.KLING_LEGACY],
  ['KLING_PREMIUM_V1', ADAPTER_KEYS.KLING_LEGACY],
  ['OMNIHUMAN_CREATOR_V1', ADAPTER_KEYS.OMNIHUMAN_15],
  ['SEEDANCE_DYNAMIC_V1', ADAPTER_KEYS.SEEDANCE_25],
  ['KLING_OMNI_DYNAMIC_V1', ADAPTER_KEYS.KLING_OMNI_30]
]);

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function adapterError(message, code = 'UGC_ADAPTER_ERROR', status = 422) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.publicMessage = message;
  return error;
}

function modelIds() {
  return {
    h3Max: env.runware.ugcStandardModel || 'minimax:h3@max',
    hailuo23: 'minimax:4@1',
    klingLegacy: env.runware.ugcPremiumModel || 'klingai:kling-video@3-standard',
    omniHuman15: env.runware.ugcOmniHumanModel || 'bytedance:5@2',
    seedance25: env.runware.ugcSeedanceModel || 'bytedance:seedance@2.5',
    klingOmni30: env.runware.ugcKlingOmniModel || 'klingai:kling-video@o3-standard',
    lipSync: env.runware.ugcLipSyncModel || 'klingai:7@1',
    tts: env.runware.ugcTtsModel || 'inworld:tts@2'
  };
}

function capabilities() {
  const ids = modelIds();
  return {
    [ADAPTER_KEYS.H3_MAX]: {
      adapterKey: ADAPTER_KEYS.H3_MAX,
      provider: 'runware',
      model: ids.h3Max,
      modes: ['TEXT_TO_VIDEO','REFERENCE_TO_VIDEO'],
      sceneKinds: ['CREATOR','PRODUCT','LIFESTYLE','CTA'],
      minDuration: 5,
      maxDuration: 15,
      supportedDurations: 'INTEGER_5_15',
      maxReferenceImages: 9,
      referenceMode: 'REFERENCE_IMAGES',
      audioMode: 'NATIVE_SYNC_AUDIO',
      nativeLipSync: true,
      resolution: '768p',
      aspectRatio: '9:16'
    },
    [ADAPTER_KEYS.HAILUO_23]: {
      adapterKey: ADAPTER_KEYS.HAILUO_23,
      provider: 'runware',
      model: ids.hailuo23,
      modes: ['IMAGE_TO_VIDEO'],
      sceneKinds: ['CREATOR','PRODUCT','LIFESTYLE','CTA'],
      minDuration: 6,
      maxDuration: 10,
      supportedDurations: [6,10],
      maxReferenceImages: 1,
      referenceMode: 'FIRST_FRAME',
      audioMode: 'EXTERNAL_TTS_POST_PROCESS',
      nativeLipSync: false,
      resolution: '720p',
      aspectRatio: '9:16'
    },
    [ADAPTER_KEYS.KLING_LEGACY]: {
      adapterKey: ADAPTER_KEYS.KLING_LEGACY,
      provider: 'runware',
      model: ids.klingLegacy,
      modes: ['IMAGE_TO_VIDEO'],
      sceneKinds: ['CREATOR','PRODUCT','LIFESTYLE','CTA'],
      minDuration: 5,
      maxDuration: 15,
      supportedDurations: 'MODEL_DEFINED',
      maxReferenceImages: 1,
      referenceMode: 'FIRST_FRAME',
      audioMode: 'EXTERNAL_TTS_POST_PROCESS',
      nativeLipSync: false,
      resolution: '720p',
      aspectRatio: '9:16'
    },
    [ADAPTER_KEYS.OMNIHUMAN_15]: {
      adapterKey: ADAPTER_KEYS.OMNIHUMAN_15,
      provider: 'runware',
      model: ids.omniHuman15,
      modes: ['IMAGE_AUDIO_TO_VIDEO'],
      sceneKinds: ['CREATOR','CTA'],
      minDuration: 1,
      maxDuration: 60,
      supportedDurations: 'AUDIO_DRIVEN',
      maxReferenceImages: 1,
      referenceMode: 'PORTRAIT',
      audioMode: 'AUDIO_DRIVEN_NATIVE',
      nativeLipSync: true,
      resolution: 'SOURCE_DRIVEN',
      aspectRatio: 'SOURCE_DRIVEN'
    },
    [ADAPTER_KEYS.SEEDANCE_25]: {
      adapterKey: ADAPTER_KEYS.SEEDANCE_25,
      provider: 'runware',
      model: ids.seedance25,
      modes: ['TEXT_TO_VIDEO','IMAGE_TO_VIDEO','REFERENCE_TO_VIDEO'],
      sceneKinds: ['PRODUCT','LIFESTYLE'],
      minDuration: 4,
      maxDuration: 30,
      supportedDurations: 'INTEGER_4_30',
      maxReferenceImages: 30,
      referenceMode: 'REFERENCE_IMAGES',
      audioMode: 'EXTERNAL_TTS_LOCAL_MUX',
      nativeLipSync: false,
      resolution: '720p',
      aspectRatio: '9:16'
    },
    [ADAPTER_KEYS.KLING_OMNI_30]: {
      adapterKey: ADAPTER_KEYS.KLING_OMNI_30,
      provider: 'runware',
      model: ids.klingOmni30,
      modes: ['TEXT_TO_VIDEO','IMAGE_TO_VIDEO','REFERENCE_TO_VIDEO'],
      sceneKinds: ['CREATOR','PRODUCT','LIFESTYLE','CTA'],
      minDuration: 3,
      maxDuration: 15,
      supportedDurations: 'INTEGER_3_15',
      maxReferenceImages: 7,
      referenceMode: 'FIRST_FRAME_OR_REFERENCES',
      audioMode: 'EXTERNAL_TTS_POST_PROCESS',
      nativeLipSync: false,
      resolution: '720p',
      aspectRatio: '9:16'
    }
  };
}

function normalizeRouteKey(routeKey) {
  const raw = clean(routeKey, 120).toUpperCase();
  return ROUTE_ALIASES.get(raw) || raw;
}

function getAdapter(routeKey) {
  const key = normalizeRouteKey(routeKey);
  const cap = capabilities()[key];
  if (!cap) throw adapterError('This UGC render route is not supported.', 'UGC_ROUTE_UNSUPPORTED', 422);
  return cap;
}

function isCreatorLike(kind) {
  return ['CREATOR','CTA'].includes(String(kind || '').toUpperCase());
}

function validateContext(cap, context) {
  const kind = String(context.kind || 'CREATOR').toUpperCase();
  const duration = Number(context.providerDuration || 0);
  if (!cap.sceneKinds.includes(kind)) throw adapterError('The selected UGC route does not support this scene type.', 'UGC_ROUTE_SCENE_UNSUPPORTED', 422);
  if (cap.adapterKey === ADAPTER_KEYS.HAILUO_23 && !cap.supportedDurations.includes(duration)) {
    throw adapterError('The Standard UGC scene duration is not supported by the configured video model.', 'UGC_ROUTE_DURATION_UNSUPPORTED', 422);
  }
  if (typeof cap.minDuration === 'number' && duration && duration < cap.minDuration && cap.adapterKey !== ADAPTER_KEYS.OMNIHUMAN_15) {
    throw adapterError('The selected UGC route cannot render a scene this short.', 'UGC_ROUTE_DURATION_UNSUPPORTED', 422);
  }
  if (typeof cap.maxDuration === 'number' && duration > cap.maxDuration && cap.adapterKey !== ADAPTER_KEYS.OMNIHUMAN_15) {
    throw adapterError('The selected UGC route cannot render a scene this long.', 'UGC_ROUTE_DURATION_UNSUPPORTED', 422);
  }
  const references = Array.isArray(context.references) ? context.references.filter(Boolean) : (context.reference ? [context.reference] : []);
  if (!references.length) throw adapterError('This UGC route requires a visual reference.', 'UGC_REFERENCE_REQUIRED', 422);
  if (cap.adapterKey === ADAPTER_KEYS.OMNIHUMAN_15 && !context.narration?.audioURL) {
    throw adapterError('Professional creator rendering requires narrator audio.', 'UGC_NARRATION_REQUIRED', 422);
  }
}

function providerPrompt(prompt, max = 2000) {
  const value = clean(prompt, Math.max(2, Number(max || 2000)));
  return value.length >= 2 ? value : 'Natural creator-led UGC scene.';
}

function commonTask(model, prompt, maxPrompt = 2000) {
  return {
    taskType: 'videoInference',
    taskUUID: crypto.randomUUID(),
    deliveryMethod: 'async',
    includeCost: true,
    outputType: 'URL',
    outputFormat: 'MP4',
    model,
    positivePrompt: providerPrompt(prompt, maxPrompt)
  };
}

function buildTask(cap, context) {
  const task = commonTask(cap.model, context.prompt, cap.adapterKey === ADAPTER_KEYS.H3_MAX ? 7000 : 2000);
  const duration = Number(context.providerDuration);
  if (cap.adapterKey === ADAPTER_KEYS.H3_MAX) {
    const references = (Array.isArray(context.references) ? context.references : [context.reference]).filter(Boolean).slice(0, 9);
    task.duration = duration;
    task.width = 768;
    task.height = 1344;
    task.inputs = { referenceImages: references };
    task.settings = { promptExpansion: 'quality' };
    return task;
  }
  if (cap.adapterKey === ADAPTER_KEYS.HAILUO_23) {
    task.duration = duration;
    task.fps = 25;
    task.inputs = { frameImages: [{ image: context.reference, frame: 'first' }] };
    task.providerSettings = { minimax: { promptOptimizer: true } };
    return task;
  }
  if (cap.adapterKey === ADAPTER_KEYS.KLING_LEGACY) {
    task.duration = duration;
    task.inputs = { frameImages: [{ image: context.reference, frame: 'first' }] };
    task.providerSettings = { klingai: { sound: false } };
    return task;
  }
  if (cap.adapterKey === ADAPTER_KEYS.OMNIHUMAN_15) {
    task.inputs = { image: context.reference, audio: context.narration.audioURL };
    return task;
  }
  if (cap.adapterKey === ADAPTER_KEYS.SEEDANCE_25) {
    task.duration = duration;
    task.width = 720;
    task.height = 1280;
    task.inputs = { referenceImages: (Array.isArray(context.references) ? context.references : [context.reference]).filter(Boolean).slice(0, cap.maxReferenceImages) };
    task.settings = { audio: false };
    return task;
  }
  if (cap.adapterKey === ADAPTER_KEYS.KLING_OMNI_30) {
    task.duration = duration;
    task.inputs = { frameImages: [{ image: context.reference, frame: 'first' }] };
    task.providerSettings = { klingai: { sound: false } };
    return task;
  }
  throw adapterError('This UGC route has no provider adapter.', 'UGC_ADAPTER_MISSING', 500);
}

async function pollTask(taskUUID, onProgress = () => {}) {
  const started = Date.now();
  const timeout = Math.max(180000, Number(env.runware.videoTimeoutMs || 900000));
  while (Date.now() - started < timeout) {
    await new Promise(resolve => setTimeout(resolve, Math.max(2000, Number(env.runware.pollIntervalMs || 3000))));
    const results = await runware.request([{ taskType: 'getResponse', taskUUID }], Math.min(60000, timeout));
    const item = results.find(entry => entry.taskUUID === taskUUID) || results[0];
    if (!item) continue;
    if (item.status === 'processing') {
      onProgress(Math.max(5, Math.min(95, Number(item.progress || 35))));
      continue;
    }
    if (item.status === 'error') {
      throw adapterError('A UGC video scene could not be rendered.', 'UGC_PROVIDER_FAILED', 502);
    }
    if (item.videoURL || item.status === 'success') {
      if (!item.videoURL) throw adapterError('UGC generation completed without a usable video.', 'UGC_PROVIDER_EMPTY', 502);
      return item;
    }
  }
  throw adapterError('UGC rendering timed out. Reserved credits will be returned for the failed render.', 'UGC_PROVIDER_TIMEOUT', 504);
}

function postProcessFor(cap, context) {
  if ([ADAPTER_KEYS.H3_MAX, ADAPTER_KEYS.OMNIHUMAN_15].includes(cap.adapterKey)) return 'NONE';
  if (!context.narration?.audioURL) return 'NONE';
  return isCreatorLike(context.kind) ? 'LIP_SYNC' : 'LOCAL_MUX';
}

async function renderScene(routeKey, context, onProgress = () => {}) {
  const cap = getAdapter(routeKey);
  validateContext(cap, context);
  const task = buildTask(cap, context);
  onProgress(5);
  const initial = await runware.request([task], 60000);
  const first = initial.find(entry => entry.taskUUID === task.taskUUID) || initial[0];
  const item = first?.videoURL ? first : await pollTask(task.taskUUID, onProgress);
  onProgress(100);
  return {
    item,
    taskUUID: task.taskUUID,
    model: cap.model,
    adapterKey: cap.adapterKey,
    routeKey: clean(routeKey, 120),
    postProcess: postProcessFor(cap, context),
    capability: cap
  };
}

function adapterSnapshot() {
  return {
    version: ADAPTERS_VERSION,
    routes: capabilities()
  };
}

module.exports = {
  ADAPTERS_VERSION,
  ADAPTER_KEYS,
  ROUTE_ALIASES,
  modelIds,
  capabilities,
  normalizeRouteKey,
  getAdapter,
  isCreatorLike,
  validateContext,
  providerPrompt,
  buildTask,
  postProcessFor,
  renderScene,
  adapterSnapshot
};
