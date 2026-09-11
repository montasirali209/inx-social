const crypto = require('node:crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const credits = require('./aiCreditService');
const runware = require('./runwareService');
const mediaLibrary = require('./mediaLibraryService');

const CHAT_MODEL = String(process.env.OPENAI_CHAT_MODEL || 'gpt-5.6-luna').trim();

function publicError(message, code = 'AI_VIDEO_STUDIO_ERROR', status = 400) {
  const error = new Error(message); error.code = code; error.status = status; error.publicMessage = message; return error;
}
function clean(value, max = 4000) { return String(value || '').replace(/\u0000/g, '').trim().slice(0, max) }
function safeJson(text) {
  const raw = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { return null; }
}

function catalog() {
  return [
    {
      id: 'pvideo', name: 'P-Video', badge: 'Fast value', speed: 'fast',
      description: 'The fastest low-cost route for Reels, motion tests and everyday social clips.',
      model: env.runware.videoModel || 'prunaai:p-video@0', resolutions: ['720p', '1080p'], durations: [5, 10], aspects: ['9:16', '16:9', '1:1'],
      draftSupported: true, audioSupported: true, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '720p': 0.02, '1080p': 0.04 }, draftRates: { '720p': 0.005, '1080p': 0.01 }, tags: ['fast', 'budget', 'social', 'reel']
    },
    {
      id: 'h3fast', name: 'MiniMax H3 Fast', badge: 'Fast references', speed: 'fast',
      description: 'Fast reference-driven video with strong visual continuity for product shots and rapid creative iteration.',
      model: 'minimax:h3@fast', resolutions: ['480p'], durations: [5, 10, 15], aspects: ['9:16', '16:9', '1:1'],
      draftSupported: false, audioSupported: false, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '480p': 0.046 }, tags: ['fast', 'reference', 'product', 'iteration']
    },
    {
      id: 'kling30', name: 'Kling VIDEO 3.0', badge: 'Balanced + audio', speed: 'balanced',
      description: 'A balanced social-video model with stable motion, strong prompt following and optional synchronized audio.',
      model: 'klingai:kling-video@3-standard', resolutions: ['720p'], durations: [5, 8, 10, 12], aspects: ['9:16', '16:9', '1:1'],
      draftSupported: false, audioSupported: true, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '720p': 0.084 }, audioRates: { '720p': 0.126 }, tags: ['balanced', 'audio', 'people', 'social']
    },
    {
      id: 'wan30', name: 'Wan 3.0', badge: 'Quality', speed: 'quality',
      description: 'High-fidelity generation for polished hero Reels, product storytelling and stronger motion quality.',
      model: env.runware.videoLongModel || 'alibaba:wan@3.0', resolutions: ['480p', '720p', '1080p'], durations: [5, 10, 15], aspects: ['9:16', '16:9', '1:1'],
      draftSupported: false, audioSupported: true, imageReferenceSupported: true, referenceMode: 'reference',
      rates: { '480p': 0.05, '720p': 0.10, '1080p': 0.20 }, tags: ['quality', 'product', 'cinematic', 'reference']
    },
    {
      id: 'ltx25pro', name: 'LTX-2.5 Pro', badge: 'Production', speed: 'balanced',
      description: 'Production-focused video with excellent turnaround, synchronized audio and strong image-to-video control.',
      model: 'lightricks:ltx@2.5-pro', resolutions: ['720p', '1080p'], durations: [6, 8, 10], aspects: ['9:16', '16:9'],
      draftSupported: false, audioSupported: true, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '720p': 0.12, '1080p': 0.17 }, tags: ['production', 'audio', 'commercial', 'product']
    },
    {
      id: 'runway45', name: 'Runway Gen-4.5', badge: 'Cinematic', speed: 'quality',
      description: 'Cinematic realistic motion and strong composition for premium visual storytelling.',
      model: 'runway:1@2', resolutions: ['720p'], durations: [5, 8, 10], aspects: ['9:16', '16:9', '1:1'],
      draftSupported: false, audioSupported: false, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '720p': 0.12 }, tags: ['cinematic', 'realistic', 'premium', 'storytelling']
    },
    {
      id: 'seedance25', name: 'Seedance 2.5', badge: 'Long-form premium', speed: 'premium',
      description: 'Premium multimodal generation for complex branded stories, longer clips and demanding creative direction.',
      model: 'bytedance:seedance@2.5', resolutions: ['480p', '720p', '1080p'], durations: [5, 10, 15, 20, 30], aspects: ['9:16', '16:9', '1:1'],
      draftSupported: false, audioSupported: true, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '480p': 0.102, '720p': 0.23, '1080p': 0.614 }, tags: ['premium', 'long-form', 'brand', 'multimodal']
    }
  ].map(({ model, referenceMode, rates, draftRates, audioRates, ...publicItem }) => publicItem);
}

