const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const axios = require('axios');
const ffmpegPath = require('ffmpeg-static');
const prisma = require('../db/prisma');
const env = require('../config/env');
const credits = require('./aiCreditService');
const mediaLibrary = require('./mediaLibraryService');
const { expiresAtFor } = require('./mediaRetentionService');

const MONTHLY_LIMIT = () => Math.max(1, Math.min(100, Number(process.env.STOCK_VIDEO_MONTHLY_LIMIT || 30)));
const CHAT_MODEL = String(process.env.OPENAI_CHAT_MODEL || 'gpt-5.6-luna').trim();
const TTS_MODEL = String(process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts').trim();
const STOCK_TIMEOUT = Math.max(15000, Number(process.env.STOCK_VIDEO_PROVIDER_TIMEOUT_MS || 45000));
const FINAL_MAX_BYTES = 120 * 1024 * 1024;
const activeJobs = new Set();
const pendingJobs = [];
// One native OpenMontage render per Railway worker. Additional requests remain
// durable in AiGeneration and are drained in order without competing for RAM.
const MAX_CONCURRENT_JOBS = () => 1;
const RECOVERY_INTERVAL_MS = 15000;
let recoveryIntervalHandle = null;
let recoveryPassRunning = false;

function publicError(message, code = 'STOCK_VIDEO_ERROR', status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.publicMessage = message;
  return error;
}

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function safeJson(text) {
  const raw = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { return null; }
}

function providerConfig() {
  return {
    pexels: clean(process.env.PEXELS_API_KEY, 500),
    pixabay: clean(process.env.PIXABAY_API_KEY, 500)
  };
}

function isConfigured() {
  return Boolean(env.stockVideo.openMontageUrl && env.stockVideo.openMontageToken);
}

function workerHeaders() {
  return { Authorization: `Bearer ${env.stockVideo.openMontageToken}` };
}

let capabilityCache = { value: null, expiresAt: 0 };
async function workerCapabilities() {
  if (!isConfigured()) return null;
  if (capabilityCache.value && capabilityCache.expiresAt > Date.now()) return capabilityCache.value;
  try {
    const response = await axios.get(`${env.stockVideo.openMontageUrl}/capabilities`, { headers: workerHeaders(), timeout: 30000 });
    capabilityCache = { value: response.data, expiresAt: Date.now() + 5 * 60 * 1000 };
    return response.data;
  } catch (_) { return null; }
}

function dimensions(aspectRatio, resolution) {
  const long = resolution === '1080p' ? 1920 : 1280;
  const short = resolution === '1080p' ? 1080 : 720;
  if (aspectRatio === '16:9') return { width: long, height: short };
  if (aspectRatio === '1:1') return { width: short, height: short };
  return { width: short, height: long };
}

function sentenceParts(value) {
  return clean(value, 12000).split(/(?<=[.!?])\s+/).map(part => part.trim()).filter(Boolean);
}

function limitWords(value, maximum) {
  const words = clean(value, 12000).split(/\s+/).filter(Boolean);
  return words.length <= maximum ? words.join(' ') : `${words.slice(0, maximum).join(' ').replace(/[,:;]$/, '')}.`;
}

function fallbackPlan(input) {
  const duration = Number(input.duration || 30);
  const count = duration <= 15 ? 3 : duration <= 30 ? 5 : duration <= 45 ? 6 : 8;
  const seconds = Math.max(2, duration / count);
  const idea = clean(input.prompt, 1500);
  return {
    title: idea.slice(0, 90),
    caption: idea,
    hashtags: ['video', 'story', 'inxsocial'],
    narration: idea,
    scenes: Array.from({ length: count }, (_, index) => ({
      searchQuery: `${idea} ${['wide establishing shot', 'people detail', 'close up', 'movement', 'ending'][index % 5]}`.slice(0, 100),
      overlay: index === 0 ? idea.slice(0, 90) : '',
      seconds
    }))
  };
}

function normalizePlan(raw, input) {
  const fallback = fallbackPlan(input);
  const duration = Number(input.duration || 30);
  const requested = Array.isArray(raw?.scenes) ? raw.scenes : fallback.scenes;
  const scenes = requested.slice(0, 8).map((scene, index) => ({
    searchQuery: clean(scene?.searchQuery || scene?.query || fallback.scenes[index % fallback.scenes.length].searchQuery, 100),
    overlay: clean(scene?.overlay || scene?.text, 100),
    seconds: Math.max(2, Math.min(12, Number(scene?.seconds || duration / Math.max(3, requested.length))))
  })).filter(scene => scene.searchQuery);
  while (scenes.length < 3) scenes.push(fallback.scenes[scenes.length]);
  const scale = duration / scenes.reduce((total, scene) => total + scene.seconds, 0);
  return {
    title: clean(raw?.title || fallback.title, 120),
    caption: clean(raw?.caption || fallback.caption, 10000),
    hashtags: (Array.isArray(raw?.hashtags) ? raw.hashtags : fallback.hashtags).map(tag => clean(tag, 80).replace(/^#/, '')).filter(Boolean).slice(0, 12),
    narration: limitWords(raw?.narration || raw?.script || fallback.narration, Math.max(24, Math.floor(duration * 2.15))),
    scenes: scenes.map(scene => ({ ...scene, seconds: Math.max(2, Number((scene.seconds * scale).toFixed(2))) }))
  };
}

async function createPlan(input) {
  if (!env.openaiImage?.apiKey || !env.openaiImage?.baseUrl) return fallbackPlan(input);
  try {
    const response = await axios.post(`${String(env.openaiImage.baseUrl).replace(/\/$/, '')}/chat/completions`, {
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: 'You are the planning stage for an OpenMontage-style documentary montage. Turn one user idea into a concise social-video package using only real royalty-free stock footage. Return JSON only with title, caption, hashtags, narration, and 3-8 scenes. Each scene needs searchQuery (2-6 concrete visual keywords, never abstract), overlay (optional, max 8 words), and seconds. The scene seconds must total the requested duration. Avoid claims not supplied by the user.' },
        { role: 'user', content: JSON.stringify({ idea: clean(input.prompt, 1500), duration: input.duration, aspectRatio: input.aspectRatio, tone: input.tone, voiceover: input.voiceover !== false }) }
      ],
      reasoning_effort: 'none',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      max_completion_tokens: 1400
    }, { timeout: 60000, headers: { Authorization: `Bearer ${env.openaiImage.apiKey}`, 'Content-Type': 'application/json' } });
    return normalizePlan(safeJson(response.data?.choices?.[0]?.message?.content), input);
  } catch (_) {
    return normalizePlan(null, input);
  }
}

function bestPexelsFile(video, aspectRatio) {
  const portrait = aspectRatio === '9:16';
  const files = (video?.video_files || []).filter(item => item?.link && Number(item.width) >= 640 && Number(item.height) >= 640);
  const matching = files.filter(item => portrait ? Number(item.height) >= Number(item.width) : aspectRatio === '16:9' ? Number(item.width) >= Number(item.height) : true);
  return (matching.length ? matching : files).sort((a, b) => Math.abs(Number(a.width) - 1280) - Math.abs(Number(b.width) - 1280))[0] || null;
}

async function searchPexels(query, input) {
  const key = providerConfig().pexels;
  if (!key) return [];
  const orientation = input.aspectRatio === '9:16' ? 'portrait' : input.aspectRatio === '16:9' ? 'landscape' : 'square';
  const response = await axios.get('https://api.pexels.com/v1/videos/search', {
    params: { query, orientation, size: 'medium', per_page: 12 },
    timeout: STOCK_TIMEOUT,
    headers: { Authorization: key }
  });
  return (response.data?.videos || []).map(video => {
    const file = bestPexelsFile(video, input.aspectRatio);
    return file ? {
      provider: 'Pexels', providerId: String(video.id), downloadUrl: file.link,
      sourceUrl: video.url, creator: video.user?.name || 'Pexels contributor', creatorUrl: video.user?.url || video.url,
      width: Number(file.width || 0), height: Number(file.height || 0), duration: Number(video.duration || 0)
    } : null;
  }).filter(Boolean);
}

function bestPixabayFile(video, aspectRatio) {
  const choices = Object.values(video?.videos || {}).filter(item => item?.url && Number(item.width) >= 640 && Number(item.height) >= 360);
  const portrait = aspectRatio === '9:16';
  const matching = choices.filter(item => portrait ? Number(item.height) >= Number(item.width) : aspectRatio === '16:9' ? Number(item.width) >= Number(item.height) : true);
  return (matching.length ? matching : choices).sort((a, b) => Math.abs(Number(a.width) - 1280) - Math.abs(Number(b.width) - 1280))[0] || null;
}

async function searchPixabay(query, input) {
  const key = providerConfig().pixabay;
  if (!key) return [];
  const response = await axios.get('https://pixabay.com/api/videos/', {
    params: { key, q: query, per_page: 20, safesearch: true, video_type: 'film' }, timeout: STOCK_TIMEOUT
  });
  return (response.data?.hits || []).map(video => {
    const file = bestPixabayFile(video, input.aspectRatio);
    return file ? {
      provider: 'Pixabay', providerId: String(video.id), downloadUrl: file.url,
      sourceUrl: video.pageURL, creator: video.user || 'Pixabay contributor', creatorUrl: `https://pixabay.com/users/${encodeURIComponent(video.user || '')}-${video.user_id || ''}/`,
      width: Number(file.width || 0), height: Number(file.height || 0), duration: Number(video.duration || 0)
    } : null;
  }).filter(Boolean);
}

async function selectClips(plan, input, onProgress) {
  const used = new Set();
  const selected = [];
  for (let index = 0; index < plan.scenes.length; index += 1) {
    const scene = plan.scenes[index];
    let candidates = [];
    try { candidates = await searchPexels(scene.searchQuery, input); } catch (_) { /* fallback below */ }
    if (!candidates.some(item => !used.has(`${item.provider}:${item.providerId}`))) {
      try { candidates.push(...await searchPixabay(scene.searchQuery, input)); } catch (_) { /* handled below */ }
    }
    const clip = candidates.find(item => !used.has(`${item.provider}:${item.providerId}`));
    if (!clip) throw publicError(`No suitable royalty-free stock clip was found for scene ${index + 1}. Try a broader idea.`, 'STOCK_VIDEO_NO_FOOTAGE', 422);
    used.add(`${clip.provider}:${clip.providerId}`);
    selected.push({ ...scene, ...clip });
    onProgress(12 + Math.round(((index + 1) / plan.scenes.length) * 25));
  }
  return selected;
}

async function download(url, target) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000, maxContentLength: 90 * 1024 * 1024, maxBodyLength: 90 * 1024 * 1024 });
  const data = Buffer.from(response.data || []);
  if (!data.length || data.length > 90 * 1024 * 1024) throw publicError('A stock clip was empty or too large.', 'STOCK_VIDEO_CLIP_INVALID', 502);
  await fs.writeFile(target, data);
}

