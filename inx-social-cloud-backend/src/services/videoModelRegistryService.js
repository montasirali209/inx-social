const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const commercialGuard = require('./videoCommercialGuardService');

const REGISTRY_VERSION = 'video-model-registry-v1';
const SETTING_KEY = 'ai_video_model_catalog_v1';
const CONTENT_BASE_URL = 'https://content.runware.ai';
const SCHEMAS_BASE_URL = 'https://schemas.runware.ai';
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const CREDIT_COST_BUFFER = Math.max(1.15, Number(env.videoCommercial?.creditCostBuffer || 1.15));
const NON_NATIVE_STATUSES = new Set(['openai-compatible', 'deprecated', 'retired', 'disabled', 'unavailable', 'archived']);

let memorySnapshot = null;
let refreshPromise = null;
let runtimeTimer = null;
let healthTimer = null;

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function uniq(values) {
  return [...new Set((values || []).filter(value => value !== undefined && value !== null && value !== ''))];
}

function safeJson(value, fallback = null) {
  try { return JSON.parse(String(value || '')); } catch (_) { return fallback; }
}

function legacyProfiles() {
  return [
    {
      id: 'pvideo', air: env.runware.videoEconomyModel || 'prunaai:p-video@2', name: 'P-Video-2', badge: 'Best value', speed: 'fast',
      description: 'Quality-focused generation for everyday social video, with native audio, draft previews and frame guidance.',
      resolutions: ['720p'], durations: [5, 10], aspects: ['9:16', '16:9', '1:1'], fps: [24],
      draftSupported: true, audioSupported: true, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '720p': 0.025 }, draftRates: { '720p': 0.015 },
      tags: ['fast', 'budget', 'quality', 'social', 'reel'], adapterKey: 'PVIDEO2'
    },
    {
      id: 'h3fast', air: 'minimax:h3@fast', name: 'MiniMax H3 Fast', badge: 'Fast references', speed: 'fast',
      description: 'Fast reference-driven video with strong visual continuity for product shots and rapid creative iteration.',
      resolutions: ['480p'], durations: [5, 10, 15], aspects: ['9:16', '16:9', '1:1'], fps: [],
      draftSupported: false, audioSupported: false, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '480p': 0.046 }, tags: ['fast', 'reference', 'product', 'iteration'], adapterKey: 'H3_FAST'
    },
    {
      id: 'kling30', air: 'klingai:kling-video@3-standard', name: 'Kling VIDEO 3.0', badge: 'Balanced + audio', speed: 'balanced',
      description: 'A balanced social-video model with stable motion, strong prompt following and optional synchronized audio.',
      resolutions: ['720p'], durations: [5, 8, 10, 12], aspects: ['9:16', '16:9', '1:1'], fps: [],
      draftSupported: false, audioSupported: true, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '720p': 0.084 }, audioRates: { '720p': 0.126 },
      tags: ['balanced', 'audio', 'people', 'social'], adapterKey: 'KLING30'
    },
    {
      id: 'wan30', air: env.runware.videoLongModel || 'alibaba:wan@3.0', name: 'Wan 3.0', badge: 'Quality', speed: 'quality',
      description: 'High-fidelity generation for polished hero Reels, product storytelling and stronger motion quality.',
      resolutions: ['480p', '720p', '1080p'], durations: [5, 10, 15], aspects: ['9:16', '16:9', '1:1'], fps: [],
      draftSupported: false, audioSupported: true, imageReferenceSupported: true, referenceMode: 'reference',
      rates: { '480p': 0.05, '720p': 0.10, '1080p': 0.20 },
      tags: ['quality', 'product', 'cinematic', 'reference'], adapterKey: 'WAN30'
    },
    {
      id: 'ltx25pro', air: 'lightricks:ltx@2.5-pro', name: 'LTX-2.5 Pro', badge: 'Production', speed: 'balanced',
      description: 'Production-focused video with excellent turnaround, synchronized audio and strong image-to-video control.',
      resolutions: ['720p', '1080p'], durations: [6, 8, 10], aspects: ['9:16', '16:9'], fps: [],
      draftSupported: false, audioSupported: true, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '720p': 0.12, '1080p': 0.17 },
      tags: ['production', 'audio', 'commercial', 'product'], adapterKey: 'LTX25PRO'
    },
    {
      id: 'runway45', air: 'runway:1@2', name: 'Runway Gen-4.5', badge: 'Cinematic', speed: 'quality',
      description: 'Cinematic realistic motion and strong composition for premium visual storytelling.',
      resolutions: ['720p'], durations: [5, 8, 10], aspects: ['9:16', '16:9', '1:1'], fps: [],
      draftSupported: false, audioSupported: false, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '720p': 0.12 }, tags: ['cinematic', 'realistic', 'premium', 'storytelling'], adapterKey: 'RUNWAY45'
    },
    {
      id: 'seedance25', air: 'bytedance:seedance@2.5', name: 'Seedance 2.5', badge: 'Long-form premium', speed: 'premium',
      description: 'Premium multimodal generation for complex branded stories, longer clips and demanding creative direction.',
      resolutions: ['480p', '720p', '1080p'], durations: [5, 10, 15, 20, 30], aspects: ['9:16', '16:9', '1:1'], fps: [],
      draftSupported: false, audioSupported: true, imageReferenceSupported: true, referenceMode: 'frame',
      rates: { '480p': 0.102, '720p': 0.23, '1080p': 0.614 },
      tags: ['premium', 'long-form', 'brand', 'multimodal'], adapterKey: 'SEEDANCE25'
    }
  ].map(profile => ({ ...profile, model: profile.air, provider: 'runware', compatibility: 'ACTIVE', generationReady: true, source: 'compatibility-seed' }));
}