function internalProfiles() {
  const publicItems = catalog();
  const raw = [
    { id: 'pvideo', model: env.runware.videoModel || 'prunaai:p-video@0', referenceMode: 'frame', rates: { '720p': 0.02, '1080p': 0.04 }, draftRates: { '720p': 0.005, '1080p': 0.01 } },
    { id: 'h3fast', model: 'minimax:h3@fast', referenceMode: 'frame', rates: { '480p': 0.046 } },
    { id: 'kling30', model: 'klingai:kling-video@3-standard', referenceMode: 'frame', rates: { '720p': 0.084 }, audioRates: { '720p': 0.126 } },
    { id: 'wan30', model: env.runware.videoLongModel || 'alibaba:wan@3.0', referenceMode: 'reference', rates: { '480p': 0.05, '720p': 0.10, '1080p': 0.20 } },
    { id: 'ltx25pro', model: 'lightricks:ltx@2.5-pro', referenceMode: 'frame', rates: { '720p': 0.12, '1080p': 0.17 } },
    { id: 'runway45', model: 'runway:1@2', referenceMode: 'frame', rates: { '720p': 0.12 } },
    { id: 'seedance25', model: 'bytedance:seedance@2.5', referenceMode: 'frame', rates: { '480p': 0.102, '720p': 0.23, '1080p': 0.614 } }
  ];
  return publicItems.map(item => ({ ...item, ...raw.find(entry => entry.id === item.id) }));
}

function modelConfig(route) {
  const requested = clean(route, 50) || 'pvideo';
  const profile = internalProfiles().find(item => item.id === requested);
  if (!profile) throw publicError('Choose a supported video model.', 'AI_VIDEO_MODEL_UNSUPPORTED', 422);
  return profile;
}

function estimateCredits(input = {}) {
  const profile = modelConfig(input.modelRoute);
  const duration = Math.floor(Number(input.duration || profile.durations[0] || 5));
  const resolution = String(input.resolution || profile.resolutions[0]);
  const draft = Boolean(input.draft) && profile.draftSupported;
  const audio = input.audio !== false && profile.audioSupported;
  if (!profile.durations.includes(duration)) throw publicError('Choose a duration supported by the selected video model.', 'AI_VIDEO_DURATION_UNSUPPORTED', 422);
  if (!profile.resolutions.includes(resolution)) throw publicError('Choose a resolution supported by the selected video model.', 'AI_VIDEO_RESOLUTION_UNSUPPORTED', 422);
  if (input.aspectRatio && !profile.aspects.includes(String(input.aspectRatio))) throw publicError('Choose an aspect ratio supported by the selected video model.', 'AI_VIDEO_ASPECT_UNSUPPORTED', 422);
  const rateTable = draft && profile.draftRates ? profile.draftRates : audio && profile.audioRates ? profile.audioRates : profile.rates;
  const usdPerSecond = Number(rateTable?.[resolution] || profile.rates?.[resolution] || 0.12);
  return Math.max(1, Math.ceil(duration * usdPerSecond * 100));
}

function fallbackRecommendation(input = {}) {
  const prompt = clean(input.prompt, 1500).toLowerCase();
  const hasReference = Boolean(input.hasReference);
  let id = 'pvideo';
  if (/30\s*sec|20\s*sec|long[- ]?form|longer clip|story sequence/.test(prompt)) id = 'seedance25';
  else if (/dialogue|voice|speaking|native audio|sound|music|ambient/.test(prompt)) id = 'kling30';
  else if (/cinematic|film|photoreal|realistic motion|premium visual/.test(prompt)) id = 'runway45';
  else if (hasReference && /brand|product|commercial|ad|ui|interface|screen/.test(prompt)) id = 'ltx25pro';
  else if (hasReference) id = 'h3fast';
  else if (/hero|quality|polished|high fidelity|storytelling/.test(prompt)) id = 'wan30';
  const profile = modelConfig(id);
  const duration = profile.durations.includes(10) ? 10 : profile.durations[0];
  const resolution = profile.resolutions.includes('720p') ? '720p' : profile.resolutions[0];
  return { modelRoute: id, reason: `Recommended for ${profile.description.toLowerCase()}`, duration, resolution, aspectRatio: '9:16', audio: profile.audioSupported, draft: false };
}

