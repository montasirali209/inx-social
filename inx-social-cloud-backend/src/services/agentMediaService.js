const crypto = require('node:crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const brain = require('./agentBrainService');
const routing = require('./aiModelRoutingService');

function status() {
  return { configured: Boolean(env.ollama.baseUrl && env.ollama.imageModel), generationChoices: ['IMAGE_FAST', 'IMAGE_QUALITY'] };
}

function resolveImageModel(policy, generationChoice) {
  return generationChoice === 'IMAGE_QUALITY' ? policy.qualityModel : policy.model;
}

function imageType(data) {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimeType: 'image/png', extension: 'png' };
  if (data[0] === 0xff && data[1] === 0xd8 && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9) return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') return { mimeType: 'image/webp', extension: 'webp' };
  throw new Error('Ollama returned an unsupported image format.');
}

function plannedPost(plan, index) {
  const task = (plan.tasks || []).find(item => item.type === 'COPY_GENERATION' && item.outputJson);
  try {
    const output = JSON.parse(task?.outputJson || '{}');
    const raw = String(output.content || '');
    const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    return Array.isArray(parsed.posts) ? parsed.posts[index] || null : null;
  } catch (_) { return null; }
}

function imagePrompt(plan, task, index) {
  let strategy = {};
  try { strategy = JSON.parse(plan.strategyJson || '{}'); } catch (_) {}
  const pages = (strategy.pageTargets || []).map(page => page.name).filter(Boolean).join(', ');
  const references = (strategy.referenceAssets || []).map(asset => `${asset.kind}: ${asset.originalName || 'uploaded image'}`).join(', ');
  const post = plannedPost(plan, index);
  return [
    'Create a polished organic social-media visual for one specific post in a coordinated campaign.',
    `Campaign brief: ${plan.prompt}`,
    `Target Pages: ${pages || 'connected brand'}`,
    `Supplied brand files: ${references || 'none; follow only the written brief'}.`,
    `Post ${index + 1} title: ${post?.title || task.title}.`,
    `Post ${index + 1} creative direction: ${post?.visualBrief || post?.objective || post?.caption || 'Create a distinct, relevant concept from the campaign brief'}.`,
    'Make this concept visibly different from the other campaign images. Never create a generic phone, app screen or social-media interface mockup.',
    'Use a clean modern composition with safe margins. Never redraw or invent a supplied logo; preserve the uploaded logo separately for exact placement. Do not fabricate testimonials, prices, people or claims. Do not include platform UI, watermarks, gibberish or tiny unreadable text.'
  ].join(' ');
}

function campaignImagePrompt(plan, post) {
  let strategy = {};
  try { strategy = JSON.parse(plan.strategyJson || '{}'); } catch (_) {}
  const pageNames = (strategy.pageTargets || []).map(page => page.name).filter(Boolean).join(', ');
  return [
    'Create one polished organic social-media visual that belongs to a real branded campaign.',
    `Campaign brief: ${plan.prompt}`,
    `Target Page: ${pageNames || 'connected brand'}`,
    `Post title: ${post.title || `Post ${post.sequence}`}`,
    `Creative direction: ${post.visualBrief || post.caption}`,
    'The visual must be meaningfully specific to this post, not a generic phone or social-media interface mockup.',
    'Use a clean modern composition with safe margins. Do not fabricate logos, testimonials, prices, results, people or claims. Do not include platform UI, watermarks, gibberish, tiny text or unreadable lettering.'
  ].join(' ');
}