function publicLegacyCatalog() {
  return legacyProfiles().map(({ air, model, referenceMode, rates, draftRates, audioRates, adapterKey, provider, compatibility, generationReady, source, fps, ...item }) => item);
}

function schemaProperty(schema, path) {
  let current = schema;
  for (const key of path) {
    const properties = current?.properties || {};
    current = properties[key];
    if (!current) return null;
  }
  return current || null;
}

function schemaEnum(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node.enum)) return node.enum;
  const options = [...(node.oneOf || []), ...(node.anyOf || [])];
  return uniq(options.flatMap(option => schemaEnum(option)));
}

function numericRange(node, maxSpan = 120) {
  const values = schemaEnum(node).map(Number).filter(Number.isFinite);
  if (values.length) return uniq(values).sort((a, b) => a - b);
  const minimum = Number(node?.minimum ?? node?.min ?? NaN);
  const maximum = Number(node?.maximum ?? node?.max ?? NaN);
  const integer = node?.type === 'integer' || Number.isInteger(Number(node?.default));
  if (Number.isFinite(minimum) && Number.isFinite(maximum) && integer && maximum - minimum <= maxSpan) {
    const output = [];
    for (let value = minimum; value <= maximum; value += 1) output.push(value);
    return output;
  }
  return [];
}

function hasProperty(schema, path) {
  return Boolean(schemaProperty(schema, path));
}

function normalizeCapabilities(model, requestSchema) {
  const raw = uniq(model?.capabilities || []).map(value => clean(value, 120));
  const modes = [];
  if (raw.some(value => /text-to-video/i.test(value))) modes.push('TEXT_TO_VIDEO');
  if (raw.some(value => /image-to-video/i.test(value))) modes.push('IMAGE_TO_VIDEO');
  if (raw.some(value => /video-to-video/i.test(value))) modes.push('VIDEO_TO_VIDEO');
  if (raw.some(value => /audio-to-video/i.test(value))) modes.push('AUDIO_TO_VIDEO');
  if (!modes.length && requestSchema && hasProperty(requestSchema, ['positivePrompt'])) modes.push('TEXT_TO_VIDEO');

  const resolutionNode = schemaProperty(requestSchema, ['resolution']);
  const durationNode = schemaProperty(requestSchema, ['duration']);
  const fpsNode = schemaProperty(requestSchema, ['fps']);
  const resolutionValues = schemaEnum(resolutionNode).map(value => clean(value, 32)).filter(Boolean);
  const durationValues = numericRange(durationNode, 60).filter(value => value > 0 && value <= 120);
  const fpsValues = numericRange(fpsNode, 120).filter(value => value > 0 && value <= 240);
  const topRequired = Array.isArray(requestSchema?.required) ? requestSchema.required : [];
  const allowedRequired = new Set(['taskType', 'taskUUID', 'model', 'positivePrompt']);
  const specialRequired = topRequired.filter(key => !allowedRequired.has(key));

  const supportsFrameImages = hasProperty(requestSchema, ['inputs', 'frameImages']);
  const supportsReferenceImages = hasProperty(requestSchema, ['inputs', 'referenceImages']);
  const supportsInputImage = hasProperty(requestSchema, ['inputs', 'image']);
  const supportsInputVideo = hasProperty(requestSchema, ['inputs', 'video']);
  const supportsInputAudio = hasProperty(requestSchema, ['inputs', 'audio']);
  const supportsAudioSetting = hasProperty(requestSchema, ['settings', 'audio']);
  const supportsDraft = hasProperty(requestSchema, ['settings', 'draft']);
  const supportsWidth = hasProperty(requestSchema, ['width']);
  const supportsHeight = hasProperty(requestSchema, ['height']);
  const supportsResolution = Boolean(resolutionNode);

  return {
    raw,
    modes,
    resolutions: resolutionValues,
    durations: durationValues,
    fps: fpsValues,
    aspects: ['9:16', '16:9', '1:1', '4:5'],
    audioSupported: raw.some(value => /audio|sound/i.test(value)) || supportsAudioSetting || supportsInputAudio,
    draftSupported: supportsDraft,
    imageReferenceSupported: raw.some(value => /image-to-video|reference/i.test(value)) || supportsFrameImages || supportsReferenceImages || supportsInputImage,
    firstFrameSupported: supportsFrameImages,
    lastFrameSupported: supportsFrameImages,
    referenceImagesSupported: supportsReferenceImages,
    inputVideoSupported: supportsInputVideo,
    inputAudioSupported: supportsInputAudio,
    supportsAudioSetting,
    supportsResolution,
    supportsDimensions: supportsWidth && supportsHeight,
    specialRequired,
    schemaResolved: Boolean(requestSchema)
  };
}

