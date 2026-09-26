const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const axios = require('axios');
const ffmpegPath = require('ffmpeg-static');
const prisma = require('../db/prisma');
const env = require('../config/env');
const credits = require('./aiCreditService');
const runware = require('./runwareService');
const videoModels = require('./videoModelRegistryService');
const videoAdapters = require('./videoProviderAdapters');
const mediaLibrary = require('./mediaLibraryService');
const { expiresAtFor } = require('./mediaRetentionService');
const objectStorage = require('./mediaObjectStorageService');

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

function runFfmpeg(args, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('MP4 normalization timed out'));
    }, timeoutMs);
    child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-2000); });
    child.once('error', finish);
    child.once('close', code => finish(code === 0 ? null : new Error(stderr || `ffmpeg exited with code ${code}`)));
  });
}

async function browserReadyMp4(data, generationId) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'inxsocial-video-'));
  const inputPath = path.join(directory, `${generationId}-source.mp4`);
  const outputPath = path.join(directory, `${generationId}-faststart.mp4`);
  try {
    await fs.writeFile(inputPath, data);
    await runFfmpeg([
      '-hide_banner', '-loglevel', 'error', '-y', '-fflags', '+genpts', '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a?', '-c', 'copy', '-avoid_negative_ts', 'make_zero',
      '-movflags', '+faststart', outputPath
    ]);
    const normalized = await fs.readFile(outputPath);
    return normalized.length ? normalized : data;
  } catch (caught) {
    // The paid provider result is still usable even if a defensive remux fails.
    console.warn('[AI VIDEO NORMALIZE FALLBACK]', JSON.stringify({ generationId, error: clean(caught?.message, 500) }));
    return data;
  } finally {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

function catalog() {
  return videoModels.publicLegacyCatalog();
}

function internalProfiles() {
  return videoModels.legacyProfiles();
}

async function modelConfig(route) {
  return videoModels.resolveModelForGeneration(clean(route, 180) || 'pvideo');
}

async function estimateCredits(input = {}) {
  const profile = await modelConfig(input.modelRoute);
  videoAdapters.validateSelection(profile, input, [], { requireReferences: false });
  return videoModels.estimateCredits(profile, input);
}

async function fallbackRecommendation(input = {}) {
  const prompt = clean(input.prompt, 1500).toLowerCase();
  const hasReference = Boolean(input.hasReference);
  let id = 'pvideo';
  if (/30\s*sec|20\s*sec|long[- ]?form|longer clip|story sequence/.test(prompt)) id = 'seedance25';
  else if (/dialogue|voice|speaking|native audio|sound|music|ambient/.test(prompt)) id = 'kling30';
  else if (/cinematic|film|photoreal|realistic motion|premium visual/.test(prompt)) id = 'runway45';
  else if (hasReference && /brand|product|commercial|ad|ui|interface|screen/.test(prompt)) id = 'ltx25pro';
  else if (hasReference) id = 'h3fast';
  else if (/hero|quality|polished|high fidelity|storytelling/.test(prompt)) id = 'wan30';
  const profile = await modelConfig(id);
  const duration = profile.durations.includes(10) ? 10 : profile.durations[0];
  const resolution = profile.resolutions.includes('720p') ? '720p' : profile.resolutions[0];
  return { modelRoute: id, reason: `Recommended for ${profile.description.toLowerCase()}`, duration, resolution, aspectRatio: '9:16', audio: profile.audioSupported, draft: false };
}

async function recommendModel(input = {}) {
  const prompt = clean(input.prompt, 1500);
  if (prompt.length < 2) throw publicError('Describe the video first so AI can recommend the right model.', 'AI_VIDEO_RECOMMEND_PROMPT', 422);
  const universal = await videoModels.publicCatalog({ all: true });
  const candidates = universal.models
    .filter(item => item.generationReady && (
      Boolean(input.hasReference)
        ? (item.modes?.includes('TEXT_TO_VIDEO') || item.modes?.includes('IMAGE_TO_VIDEO') || item.referenceImagesSupported || item.imageReferenceSupported)
        : item.modes?.includes('TEXT_TO_VIDEO')
    ))
    .map(item => ({
      id: item.id,
      name: item.name,
      creator: item.creator,
      description: item.description,
      modes: item.modes,
      durations: item.durations,
      resolutions: item.resolutions,
      aspects: item.aspects,
      audio: item.audioSupported,
      reference: item.imageReferenceSupported,
      references: item.referenceImagesSupported,
      baselineCredits: item.baselineCredits,
      tags: item.tags
    }));
  if (!env.openaiImage?.apiKey || !env.openaiImage?.baseUrl) return fallbackRecommendation(input);
  try {
    const response = await axios.post(`${String(env.openaiImage.baseUrl).replace(/\/$/, '')}/chat/completions`, {
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: 'You are the private INXSocial video routing engine. Choose exactly one model from the supplied live Runware catalogue. Optimise quality-to-cost for the actual brief, required reference mode, duration, resolution and audio needs. Do not prefer premium models unless the brief benefits from them. Do not choose a model that cannot work with the supplied reference state. Return JSON only with modelRoute, reason, duration, resolution, aspectRatio, audio and draft.' },
        { role: 'user', content: JSON.stringify({ prompt, hasReference: Boolean(input.hasReference), aspectRatio: input.aspectRatio || '9:16', candidates }) }
      ],
      reasoning_effort: 'none', temperature: 0.2, response_format: { type: 'json_object' }, max_completion_tokens: 450
    }, { timeout: 45000, headers: { Authorization: `Bearer ${env.openaiImage.apiKey}`, 'Content-Type': 'application/json' } });
    const parsed = safeJson(response.data?.choices?.[0]?.message?.content);
    const profile = await modelConfig(parsed?.modelRoute);
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

function dimensions(resolution, aspect, profileId = '') {
  if (profileId === 'pvideo') {
    const pVideo2 = { '16:9': [1280, 704], '9:16': [704, 1280], '1:1': [960, 960] };
    return pVideo2[aspect] || pVideo2['9:16'];
  }
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

async function sourceImages(userId, input = {}) {
  const ids = [
    input.firstFrameMediaLibraryAssetId || input.sourceMediaLibraryAssetId,
    ...(Array.isArray(input.referenceMediaLibraryAssetIds) ? input.referenceMediaLibraryAssetIds : []),
    input.lastFrameMediaLibraryAssetId
  ].map(value => clean(value, 120)).filter(Boolean);
  const uniqueIds = [...new Set(ids)].slice(0, 30);
  return Promise.all(uniqueIds.map(assetId => sourceImage(userId, assetId)));
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

function buildProviderTask(profile, input, references, taskUUID) {
  return videoAdapters.buildTask(profile, input, references, taskUUID);
}

async function providerGenerate(input, references, onProgress) {
  const profile = await modelConfig(input.modelRoute);
  const taskUUID = crypto.randomUUID();
  const built = buildProviderTask(profile, input, references, taskUUID);
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
  try {
    await credits.reserve(userId, id, amount);
    return id;
  } catch (error) {
    await prisma.$executeRawUnsafe('DELETE FROM "AiGeneration" WHERE "id"=$1 AND "userId"=$2', id, userId).catch(() => {});
    throw error;
  }
}

async function persistVideo(userId, generationId, output, input, amount) {
  let response;
  try { response = await axios.get(output.item.videoURL, { responseType: 'arraybuffer', timeout: 120000, maxContentLength: 120 * 1024 * 1024, maxBodyLength: 120 * 1024 * 1024 }); }
  catch (_) { throw publicError('The generated video could not be copied into your INXSocial Media Library.', 'AI_VIDEO_DOWNLOAD_FAILED', 502); }
  const downloaded = Buffer.from(response.data || []);
  if (!downloaded.length || downloaded.length > 120 * 1024 * 1024) throw publicError('The generated video output was empty or too large.', 'AI_VIDEO_OUTPUT_INVALID', 502);
  const data = await browserReadyMp4(downloaded, generationId);
  const mimeType = String(response.headers['content-type'] || 'video/mp4').split(';')[0];
  const originalName = `INXSocial-video-${generationId.slice(0, 8)}.mp4`;
  const stored = await objectStorage.persistBuffer({ userId, data, mimeType, originalName, prefix: 'ai-video' });
  const record = await prisma.agentAsset.create({ data: {
    userId, kind: 'AI_VIDEO', source: 'AI_STUDIO', status: 'READY', originalName, mimeType, byteSize: data.length,
    checksum: crypto.createHash('sha256').update(data).digest('hex'), prompt: clean(input.prompt, 1500), customerPrompt: clean(input.prompt, 1500),
    generationChoice: JSON.stringify({ route: output.route, model: output.model, resolution: output.resolution, duration: output.duration, aspectRatio: output.aspect, generationId, providerCostUsd: Number(output.item.cost || 0), taskUUID: output.taskUUID }),
    tagsJson: JSON.stringify(['ai-generated', 'ai-content-studio', 'short-video', output.route]), data: stored.data, storageProvider: stored.storageProvider, storageKey: stored.storageKey, durationSeconds: output.duration,
    expiresAt: expiresAtFor('video/mp4')
  }});
  const publicAsset = mediaLibrary.publicAsset(record);
  return { id: record.id, type: 'video', url: publicAsset.fileUrl, prompt: clean(input.prompt, 1500), caption: clean(input.caption, 10000), hashtags: Array.isArray(input.hashtags) ? input.hashtags.map(tag => clean(tag, 100).replace(/^#/, '')).filter(Boolean).slice(0, 20) : [], creditsUsed: amount, createdAt: record.createdAt.toISOString(), aspectRatio: output.aspect, mediaLibraryAssetId: record.id, script: clean(input.script, 5000), completionStatus: 'completed' };
}

async function runVideoGeneration(userId, generationId, input, amount, profile, duration, resolution, aspect) {
  try {
    const references = await sourceImages(userId, input);
    await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "status"=$2,"progress"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, 'PROCESSING', 5);
    const output = await providerGenerate(
      { ...input, duration, resolution, aspectRatio: aspect, modelRoute: profile.id },
      references,
      progress => { void prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "status"=$2,"progress"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, 'PROCESSING', Math.max(5, Math.min(95, progress))).catch(() => {}); }
    );
    const providerCostUsd = Math.max(0, Number(output.item.cost || 0));
    const providerRequiredCredits = providerCostUsd > 0 ? videoModels.creditsFromUsd(providerCostUsd) : amount;
    await videoModels.recordActualCost({
      model: profile,
      selection: { ...input, duration, resolution, aspectRatio: aspect },
      providerCostUsd,
      reservedCredits: amount,
      requiredCredits: providerRequiredCredits
    });
    const actualCredits = Math.min(amount, providerRequiredCredits);
    const asset = await persistVideo(userId, generationId, output, input, actualCredits);
    await credits.settle(userId, generationId, actualCredits, {
      provider: 'runware',
      providerCostUsd,
      reservedCredits: amount,
      pricingVersion: videoModels.REGISTRY_VERSION
    });
    await prisma.$executeRawUnsafe(
      'UPDATE "AiGeneration" SET "status"=$2,"progress"=100,"model"=$3,"providerCostUsd"=$4,"taskUuid"=$5,"assetJson"=$6,"responseJson"=$7,"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1',
      generationId, 'COMPLETED', output.model, providerCostUsd, output.taskUUID, JSON.stringify(asset),
      JSON.stringify({ route: output.route, duration, resolution, reservedCredits: amount, creditsUsed: actualCredits, providerRequiredCredits, providerCostUsd, pricingVersion: videoModels.REGISTRY_VERSION })
    );
  } catch (caught) {
    console.error('[AI VIDEO GENERATION FAILED]', JSON.stringify({
      generationId,
      route: profile.id,
      model: profile.model,
      code: clean(caught?.code || 'AI_VIDEO_FAILED', 120),
      status: Number(caught?.status || 0),
      providerDetail: clean(caught?.providerDetail, 700)
    }));
    await credits.refund(userId, generationId, caught?.code || 'video_failed').catch(() => {});
    await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "status"=$2,"errorCode"=$3,"errorMessage"=$4,"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, 'FAILED', clean(caught?.code || 'AI_VIDEO_FAILED', 120), clean(caught?.publicMessage || caught?.message || 'Video generation failed.', 700)).catch(() => {});
  }
}

async function generateVideo(userId, input = {}) {
  if (!runware.isConfigured()) throw publicError('Video generation is temporarily unavailable.', 'AI_VIDEO_NOT_CONFIGURED', 503);
  if (clean(input.prompt, 1500).length < 2) throw publicError('Describe the video you want to create.');
  const profile = await modelConfig(input.modelRoute);
  const selection = videoAdapters.validateSelection(profile, input, [], { requireReferences: false });
  const normalized = {
    ...input,
    duration: selection.duration,
    resolution: selection.resolution,
    aspectRatio: selection.aspect,
    fps: selection.fps,
    modelRoute: profile.id
  };
  const amount = await estimateCredits(normalized);
  await credits.getBalance(userId);
  const generationId = await createGenerationRow(userId, normalized, amount);
  setImmediate(() => { void runVideoGeneration(userId, generationId, normalized, amount, profile, selection.duration, selection.resolution, selection.aspect); });
  return { id: generationId, status: 'preparing', progress: 0 };
}

async function universalCatalog(options = {}) {
  return videoModels.publicCatalog({ all: true, refresh: Boolean(options.refresh) });
}

async function videoHealth() {
  return videoModels.commercialHealth();
}

module.exports = { catalog, internalProfiles, universalCatalog, videoHealth, estimateCredits, recommendModel, generateVideo };