function srtTimestamp(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function createSrt(narration, duration) {
  const parts = sentenceParts(narration);
  if (!parts.length) return '';
  const weights = parts.map(part => Math.max(1, part.split(/\s+/).length));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return parts.map((part, index) => {
    const seconds = duration * (weights[index] / total);
    const start = cursor;
    cursor += seconds;
    return `${index + 1}\n${srtTimestamp(start)} --> ${srtTimestamp(Math.min(duration, cursor))}\n${part}\n`;
  }).join('\n');
}

async function createNarration(text, outputPath) {
  if (!env.openaiImage?.apiKey || !env.openaiImage?.baseUrl || !clean(text)) return false;
  try {
    const response = await axios.post(`${String(env.openaiImage.baseUrl).replace(/\/$/, '')}/audio/speech`, {
      model: TTS_MODEL, voice: 'alloy', input: clean(text, 4096), response_format: 'mp3'
    }, { responseType: 'arraybuffer', timeout: 120000, headers: { Authorization: `Bearer ${env.openaiImage.apiKey}`, 'Content-Type': 'application/json' } });
    await fs.writeFile(outputPath, Buffer.from(response.data || []));
    return true;
  } catch (_) { return false; }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-12000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with ${code}: ${stderr.slice(-1200)}`)));
  });
}

function subtitleFilter(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

async function composeVideo(workDir, clips, plan, input, onProgress) {
  const { width, height } = dimensions(input.aspectRatio, input.resolution);
  const clipPaths = [];
  for (let index = 0; index < clips.length; index += 1) {
    const target = path.join(workDir, `clip-${index}.mp4`);
    await download(clips[index].downloadUrl, target);
    clipPaths.push(target);
    onProgress(38 + Math.round(((index + 1) / clips.length) * 22));
  }
  const narrationPath = path.join(workDir, 'narration.mp3');
  const hasNarration = input.voiceover !== false && await createNarration(plan.narration, narrationPath);
  const subtitlesPath = path.join(workDir, 'captions.srt');
  if (input.captions !== false && plan.narration) await fs.writeFile(subtitlesPath, createSrt(plan.narration, input.duration), 'utf8');
  const inputs = clipPaths.flatMap(file => ['-i', file]);
  if (hasNarration) inputs.push('-i', narrationPath);
  const filters = clips.map((clip, index) => `[${index}:v]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=${clip.seconds},trim=duration=${clip.seconds},format=yuv420p[v${index}]`);
  filters.push(`${clips.map((_, index) => `[v${index}]`).join('')}concat=n=${clips.length}:v=1:a=0[base]`);
  const hasSubtitles = input.captions !== false && Boolean(plan.narration);
  if (hasSubtitles) filters.push(`[base]subtitles='${subtitleFilter(subtitlesPath)}':force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&HAA000000,BorderStyle=3,Outline=2,Shadow=0,MarginV=55,Alignment=2'[vout]`);
  const outputPath = path.join(workDir, 'final.mp4');
  const args = ['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', hasSubtitles ? '[vout]' : '[base]'];
  if (hasNarration) args.push('-map', `${clips.length}:a`, '-af', 'apad', '-c:a', 'aac', '-b:a', '160k');
  else args.push('-an');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', input.resolution === '1080p' ? '22' : '24', '-movflags', '+faststart', '-t', String(input.duration), outputPath);
  onProgress(66);
  await runFfmpeg(args);
  onProgress(92);
  return { outputPath, hasNarration };
}

async function quota(userId) {
  const access = await credits.getAccess(userId);
  if (!access.studioEnabled) throw publicError('Stock Video Creator is available on the Plus plan.', 'STOCK_VIDEO_PLUS_REQUIRED', 403);
  const start = access.periodStart ? new Date(access.periodStart) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const end = access.periodEnd ? new Date(access.periodEnd) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));
  const rows = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "AiGeneration" WHERE "userId"=$1 AND "contentType"=$2 AND "createdAt">=$3 AND "createdAt"<$4 AND "status" IN (\'PREPARING\',\'PROCESSING\',\'COMPLETED\')', userId, 'stock_video', start, end);
  const used = Number(rows[0]?.count || 0);
  return { limit: MONTHLY_LIMIT(), used, remaining: Math.max(0, MONTHLY_LIMIT() - used), periodStart: start, periodEnd: end };
}