function parsePriceNumber(value) {
  const text = String(value || '').replace(/,/g, '');
  const explicit = text.match(/(?:\$|USD\s*)([0-9]+(?:\.[0-9]+)?)/i);
  if (explicit) return Number(explicit[1]);
  const bare = text.match(/\b([0-9]+(?:\.[0-9]+)?)\b/);
  return bare ? Number(bare[1]) : NaN;
}

function parseResolution(configuration) {
  const text = clean(configuration, 240);
  const direct = text.match(/\b(360|480|540|720|768|1080|1440|2160)p\b/i)?.[0];
  if (direct) return direct.toLowerCase();

  const dimensions = text.match(/\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/i);
  if (!dimensions) return null;
  const width = Number(dimensions[1]);
  const height = Number(dimensions[2]);
  const known = [2160, 1440, 1080, 768, 720, 540, 480, 360];
  const edge = known.find(value => value === width || value === height);
  return edge ? String(edge) + 'p' : null;
}

function parseDuration(configuration) {
  const text = clean(configuration, 240);
  const durationMatch = text.match(/\b(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?\b/i);
  return durationMatch ? Number(durationMatch[1]) : null;
}

function pricingMode(configuration) {
  const text = clean(configuration, 240);
  if (/draft/i.test(text)) return 'draft';
  if (/quality/i.test(text)) return 'quality';
  if (/speed|fast|turbo/i.test(text)) return 'speed';
  if (/audio/i.test(text)) return 'audio';
  return 'standard';
}

function explicitPricingUnit(configuration, rawPrice) {
  const text = clean(configuration, 240) + ' ' + clean(rawPrice, 120);
  if (/(?:\/\s*s\b|\/sec\b|per\s+second)/i.test(text)) return 'per_second';
  if (/(?:\/\s*run\b|per\s+run|per\s+request)/i.test(text)) return 'per_request';
  // Runware pricingExamples are complete example-generation prices. Do not
  // reinterpret them as per-second rates just because pricingOverview says
  // the model is generally billed "per second".
  return 'per_request';
}

function parsePricing(pricing) {
  const examples = Array.isArray(pricing?.pricingExamples) ? pricing.pricingExamples : [];
  const overview = clean(pricing?.pricingOverview, 2000);
  const rules = examples.map(example => {
    const configuration = clean(example?.configuration, 240);
    const rawPrice = clean(example?.price, 120);
    const price = parsePriceNumber(rawPrice);
    if (!Number.isFinite(price) || price <= 0) return null;
    return {
      configuration,
      price,
      resolution: parseResolution(configuration),
      duration: parseDuration(configuration),
      mode: pricingMode(configuration),
      unit: explicitPricingUnit(configuration, rawPrice),
      source: 'provider_example'
    };
  }).filter(Boolean);

  return { overview, rules, status: rules.length ? 'SYNCED' : 'UNAVAILABLE' };
}

function ruleModeCompatible(rule, selection) {
  if (selection.draft) return rule.mode === 'draft' || rule.mode === 'standard';
  if (rule.mode === 'draft') return false;
  if (!selection.audio && rule.mode === 'audio') return false;
  return true;
}

function ruleScore(rule, selection) {
  if (!ruleModeCompatible(rule, selection)) return -1;
  let score = 0;
  if (rule.resolution) {
    if (rule.resolution !== selection.resolution) return -1;
    score += 6;
  }
  if (rule.duration) {
    if (Number(rule.duration) !== Number(selection.duration)) return -1;
    score += 6;
  }
  if (selection.draft && rule.mode === 'draft') score += 5;
  else if (selection.audio && rule.mode === 'audio') score += 3;
  else if (rule.mode === 'quality') score += 2;
  else if (rule.mode === 'speed') score += 2;
  else if (rule.mode === 'standard') score += 3;
  return score;
}

function ruleCost(rule, duration) {
  if (!rule || !Number.isFinite(Number(rule.price)) || Number(rule.price) <= 0) return null;
  if (rule.unit === 'per_second') return Number(rule.price) * duration;
  return Number(rule.price);
}

function normalizedPerSecond(rule) {
  if (!rule || !Number.isFinite(Number(rule.price)) || Number(rule.price) <= 0) return null;
  if (rule.unit === 'per_second') return Number(rule.price);
  const ruleDuration = Number(rule.duration || 0);
  if (ruleDuration > 0) return Number(rule.price) / ruleDuration;
  return null;
}

function conservativeDerivedCost(rules, selection) {
  const compatible = rules.filter(rule => ruleModeCompatible(rule, selection));
  if (!compatible.length) return null;

  const sameResolution = compatible.filter(rule => !rule.resolution || rule.resolution === selection.resolution);
  const candidates = sameResolution.length ? sameResolution : compatible;

  // Pricing examples are complete generation costs. When the exact selected
  // configuration is absent, normalize examples with known duration into
  // effective per-second rates and reserve against the highest relevant rate.
  // The successful render is later settled against Runware's actual cost.
  const rates = candidates.map(normalizedPerSecond).filter(value => Number.isFinite(value) && value > 0);
  if (rates.length) return Math.max(...rates) * selection.duration;

  // Some fixed-price models expose only per-request examples without a duration.
  // Reserve against the highest compatible request price rather than blocking.
  const fixed = candidates
    .filter(rule => rule.unit === 'per_request' && !rule.duration)
    .map(rule => Number(rule.price))
    .filter(value => Number.isFinite(value) && value > 0);
  return fixed.length ? Math.max(...fixed) : null;
}

function costFromPricing(profile, selection = {}) {
  const duration = Math.max(1, Number(selection.duration || profile.durations?.[0] || profile.availableDurations?.[0] || 5));
  const resolution = clean(selection.resolution || profile.resolutions?.[0] || profile.availableResolutions?.[0] || '', 32).toLowerCase();
  const draft = Boolean(selection.draft && profile.draftSupported);
  const audio = selection.audio !== false && Boolean(profile.audioSupported);
  const normalizedSelection = { duration, resolution, draft, audio };
  const rules = Array.isArray(profile.pricing?.rules) ? profile.pricing.rules : [];

  const ranked = rules
    .map(rule => ({ rule, score: ruleScore(rule, normalizedSelection) }))
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score);
  if (ranked[0]) {
    const exact = ruleCost(ranked[0].rule, duration);
    if (Number.isFinite(exact) && exact > 0) return exact;
  }

  const rateTable = draft && profile.draftRates ? profile.draftRates : audio && profile.audioRates ? profile.audioRates : profile.rates;
  const rate = Number(rateTable?.[resolution] ?? profile.rates?.[resolution]);
  if (Number.isFinite(rate) && rate > 0) return rate * duration;

  return conservativeDerivedCost(rules, normalizedSelection);
}

