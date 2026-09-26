const crypto = require('node:crypto');

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function adapterError(message, code = 'AI_VIDEO_SELECTION_UNSUPPORTED', status = 422) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.publicMessage = message;
  return error;
}

function defaultDimensions(resolution = '720p', aspect = '9:16', profileId = '') {
  if (profileId === 'pvideo') {
    const pVideo2 = {
      '720p': { '16:9': [1280, 704], '9:16': [704, 1280], '1:1': [960, 960], '4:5': [864, 1088] },
      '1080p': { '16:9': [1920, 1088], '9:16': [1088, 1920], '1:1': [1440, 1440], '4:5': [1248, 1568] }
    };
    return pVideo2[resolution]?.[aspect] || pVideo2['720p']['9:16'];
  }
  const maps = {
    '360p': { '16:9': [640, 360], '9:16': [360, 640], '1:1': [360, 360], '4:5': [360, 450] },
    '480p': { '16:9': [864, 480], '9:16': [480, 864], '1:1': [480, 480], '4:5': [480, 600] },
    '540p': { '16:9': [960, 540], '9:16': [540, 960], '1:1': [540, 540], '4:5': [540, 675] },
    '720p': { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [960, 960], '4:5': [720, 900] },
    '768p': { '16:9': [1344, 768], '9:16': [768, 1344], '1:1': [768, 768], '4:5': [768, 960] },
    '1080p': { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1440, 1440], '4:5': [1080, 1350] }
  };
  return maps[resolution]?.[aspect] || maps['720p']['9:16'];
}

function supportedOrUnknown(values, value) {
  return !Array.isArray(values) || values.length === 0 || values.map(String).includes(String(value));
}

function validateSelection(profile, input = {}, references = []) {
  if (!profile?.generationReady) throw adapterError('This Runware video model has been discovered but is not yet marked generation-ready.', 'AI_VIDEO_MODEL_NOT_READY');
  const duration = Math.floor(Number(input.duration || profile.durations?.[0] || profile.availableDurations?.[0] || 5));
  const resolution = clean(input.resolution || profile.resolutions?.[0] || profile.availableResolutions?.[0] || '720p', 32);
  const aspect = clean(input.aspectRatio || profile.aspects?.[0] || '9:16', 20);
  const fps = input.fps === undefined || input.fps === null ? null : Math.floor(Number(input.fps));
  const allowedDurations = profile.durations?.length ? profile.durations : profile.availableDurations;
  const allowedResolutions = profile.resolutions?.length ? profile.resolutions : profile.availableResolutions;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 120) throw adapterError('Choose a valid video duration.', 'AI_VIDEO_DURATION_UNSUPPORTED');
  if (!supportedOrUnknown(allowedDurations, duration)) throw adapterError('Choose a duration supported by the selected video model.', 'AI_VIDEO_DURATION_UNSUPPORTED');
  if (!supportedOrUnknown(allowedResolutions, resolution)) throw adapterError('Choose a resolution supported by the selected video model.', 'AI_VIDEO_RESOLUTION_UNSUPPORTED');
  if (!supportedOrUnknown(profile.aspects, aspect)) throw adapterError('Choose an aspect ratio supported by the selected video model.', 'AI_VIDEO_ASPECT_UNSUPPORTED');
  if (fps !== null && !supportedOrUnknown(profile.fps?.length ? profile.fps : profile.availableFps, fps)) throw adapterError('Choose a frame rate supported by the selected video model.', 'AI_VIDEO_FPS_UNSUPPORTED');
  if (references.length && !profile.imageReferenceSupported) throw adapterError('The selected model does not accept an image reference.', 'AI_VIDEO_REFERENCE_UNSUPPORTED');
  if (references.length > 1 && !(profile.referenceImagesSupported || profile.lastFrameSupported)) throw adapterError('The selected model does not support multiple image references.', 'AI_VIDEO_REFERENCE_COUNT_UNSUPPORTED');
  return { duration, resolution, aspect, fps };
}