async function access(userId) {
  const entitlement = await credits.getEntitlement(userId);
  if (!entitlement.studioEnabled) return { enabled: false, configured: isConfigured(), limit: MONTHLY_LIMIT(), used: 0, remaining: 0 };
  void recoverStockVideoJobs();
  const capabilities = await workerCapabilities();
  const activeSources = Array.isArray(capabilities?.professionalSources) ? capabilities.professionalSources : [];
  return { enabled: true, configured: isConfigured() && Boolean(capabilities) && activeSources.length > 0, ...(await quota(userId)),
    providers: { pexels: activeSources.includes('pexels'), pixabay: activeSources.includes('pixabay_video') }, commercialOutput: true,
    runtime: capabilities ? { name: capabilities.runtime, commit: capabilities.commit, pipelines: capabilities.pipelines || [],
      studioWorkflow: capabilities.studioWorkflow || null, providerMenu: capabilities.providerMenu || null } : null };
}

function drainQueue() {
  while (activeJobs.size < MAX_CONCURRENT_JOBS() && pendingJobs.length) {
    const job = pendingJobs.shift();
    if (job) void processJob(job.userId, job.generationId, job.input, job.workerJobId);
  }
}

function enqueueJob(userId, generationId, input, workerJobId = null) {
  if (!pendingJobs.some(job => job.generationId === generationId) && !activeJobs.has(generationId)) {
    pendingJobs.push({ userId, generationId, input, workerJobId: clean(workerJobId, 160) || null });
  }
  drainQueue();
}

