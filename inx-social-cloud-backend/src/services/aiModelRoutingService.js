const prisma = require('../db/prisma');
const env = require('../config/env');

const ROUTES = ['default', 'planning', 'copy', 'adaptation', 'scheduling', 'mediaPrompt'];
const PREFIX = 'ai_route_';
const MEDIA_POLICY_KEY = 'media_generation_policy';
const IMAGE_POLICY_KEY = 'image_generation_policy';
const MEDIA_PROVIDERS = ['INX_TEMPLATE', 'LOCAL_WORKER', 'RUNPOD', 'FAL', 'REPLICATE', 'BYTEPLUS', 'OPENAI'];
const IMAGE_ROUTES = ['LOCAL_ONLY', 'OPENAI_PREFERRED', 'LOCAL_THEN_OPENAI'];
const OPENAI_IMAGE_MODELS = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1-mini'];

function cleanModel(value, fallback = '') {
  const model = String(value || '').trim();
  return /^[a-zA-Z0-9._:/-]{1,160}$/.test(model) ? model : fallback;
}

function normalizeRoute(value, fallbackModel = env.ollama.model) {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch (_) { parsed = null; }
  }
  const ollamaModel = cleanModel(parsed?.ollamaModel, fallbackModel);
  const fallbackModelName = cleanModel(parsed?.fallbackModel, env.aiFallback.model);
  return { ollamaModel, fallbackModel: fallbackModelName, fallbackEnabled: Boolean(parsed?.fallbackEnabled && fallbackModelName) };
}

async function getRouting() {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: ROUTES.map(route => PREFIX + route) } } });
  const saved = Object.fromEntries(rows.map(row => [row.key.slice(PREFIX.length), normalizeRoute(row.value)]));
  const defaultRoute = saved.default || normalizeRoute(null);
  return Object.fromEntries(ROUTES.map(route => [route, saved[route] || { ...defaultRoute }]));
}

async function updateRouting(input) {
  const routing = {};
  for (const route of ROUTES) {
    const normalized = normalizeRoute(input?.[route]);
    if (!normalized.ollamaModel) throw Object.assign(new Error(`A valid Ollama model is required for ${route}.`), { status: 400 });
    const value = JSON.stringify(normalized);
    await prisma.appSetting.upsert({
      where: { key: PREFIX + route },
      create: { key: PREFIX + route, value, description: `Ollama-first AI priority route for ${route}` },
      update: { value, description: `Ollama-first AI priority route for ${route}` }
    });
    routing[route] = normalized;
  }
  return routing;
}

function routeName(task) {
  return ({ BRAND_REVIEW: 'planning', CONTENT_STRATEGY: 'planning', COPY_GENERATION: 'copy', PLATFORM_VARIANT: 'adaptation', SCHEDULE: 'scheduling', MEDIA_GENERATION: 'mediaPrompt', IMAGE_GENERATION: 'mediaPrompt', VIDEO_GENERATION: 'mediaPrompt' })[task?.type] || 'default';
}

async function routeForTask(task) {
  const routing = await getRouting();
  return routing[routeName(task)] || routing.default;
}

function normalizeMediaPolicy(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch (_) { parsed = {}; }
  }
  const provider = MEDIA_PROVIDERS.includes(parsed?.provider) ? parsed.provider : 'INX_TEMPLATE';
  const fallbackProvider = MEDIA_PROVIDERS.includes(parsed?.fallbackProvider) ? parsed.fallbackProvider : 'INX_TEMPLATE';
  return {
    enabled: parsed?.enabled !== false,
    paidGenerationAllowed: Boolean(parsed?.paidGenerationAllowed),
    provider,
    model: cleanModel(parsed?.model, provider === 'INX_TEMPLATE' ? 'inx-template-v1' : ''),
    fallbackProvider,
    fallbackModel: cleanModel(parsed?.fallbackModel, fallbackProvider === 'INX_TEMPLATE' ? 'inx-template-v1' : ''),
    maxCostCentsPerAsset: Math.max(0, Math.min(10000, Number(parsed?.maxCostCentsPerAsset || 0)))
  };
}