async function createGeneratedAsset(plan, prompt, index, options = {}) {
  const http = options.http || axios;
  const response = await http.post(`${env.ollama.baseUrl}/v1/images/generations`, {
    model: options.model,
    prompt,
    size: options.size,
    response_format: 'b64_json'
  }, { timeout: env.ollama.imageTimeoutMs, headers: brain.ollamaHeaders(), maxContentLength: 12 * 1024 * 1024 });
  const encoded = response.data?.data?.[0]?.b64_json;
  if (!encoded) throw new Error('Ollama image generation returned no image data.');
  const data = Buffer.from(encoded, 'base64');
  if (!data.length || data.length > 8 * 1024 * 1024) throw new Error('Generated image was empty or exceeded the 8 MB safety limit.');
  const detected = imageType(data);
  const created = await prisma.agentAsset.create({ data: {
    userId: plan.userId,
    planId: plan.id,
    kind: 'GENERATED_POST',
    source: 'OLLAMA_IMAGE',
    status: 'READY',
    originalName: `inx-agent-${index + 1}.${detected.extension}`,
    mimeType: detected.mimeType,
    byteSize: data.length,
    checksum: crypto.createHash('sha256').update(data).digest('hex'),
    prompt,
    data
  } });
  return { id: created.id, kind: created.kind, mimeType: created.mimeType, byteSize: created.byteSize, contentUrl: `/api/agent/assets/${encodeURIComponent(created.id)}/content` };
}

async function generateImages(plan, task, dependencies = {}) {
  const policy = dependencies.policy || await routing.getImagePolicy();
  if (!policy.enabled) throw Object.assign(new Error('Local image generation is disabled by the administrator.'), { code: 'IMAGE_DISABLED' });
  if (!env.ollama.baseUrl) throw Object.assign(new Error('The private Ollama image gateway is not configured.'), { code: 'OLLAMA_NOT_CONFIGURED' });
  if (typeof prisma.agentAsset?.create !== 'function') throw Object.assign(new Error('Generated asset storage is not available.'), { code: 'ASSET_STORAGE_UNAVAILABLE' });
  let strategy = {};
  try { strategy = JSON.parse(plan.strategyJson || '{}'); } catch (_) {}
  const generationChoice = strategy.mediaModel === 'IMAGE_QUALITY' ? 'IMAGE_QUALITY' : 'IMAGE_FAST';
  const selectedModel = resolveImageModel(policy, generationChoice);
  if (!selectedModel) throw Object.assign(new Error('The selected image-generation mode is not configured.'), { code: 'OLLAMA_NOT_CONFIGURED' });
  const requested = Math.max(1, Number(strategy.assetCount || 1));
  const count = Math.min(requested, policy.maxAssetsPerMission);
  const http = dependencies.http || axios;
  const assets = [];
  for (let index = 0; index < count; index += 1) {
    const prompt = imagePrompt(plan, task, index);
    assets.push(await createGeneratedAsset(plan, prompt, index, { http, model: selectedModel, size: policy.size }));
  }
  return { content: `${assets.length} branded image${assets.length === 1 ? '' : 's'} generated and saved.`, summary: `Generated ${assets.length} of ${requested} requested assets in this bounded local run.`, assets };
}

async function regenerateCampaignImage(plan, post, dependencies = {}) {
  const policy = dependencies.policy || await routing.getImagePolicy();
  if (!policy.enabled) throw Object.assign(new Error('Local image generation is disabled by the administrator.'), { code: 'IMAGE_DISABLED' });
  if (!env.ollama.baseUrl) throw Object.assign(new Error('The private Ollama image gateway is not configured.'), { code: 'OLLAMA_NOT_CONFIGURED' });
  if (typeof prisma.agentAsset?.create !== 'function') throw Object.assign(new Error('Generated asset storage is not available.'), { code: 'ASSET_STORAGE_UNAVAILABLE' });
  let strategy = {};
  try { strategy = JSON.parse(plan.strategyJson || '{}'); } catch (_) {}
  const generationChoice = strategy.mediaModel === 'IMAGE_QUALITY' ? 'IMAGE_QUALITY' : 'IMAGE_FAST';
  const selectedModel = resolveImageModel(policy, generationChoice);
  if (!selectedModel) throw Object.assign(new Error('The selected image-generation mode is not configured.'), { code: 'OLLAMA_NOT_CONFIGURED' });
  return createGeneratedAsset(plan, campaignImagePrompt(plan, post), Number(post.sequence || 1) - 1, { http: dependencies.http || axios, model: selectedModel, size: policy.size });
}

module.exports = { status, imageType, plannedPost, imagePrompt, campaignImagePrompt, resolveImageModel, generateImages, regenerateCampaignImage };
