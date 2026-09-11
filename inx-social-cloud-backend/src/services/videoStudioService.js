const crypto = require('node:crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const credits = require('./aiCreditService');
const runware = require('./runwareService');
const mediaLibrary = require('./mediaLibraryService');

function publicError(message, code = 'AI_VIDEO_STUDIO_ERROR', status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.publicMessage = message;
  return error;
}

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function catalog() {
  return [
    {
      id: 'fast',
      name: 'P-Video',
      badge: 'Fast',
      description: 'Fast social clips and rapid iteration. Best for testing motion ideas before a premium render.',
      resolutions: ['720p', '1080p'],
      durations: [5, 10],
      aspects: ['9:16', '16:9', '1:1', '4:5'],
      draftSupported: true,
      audioSupported: true,
      imageReferenceSupported: true
    },
    {
      id: 'quality',
      name: 'Wan 3.0',
      badge: 'Quality',
      description: 'Higher-fidelity generation for hero reels, product storytelling and reference-led motion.',
      resolutions: ['480p', '720p', '1080p'],
      durations: [5, 10, 15],
      aspects: ['9:16', '16:9', '1:1', '4:5'],
      draftSupported: false,
      audioSupported: true,
      imageReferenceSupported: true
    }
  ];
}

function modelConfig(route) {
  const value = String(route || 'fast');
  if (value === 'quality') return { route: 'quality', model: env.runware.videoLongModel || 'alibaba:wan@3.0' };
  return { route: 'fast', model: env.runware.videoModel || 'prunaai:p-video@0' };
}

function estimateCredits(input = {}) {
  const { route } = modelConfig(input.modelRoute);
  const duration = Math.floor(Number(input.duration || 5));
  const resolution = String(input.resolution || (route === 'quality' ? '720p' : '720p'));
  const draft = route === 'fast' && Boolean(input.draft);
  const available = catalog().find(item => item.id === route);
  if (!available.durations.includes(duration)) throw publicError('Choose a duration supported by the selected video model.', 'AI_VIDEO_DURATION_UNSUPPORTED', 422);
  if (!available.resolutions.includes(resolution)) throw publicError('Choose a resolution supported by the selected video model.', 'AI_VIDEO_RESOLUTION_UNSUPPORTED', 422);

  let creditsPerSecond;
  if (route === 'fast') {
    creditsPerSecond = draft ? (resolution === '1080p' ? 1.5 : 1) : (resolution === '1080p' ? 4 : 2);
  } else {
    creditsPerSecond = resolution === '1080p' ? 20 : resolution === '720p' ? 10 : 5;
  }
  return Math.ceil(duration * creditsPerSecond);
}

function dimensions(route, resolution, aspect) {
  const key = `${resolution}:${aspect}`;
  const fast = {
    '720p:16:9': [1280, 720], '720p:9:16': [720, 1280], '720p:1:1': [720, 720], '720p:4:5': [720, 900],
    '1080p:16:9': [1920, 1080], '1080p:9:16': [1080, 1920], '1080p:1:1': [1080, 1080], '1080p:4:5': [1080, 1350]
  };
  const quality = {
    '480p:16:9': [832, 480], '480p:9:16': [480, 832], '480p:1:1': [624, 624], '480p:4:5': [544, 680],
    '720p:16:9': [1280, 720], '720p:9:16': [720, 1280], '720p:1:1': [960, 960], '720p:4:5': [832, 1040],
    '1080p:16:9': [1920, 1080], '1080p:9:16': [1080, 1920], '1080p:1:1': [1440, 1440], '1080p:4:5': [1248, 1560]
  };
  return (route === 'quality' ? quality[key] : fast[key]) || (route === 'quality' ? quality['720p:9:16'] : fast['720p:9:16']);
}

async function sourceImage(userId, assetId) {
  if (!assetId) return null;
  const asset = await prisma.agentAsset.findFirst({ where: { id: String(assetId), userId, status: 'READY', archivedAt: null } });
  if (!asset) throw publicError('The selected source image is unavailable.', 'AI_VIDEO_SOURCE_NOT_FOUND', 404);
  if (!String(asset.mimeType || '').startsWith('image/')) throw publicError('This Video Studio version accepts an image as the optional visual reference.', 'AI_VIDEO_SOURCE_TYPE', 422);
  if (asset.data.length > 20 * 1024 * 1024) throw publicError('Choose a source image under 20 MB.', 'AI_VIDEO_SOURCE_TOO_LARGE', 413);
  return { id: asset.id, dataUri: `data:${asset.mimeType};base64,${asset.data.toString('base64')}`, mimeType: asset.mimeType, name: asset.originalName || 'Reference image' };
}

async function poll(taskUUID, timeoutMs, onProgress = () => {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, Math.max(2000, Number(env.runware.pollIntervalMs || 4000))));
    const results = await runware.request([{ taskType: 'getResponse', taskUUID }], Math.min(60000, timeoutMs));
    const item = results.find(entry => entry.taskUUID === taskUUID) || results[0];
    if (!item) continue;
    if (item.status === 'processing') {
      onProgress(Math.max(10, Math.min(95, Number(item.progress || 35))));
      continue;
    }
    if (item.status === 'error') throw publicError('The selected video model could not complete this render. Adjust the prompt or reference and try again.', 'AI_VIDEO_PROVIDER_FAILED', 502);
    if (item.videoURL || item.status === 'success') {
      if (!item.videoURL) throw publicError('Video generation completed without a usable output.', 'AI_VIDEO_EMPTY', 502);
      return item;
    }
  }
  throw publicError('Video generation timed out. Your reserved credits are returned automatically.', 'AI_VIDEO_TIMEOUT', 504);
}