function storedRequest(value) {
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) return value;
  try { return JSON.parse(String(value || '{}')); } catch (_) { return {}; }
}

async function recoverStockVideoJobs() {
  if (!isConfigured() || recoveryPassRunning) return;
  recoveryPassRunning = true;
  try {
    // A stale heartbeat means the process that owned the poll loop is gone. The
    // delay also prevents the old and new Railway instances from completing the
    // same job during a rolling deployment overlap.
    const rows = await prisma.$queryRawUnsafe(`
      SELECT "id", "userId", "requestJson", "taskUuid", "status", "errorCode"
      FROM "AiGeneration"
      WHERE "contentType"='stock_video'
        AND "hiddenAt" IS NULL
        AND (
          ("status" IN ('PREPARING','PROCESSING') AND "updatedAt" < CURRENT_TIMESTAMP - INTERVAL '15 seconds')
          OR
          ("status"='FAILED' AND "errorCode"='STOCK_VIDEO_WORKER_INTERRUPTED' AND "completedAt" > CURRENT_TIMESTAMP - INTERVAL '6 hours')
        )
      ORDER BY "createdAt" ASC
      LIMIT 20
    `);
    if (rows.length) console.info('[stock-video] recovering persisted productions', { count: rows.length });
    for (const row of rows) {
      const input = storedRequest(row.requestJson);
      if (!clean(input.prompt, 1500)) {
        await updateJob(row.id, 'FAILED', 0, {
          errorCode: 'STOCK_VIDEO_RECOVERY_INVALID',
          errorMessage: 'This saved video request could not be recovered. Please create it again.',
          completedAt: new Date()
        });
        continue;
      }
      enqueueJob(row.userId, row.id, input, row.taskUuid);
    }
  } catch (error) {
    console.error('[stock-video] recovery pass failed', { error: clean(error?.message, 1000) });
  } finally {
    recoveryPassRunning = false;
  }
}

