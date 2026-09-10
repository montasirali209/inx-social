const crypto = require('node:crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const credits = require('./aiCreditService');
const runware = require('./runwareService');
const mediaLibrary = require('./mediaLibraryService');

const CONTENT_TYPES = new Set(['image_post', 'carousel_post', 'short_video', 'ugc_ad']);
const IMAGE_ASPECTS = new Set(['1:1', '4:5', '9:16', '16:9']);
const VIDEO_ASPECTS = new Set(['9:16', '4:5', '1:1', '16:9']);
const STANDARD_VIDEO_DURATIONS = new Set([5, 10]);

function error(message, status = 400, code = 'AI_STUDIO_ERROR') {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  value.publicMessage = message;
  return value;
}

function intOption(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function estimateGenerationCost(request) {
  const type = request?.type;
  const options = request?.options || {};
  if (!CONTENT_TYPES.has(type)) throw error('Choose a supported AI Content Studio format.');
  if (type === 'image_post') return 5 * Math.max(1, Math.min(4, intOption(options.variants, 1)));
  if (type === 'carousel_post') {
    const slides = Math.max(3, Math.min(10, intOption(options.slides, 5)));
    return slides <= 5 ? 10 : slides <= 8 ? 15 : 20;
  }
  const duration = intOption(options.duration, type === 'ugc_ad' ? 10 : 5);
  if (!STANDARD_VIDEO_DURATIONS.has(duration)) throw error('Standard AI Studio video generation currently supports 5 or 10 seconds.', 422, 'AI_STUDIO_DURATION_UNSUPPORTED');
  if (type === 'short_video') return duration === 5 ? 15 : 25;
  return 25;
}

function validateGenerationRequest(request) {
  if (!CONTENT_TYPES.has(request?.type)) throw error('Choose a supported AI Content Studio format.');
  const prompt = String(request.prompt || '').trim();
  if (!prompt) throw error('Add a clear generation prompt.');
  if (prompt.length > 1500) throw error('Keep the generation brief under 1,500 characters.');

  const options = request.options || {};
  const aspectRatio = request.aspectRatio || (['short_video', 'ugc_ad'].includes(request.type) ? '9:16' : request.type === 'carousel_post' ? '1:1' : '4:5');
  const allowedAspects = ['short_video', 'ugc_ad'].includes(request.type) ? VIDEO_ASPECTS : IMAGE_ASPECTS;
  if (!allowedAspects.has(aspectRatio)) throw error('Choose a supported aspect ratio.', 422, 'AI_STUDIO_ASPECT_UNSUPPORTED');

  if (request.type === 'image_post') {
    const variants = intOption(options.variants, 1);
    if (variants < 1 || variants > 4) throw error('Image Post supports between 1 and 4 variants.', 422, 'AI_STUDIO_VARIANTS_UNSUPPORTED');
  }

  if (request.type === 'carousel_post') {
    const slides = intOption(options.slides, 5);
    if (slides < 3 || slides > 10) throw error('Carousel Post supports between 3 and 10 slides.', 422, 'AI_STUDIO_SLIDES_UNSUPPORTED');
  }

  if (['short_video', 'ugc_ad'].includes(request.type)) {
    const duration = intOption(options.duration, request.type === 'ugc_ad' ? 10 : 5);
    if (!STANDARD_VIDEO_DURATIONS.has(duration)) throw error('Standard AI Studio video generation currently supports 5 or 10 seconds.', 422, 'AI_STUDIO_DURATION_UNSUPPORTED');
  }

  if (request.type === 'ugc_ad') {
    if (!String(options.productName || '').trim()) throw error('Add the product or service name before generating.', 422, 'AI_STUDIO_PRODUCT_NAME_REQUIRED');
    if (!String(options.productDescription || '').trim()) throw error('Describe what you are promoting before generating.', 422, 'AI_STUDIO_PRODUCT_DESCRIPTION_REQUIRED');
  }

  const needsSource = options.visualSource === 'Uploaded media' || options.visualSource === 'Media Library assets' || options.mediaSource === 'Upload product media' || options.mediaSource === 'Select from Media Library';
  if (needsSource && !options.sourceMediaLibraryAssetId) throw error('Choose or upload the source media before generating.', 422, 'AI_STUDIO_SOURCE_MEDIA_REQUIRED');
  return true;
}

function cleanJson(text) {
  const source = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) throw error('AI copy generation returned an invalid structure.', 502, 'AI_COPY_PARSE_ERROR');
  try { return JSON.parse(source.slice(start, end + 1)); } catch (_) { throw error('AI copy generation returned invalid JSON.', 502, 'AI_COPY_PARSE_ERROR'); }
}

function safeTags(value) {
  return Array.isArray(value) ? value.map(item => String(item).replace(/^#/, '').trim()).filter(Boolean).slice(0, 20) : [];
}

function requestContext(request) {
  const o = request.options || {};
  return [
    `Content type: ${request.type}`,
    `User brief: ${request.prompt}`,
    `Platform: ${request.platform || 'general social media'}`,
    `Goal: ${o.goal || 'engagement'}`,
    `Tone: ${request.tone || 'professional'}`,
    `Visual style: ${o.visualStyle || 'brand-led'}`,
    o.targetAudience ? `Audience: ${o.targetAudience}` : '',
    o.hook ? `Requested hook: ${o.hook}` : '',
    o.offer ? `Offer supplied by user: ${o.offer}` : '',
    o.cta ? `CTA: ${o.cta}` : ''
  ].filter(Boolean).join('\n');
}

function fallbackCopy(request) {
  const o = request.options || {};
  if (request.type === 'carousel_post') {
    const count = Math.max(3, Math.min(10, intOption(o.slides, 5)));
    return {
      caption: '',
      hashtags: [],
      slides: Array.from({ length: count }, (_, index) => ({
        text: '',
        visualPrompt: `${request.prompt}. Coordinated social carousel visual ${index + 1} of ${count}.`
      }))
    };
  }
  if (request.type === 'short_video') {
    return { caption: '', hashtags: [], script: '', visualPrompt: request.prompt };
  }
  if (request.type === 'ugc_ad') {
    return { hook: o.hook || '', script: '', caption: '', cta: o.cta || '', hashtags: [], visualPrompt: request.prompt };
  }
  return {
    caption: '',
    hashtags: [],
    altText: o.generateAltText === false ? '' : request.prompt.slice(0, 300),
    visualPrompt: request.prompt
  };
}

function copyHelpersRequested(request) {
  const o = request.options || {};
  if (request.type === 'image_post') return o.generateCaption !== false || o.generateHashtags !== false || o.generateAltText !== false;
  if (request.type === 'carousel_post') return o.generateCaption !== false || o.generateSlideCopy !== false;
  return true;
}

async function buildCopy(request) {
  const o = request.options || {};
  let specification;
  if (request.type === 'image_post') {
    specification = 'Return JSON only with keys caption (string), hashtags (array of strings without #), altText (string), visualPrompt (string describing a polished text-free social visual).';
  } else if (request.type === 'carousel_post') {
    specification = `Return JSON only with keys caption, hashtags, and slides. slides must contain exactly ${Math.max(3, Math.min(10, intOption(o.slides, 5)))} objects, each with text and visualPrompt. Keep slide text concise and make visual prompts coordinated but individually relevant.`;
  } else if (request.type === 'short_video') {
    specification = 'Return JSON only with keys caption, hashtags, script, visualPrompt. visualPrompt must describe the actual short-form social video, camera/motion and scene. Do not include unsupported claims.';
  } else {
    specification = `Return JSON only with keys hook, script, caption, cta, hashtags, visualPrompt. Write creator-style UGC in the requested format (${o.ugcFormat || 'natural creator-style promotion'}). Only state product facts supplied by the user.`;
  }
  const result = await runware.generateText(`${requestContext(request)}\n\n${specification}`, { maxTokens: request.type === 'carousel_post' ? 2800 : 1800 });
  return { data: cleanJson(result.text), cost: result.cost, model: result.model };
}

async function buildCopySafe(request) {
  if (!copyHelpersRequested(request)) return { data: fallbackCopy(request), cost: 0, model: null, warnings: [] };
  try {
    const result = await buildCopy(request);
    return { ...result, warnings: [] };
  } catch (caught) {
    console.warn('[AI STUDIO COPY FALLBACK]', caught?.code || 'AI_COPY_FAILED', caught?.providerDetail || caught?.message || '');
    return {
      data: fallbackCopy(request),
      cost: 0,
      model: null,
      warnings: ['Media was generated from your original brief, but the optional caption/script helpers were unavailable. You can edit the publishing copy before sending to Posts.']
    };
  }
}

async function loadReference(userId, assetId) {
  if (!assetId) return null;
  const asset = await prisma.agentAsset.findFirst({ where: { id: String(assetId), userId, status: 'READY', archivedAt: null } });
  if (!asset) throw error('The selected Media Library source asset is unavailable.', 404, 'SOURCE_MEDIA_NOT_FOUND');
  if (asset.data.length > 50 * 1024 * 1024) throw error('The source media is too large for AI generation. Choose a file under 50 MB.', 413, 'SOURCE_MEDIA_TOO_LARGE');
  const publicAsset = mediaLibrary.publicAsset(asset);
  const publicUrl = `${String(env.appUrl || env.portalUrl || '').replace(/\/$/, '')}${publicAsset.fileUrl}`;
  return {
    id: asset.id,
    mimeType: asset.mimeType,
    dataUri: String(asset.mimeType || '').startsWith('image/') ? `data:${asset.mimeType};base64,${asset.data.toString('base64')}` : null,
    publicUrl
  };
}

async function downloadProviderAsset(url, type) {
  let response;
  try {
    response = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000, maxContentLength: 100 * 1024 * 1024, maxBodyLength: 100 * 1024 * 1024 });
  } catch (_) {
    throw error('Generated media could not be copied into the INXSocial Media Library.', 502, 'GENERATED_MEDIA_DOWNLOAD_FAILED');
  }
  const data = Buffer.from(response.data);
  if (!data.length) throw error('Generated media was empty.', 502, 'GENERATED_MEDIA_EMPTY');
  return { data, mimeType: String(response.headers['content-type'] || (type === 'video' ? 'video/mp4' : 'image/jpeg')).split(';')[0] };
}

async function persistProviderAsset(userId, generationId, result, meta) {
  const downloaded = await downloadProviderAsset(result.url, meta.type);
  const checksum = crypto.createHash('sha256').update(downloaded.data).digest('hex');
  const extension = meta.type === 'video' ? 'mp4' : downloaded.mimeType.includes('png') ? 'png' : 'jpg';
  const record = await prisma.agentAsset.create({
    data: {
      userId,
      kind: meta.type === 'video' ? 'AI_VIDEO' : 'AI_IMAGE',
      source: 'AI_STUDIO',
      status: 'READY',
      originalName: `INXSocial-${meta.contentType}-${generationId.slice(0, 8)}${meta.index ? `-${meta.index}` : ''}.${extension}`,
      mimeType: downloaded.mimeType,
      byteSize: downloaded.data.length,
      checksum,
      prompt: meta.visualPrompt || meta.prompt,
      customerPrompt: meta.prompt,
      generationChoice: JSON.stringify({ provider: 'runware', model: result.model, aspectRatio: meta.aspectRatio, generationId, providerCostUsd: result.cost || 0, taskUUID: result.taskUUID || null }),
      tagsJson: JSON.stringify(['ai-generated', 'ai-content-studio', meta.contentType]),
      data: downloaded.data,
      width: result.width || null,
      height: result.height || null,
      durationSeconds: result.duration || null
    }
  });
  const publicAsset = mediaLibrary.publicAsset(record);
  return {
    id: record.id,
    type: meta.type,
    url: publicAsset.fileUrl,
    thumbnailUrl: meta.type === 'image' ? publicAsset.thumbnailUrl : undefined,
    prompt: meta.prompt,
    caption: meta.caption || '',
    hashtags: meta.hashtags || [],
    altText: meta.altText || '',
    creditsUsed: meta.creditsUsed,
    createdAt: record.createdAt.toISOString(),
    provider: 'runware',
    model: result.model,
    aspectRatio: meta.aspectRatio,
    mediaLibraryAssetId: record.id,
    script: meta.script,
    hook: meta.hook,
    cta: meta.cta
  };
}

async function createGenerationRow(userId, request, estimatedCredits) {
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    'INSERT INTO "AiGeneration" ("id","userId","contentType","status","provider","prompt","requestJson","reservedCredits","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
    id, userId, request.type, 'PREPARING', 'runware', request.prompt, JSON.stringify(request)
  );
  await credits.reserve(userId, id, estimatedCredits);
  return id;
}