async function providerGenerate(input, reference, onProgress) {
  const config = modelConfig(input.modelRoute);
  const route = config.route;
  const duration = Math.floor(Number(input.duration || 5));
  const resolution = String(input.resolution || '720p');
  const aspect = String(input.aspectRatio || '9:16');
  const draft = route === 'fast' && Boolean(input.draft);
  const audio = input.audio !== false;
  const taskUUID = crypto.randomUUID();
  const task = {
    taskType: 'videoInference',
    taskUUID,
    model: config.model,
    deliveryMethod: 'async',
    positivePrompt: clean(input.prompt, route === 'fast' ? 2000 : 10000),
    duration,
    includeCost: true,
    outputType: 'URL',
    settings: route === 'fast' ? { audio, draft, promptUpsampling: true } : { audio, promptExtend: true }
  };

  if (reference) {
    task.inputs = route === 'quality' ? { referenceImages: [reference.dataUri] } : { frameImages: [reference.dataUri] };
    task.resolution = resolution;
  } else {
    const [width, height] = dimensions(route, resolution, aspect);
    task.width = width;
    task.height = height;
  }
  if (route === 'fast') task.fps = 24;

  onProgress(5);
  const initial = await runware.request([task], 60000);
  const first = initial.find(entry => entry.taskUUID === taskUUID) || initial[0];
  if (first?.videoURL) return { item: first, taskUUID, route, model: config.model, duration, resolution, aspect };
  const final = await poll(taskUUID, Number(env.runware.videoTimeoutMs || 600000), onProgress);
  onProgress(100);
  return { item: final, taskUUID, route, model: config.model, duration, resolution, aspect };
}

async function createGenerationRow(userId, input, amount) {
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    'INSERT INTO "AiGeneration" ("id","userId","contentType","status","provider","prompt","requestJson","reservedCredits","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
    id, userId, 'short_video', 'PREPARING', 'runware', clean(input.prompt, 1500), JSON.stringify(input)
  );
  await credits.reserve(userId, id, amount);
  return id;
}