function normalizeImagePolicy(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch (_) { parsed = {}; }
  }
  const enabled = parsed?.enabled !== false;
  const paidEnabled = Boolean(parsed?.paidEnabled);
  const route = IMAGE_ROUTES.includes(parsed?.route) ? parsed.route : 'LOCAL_ONLY';
  const effectiveRoute = paidEnabled ? (enabled ? route : 'OPENAI_PREFERRED') : 'LOCAL_ONLY';
  const openaiModel = OPENAI_IMAGE_MODELS.includes(parsed?.openaiModel) ? parsed.openaiModel : env.openaiImage.model;
  return {
    enabled,
    provider: effectiveRoute === 'OPENAI_PREFERRED' ? 'OPENAI_IMAGE' : 'OLLAMA_IMAGE',
    route: effectiveRoute,
    model: cleanModel(parsed?.model, env.ollama.imageModel),
    qualityModel: cleanModel(parsed?.qualityModel, process.env.OLLAMA_QUALITY_IMAGE_MODEL || 'x/flux2-klein:4b'),
    size: ['1024x1024', '1024x1536', '1536x1024'].includes(parsed?.size) ? parsed.size : '1024x1536',
    maxAssetsPerMission: Math.max(1, Math.min(4, Number(parsed?.maxAssetsPerMission || 2))),
    paidEnabled,
    openaiModel: OPENAI_IMAGE_MODELS.includes(openaiModel) ? openaiModel : 'gpt-image-2',
    openaiQuality: ['low', 'medium', 'high'].includes(parsed?.openaiQuality) ? parsed.openaiQuality : 'medium',
    maxPaidImagesPerMission: Math.max(1, Math.min(4, Number(parsed?.maxPaidImagesPerMission || 1)))
  };
}

async function getImagePolicy() {
  if (typeof prisma.appSetting?.findUnique !== 'function') return normalizeImagePolicy(null);
  const row = await prisma.appSetting.findUnique({ where: { key: IMAGE_POLICY_KEY } });
  return normalizeImagePolicy(row?.value);
}

async function updateImagePolicy(input) {
  const policy = normalizeImagePolicy(input);
  if (policy.paidEnabled && !env.openaiImage.apiKey) throw Object.assign(new Error('Configure OPENAI_IMAGE_API_KEY or OPENAI_API_KEY before enabling paid image generation.'), { status: 400 });
  const value = JSON.stringify(policy);
  await prisma.appSetting.upsert({ where: { key: IMAGE_POLICY_KEY }, create: { key: IMAGE_POLICY_KEY, value, description: 'Governed local and paid image-generation policy' }, update: { value, description: 'Governed local and paid image-generation policy' } });
  return policy;
}

function imageProviderCapabilities(policy = normalizeImagePolicy(null)) {
  const paidConfigured = Boolean(env.openaiImage.apiKey);
  return {
    localConfigured: Boolean(env.ollama.baseUrl && policy.model && policy.qualityModel),
    paidConfigured,
    premiumAvailable: Boolean(policy.paidEnabled && paidConfigured),
    generationChoices: policy.paidEnabled && paidConfigured ? ['IMAGE_FAST', 'IMAGE_QUALITY', 'IMAGE_PREMIUM'] : ['IMAGE_FAST', 'IMAGE_QUALITY'],
    openaiModels: OPENAI_IMAGE_MODELS
  };
}

async function getMediaPolicy() {
  const row = await prisma.appSetting.findUnique({ where: { key: MEDIA_POLICY_KEY } });
  return normalizeMediaPolicy(row?.value);
}

async function updateMediaPolicy(input) {
  const policy = normalizeMediaPolicy(input);
  if (policy.paidGenerationAllowed && !policy.maxCostCentsPerAsset) throw Object.assign(new Error('Set a per-asset cost ceiling before enabling paid video generation.'), { status: 400 });
  const value = JSON.stringify(policy);
  await prisma.appSetting.upsert({ where: { key: MEDIA_POLICY_KEY }, create: { key: MEDIA_POLICY_KEY, value, description: 'Video generation provider priority and cost guardrail' }, update: { value, description: 'Video generation provider priority and cost guardrail' } });
  return policy;
}

module.exports = { ROUTES, MEDIA_PROVIDERS, IMAGE_ROUTES, OPENAI_IMAGE_MODELS, cleanModel, normalizeRoute, getRouting, updateRouting, routeName, routeForTask, normalizeMediaPolicy, getMediaPolicy, updateMediaPolicy, normalizeImagePolicy, getImagePolicy, updateImagePolicy, imageProviderCapabilities };