async function updateGeneration(id, userId, patch) {
  const currentRows = await prisma.$queryRawUnsafe('SELECT * FROM "AiGeneration" WHERE "id"=$1 AND "userId"=$2 LIMIT 1', id, userId);
  const current = currentRows[0];
  if (!current) return;
  const values = {
    status: patch.status ?? current.status,
    taskUuid: patch.taskUuid ?? current.taskUuid,
    model: patch.model ?? current.model,
    responseJson: patch.responseJson === undefined ? current.responseJson : JSON.stringify(patch.responseJson),
    providerCostUsd: patch.providerCostUsd ?? current.providerCostUsd,
    progress: patch.progress ?? current.progress,
    assetJson: patch.assetJson === undefined ? current.assetJson : JSON.stringify(patch.assetJson),
    errorCode: patch.errorCode ?? current.errorCode,
    errorMessage: patch.errorMessage ?? current.errorMessage,
    completedAt: patch.completedAt ?? current.completedAt
  };
  await prisma.$executeRawUnsafe(
    'UPDATE "AiGeneration" SET "status"=$3,"taskUuid"=$4,"model"=$5,"responseJson"=$6,"providerCostUsd"=$7,"progress"=$8,"assetJson"=$9,"errorCode"=$10,"errorMessage"=$11,"completedAt"=$12,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "userId"=$2',
    id, userId, values.status, values.taskUuid, values.model, values.responseJson, values.providerCostUsd, values.progress, values.assetJson, values.errorCode, values.errorMessage, values.completedAt
  );
}