async function persistVideo(userId, generationId, output, input, amount) {
  let response;
  try {
    response = await axios.get(output.item.videoURL, { responseType: 'arraybuffer', timeout: 120000, maxContentLength: 120 * 1024 * 1024, maxBodyLength: 120 * 1024 * 1024 });
  } catch (_) {
    throw publicError('The generated video could not be copied into your INXSocial Media Library.', 'AI_VIDEO_DOWNLOAD_FAILED', 502);
  }
  const data = Buffer.from(response.data || []);
  if (!data.length || data.length > 120 * 1024 * 1024) throw publicError('The generated video output was empty or too large.', 'AI_VIDEO_OUTPUT_INVALID', 502);
  const checksum = crypto.createHash('sha256').update(data).digest('hex');
  const record = await prisma.agentAsset.create({
    data: {
      userId,
      kind: 'AI_VIDEO',
      source: 'AI_STUDIO',
      status: 'READY',
      originalName: `INXSocial-video-${generationId.slice(0, 8)}.mp4`,
      mimeType: String(response.headers['content-type'] || 'video/mp4').split(';')[0],
      byteSize: data.length,
      checksum,
      prompt: clean(input.prompt, 1500),
      customerPrompt: clean(input.prompt, 1500),
      generationChoice: JSON.stringify({ route: output.route, model: output.model, resolution: output.resolution, duration: output.duration, aspectRatio: output.aspect, generationId, providerCostUsd: Number(output.item.cost || 0), taskUUID: output.taskUUID }),
      tagsJson: JSON.stringify(['ai-generated', 'ai-content-studio', 'short-video', output.route]),
      data,
      durationSeconds: output.duration
    }
  });
  const publicAsset = mediaLibrary.publicAsset(record);
  return {
    id: record.id,
    type: 'video',
    url: publicAsset.fileUrl,
    prompt: clean(input.prompt, 1500),
    caption: clean(input.caption, 10000),
    hashtags: Array.isArray(input.hashtags) ? input.hashtags.map(tag => clean(tag, 100).replace(/^#/, '')).filter(Boolean).slice(0, 20) : [],
    creditsUsed: amount,
    createdAt: record.createdAt.toISOString(),
    aspectRatio: output.aspect,
    mediaLibraryAssetId: record.id,
    script: clean(input.script, 5000),
    completionStatus: 'completed'
  };
}

async function generateVideo(userId, input = {}) {
  if (!runware.isConfigured()) throw publicError('Video generation is temporarily unavailable.', 'AI_VIDEO_NOT_CONFIGURED', 503);
  const prompt = clean(input.prompt, 1500);
  if (prompt.length < 2) throw publicError('Describe the video you want to create.');
  const config = modelConfig(input.modelRoute);
  const available = catalog().find(item => item.id === config.route);
  const duration = Math.floor(Number(input.duration || 5));
  const resolution = String(input.resolution || '720p');
  const aspect = String(input.aspectRatio || '9:16');
  if (!available.durations.includes(duration)) throw publicError('Choose a duration supported by the selected model.', 'AI_VIDEO_DURATION_UNSUPPORTED', 422);
  if (!available.resolutions.includes(resolution)) throw publicError('Choose a resolution supported by the selected model.', 'AI_VIDEO_RESOLUTION_UNSUPPORTED', 422);
  if (!available.aspects.includes(aspect)) throw publicError('Choose a supported video aspect ratio.', 'AI_VIDEO_ASPECT_UNSUPPORTED', 422);
  const amount = estimateCredits({ ...input, duration, resolution, modelRoute: config.route });
  await credits.getBalance(userId);
  const generationId = await createGenerationRow(userId, { ...input, duration, resolution, aspectRatio: aspect }, amount);
  try {
    const reference = await sourceImage(userId, input.sourceMediaLibraryAssetId);
    await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "status"=$2,"progress"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, 'PROCESSING', 5);
    const output = await providerGenerate({ ...input, duration, resolution, aspectRatio: aspect, modelRoute: config.route }, reference, progress => {
      void prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "status"=$2,"progress"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, 'PROCESSING', Math.max(5, Math.min(95, progress))).catch(() => {});
    });
    const asset = await persistVideo(userId, generationId, output, input, amount);
    await credits.complete(userId, generationId, amount);
    await prisma.$executeRawUnsafe(
      'UPDATE "AiGeneration" SET "status"=$2,"progress"=100,"model"=$3,"providerCostUsd"=$4,"taskUuid"=$5,"assetJson"=$6,"responseJson"=$7,"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1',
      generationId, 'COMPLETED', output.model, Number(output.item.cost || 0), output.taskUUID, JSON.stringify(asset), JSON.stringify({ route: output.route, duration, resolution, creditsUsed: amount })
    );
    return asset;
  } catch (caught) {
    await credits.refund(userId, generationId, caught?.code || 'video_failed').catch(() => {});
    await prisma.$executeRawUnsafe(
      'UPDATE "AiGeneration" SET "status"=$2,"errorCode"=$3,"errorMessage"=$4,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1',
      generationId, 'FAILED', clean(caught?.code || 'AI_VIDEO_FAILED', 120), clean(caught?.publicMessage || caught?.message || 'Video generation failed.', 700)
    ).catch(() => {});
    throw caught;
  }
}

module.exports = { catalog, estimateCredits, generateVideo };
