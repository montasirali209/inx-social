const prisma = require('../db/prisma');
const env = require('../config/env');

const ROUTES = ['default', 'planning', 'copy', 'adaptation', 'scheduling', 'mediaPrompt'];
const PREFIX = 'ai_route_';
const MEDIA_POLICY_KEY = 'media_generation_policy';
const IMAGE_POLICY_KEY = 'image_generation_policy';
const MEDIA_PROVIDERS = ['INX_TEMPLATE', 'LOCAL_WORKER', 'RUNPOD', 'FAL', 'REPLICATE', 'BYTEPLUS', 'OPENAI'];

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
  return {
    enabled: parsed?.enabled !== false,
    provider: 'OLLAMA_IMAGE',
    model: cleanModel(parsed?.model, env.ollama.imageModel),
    size: ['1024x1024', '1024x1536', '1536x1024'].includes(parsed?.size) ? parsed.size : '1024x1024',
    maxAssetsPerMission: Math.max(1, Math.min(4, Number(parsed?.maxAssetsPerMission || 2)))
  };
}

async function getImagePolicy() {
  if (typeof prisma.appSetting?.findUnique !== 'function') return normalizeImagePolicy(null);
  const row = await prisma.appSetting.findUnique({ where: { key: IMAGE_POLICY_KEY } });
  return normalizeImagePolicy(row?.value);
}

async function updateImagePolicy(input) {
  const policy = normalizeImagePolicy(input);
  const value = JSON.stringify(policy);
  await prisma.appSetting.upsert({ where: { key: IMAGE_POLICY_KEY }, create: { key: IMAGE_POLICY_KEY, value, description: 'Local Ollama image-generation policy' }, update: { value, description: 'Local Ollama image-generation policy' } });
  return policy;
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

module.exports = { ROUTES, MEDIA_PROVIDERS, cleanModel, normalizeRoute, getRouting, updateRouting, routeName, routeForTask, normalizeMediaPolicy, getMediaPolicy, updateMediaPolicy, normalizeImagePolicy, getImagePolicy, updateImagePolicy };