async function generate(userId, request) {
  validateGenerationRequest(request);
  await credits.getBalance(userId);
  const estimatedCredits = estimateGenerationCost(request);
  const generationId = await createGenerationRow(userId, request, estimatedCredits);
  let providerCost = 0;
  try {
    await updateGeneration(generationId, userId, { status: 'GENERATING', progress: 8 });
    const copy = await buildCopySafe(request);
    providerCost += copy.cost;
    const data = copy.data;
    const warnings = [...copy.warnings];
    const options = request.options || {};
    let asset;
    let model;

    if (request.type === 'image_post') {
      const variants = Math.max(1, Math.min(4, intOption(options.variants, 1)));
      const prompts = Array.from({ length: variants }, (_, index) => `${data.visualPrompt || request.prompt}\nVisual style: ${options.visualStyle || 'brand-led'}. ${variants > 1 ? `Creative variation ${index + 1} of ${variants}.` : ''} No logos unless explicitly supplied. Avoid text baked into the image unless the brief explicitly requires it.`);
      const generated = await runware.generateImages(prompts, { aspectRatio: request.aspectRatio || '4:5' });
      providerCost += generated.cost;
      model = generated.model;
      const saved = [];
      for (let index = 0; index < generated.images.length; index += 1) {
        saved.push(await persistProviderAsset(userId, generationId, generated.images[index], {
          type: 'image', contentType: request.type, prompt: request.prompt, visualPrompt: prompts[index], aspectRatio: request.aspectRatio || '4:5',
          caption: options.generateCaption === false ? '' : data.caption,
          hashtags: options.generateHashtags === false ? [] : safeTags(data.hashtags),
          altText: options.generateAltText === false ? '' : data.altText,
          creditsUsed: estimatedCredits, index: index + 1
        }));
      }
      asset = saved[0];
      if (saved.length > 1) asset.variants = saved;
    } else if (request.type === 'carousel_post') {
      const count = Math.max(3, Math.min(10, intOption(options.slides, 5)));
      const slides = Array.isArray(data.slides) ? data.slides.slice(0, count) : [];
      while (slides.length < count) slides.push({ text: '', visualPrompt: `${request.prompt}. Coordinated social carousel visual ${slides.length + 1} of ${count}.` });
      const prompts = slides.map((slide, index) => `${slide.visualPrompt || request.prompt}\nThis is slide ${index + 1} of a coordinated ${count}-slide social carousel. Keep the visual family consistent across slides. Do not bake paragraph copy into the image.`);
      const generated = await runware.generateImages(prompts, { aspectRatio: request.aspectRatio || '1:1' });
      providerCost += generated.cost;
      model = generated.model;
      const savedSlides = [];
      for (let index = 0; index < generated.images.length; index += 1) {
        const slideText = options.generateSlideCopy === false ? '' : String(slides[index]?.text || '');
        const saved = await persistProviderAsset(userId, generationId, generated.images[index], {
          type: 'image', contentType: request.type, prompt: request.prompt, visualPrompt: prompts[index], aspectRatio: request.aspectRatio || '1:1', caption: slideText, hashtags: [], altText: slideText, creditsUsed: estimatedCredits, index: index + 1
        });
        savedSlides.push(saved);
      }
      asset = {
        id: generationId,
        type: 'carousel',
        url: savedSlides[0]?.url || '',
        thumbnailUrl: savedSlides[0]?.thumbnailUrl,
        prompt: request.prompt,
        caption: options.generateCaption === false ? '' : String(data.caption || ''),
        hashtags: options.generateCaption === false ? [] : safeTags(data.hashtags),
        creditsUsed: estimatedCredits,
        createdAt: new Date().toISOString(),
        provider: 'runware',
        model,
        aspectRatio: request.aspectRatio || '1:1',
        mediaLibraryAssetId: savedSlides[0]?.mediaLibraryAssetId || null,
        slides: savedSlides
      };
    } else {
      const reference = await loadReference(userId, options.sourceMediaLibraryAssetId);
      const visualPrompt = `${data.visualPrompt || request.prompt}\nFormat: ${request.type === 'ugc_ad' ? options.ugcFormat || 'creator-style UGC' : options.visualStyle || 'short-form social video'}. ${options.subtitles ? 'Leave clean lower-third safe space for social captions.' : ''} ${options.cta ? `End with a visual beat suitable for CTA: ${options.cta}.` : ''}`;
      const duration = intOption(options.duration, request.type === 'ugc_ad' ? 10 : 5);
      const shortUgcModel = request.type === 'ugc_ad' && !reference?.mimeType?.startsWith('video/') ? env.runware.ugcModel : undefined;
      const video = await runware.generateVideo({
        prompt: visualPrompt,
        duration,
        aspectRatio: request.aspectRatio || '9:16',
        audio: options.music === true || options.voiceover === true,
        referenceImage: reference?.mimeType?.startsWith('image/') ? reference.dataUri : null,
        referenceVideo: reference?.mimeType?.startsWith('video/') ? reference.publicUrl : null,
        model: shortUgcModel
      }, progress => { void updateGeneration(generationId, userId, { status: 'PROCESSING', progress, taskUuid: undefined }); });
      providerCost += video.cost;
      model = video.model;
      asset = await persistProviderAsset(userId, generationId, video, {
        type: 'video', contentType: request.type, prompt: request.prompt, visualPrompt, aspectRatio: request.aspectRatio || '9:16', caption: data.caption, hashtags: safeTags(data.hashtags), creditsUsed: estimatedCredits, script: data.script, hook: data.hook, cta: data.cta || options.cta
      });
    }

    asset.warnings = warnings;
    asset.completionStatus = warnings.length ? 'completed_with_warnings' : 'completed';
    await credits.complete(userId, generationId, estimatedCredits);
    await updateGeneration(generationId, userId, {
      status: 'COMPLETED', progress: 100, model, providerCostUsd: providerCost, assetJson: asset,
      responseJson: { providerCostUsd: providerCost, warnings, completionStatus: asset.completionStatus }, completedAt: new Date()
    });
    return asset;
  } catch (caught) {
    await credits.refund(userId, generationId, caught.code || caught.message).catch(() => {});
    await updateGeneration(generationId, userId, { status: 'FAILED', errorCode: caught.code || 'GENERATION_FAILED', errorMessage: String(caught.publicMessage || caught.message || 'Generation failed').slice(0, 1000), completedAt: new Date() }).catch(() => {});
    throw caught;
  }
}