function startStockVideoRuntime() {
  if (recoveryIntervalHandle) return;
  void recoverStockVideoJobs();
  recoveryIntervalHandle = setInterval(() => { void recoverStockVideoJobs(); }, RECOVERY_INTERVAL_MS);
  recoveryIntervalHandle.unref?.();
}

async function createJob(userId, input) {
  if (!isConfigured()) throw publicError('Stock Video Creator is still preparing. Please try again shortly.', 'STOCK_VIDEO_NOT_CONFIGURED', 503);
  const entitlement = await credits.getEntitlement(userId);
  if (!entitlement.studioEnabled) throw publicError('Stock Video Creator is available on the Plus plan.', 'STOCK_VIDEO_PLUS_REQUIRED', 403);
  const generationId = crypto.randomUUID();
  await prisma.$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE', userId);
    const usage = await quota(userId);
    if (usage.remaining <= 0) throw publicError(`You have used all ${usage.limit} Stock Video Creator renders for this billing period.`, 'STOCK_VIDEO_LIMIT_REACHED', 402);
    await tx.$executeRawUnsafe('INSERT INTO "AiGeneration" ("id","userId","contentType","status","provider","prompt","requestJson","reservedCredits","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)', generationId, userId, 'stock_video', 'PREPARING', 'openmontage-stock', clean(input.prompt, 1500), JSON.stringify(input));
  });
  setImmediate(() => enqueueJob(userId, generationId, input));
  return { id: generationId, status: 'preparing', progress: 1 };
}