function creditsFromUsd(providerCostUsd) {
  const cost = Math.max(0, Number(providerCostUsd || 0));
  return Math.max(1, Math.ceil(cost * 100 * CREDIT_COST_BUFFER));
}

function estimateCredits(profile, selection = {}) {
  const cost = costFromPricing(profile, selection);
  if (!Number.isFinite(cost) || cost <= 0) {
    const error = new Error('Current provider pricing is unavailable for this video model.');
    error.code = 'AI_VIDEO_PRICING_UNAVAILABLE';
    error.status = 503;
    error.publicMessage = 'Current pricing is unavailable for this video model. Choose another model and try again.';
    throw error;
  }
  return commercialGuard.assertEstimate(creditsFromUsd(cost));
}

function mergeLegacyWithLive(legacy, live) {
  if (!live) return { ...legacy, pricing: { status: 'FALLBACK', overview: '', rules: [] }, pricingStatus: 'FALLBACK', schemaResolved: false };
  return {
    ...live,
    ...legacy,
    model: legacy.air,
    air: legacy.air,
    provider: 'runware',
    capabilities: live.capabilities || live.rawCapabilities || [],
    availableResolutions: live.resolutions?.length ? live.resolutions : legacy.resolutions,
    availableDurations: live.durations?.length ? live.durations : legacy.durations,
    availableFps: live.fps || [],
    pricing: live.pricing,
    pricingStatus: live.pricingStatus,
    schemaResolved: live.schemaResolved,
    compatibility: 'ACTIVE',
    generationReady: true,
    source: 'runware-live+compatibility'
  };
}