function parseJson(value, fallback) { try { return JSON.parse(value || '') ?? fallback; } catch (_) { return fallback; } }

async function getGeneration(userId, id) {
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM "AiGeneration" WHERE "id"=$1 AND "userId"=$2 LIMIT 1', id, userId);
  const row = rows[0];
  if (!row) throw error('AI generation not found.', 404, 'GENERATION_NOT_FOUND');
  return { id: row.id, status: String(row.status || '').toLowerCase(), progress: Number(row.progress || 0), asset: parseJson(row.assetJson, null), error: row.errorMessage || null };
}

async function cancelGeneration(userId, id) {
  const current = await getGeneration(userId, id);
  if (['completed', 'failed', 'cancelled'].includes(current.status)) return current;
  if (!['preparing'].includes(current.status)) throw error('This provider job is already running and cannot be cancelled safely. You can leave this screen while it finishes.', 409, 'GENERATION_CANNOT_CANCEL');
  await credits.refund(userId, id, 'user_cancelled');
  await updateGeneration(id, userId, { status: 'CANCELLED', errorCode: 'CANCELLED', errorMessage: null, completedAt: new Date() });
  return getGeneration(userId, id);
}

async function history(userId, limit = 50) {
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM "AiGeneration" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2', userId, Math.max(1, Math.min(100, Number(limit || 50))));
  return rows.map(row => ({ id: row.id, type: row.contentType, prompt: row.prompt, createdAt: row.createdAt, creditsUsed: Number(row.creditsUsed || 0), status: String(row.status || '').toLowerCase(), assetUrl: parseJson(row.assetJson, null)?.url || null }));
}