async function updateJob(id, status, progress, extra = {}) {
  await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "status"=$2,"progress"=$3,"assetJson"=COALESCE($4,"assetJson"),"responseJson"=COALESCE($5,"responseJson"),"errorCode"=$6,"errorMessage"=$7,"completedAt"=$8,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', id, status, progress, extra.assetJson ? JSON.stringify(extra.assetJson) : null, extra.responseJson ? JSON.stringify(extra.responseJson) : null, extra.errorCode || null, extra.errorMessage || null, extra.completedAt || null);
}

async function startWorkerProduction(input) {
  const started = await axios.post(`${env.stockVideo.openMontageUrl}/jobs`, { ...input, fullRunAuthorized: input.fullRunAuthorized !== false }, { headers: workerHeaders(), timeout: 60000 });
  const workerJobId = String(started.data?.id || '');
  if (!workerJobId) throw publicError('The video engine did not accept this production. Please try again.', 'STOCK_VIDEO_JOB_REJECTED', 502);
  return { workerJobId, workerJob: started.data || {} };
}

async function loadWorkerProduction(workerJobId) {
  try {
    const response = await axios.get(`${env.stockVideo.openMontageUrl}/jobs/${encodeURIComponent(workerJobId)}`, { headers: workerHeaders(), timeout: 30000 });
    return response.data || {};
  } catch (error) {
    if (Number(error?.response?.status || 0) === 404) return null;
    throw error;
  }
}