function referenceData(references) {
  return (references || []).filter(Boolean).map(reference => reference.dataUri || reference.url || reference).filter(Boolean);
}

function buildLegacyTask(profile, input, references, taskUUID, selection) {
  const images = referenceData(references);
  const audio = input.audio !== false && profile.audioSupported;
  const task = {
    taskType: 'videoInference',
    taskUUID,
    model: profile.air || profile.model,
    deliveryMethod: 'async',
    positivePrompt: clean(input.prompt, profile.id === 'pvideo' ? 2048 : profile.id === 'runway45' ? 1000 : 7000),
    duration: selection.duration,
    includeCost: true,
    outputType: 'URL'
  };

  if (images.length) {
    if (profile.referenceMode === 'reference') task.inputs = { referenceImages: images };
    else if (images.length > 1 && profile.lastFrameSupported) {
      task.inputs = { frameImages: [
        { image: images[0], frame: 'first' },
        { image: images[images.length - 1], frame: 'last' }
      ] };
    } else task.inputs = { frameImages: images };
    if (['pvideo', 'wan30', 'seedance25'].includes(profile.id)) task.resolution = selection.resolution;
  } else {
    const [width, height] = defaultDimensions(selection.resolution, selection.aspect, profile.id);
    task.width = width;
    task.height = height;
  }

  if (profile.id === 'pvideo') {
    task.fps = selection.fps || 24;
    task.settings = { audio, draft: Boolean(input.draft), promptUpsampling: true };
  }
  if (profile.id === 'wan30' && !audio) task.positivePrompt = `${task.positivePrompt}\n\nCreate a silent video with no dialogue, voice, music or sound effects.`;
  if (profile.id === 'ltx25pro' || profile.id === 'seedance25') task.settings = { audio };
  if (profile.id === 'kling30') task.providerSettings = { klingai: { sound: audio } };
  return task;
}

function buildGenericTask(profile, input, references, taskUUID, selection) {
  const images = referenceData(references);
  const task = {
    taskType: 'videoInference',
    taskUUID,
    model: profile.air || profile.model,
    deliveryMethod: 'async',
    positivePrompt: clean(input.prompt, 7000),
    includeCost: true,
    outputType: 'URL'
  };

  if (profile.durations?.length || profile.availableDurations?.length) task.duration = selection.duration;
  if (selection.fps && (profile.fps?.length || profile.availableFps?.length)) task.fps = selection.fps;

  if (images.length) {
    if (profile.referenceImagesSupported) task.inputs = { referenceImages: images };
    else if (profile.firstFrameSupported) {
      task.inputs = images.length > 1 && profile.lastFrameSupported
        ? { frameImages: [{ image: images[0], frame: 'first' }, { image: images[images.length - 1], frame: 'last' }] }
        : { frameImages: [images[0]] };
    } else task.inputs = { image: images[0] };
  }

  if (profile.supportsResolution) task.resolution = selection.resolution;
  else if (profile.supportsDimensions) {
    const [width, height] = defaultDimensions(selection.resolution, selection.aspect, profile.id);
    task.width = width;
    task.height = height;
  }

  const settings = {};
  if (profile.supportsAudioSetting) settings.audio = input.audio !== false;
  if (profile.draftSupported) settings.draft = Boolean(input.draft);
  if (Object.keys(settings).length) task.settings = settings;
  return task;
}

function buildTask(profile, input = {}, references = [], taskUUID = crypto.randomUUID()) {
  const selection = validateSelection(profile, input, references);
  const task = profile.adapterKey
    ? buildLegacyTask(profile, input, references, taskUUID, selection)
    : buildGenericTask(profile, input, references, taskUUID, selection);
  return { task, ...selection };
}

module.exports = {
  defaultDimensions,
  validateSelection,
  buildTask
};
