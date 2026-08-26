const crypto = require('node:crypto');
const axios = require('axios');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const env = require('../config/env');
const brain = require('./agentBrainService');
const routing = require('./aiModelRoutingService');
const branding = require('./agentBrandingService');
const managerIntelligence = require('./socialManagerIntelligence');

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

function jsonObject(value) {
  const raw = String(value || '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { return null; }
}

function cleanCustomerPrompt(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function cleanOverlayText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function isFirstPostMission(value) {
  return /\b(?:first|introductory|introduction|welcome|launch)\s+(?:facebook\s+|instagram\s+|social(?:\s+media)?\s+|page\s+)?post\b|\bpost\s+(?:for|on)\s+(?:my|our|the)\s+(?:new|newly\s+created|just\s+created)\s+(?:facebook\s+|social(?:\s+media)?\s+)?page\b/i.test(String(value || ''));
}

function firstPostVisualRule(plan) {
  return isFirstPostMission(plan?.prompt)
    ? 'This is the Page’s first post. Create a premium brand-introduction visual that makes the product’s customer benefit immediately understandable. Use a product-relevant visual metaphor derived from the approved creative direction. Do not turn it into a dashboard advertisement, phone mockup or feature checklist.'
    : '';
}

function escapeXml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

function wrapOverlayText(value, maximum = 30) {
  const words = cleanOverlayText(value).split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maximum && current) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

async function composeExactBranding(plan, data, overlayText, dependencies = {}) {
  if (typeof dependencies.composeImage === 'function') return dependencies.composeImage({ plan, data, overlayText });
  const logo = await branding.exactBrandMark(plan, { http: dependencies.brandHttp });
  const lines = wrapOverlayText(overlayText);
  if (!logo && !lines.length) return data;
  const layers = [];
  if (logo?.data) {
    const logoData = await sharp(Buffer.from(logo.data)).resize({ width: 230, height: 110, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    layers.push({ input: logoData, left: 64, top: 58 });
  }
  if (lines.length) {
    const lineMarkup = lines.map((line, index) => `<tspan x="70" dy="${index ? 64 : 0}">${escapeXml(line)}</tspan>`).join('');
    const panelHeight = 98 + (lines.length * 64);
    const svg = Buffer.from(`<svg width="1080" height="${panelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="1080" height="${panelHeight}" rx="28" fill="rgba(3,12,24,.78)"/><text x="70" y="76" font-family="Arial,Helvetica,sans-serif" font-size="54" font-weight="700" fill="#ffffff">${lineMarkup}</text></svg>`);
    layers.push({ input: svg, left: 0, top: 1350 - panelHeight });
  }
  return sharp(data).resize(1080, 1350, { fit: 'cover', position: 'attention' }).composite(layers).png().toBuffer();
}

async function reviewGeneratedImage(plan, prompt, data, dependencies = {}) {
  if (dependencies.reviewImage === false) return { available: false, approved: true, score: null, issues: [], correction: '', warning: null };
  if (!env.ollama.imageReviewEnabled) return { available: false, approved: false, score: null, issues: ['Automated visual inspection is disabled.'], correction: '', warning: 'Automated visual inspection must be enabled before generated media can be approved.' };
  const http = dependencies.http || axios;
  try {
    const response = await http.post(`${env.ollama.baseUrl}/api/chat`, {
      model: env.ollama.model,
      stream: false,
      think: false,
      keep_alive: '10m',
      format: 'json',
      messages: [{
        role: 'system',
        content: 'You are the INX Social visual quality gate. Inspect the supplied generated image, not hidden reasoning. Reject generic phone or platform-interface mockups, fabricated or altered logos, gibberish, misspelled or unreadable lettering, watermarks, unsafe cropping, misleading product UI, irrelevant stock imagery, and visuals that fail to communicate the post. Exact logo and headline overlays may be present and must remain crisp and correctly spelled. Return JSON only with approved boolean, score integer 0-100, issues array of short strings, and correction string containing a concise regeneration instruction. A professional, relevant visual without embedded text may pass.'
      }, {
        role: 'user',
        content: `Campaign: ${String(plan.prompt || '').slice(0, 1600)}\nOriginal visual brief: ${String(prompt || '').slice(0, 3000)}\nEvaluate publish readiness.`,
        images: [data.toString('base64')]
      }],
      options: { temperature: 0.05, num_ctx: env.ollama.simpleContext }
    }, { timeout: env.ollama.timeoutMs, headers: brain.ollamaHeaders(), maxContentLength: 2 * 1024 * 1024 });
    const parsed = jsonObject(response.data?.message?.content);
    if (!parsed) throw new Error('Vision review returned invalid JSON.');
    const score = Math.max(0, Math.min(100, Number(parsed.score || 0)));
    const issues = (Array.isArray(parsed.issues) ? parsed.issues : []).map(value => String(value).trim().slice(0, 300)).filter(Boolean).slice(0, 8);
    const approved = Boolean(parsed.approved) && score >= env.ollama.imageReviewMinScore;
    return { available: true, approved, score, issues, correction: String(parsed.correction || '').trim().slice(0, 1200), warning: null };
  } catch (_) {
    return { available: false, approved: false, score: null, issues: ['Automated visual inspection was unavailable.'], correction: '', warning: 'The image was withheld because publish-readiness could not be verified.' };
  }
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
    ...managerIntelligence.playbookForTask('IMAGE_GENERATION'),
    firstPostVisualRule(plan),
    'Make this concept visibly different from the other campaign images. Never create a generic phone, app screen or social-media interface mockup.',
    'Generate only the photographic, illustrative or abstract background layer. Include no words, letters, numbers, logos, badges, app screens, interface panels or watermarks. Exact approved text and the selected brand mark or connected Page profile image are added programmatically after generation. Use a clean modern composition with safe margins and do not fabricate testimonials, prices, people, results or claims.'
  ].join(' ');
}

function campaignImagePrompt(plan, post, input = {}) {
  let strategy = {};
  try { strategy = JSON.parse(plan.strategyJson || '{}'); } catch (_) {}
  const pageNames = (strategy.pageTargets || []).map(page => page.name).filter(Boolean).join(', ');
  return [
    'Create one polished organic social-media visual that belongs to a real branded campaign.',
    `Campaign brief: ${plan.prompt}`,
    `Target Page: ${pageNames || 'connected brand'}`,
    `Post title: ${post.title || `Post ${post.sequence}`}`,
    `Creative direction: ${post.visualBrief || post.caption}`,
    cleanCustomerPrompt(input.customerPrompt) ? `Customer-requested change: ${cleanCustomerPrompt(input.customerPrompt)}` : '',
    ...managerIntelligence.playbookForTask('IMAGE_GENERATION'),
    firstPostVisualRule(plan),
    'The visual must be meaningfully specific to this post, not a generic phone or social-media interface mockup.',
    'Generate only the photographic, illustrative or abstract background layer. Include no words, letters, numbers, logos, badges, app screens, interface panels or watermarks. Exact approved text and the selected brand mark or connected Page profile image are added programmatically after generation. Use a clean modern composition with safe margins and do not fabricate testimonials, prices, results, people or claims.'
  ].filter(Boolean).join(' ');
}

async function createGeneratedAsset(plan, prompt, index, options = {}) {
  const http = options.http || axios;
  const generate = async finalPrompt => {
    let response;
    try {
      response = await http.post(`${env.ollama.baseUrl}/v1/images/generations`, {
        model: options.model,
        prompt: finalPrompt,
        size: options.size,
        response_format: 'b64_json'
      }, { timeout: env.ollama.imageTimeoutMs, headers: brain.ollamaHeaders(), maxContentLength: 12 * 1024 * 1024 });
    } catch (error) {
      const detail = String(error?.response?.data?.error || '').trim();
      const message = detail || error.message || 'The private image worker could not create this image.';
      throw Object.assign(new Error(message), { code: 'IMAGE_GENERATION_FAILED', status: Number(error?.response?.status || 502) });
    }
    const encoded = response.data?.data?.[0]?.b64_json;
    if (!encoded) throw new Error('Ollama image generation returned no image data.');
    const output = Buffer.from(encoded, 'base64');
    if (!output.length || output.length > 8 * 1024 * 1024) throw new Error('Generated image was empty or exceeded the 8 MB safety limit.');
    return output;
  };
  const createAttempt = async finalPrompt => {
    const generated = await generate(finalPrompt);
    const composed = await composeExactBranding(plan, generated, options.overlayText, options);
    if (!composed.length || composed.length > 8 * 1024 * 1024) throw new Error('The final composed image was empty or exceeded the 8 MB safety limit.');
    return { data: composed, qualityReview: await reviewGeneratedImage(plan, finalPrompt, composed, options) };
  };
  let finalPrompt = prompt;
  let attempt = await createAttempt(finalPrompt);
  let { data, qualityReview } = attempt;
  if (qualityReview.available && !qualityReview.approved) {
    finalPrompt = `${prompt} REQUIRED CORRECTION: ${qualityReview.correction || qualityReview.issues.join('; ') || 'Produce a more specific, professional concept.'} Do not generate any text, letters, numbers, logos or interface elements.`.slice(0, 12000);
    attempt = await createAttempt(finalPrompt);
    data = attempt.data;
    qualityReview = attempt.qualityReview;
  }
  const detected = imageType(data);
  const ready = Boolean(qualityReview.approved);
  const created = await prisma.agentAsset.create({ data: {
    userId: plan.userId,
    planId: plan.id,
    kind: 'GENERATED_POST',
    source: 'OLLAMA_IMAGE',
    status: ready ? 'READY' : 'REJECTED',
    originalName: `inx-agent-${index + 1}.${detected.extension}`,
    mimeType: detected.mimeType,
    byteSize: data.length,
    checksum: crypto.createHash('sha256').update(data).digest('hex'),
    prompt: finalPrompt,
    customerPrompt: cleanCustomerPrompt(options.customerPrompt) || null,
    exactOverlayText: cleanOverlayText(options.overlayText) || null,
    generationChoice: options.generationChoice || null,
    qualityScore: Number.isFinite(qualityReview.score) ? qualityReview.score : null,
    qualityIssuesJson: JSON.stringify(qualityReview.issues || []),
    data
  } });
  return { id: created.id, kind: created.kind, status: created.status, mimeType: created.mimeType, byteSize: created.byteSize, contentUrl: ready ? `/api/agent/assets/${encodeURIComponent(created.id)}/content` : null, qualityReview };
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
    assets.push(await createGeneratedAsset(plan, prompt, index, { http, model: selectedModel, size: policy.size, generationChoice }));
  }
  const readyAssets = assets.filter(asset => asset.status === 'READY');
  const rejectedCount = assets.length - readyAssets.length;
  return {
    content: rejectedCount ? `${readyAssets.length} image${readyAssets.length === 1 ? '' : 's'} passed visual review; ${rejectedCount} unsafe result${rejectedCount === 1 ? ' was' : 's were'} withheld.` : `${readyAssets.length} branded image${readyAssets.length === 1 ? '' : 's'} generated and saved.`,
    summary: rejectedCount ? 'Generated media that failed the final visual review was not made approval-ready.' : `Generated ${readyAssets.length} of ${requested} requested assets in this bounded local run.`,
    assets: readyAssets,
    rejectedCount
  };
}

async function regenerateCampaignImage(plan, post, input = {}, dependencies = {}) {
  const policy = dependencies.policy || await routing.getImagePolicy();
  if (!policy.enabled) throw Object.assign(new Error('Local image generation is disabled by the administrator.'), { code: 'IMAGE_DISABLED' });
  if (!env.ollama.baseUrl) throw Object.assign(new Error('The private Ollama image gateway is not configured.'), { code: 'OLLAMA_NOT_CONFIGURED' });
  if (typeof prisma.agentAsset?.create !== 'function') throw Object.assign(new Error('Generated asset storage is not available.'), { code: 'ASSET_STORAGE_UNAVAILABLE' });
  const requestedChoice = String(input.generationChoice || '').toUpperCase();
  const generationChoice = requestedChoice === 'IMAGE_FAST' ? 'IMAGE_FAST' : 'IMAGE_QUALITY';
  const selectedModel = resolveImageModel(policy, generationChoice);
  if (!selectedModel) throw Object.assign(new Error('The selected image-generation mode is not configured.'), { code: 'OLLAMA_NOT_CONFIGURED' });
  return createGeneratedAsset(plan, campaignImagePrompt(plan, post, input), Number(post.sequence || 1) - 1, {
    http: dependencies.http || axios,
    model: selectedModel,
    size: policy.size,
    generationChoice,
    customerPrompt: cleanCustomerPrompt(input.customerPrompt),
    overlayText: cleanOverlayText(input.overlayText),
    reviewImage: dependencies.reviewImage,
    composeImage: dependencies.composeImage
  });
}

module.exports = { status, imageType, cleanCustomerPrompt, cleanOverlayText, isFirstPostMission, firstPostVisualRule, wrapOverlayText, composeExactBranding, plannedPost, imagePrompt, campaignImagePrompt, resolveImageModel, reviewGeneratedImage, createGeneratedAsset, generateImages, regenerateCampaignImage };