async function processJob(userId, generationId, input, existingWorkerJobId = null) {
  if (activeJobs.has(generationId)) return;
  activeJobs.add(generationId);
  try {
    await updateJob(generationId, 'PROCESSING', 4);
    let workerJobId = clean(existingWorkerJobId, 160);
    let workerJob = workerJobId ? await loadWorkerProduction(workerJobId) : null;
    if (workerJobId && workerJob) {
      console.info('[stock-video] resumed persisted worker production', { generationId, workerJobId, status: workerJob.status });
    } else {
      if (workerJobId) console.warn('[stock-video] worker state was unavailable; restarting saved production', { generationId, workerJobId });
      const started = await startWorkerProduction(input);
      workerJobId = started.workerJobId;
      workerJob = started.workerJob;
      await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "taskUuid"=$2,"responseJson"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, workerJobId, JSON.stringify({ runtime: 'OpenMontage', workerJobId, stage: 'preflight' }));
    }
    const deadline = Date.now() + env.stockVideo.openMontageTimeoutMs;
    while (Date.now() < deadline) {
      if (workerJob.status === 'completed' || workerJob.status === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 3000));
      const polled = await loadWorkerProduction(workerJobId);
      if (!polled) {
        console.warn('[stock-video] worker lost active state; restarting saved production', { generationId, workerJobId });
        const restarted = await startWorkerProduction(input);
        workerJobId = restarted.workerJobId;
        workerJob = restarted.workerJob;
        await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "taskUuid"=$2,"responseJson"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, workerJobId, JSON.stringify({ runtime: 'OpenMontage', workerJobId, stage: 'preflight', recovered: true }));
        continue;
      }
      workerJob = polled;
      await updateJob(generationId, 'PROCESSING', Math.max(2, Math.min(98, Number(workerJob.progress || 2))), { responseJson: { runtime: 'OpenMontage', workerJobId, stage: workerJob.stage || 'processing', openmontageCommit: workerJob.result?.openmontageCommit } });
      if (workerJob.status === 'completed' || workerJob.status === 'failed') break;
    }
    if (workerJob.status !== 'completed') {
      const internalError = clean(workerJob.error || 'Video engine timeout', 4000);
      console.error('[stock-video] production failed', { generationId, workerJobId, status: workerJob.status, error: internalError });
      const renderingStages = new Set(['assembly', 'color_grade', 'caption_credits', 'final_qa']);
      const publicMessage = renderingStages.has(String(workerJob.stage || ''))
        ? 'Video rendering could not be completed. Please retry; your previous attempt was not counted.'
        : 'Video preparation could not be completed. Please retry; your previous attempt was not counted.';
      throw publicError(publicMessage, workerJob.status === 'failed' ? 'STOCK_VIDEO_PIPELINE_FAILED' : 'STOCK_VIDEO_TIMEOUT', 502);
    }
    const downloadResponse = await axios.get(`${env.stockVideo.openMontageUrl}/jobs/${encodeURIComponent(workerJobId)}/output`, { responseType: 'arraybuffer', headers: workerHeaders(), timeout: 180000, maxContentLength: FINAL_MAX_BYTES, maxBodyLength: FINAL_MAX_BYTES });
    const data = Buffer.from(downloadResponse.data || []);
    if (!data.length || data.length > FINAL_MAX_BYTES) throw publicError('The finished stock video was empty or too large for Media Library.', 'STOCK_VIDEO_OUTPUT_INVALID', 502);
    const result = workerJob.result || {};
    const provenance = Array.isArray(result.provenance) ? result.provenance : [];
    const record = await prisma.agentAsset.create({ data: {
      userId, kind: 'AI_VIDEO', source: 'AI_STUDIO', status: 'READY', originalName: `INXSocial-stock-video-${generationId.slice(0, 8)}.mp4`, mimeType: 'video/mp4', byteSize: data.length,
      checksum: crypto.createHash('sha256').update(data).digest('hex'), prompt: clean(input.prompt, 1500), customerPrompt: clean(input.prompt, 1500),
      generationChoice: JSON.stringify({ runtime: 'OpenMontage', openmontageCommit: result.openmontageCommit, pipeline: result.pipeline, renderer: result.renderer || 'remotion', generationId, workerJobId, duration: input.duration, resolution: input.resolution, aspectRatio: input.aspectRatio, provenance }),
      tagsJson: JSON.stringify(['ai-assisted', 'stock-video', 'openmontage', ...new Set(provenance.map(item => String(item.provider || '').toLowerCase()).filter(Boolean))]), data, durationSeconds: input.duration,
      expiresAt: expiresAtFor('video/mp4')
    }});
    const media = mediaLibrary.publicAsset(record);
    const caption = clean(result.caption || input.prompt, 10000);
    const captionTags = new Set((caption.match(/#[A-Za-z0-9_]+/g) || []).map(tag => tag.slice(1).toLowerCase()));
    const asset = {
      id: record.id, type: 'video', url: media.fileUrl, prompt: clean(input.prompt, 1500), caption,
      hashtags: Array.isArray(result.hashtags) ? result.hashtags.filter(tag => !captionTags.has(String(tag).replace(/^#/, '').toLowerCase())) : [], creditsUsed: 0, createdAt: record.createdAt.toISOString(), provider: 'OpenMontage',
      model: result.pipeline || 'INX Stock Montage', aspectRatio: input.aspectRatio, mediaLibraryAssetId: record.id, script: clean(result.script, 10000),
      completionStatus: 'completed', provenance, expiresAt: record.expiresAt.toISOString(), retentionDays: 10,
      warnings: Array.isArray(result.warnings) ? result.warnings : []
    };
    await updateJob(generationId, 'COMPLETED', 100, { assetJson: asset, responseJson: { runtime: 'OpenMontage', openmontageCommit: result.openmontageCommit, pipeline: result.pipeline, renderer: result.renderer || 'remotion', provenance }, completedAt: new Date() });
  } catch (caught) {
    console.error('[stock-video] job error', { generationId, code: caught?.code || 'STOCK_VIDEO_FAILED', error: clean(caught?.message, 4000) });
    await updateJob(generationId, 'FAILED', 0, { errorCode: clean(caught?.code || 'STOCK_VIDEO_FAILED', 120), errorMessage: clean(caught?.publicMessage || caught?.message || 'Stock video creation failed.', 700), completedAt: new Date() }).catch(() => {});
  } finally {
    activeJobs.delete(generationId);
    drainQueue();
  }
}

module.exports = { access, createJob, isConfigured, normalizePlan, createSrt, dimensions, recoverStockVideoJobs, startStockVideoRuntime };