async function hydrateDraft(row) {
  const asset = parseJson(row.assetJson, null);
  const ids = parseJson(row.mediaLibraryAssetIdsJson, []);
  const media = ids.length ? await prisma.agentAsset.findMany({ where: { id: { in: ids }, userId: row.userId, status: 'READY' } }) : [];
  const publicMedia = media.map(mediaLibrary.publicAsset);
  return {
    id: row.id,
    contentType: row.contentType,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl,
    updatedAt: row.updatedAt,
    status: String(row.status || 'DRAFT').toLowerCase() === 'ready' ? 'ready' : 'draft',
    prompt: row.prompt || '',
    caption: row.caption || '',
    hashtags: parseJson(row.hashtagsJson, []),
    altText: row.altText || '',
    asset,
    mediaLibraryAsset: publicMedia[0] || null,
    mediaLibraryAssets: publicMedia
  };
}

async function saveDraft(userId, input) {
  const id = String(input.id || crypto.randomUUID()).slice(0, 100);
  const existing = await prisma.$queryRawUnsafe('SELECT "id" FROM "AiDraft" WHERE "id"=$1 LIMIT 1', id);
  if (existing[0]) {
    await prisma.$executeRawUnsafe('UPDATE "AiDraft" SET "contentType"=$3,"title"=$4,"thumbnailUrl"=$5,"prompt"=$6,"caption"=$7,"hashtagsJson"=$8,"altText"=$9,"assetJson"=$10,"mediaLibraryAssetIdsJson"=$11,"status"=$12,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "userId"=$2', id, userId, input.contentType, String(input.title || 'AI content draft').slice(0, 200), input.thumbnailUrl || null, input.prompt || null, input.caption || null, JSON.stringify(input.hashtags || []), input.altText || null, input.asset ? JSON.stringify(input.asset) : null, JSON.stringify((input.mediaLibraryAssets || []).map(item => item.id).filter(Boolean)), String(input.status || 'draft').toUpperCase());
  } else {
    await prisma.$executeRawUnsafe('INSERT INTO "AiDraft" ("id","userId","contentType","title","thumbnailUrl","prompt","caption","hashtagsJson","altText","assetJson","mediaLibraryAssetIdsJson","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)', id, userId, input.contentType, String(input.title || 'AI content draft').slice(0, 200), input.thumbnailUrl || null, input.prompt || null, input.caption || null, JSON.stringify(input.hashtags || []), input.altText || null, input.asset ? JSON.stringify(input.asset) : null, JSON.stringify((input.mediaLibraryAssets || []).map(item => item.id).filter(Boolean)), String(input.status || 'draft').toUpperCase());
  }
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM "AiDraft" WHERE "id"=$1 AND "userId"=$2 LIMIT 1', id, userId);
  return hydrateDraft(rows[0]);
}