async function recommendModel(input = {}) {
  const prompt = clean(input.prompt, 1500);
  if (prompt.length < 2) throw publicError('Describe the video first so AI can recommend the right model.', 'AI_VIDEO_RECOMMEND_PROMPT', 422);
  const candidates = catalog().map(item => ({ id: item.id, name: item.name, badge: item.badge, description: item.description, durations: item.durations, resolutions: item.resolutions, aspects: item.aspects, audio: item.audioSupported, reference: item.imageReferenceSupported, tags: item.tags }));
  if (!env.openaiImage?.apiKey || !env.openaiImage?.baseUrl) return fallbackRecommendation(input);
  try {
    const response = await axios.post(`${String(env.openaiImage.baseUrl).replace(/\/$/, '')}/chat/completions`, {
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: 'You are the private INXSocial video routing engine. Choose one model from the supplied catalog for the user brief. Optimise quality-to-cost, not maximum quality by default. Prefer P-Video for ordinary fast social clips, H3 Fast for cheap reference-heavy iteration, Kling for synchronized audio/people, LTX-2.5 Pro for polished product/commercial reference work, Runway for cinematic realism, Wan for high-quality hero visuals, and Seedance only when long-form or complex premium direction justifies its cost. Return JSON only.' },
        { role: 'user', content: JSON.stringify({ prompt, hasReference: Boolean(input.hasReference), aspectRatio: input.aspectRatio || '9:16', candidates }) }
      ],
      reasoning_effort: 'none', temperature: 0.2, response_format: { type: 'json_object' }, max_completion_tokens: 450
    }, { timeout: 45000, headers: { Authorization: `Bearer ${env.openaiImage.apiKey}`, 'Content-Type': 'application/json' } });
    const parsed = safeJson(response.data?.choices?.[0]?.message?.content);
    const profile = modelConfig(parsed?.modelRoute);
    const duration = profile.durations.includes(Number(parsed?.duration)) ? Number(parsed.duration) : (profile.durations.includes(10) ? 10 : profile.durations[0]);
    const resolution = profile.resolutions.includes(String(parsed?.resolution)) ? String(parsed.resolution) : (profile.resolutions.includes('720p') ? '720p' : profile.resolutions[0]);
    const aspectRatio = profile.aspects.includes(String(parsed?.aspectRatio || input.aspectRatio)) ? String(parsed?.aspectRatio || input.aspectRatio) : profile.aspects[0];
    return {
      modelRoute: profile.id,
      reason: clean(parsed?.reason, 320) || `Best fit for this brief using ${profile.name}.`,
      duration,
      resolution,
      aspectRatio,
      audio: profile.audioSupported && parsed?.audio !== false,
      draft: profile.draftSupported && Boolean(parsed?.draft)
    };
  } catch (_) {
    return fallbackRecommendation(input);
  }
}

function dimensions(resolution, aspect) {
  const maps = {
    '480p': { '16:9': [864, 480], '9:16': [480, 864], '1:1': [480, 480] },
    '720p': { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [960, 960] },
    '1080p': { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1440, 1440] }
  };
  return maps[resolution]?.[aspect] || maps['720p']['9:16'];
}

