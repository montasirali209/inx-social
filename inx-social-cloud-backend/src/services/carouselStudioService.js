const crypto = require('node:crypto');
const axios = require('axios');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const env = require('../config/env');
const credits = require('./aiCreditService');
const mediaLibrary = require('./mediaLibraryService');
const { expiresAtFor } = require('./mediaRetentionService');

const REASONING_MODEL = String(process.env.OPENAI_REASONING_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-terra').trim();
const SLIDE_LIMITS = { min: 3, max: 10 };

function publicError(message, code = 'AI_CAROUSEL_ERROR', status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.publicMessage = message;
  return error;
}

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function cleanList(value, maxItems = 20, maxChars = 300) {
  return (Array.isArray(value) ? value : []).map(item => clean(item, maxChars)).filter(Boolean).slice(0, maxItems);
}

function safeJson(text) {
  const source = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(source.slice(start, end + 1)); } catch (_) { return null; }
}

function creditsForSlides(value) {
  const slides = Math.max(SLIDE_LIMITS.min, Math.min(SLIDE_LIMITS.max, Number(value || 5)));
  return slides <= 5 ? 10 : slides <= 8 ? 15 : 20;
}

function sizeForRatio(ratio) {
  if (ratio === '1:1') return '1024x1024';
  if (ratio === '9:16') return '864x1536';
  if (ratio === '16:9') return '1536x864';
  return '1024x1280';
}

function openAIHeaders() {
  return { Authorization: `Bearer ${env.openaiImage.apiKey}`, 'Content-Type': 'application/json' };
}

async function loadReferences(userId, ids) {
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))].slice(0, 4);
  if (!unique.length) return [];
  const rows = await prisma.agentAsset.findMany({
    where: { id: { in: unique }, userId, status: 'READY', archivedAt: null },
    select: { id: true, originalName: true, mimeType: true, data: true }
  });
  return unique.map(id => rows.find(row => row.id === id)).filter(row => row && String(row.mimeType || '').startsWith('image/'));
}