function normalizeLiveModel(model, pricing, requestSchema) {
  const cap = normalizeCapabilities(model, requestSchema);
  const normalizedPricing = parsePricing(pricing);
  const nativeStatus = !NON_NATIVE_STATUSES.has(clean(model?.status, 80).toLowerCase());
  const hasVideoMode = cap.modes.some(mode => mode.endsWith('_TO_VIDEO'));
  const commonRequest = cap.schemaResolved && cap.specialRequired.length === 0 && hasProperty(requestSchema, ['positivePrompt']);
  const generationReady = Boolean(nativeStatus && hasVideoMode && commonRequest && normalizedPricing.rules.length);
  return {
    id: clean(model?.model || model?.air, 180),
    routeId: clean(model?.model || model?.air, 180),
    model: clean(model?.air, 180),
    air: clean(model?.air, 180),
    name: clean(model?.name || model?.model || model?.air, 180),
    creator: clean(model?.creator, 120),
    provider: 'runware',
    status: clean(model?.status, 80),
    releasedAt: model?.releasedAt || null,
    headline: clean(model?.headline, 500),
    description: clean(model?.description || model?.headline, 2000),
    coverImage: clean(model?.coverImage, 2000) || null,
    rawCapabilities: uniq(model?.capabilities || []),
    capabilities: uniq(model?.capabilities || []),
    modes: cap.modes,
    resolutions: cap.resolutions,
    durations: cap.durations,
    fps: cap.fps,
    aspects: cap.aspects,
    audioSupported: cap.audioSupported,
    draftSupported: cap.draftSupported,
    imageReferenceSupported: cap.imageReferenceSupported,
    firstFrameSupported: cap.firstFrameSupported,
    lastFrameSupported: cap.lastFrameSupported,
    referenceImagesSupported: cap.referenceImagesSupported,
    inputVideoSupported: cap.inputVideoSupported,
    inputAudioSupported: cap.inputAudioSupported,
    supportsAudioSetting: cap.supportsAudioSetting,
    supportsResolution: cap.supportsResolution,
    supportsDimensions: cap.supportsDimensions,
    schemaResolved: cap.schemaResolved,
    specialRequired: cap.specialRequired,
    pricing: normalizedPricing,
    pricingStatus: normalizedPricing.status,
    compatibility: generationReady ? 'SCHEMA_READY' : cap.schemaResolved ? 'DISCOVERED' : 'SCHEMA_UNAVAILABLE',
    generationReady,
    source: 'runware-live',
    tags: uniq([model?.creator, ...(model?.capabilities || [])]).map(value => clean(value, 120)).filter(Boolean)
  };
}

async function getJson(url, params) {
  const response = await axios.get(url, { params, timeout: REQUEST_TIMEOUT_MS, maxContentLength: 4 * 1024 * 1024 });
  return response.data;
}