async function sourceImage(userId, assetId) {
  if (!assetId) return null;
  const asset = await prisma.agentAsset.findFirst({ where: { id: String(assetId), userId, status: 'READY', archivedAt: null } });
  if (!asset) throw publicError('The selected source image is unavailable.', 'AI_VIDEO_SOURCE_NOT_FOUND', 404);
  if (!String(asset.mimeType || '').startsWith('image/')) throw publicError('Upload an image, product shot or first-frame reference.', 'AI_VIDEO_SOURCE_TYPE', 422);
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
    if (item.status === 'processing') { onProgress(Math.max(10, Math.min(95, Number(item.progress || 35)))); continue; }
    if (item.status === 'error') throw publicError('The selected video model could not complete this render. Adjust the brief or reference and try again.', 'AI_VIDEO_PROVIDER_FAILED', 502);
    if (item.videoURL || item.status === 'success') {
      if (!item.videoURL) throw publicError('Video generation completed without a usable output.', 'AI_VIDEO_EMPTY', 502);
      return item;
    }
  }
  throw publicError('Video generation timed out. Your reserved credits are returned automatically.', 'AI_VIDEO_TIMEOUT', 504);
}

function buildProviderTask(profile, input, reference, taskUUID) {
  const duration = Math.floor(Number(input.duration || profile.durations[0]));
  const resolution = String(input.resolution || profile.resolutions[0]);
  const aspect = String(input.aspectRatio || profile.aspects[0]);
  const audio = input.audio !== false && profile.audioSupported;
  const task = {
    taskType: 'videoInference', taskUUID, model: profile.model, deliveryMethod: 'async', positivePrompt: clean(input.prompt, profile.id === 'runway45' ? 1000 : 7000), duration,
    includeCost: true, outputType: 'URL'
  };
  if (reference) {
    task.inputs = profile.referenceMode === 'reference' ? { referenceImages: [reference.dataUri] } : { frameImages: [reference.dataUri] };
    if (profile.id === 'pvideo' || profile.id === 'wan30' || profile.id === 'seedance25') task.resolution = resolution;
  } else {
    const [width, height] = dimensions(resolution, aspect); task.width = width; task.height = height;
  }
  if (profile.id === 'pvideo') { task.settings = { audio, draft: Boolean(input.draft), promptUpsampling: true }; task.fps = 24; }
  if (profile.id === 'wan30') task.settings = { audio, promptExtend: true };
  if (profile.id === 'ltx25pro' || profile.id === 'seedance25') task.settings = { audio };
  if (profile.id === 'kling30') task.providerSettings = { klingai: { sound: audio } };
  return { task, duration, resolution, aspect };
}

async function providerGenerate(input, reference, onProgress) {
  const profile = modelConfig(input.modelRoute);
  const taskUUID = crypto.randomUUID();
  const built = buildProviderTask(profile, input, reference, taskUUID);
  onProgress(5);
  const initial = await runware.request([built.task], 60000);
  const first = initial.find(entry => entry.taskUUID === taskUUID) || initial[0];
  if (first?.videoURL) return { item: first, taskUUID, route: profile.id, model: profile.model, duration: built.duration, resolution: built.resolution, aspect: built.aspect };
  const final = await poll(taskUUID, Number(env.runware.videoTimeoutMs || 900000), onProgress); onProgress(100);
  return { item: final, taskUUID, route: profile.id, model: profile.model, duration: built.duration, resolution: built.resolution, aspect: built.aspect };
}

async function createGenerationRow(userId, input, amount) {
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe('INSERT INTO "AiGeneration" ("id","userId","contentType","status","provider","prompt","requestJson","reservedCredits","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)', id, userId, 'short_video', 'PREPARING', 'runware', clean(input.prompt, 1500), JSON.stringify(input));
  await credits.reserve(userId, id, amount); return id;
}