async function recentDrafts(userId, limit = 8) {
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM "AiDraft" WHERE "userId"=$1 ORDER BY "updatedAt" DESC LIMIT $2', userId, Math.max(1, Math.min(40, Number(limit || 8))));
  return Promise.all(rows.map(hydrateDraft));
}

async function deleteDraft(userId, id) {
  await prisma.$executeRawUnsafe('DELETE FROM "AiDraft" WHERE "id"=$1 AND "userId"=$2', id, userId);
  return true;
}

async function sendDraftToPosts(userId, id) {
  await prisma.$executeRawUnsafe('UPDATE "AiDraft" SET "status"=\'READY\',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "userId"=$2', id, userId);
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM "AiDraft" WHERE "id"=$1 AND "userId"=$2 LIMIT 1', id, userId);
  if (!rows[0]) throw error('AI draft not found.', 404, 'DRAFT_NOT_FOUND');
  return hydrateDraft(rows[0]);
}

async function brandKits(userId) {
  const [user, preference] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { businessName: true } }),
    prisma.cloudPreference.findUnique({ where: { userId } })
  ]);
  const settings = parseJson(preference?.settingsJson, {});
  return [{ id: 'workspace-default', name: settings.workspaceName || user?.businessName || 'Workspace Brand', active: true }];
}

module.exports = {
  estimateGenerationCost, validateGenerationRequest, fallbackCopy, generate, getGeneration, cancelGeneration,
  history, saveDraft, recentDrafts, deleteDraft, sendDraftToPosts, brandKits
};