async function listVideoModels() {
  const models = [];
  let offset = 0;
  const limit = 100;
  for (let page = 0; page < 8; page += 1) {
    const payload = await getJson(`${CONTENT_BASE_URL}/models`, { category: 'video', paginate: 'true', limit, offset });
    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
    models.push(...items);
    if (Array.isArray(payload) || items.length < limit || offset + items.length >= Number(payload?.total || 0)) break;
    offset += items.length;
  }
  return models.filter(model => model?.air && !NON_NATIVE_STATUSES.has(clean(model.status, 80).toLowerCase()));
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor; cursor += 1;
      try { results[index] = await mapper(items[index], index); } catch (error) { results[index] = { error }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return results;
}

async function hydrateModel(model) {
  const id = clean(model?.model || model?.air, 180);
  const air = clean(model?.air, 180);
  const [pricingResult, schemaResult] = await Promise.allSettled([
    getJson(`${CONTENT_BASE_URL}/models/${encodeURIComponent(id)}/pricing`),
    getJson(`${SCHEMAS_BASE_URL}/resolve/${encodeURIComponent(air)}`)
  ]);
  const pricing = pricingResult.status === 'fulfilled' ? pricingResult.value : null;
  const requestSchema = schemaResult.status === 'fulfilled' ? schemaResult.value?.requestSchema || null : null;
  return normalizeLiveModel(model, pricing, requestSchema);
}

function buildSnapshot(liveModels = [], source = 'fallback') {
  const legacy = legacyProfiles();
  const byAir = new Map(liveModels.map(model => [model.air, model]));
  const legacyAir = new Set(legacy.map(model => model.air));
  const compatibilityModels = legacy.map(model => mergeLegacyWithLive(model, byAir.get(model.air)));
  const discovered = liveModels.filter(model => !legacyAir.has(model.air));
  const models = [...compatibilityModels, ...discovered];
  return {
    version: REGISTRY_VERSION,
    source,
    syncedAt: new Date().toISOString(),
    provider: 'runware',
    stats: {
      total: models.length,
      compatibility: compatibilityModels.length,
      discovered: discovered.length,
      generationReady: models.filter(model => model.generationReady).length,
      pricingSynced: liveModels.filter(model => model.pricingStatus === 'SYNCED').length,
      schemaResolved: liveModels.filter(model => model.schemaResolved).length
    },
    models
  };
}

function fallbackSnapshot() {
  return buildSnapshot([], 'compatibility-fallback');
}

async function loadStoredSnapshot() {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    const parsed = safeJson(row?.value, null);
    if (parsed?.version === REGISTRY_VERSION && Array.isArray(parsed?.models) && parsed.models.length) return parsed;
  } catch (error) {
    console.warn('[VIDEO MODEL REGISTRY] last-known-good load failed', clean(error?.message, 500));
  }
  return null;
}

async function storeSnapshot(snapshotValue) {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(snapshotValue), description: 'Runware video model catalogue, capabilities and pricing (last-known-good snapshot)' },
    update: { value: JSON.stringify(snapshotValue), description: 'Runware video model catalogue, capabilities and pricing (last-known-good snapshot)' }
  });
}