async function planCarousel(input, slides) {
  const brief = input.brief || {};
  const source = input.sourceAnalysis || {};
  const prompt = [
    'You are the senior carousel creative director inside INXSocial.',
    `Create a coherent ${slides}-slide social carousel plan.`,
    'Every slide must advance one narrative. Do not repeat the same claim on multiple slides.',
    'Use only facts supported by the supplied brief/source analysis. Never invent prices, trials, statistics, testimonials or features.',
    'Slide 1 must be a strong hook. The final slide must close with a clear CTA when appropriate.',
    'Keep visible slide copy concise enough for a polished social graphic.',
    'Return JSON only with shape: {"caption":"string","hashtags":["string"],"slides":[{"headline":"string","body":"string","visualDirection":"string"}]}',
    `USER IDEA: ${clean(input.prompt, 1500)}`,
    `PLATFORM: ${clean(input.platform || brief.platform || 'Instagram', 80)}`,
    `ASPECT: ${clean(input.aspectRatio || brief.aspectRatio || '1:1', 20)}`,
    `CREATIVE BRIEF: ${JSON.stringify({ objective: brief.objective, audience: brief.audience, tone: brief.tone, visualStyle: brief.visualStyle, headline: brief.headline, supportingCopy: brief.supportingCopy, cta: brief.cta, visualDirection: brief.visualDirection, caption: brief.caption, hashtags: brief.hashtags })}`,
    `VERIFIED SOURCE ANALYSIS: ${JSON.stringify({ productName: source.productName, summary: source.summary, positioning: source.positioning, verifiedClaims: source.verifiedClaims, visualIdentity: source.visualIdentity, assetObservations: source.assetObservations, strongestAngles: source.strongestAngles, cautions: source.cautions })}`
  ].join('\n');

  let response;
  try {
    response = await axios.post(`${String(env.openaiImage.baseUrl).replace(/\/$/, '')}/chat/completions`, {
      model: REASONING_MODEL,
      messages: [{ role: 'system', content: 'Return valid JSON only. You plan social carousels from verified evidence.' }, { role: 'user', content: prompt }],
      reasoning_effort: 'medium',
      temperature: 0.45,
      response_format: { type: 'json_object' },
      max_completion_tokens: 3200
    }, { timeout: 120000, headers: openAIHeaders(), maxContentLength: 12 * 1024 * 1024 });
  } catch (caught) {
    const status = Number(caught?.response?.status || 502);
    if (status === 429) throw publicError('Carousel planning is busy right now. Please retry in a moment.', 'AI_CAROUSEL_RATE_LIMIT', 429);
    throw publicError('The carousel plan could not be prepared. Please retry.', 'AI_CAROUSEL_PLAN_FAILED', status >= 400 ? status : 502);
  }

  const parsed = safeJson(response.data?.choices?.[0]?.message?.content);
  const planned = Array.isArray(parsed?.slides) ? parsed.slides.slice(0, slides) : [];
  if (planned.length !== slides) throw publicError('The carousel plan was incomplete. Please retry.', 'AI_CAROUSEL_PLAN_INVALID', 502);
  return {
    caption: clean(parsed.caption || brief.caption, 10000),
    hashtags: cleanList(parsed.hashtags || brief.hashtags, 20, 100).map(tag => tag.replace(/^#/, '')),
    slides: planned.map((slide, index) => ({
      index: index + 1,
      headline: clean(slide?.headline, 120),
      body: clean(slide?.body, 260),
      visualDirection: clean(slide?.visualDirection, 1800)
    }))
  };
}

function slidePrompt(input, plan, slide) {
  const brief = input.brief || {};
  const source = input.sourceAnalysis || {};
  return [
    `Create slide ${slide.index} of ${plan.slides.length} in one premium, cohesive social-media carousel.`,
    'This must look like a finished designed campaign slide, not a generic stock illustration.',
    `Exact visible headline: "${slide.headline}".`,
    slide.body ? `Exact supporting copy: "${slide.body}".` : 'Use no supporting paragraph.',
    `Visual direction: ${slide.visualDirection || brief.visualDirection || 'clean brand-led editorial composition'}.`,
    brief.visualStyle ? `Brand style: ${clean(brief.visualStyle, 300)}.` : '',
    source.visualIdentity?.length ? `Verified visual identity: ${source.visualIdentity.join('; ')}.` : '',
    source.assetObservations?.length ? `Reference observations: ${source.assetObservations.join('; ')}.` : '',
    `Maintain consistent typography, spacing, palette, grid and art direction across all ${plan.slides.length} slides.`,
    'If reference images are supplied, use them as authoritative brand/product references. Preserve real logos and recognizable product UI; do not invent or misspell supplied branding.',
    'Keep the composition uncluttered and mobile-readable. Do not add any text other than the exact requested slide copy.'
  ].filter(Boolean).join('\n');
}

async function renderImage(prompt, refs, ratio) {
  const model = env.openaiImage.model || 'gpt-image-2';
  const size = sizeForRatio(ratio);
  let response;
  try {
    if (refs.length) {
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', prompt);
      form.append('size', size);
      form.append('quality', 'medium');
      form.append('output_format', 'png');
      refs.slice(0, 4).forEach((asset, index) => {
        form.append('image[]', new Blob([asset.data], { type: asset.mimeType || 'image/png' }), asset.originalName || `reference-${index + 1}.png`);
      });
      response = await axios.post(`${String(env.openaiImage.baseUrl).replace(/\/$/, '')}/images/edits`, form, {
        timeout: env.openaiImage.timeoutMs,
        headers: { Authorization: `Bearer ${env.openaiImage.apiKey}` },
        maxContentLength: 32 * 1024 * 1024,
        maxBodyLength: 32 * 1024 * 1024
      });
    } else {
      response = await axios.post(`${String(env.openaiImage.baseUrl).replace(/\/$/, '')}/images/generations`, {
        model, prompt, size, quality: 'medium', output_format: 'png', moderation: 'auto', n: 1
      }, { timeout: env.openaiImage.timeoutMs, headers: openAIHeaders(), maxContentLength: 20 * 1024 * 1024 });
    }
    const encoded = response.data?.data?.[0]?.b64_json;
    if (!encoded) throw new Error('No image data returned.');
    const data = Buffer.from(encoded, 'base64');
    if (!data.length || data.length > 18 * 1024 * 1024) throw new Error('Generated image was empty or too large.');
    return { data, model, size };
  } catch (caught) {
    const status = Number(caught?.response?.status || 502);
    if ([500, 502, 503, 504].includes(status)) throw publicError('The image provider had a temporary problem while rendering a carousel slide. Please retry.', 'AI_CAROUSEL_RENDER_FAILED', status);
    throw publicError('A carousel slide could not be rendered. Your reserved credits are returned when the carousel does not complete.', 'AI_CAROUSEL_RENDER_FAILED', status >= 400 ? status : 502);
  }
}

async function createGenerationRow(userId, input, amount) {
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    'INSERT INTO "AiGeneration" ("id","userId","contentType","status","provider","prompt","requestJson","reservedCredits","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
    id, userId, 'carousel_post', 'PREPARING', 'openai', clean(input.prompt, 1500), JSON.stringify(input)
  );
  await credits.reserve(userId, id, amount);
  return id;
}

async function persistSlide(userId, generationId, output, input, plan, slide, amount) {
  const metadata = await sharp(output.data).metadata().catch(() => ({}));
  const checksum = crypto.createHash('sha256').update(output.data).digest('hex');
  const record = await prisma.agentAsset.create({
    data: {
      userId,
      kind: 'AI_IMAGE',
      source: 'AI_STUDIO',
      status: 'READY',
      originalName: `INXSocial-carousel-${generationId.slice(0, 8)}-${slide.index}.png`,
      mimeType: 'image/png',
      byteSize: output.data.length,
      checksum,
      prompt: slide.visualDirection,
      customerPrompt: clean(input.prompt, 1500),
      generationChoice: JSON.stringify({ provider: 'openai', model: output.model, aspectRatio: input.aspectRatio || input.brief?.aspectRatio || '1:1', generationId, slide: slide.index }),
      tagsJson: JSON.stringify(['ai-generated', 'ai-content-studio', 'carousel-post', `slide-${slide.index}`]),
      data: output.data,
      width: Number(metadata.width || 0) || null,
      height: Number(metadata.height || 0) || null,
      expiresAt: expiresAtFor('image/png')
    }
  });
  const publicAsset = mediaLibrary.publicAsset(record);
  return {
    id: record.id,
    type: 'image',
    url: publicAsset.fileUrl,
    thumbnailUrl: publicAsset.thumbnailUrl,
    prompt: clean(input.prompt, 1500),
    caption: plan.caption,
    hashtags: plan.hashtags,
    altText: `${slide.headline}${slide.body ? `. ${slide.body}` : ''}`,
    creditsUsed: amount,
    createdAt: record.createdAt.toISOString(),
    aspectRatio: input.aspectRatio || input.brief?.aspectRatio || '1:1',
    mediaLibraryAssetId: record.id
  };
}

async function generateCarousel(userId, input = {}) {
  if (!env.openaiImage?.apiKey) throw publicError('Carousel generation is temporarily unavailable.', 'AI_CAROUSEL_NOT_CONFIGURED', 503);
  const prompt = clean(input.prompt, 1500);
  if (prompt.length < 2) throw publicError('Describe the carousel you want to create.');
  const slides = Math.max(SLIDE_LIMITS.min, Math.min(SLIDE_LIMITS.max, Number(input.slides || 5)));
  const amount = creditsForSlides(slides);
  await credits.getBalance(userId);
  const generationId = await createGenerationRow(userId, { ...input, slides }, amount);
  try {
    await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "status"=$2,"progress"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, 'GENERATING', 8);
    const [plan, refs] = await Promise.all([planCarousel(input, slides), loadReferences(userId, input.referenceAssetIds)]);
    const rendered = [];
    for (let index = 0; index < plan.slides.length; index += 1) {
      const slide = plan.slides[index];
      rendered.push(await renderImage(slidePrompt(input, plan, slide), refs, input.aspectRatio || input.brief?.aspectRatio || '1:1'));
      await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "progress"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', generationId, Math.min(90, 15 + Math.round(((index + 1) / slides) * 70)));
    }
    const slideAssets = [];
    for (let index = 0; index < rendered.length; index += 1) {
      slideAssets.push(await persistSlide(userId, generationId, rendered[index], input, plan, plan.slides[index], amount));
    }
    const asset = {
      id: generationId,
      type: 'carousel',
      url: slideAssets[0]?.url || '',
      thumbnailUrl: slideAssets[0]?.thumbnailUrl,
      prompt,
      caption: plan.caption,
      hashtags: plan.hashtags,
      altText: '',
      creditsUsed: amount,
      createdAt: new Date().toISOString(),
      aspectRatio: input.aspectRatio || input.brief?.aspectRatio || '1:1',
      slides: slideAssets,
      completionStatus: 'completed'
    };
    await credits.complete(userId, generationId, amount);
    await prisma.$executeRawUnsafe(
      'UPDATE "AiGeneration" SET "status"=$2,"progress"=100,"model"=$3,"assetJson"=$4,"responseJson"=$5,"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1',
      generationId, 'COMPLETED', env.openaiImage.model || 'gpt-image-2', JSON.stringify(asset), JSON.stringify({ slides, creditsUsed: amount })
    );
    return asset;
  } catch (caught) {
    await credits.refund(userId, generationId, caught?.code || 'carousel_failed').catch(() => {});
    await prisma.$executeRawUnsafe(
      'UPDATE "AiGeneration" SET "status"=$2,"errorCode"=$3,"errorMessage"=$4,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1',
      generationId, 'FAILED', clean(caught?.code || 'AI_CAROUSEL_FAILED', 120), clean(caught?.publicMessage || caught?.message || 'Carousel generation failed.', 700)
    ).catch(() => {});
    throw caught;
  }
}

module.exports = { creditsForSlides, generateCarousel };