async function persistVideo(userId, generationId, output, input, amount) {
  let response;
  try { response = await axios.get(output.item.videoURL, { responseType: 'arraybuffer', timeout: 120000, maxContentLength: 120 * 1024 * 1024, maxBodyLength: 120 * 1024 * 1024 }); }
  catch (_) { throw publicError('The generated video could not be copied into your INXSocial Media Library.', 'AI_VIDEO_DOWNLOAD_FAILED', 502); }
  const data = Buffer.from(response.data || []);
  if (!data.length || data.length > 120 * 1024 * 1024) throw publicError('The generated video output was empty or too large.', 'AI_VIDEO_OUTPUT_INVALID', 502);
  const record = await prisma.agentAsset.create({ data: {
    userId, kind: 'AI_VIDEO', source: 'AI_STUDIO', status: 'READY', originalName: `INXSocial-video-${generationId.slice(0, 8)}.mp4`, mimeType: String(response.headers['content-type'] || 'video/mp4').split(';')[0], byteSize: data.length,
    checksum: crypto.createHash('sha256').update(data).digest('hex'), prompt: clean(input.prompt, 1500), customerPrompt: clean(input.prompt, 1500),
    generationChoice: JSON.stringify({ route: output.route, model: output.model, resolution: output.resolution, duration: output.duration, aspectRatio: output.aspect, generationId, providerCostUsd: Number(output.item.cost || 0), taskUUID: output.taskUUID }),
    tagsJson: JSON.stringify(['ai-generated', 'ai-content-studio', 'short-video', output.route]), data, durationSeconds: output.duration
  }});
  const publicAsset = mediaLibrary.publicAsset(record);
  return { id: record.id, type: 'video', url: publicAsset.fileUrl, prompt: clean(input.prompt, 1500), caption: clean(input.caption, 10000), hashtags: Array.isArray(input.hashtags) ? input.hashtags.map(tag => clean(tag, 100).replace(/^#/, '')).filter(Boolean).slice(0, 20) : [], creditsUsed: amount, createdAt: record.createdAt.toISOString(), aspectRatio: output.aspect, mediaLibraryAssetId: record.id, script: clean(input.script, 5000), completionStatus: 'completed' };
}

async function generateVideo(userId, input = {}) {
  if (!runware.isConfigured()) throw publicError('Video generation is temporarily unavailable.', 'AI_VIDEO_NOT_CONFIGURED', 503);
  if (clean(input.prompt, 1500).length < 2) throw publicError('Describe the video you want to create.');
  const profile = modelConfig(input.modelRoute);
  const duration = Math.floor(Number(input.duration || profile.durations[0])); const resolution = String(input.resolution || profile.resolutions[0]); const aspect = String(input.aspectRatio || profile.aspects[0]);
  if (!profile.durations.includes(duration)) throw publicError('Choose a duration supported by the selected model.', 'AI_VIDEO_DURATION_UNSUPPORTED', 422);
  if (!profile.resolutions.includes(resolution)) throw publicError('Choose a resolution supported by the selected model.', 'AI_VIDEO_RESOLUTION_UNSUPPORTED', 422);
  if (!profile.aspects.includes(aspect)) throw publicError('Choose a supported video aspect ratio.', 'AI_VIDEO_ASPECT_UNSUPPORTED', 422);
  const amount = estimateCredits({ ...input, duration, resolution, aspectRatio: aspect, modelRoute: profile.id }); await credits.getBalance(userId);
  const generationId = await createGenerationRow(userId, { ...input, duration, resolution, aspectRatio: aspect, modelRoute: profile.id }, amount);
  try {
    const reference = await sourceImage(userId, input.sourceMediaLibraryAssetId);
    if (reference && !profile.imageReferenceSupported) throw publicError('The selected model does not accept an image reference.', 'AI_VIDEO_REFERENCE_UNSUPPORTED', 422);
    await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "status"=$2,"progress"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, 'PROCESSING', 5);
    const output = await providerGenerate({ ...input, duration, resolution, aspectRatio: aspect, modelRoute: profile.id }, reference, progress => { void prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "status"=$2,"progress"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, 'PROCESSING', Math.max(5, Math.min(95, progress))).catch(() => {}); });
    const asset = await persistVideo(userId, generationId, output, input, amount); await credits.complete(userId, generationId, amount);
    await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "status"=$2,"progress"=100,"model"=$3,"providerCostUsd"=$4,"taskUuid"=$5,"assetJson"=$6,"responseJson"=$7,"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, 'COMPLETED', output.model, Number(output.item.cost || 0), output.taskUUID, JSON.stringify(asset), JSON.stringify({ route: output.route, duration, resolution, creditsUsed: amount }));
    return asset;
  } catch (caught) {
    await credits.refund(userId, generationId, caught?.code || 'video_failed').catch(() => {});
    await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "status"=$2,"errorCode"=$3,"errorMessage"=$4,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, 'FAILED', clean(caught?.code || 'AI_VIDEO_FAILED', 120), clean(caught?.publicMessage || caught?.message || 'Video generation failed.', 700)).catch(() => {});
    throw caught;
  }
}

module.exports = { catalog, estimateCredits, recommendModel, generateVideo };