async function refreshCatalog() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const models = await listVideoModels();
    if (!models.length) throw new Error('Runware public catalogue returned no video models.');
    const hydratedRaw = await mapLimit(models, 8, hydrateModel);
    const hydrated = hydratedRaw.filter(item => item && !item.error && item.air);
    if (!hydrated.length) throw new Error('Runware video catalogue metadata could not be hydrated.');
    const next = buildSnapshot(hydrated, 'runware-live');
    await commercialGuard.reconcileAfterRefresh(next, estimateCredits);
    await storeSnapshot(next);
    memorySnapshot = next;
    const commercialHealth = commercialGuard.health(next);
    console.info('[VIDEO MODEL REGISTRY]', JSON.stringify({ version: next.version, source: next.source, ...next.stats, commercialHealth }));
    if (commercialHealth.status !== 'HEALTHY') console.warn('[VIDEO MODEL HEALTH]', JSON.stringify(commercialHealth));
    return next;
  })().catch(error => {
    console.warn('[VIDEO MODEL REGISTRY] refresh failed; retaining last-known-good catalogue', clean(error?.message, 700));
    return memorySnapshot || fallbackSnapshot();
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function snapshot({ refresh = false } = {}) {
  if (!memorySnapshot) memorySnapshot = await loadStoredSnapshot() || fallbackSnapshot();
  const age = Date.now() - new Date(memorySnapshot.syncedAt || 0).getTime();
  if (refresh) return refreshCatalog();
  if (!Number.isFinite(age) || age >= REFRESH_INTERVAL_MS || memorySnapshot.source === 'compatibility-fallback') void refreshCatalog();
  return memorySnapshot;
}

async function resolveModel(route) {
  const requested = clean(route, 180) || 'pvideo';
  const current = await snapshot();
  const profile = current.models.find(model => model.id === requested || model.routeId === requested || model.air === requested || model.model === requested);
  if (!profile) {
    const error = new Error('Choose a supported video model.');
    error.code = 'AI_VIDEO_MODEL_UNSUPPORTED'; error.status = 422; error.publicMessage = error.message; throw error;
  }
  return profile;
}

async function resolveModelForGeneration(route) {
  const requested = clean(route, 180) || 'pvideo';
  const current = await snapshot();
  commercialGuard.assertFreshSnapshot(current);
  const profile = current.models.find(model => model.id === requested || model.routeId === requested || model.air === requested || model.model === requested);
  if (!profile) {
    const error = new Error('Choose a supported video model.');
    error.code = 'AI_VIDEO_MODEL_UNSUPPORTED'; error.status = 422; error.publicMessage = error.message; throw error;
  }
  if (!profile.generationReady || profile.pricingStatus !== 'SYNCED') {
    const error = new Error('This video model is temporarily unavailable while its provider configuration is being verified.');
    error.code = 'AI_VIDEO_MODEL_NOT_READY'; error.status = 503; error.publicMessage = error.message; throw error;
  }
  commercialGuard.assertModelAllowed(profile);
  return profile;
}

function baselineCredits(model) {
  const durations = model.durations?.length ? model.durations : model.availableDurations || [];
  const resolutions = model.resolutions?.length ? model.resolutions : model.availableResolutions || [];
  const duration = durations.includes(5) ? 5 : durations[0] || 5;
  const resolution = resolutions.includes('720p') ? '720p' : resolutions[0] || '720p';
  try {
    return estimateCredits(model, { duration, resolution, draft: false, audio: Boolean(model.audioSupported) });
  } catch (_) {
    return null;
  }
}

function publicModel(model) {
  const baseline = baselineCredits(model);
  const generationReady = Boolean(
    model.generationReady
    && (model.pricingStatus || model.pricing?.status) === 'SYNCED'
    && Number.isFinite(baseline)
    && baseline > 0
    && !commercialGuard.isBlocked(model)
  );
  return {
    id: model.id,
    routeId: model.routeId || model.id,
    air: model.air,
    name: model.name,
    creator: model.creator || null,
    badge: model.badge || null,
    speed: model.speed || null,
    description: model.description || model.headline || '',
    coverImage: model.coverImage || null,
    releasedAt: model.releasedAt || null,
    modes: model.modes || [],
    resolutions: model.resolutions || [],
    availableResolutions: model.availableResolutions || model.resolutions || [],
    durations: model.durations || [],
    availableDurations: model.availableDurations || model.durations || [],
    fps: model.fps || [],
    availableFps: model.availableFps || model.fps || [],
    aspects: model.aspects || [],
    audioSupported: Boolean(model.audioSupported),
    draftSupported: Boolean(model.draftSupported),
    imageReferenceSupported: Boolean(model.imageReferenceSupported),
    firstFrameSupported: Boolean(model.firstFrameSupported ?? model.imageReferenceSupported),
    lastFrameSupported: Boolean(model.lastFrameSupported),
    referenceImagesSupported: Boolean(model.referenceImagesSupported || model.referenceMode === 'reference'),
    compatibility: model.compatibility || 'DISCOVERED',
    generationReady,
    pricingStatus: model.pricingStatus || model.pricing?.status || 'UNAVAILABLE',
    baselineCredits: Number.isFinite(baseline) && baseline > 0 ? baseline : null,
    tags: model.tags || []
  };
}

async function publicCatalog({ all = false, refresh = false } = {}) {
  const current = await snapshot({ refresh });
  const legacyIds = new Set(legacyProfiles().map(model => model.id));
  const models = all ? current.models : current.models.filter(model => legacyIds.has(model.id));
  const publicModels = models.map(publicModel);
  const health = commercialGuard.health(current);
  return {
    version: current.version,
    source: current.source,
    syncedAt: current.syncedAt,
    stats: {
      ...current.stats,
      generationReady: all ? publicModels.filter(model => model.generationReady).length : current.stats.generationReady
    },
    health,
    models: publicModels
  };
}


async function publicShowcase({ limit = 12, refresh = false } = {}) {
  let current = await snapshot({ refresh });
  if (current.source === 'compatibility-fallback') current = await refreshCatalog();
  const models = current.models
    .map(publicModel)
    .filter(model => model.generationReady)
    .sort((a, b) => {
      const releasedA = Date.parse(a.releasedAt || '') || 0;
      const releasedB = Date.parse(b.releasedAt || '') || 0;
      if (releasedA !== releasedB) return releasedB - releasedA;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 12));
  const creators = [...new Set(models.map(model => model.creator).filter(Boolean))];
  const modeCounts = {
    textToVideo: models.filter(model => model.modes.includes('TEXT_TO_VIDEO')).length,
    imageToVideo: models.filter(model => model.modes.includes('IMAGE_TO_VIDEO')).length,
    referenceToVideo: models.filter(model => model.modes.includes('REFERENCE_TO_VIDEO') || model.referenceImagesSupported).length,
    nativeAudio: models.filter(model => model.audioSupported).length
  };

  return {
    version: current.version,
    source: current.source,
    syncedAt: current.syncedAt,
    generationReady: models.length,
    catalogueTotal: Number(current.stats?.total || 0),
    creatorCount: creators.length,
    modeCounts,
    latest: models.slice(0, safeLimit).map(model => ({
      name: model.name,
      creator: model.creator,
      description: model.description,
      coverImage: model.coverImage,
      releasedAt: model.releasedAt,
      modes: model.modes,
      resolutions: model.resolutions,
      durations: model.durations,
      audioSupported: model.audioSupported,
      draftSupported: model.draftSupported,
      firstFrameSupported: model.firstFrameSupported,
      lastFrameSupported: model.lastFrameSupported,
      referenceImagesSupported: model.referenceImagesSupported,
      baselineCredits: model.baselineCredits,
      tags: model.tags
    }))
  };
}

function validateRepresentativeModels(snapshotValue) {
  const current = snapshotValue || memorySnapshot || fallbackSnapshot();
  const checks = [
    { tier: 'economy', routes: ['pvideo', 'h3fast'] },
    { tier: 'standard', routes: ['kling30', 'wan30', 'ltx25pro'] },
    { tier: 'premium', routes: ['runway45', 'seedance25'] }
  ].map(group => {
    const model = group.routes.map(route => current.models.find(item => item.id === route)).find(Boolean);
    return {
      tier: group.tier,
      ok: Boolean(model?.generationReady && model?.air && model?.resolutions?.length && model?.durations?.length),
      model: model?.air || null,
      route: model?.id || null,
      pricingStatus: model?.pricingStatus || model?.pricing?.status || 'UNAVAILABLE'
    };
  });
  return { ok: checks.every(check => check.ok), checks };
}

async function startRuntime() {
  await commercialGuard.start();
  if (!memorySnapshot) memorySnapshot = await loadStoredSnapshot() || fallbackSnapshot();
  void refreshCatalog();
  if (!runtimeTimer) {
    runtimeTimer = setInterval(() => { void refreshCatalog(); }, REFRESH_INTERVAL_MS);
    runtimeTimer.unref?.();
  }
  if (!healthTimer) {
    healthTimer = setInterval(() => {
      const health = commercialGuard.health(memorySnapshot || fallbackSnapshot());
      if (health.status !== 'HEALTHY') console.warn('[VIDEO MODEL HEALTH]', JSON.stringify(health));
    }, 30 * 60 * 1000);
    healthTimer.unref?.();
  }
  return {
    ...memorySnapshot.stats,
    validation: validateRepresentativeModels(memorySnapshot),
    commercialHealth: commercialGuard.health(memorySnapshot)
  };
}

async function recordActualCost(input) {
  return commercialGuard.recordActualCost(input);
}

async function commercialHealth() {
  const current = await snapshot();
  return commercialGuard.health(current);
}

module.exports = {
  REGISTRY_VERSION,
  CREDIT_COST_BUFFER,
  legacyProfiles,
  publicLegacyCatalog,
  normalizeCapabilities,
  parsePricing,
  parseResolution,
  normalizedPerSecond,
  conservativeDerivedCost,
  costFromPricing,
  creditsFromUsd,
  estimateCredits,
  snapshot,
  refreshCatalog,
  resolveModel,
  resolveModelForGeneration,
  publicCatalog,
  publicShowcase,
  recordActualCost,
  commercialHealth,
  validateRepresentativeModels,
  startRuntime
};
