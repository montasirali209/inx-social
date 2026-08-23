const SUPPORTED_PLATFORMS = ['facebook', 'instagram', 'youtube', 'tiktok'];

const PROVIDERS = Object.freeze({
  TEXT_ONLY: { label: 'No media model', estimatedCentsPerAsset: 0, creditsPerAsset: 0, kind: 'text', minimumPlan: 'TRIAL' },
  IMAGE_FAST: { label: 'Fast generation', description: 'Quicker results for everyday social posts.', estimatedCentsPerAsset: 0, creditsPerAsset: 0, kind: 'image', minimumPlan: 'TRIAL' },
  IMAGE_QUALITY: { label: 'Quality generation', description: 'Takes longer and prioritises detail and prompt accuracy.', estimatedCentsPerAsset: 0, creditsPerAsset: 0, kind: 'image', minimumPlan: 'TRIAL' },
  VIDEO_FAST: { label: 'Fast video generation', description: 'Efficient branded motion for routine posts.', estimatedCentsPerAsset: 5, creditsPerAsset: 1, kind: 'template', minimumPlan: 'STARTER' },
  VIDEO_QUALITY: { label: 'Quality video generation', description: 'Higher-detail generated video for campaigns.', estimatedCentsPerAsset: 11, creditsPerAsset: 3, kind: 'generative-video', minimumPlan: 'PRO' }
});

const CONTENT_OUTPUTS = Object.freeze({
  TEXT: { label: 'Text post', mediaKind: 'text' },
  IMAGE: { label: 'Image post', mediaKind: 'image' },
  CAROUSEL: { label: 'Carousel', mediaKind: 'image' },
  VIDEO: { label: 'Video post', mediaKind: 'video' },
  REEL: { label: 'Reel / short video', mediaKind: 'video' }
});

const PLAN_RANK = Object.freeze({ TRIAL: 0, STARTER: 1, PRO: 2, CREATOR: 2, LIFETIME: 3, AGENCY: 3, BUSINESS: 3, ADMIN: 3 });

function cleanPrompt(value) {
  const prompt = String(value || '').replace(/\s+/g, ' ').trim();
  if (prompt.length < 12) throw Object.assign(new Error('Tell the Social Agent what campaign or content you want to create.'), { status: 400 });
  if (prompt.length > 4000) throw Object.assign(new Error('The instruction is too long. Keep it below 4,000 characters.'), { status: 400 });
  return prompt;
}

function normalizePlatforms(input, prompt) {
  const requested = Array.isArray(input) ? input : [];
  const found = requested.map(value => String(value || '').toLowerCase()).filter(value => SUPPORTED_PLATFORMS.includes(value));
  if (!found.length) {
    for (const platform of SUPPORTED_PLATFORMS) {
      if (new RegExp(`\\b${platform}\\b`, 'i').test(prompt)) found.push(platform);
    }
  }
  return [...new Set(found.length ? found : ['facebook'])];
}

function requestedAssetCount(prompt) {
  // Natural requests often put format adjectives between the quantity and noun,
  // for example "3 cinematic vertical videos" or "14 educational posts".
  const matched = prompt.match(/\b(\d{1,3})(?:\s+[a-z-]+){0,3}\s+(?:posts?|videos?|reels?|shorts?|assets?|days?)\b/i);
  return Math.max(1, Math.min(100, Number(matched?.[1] || 1)));
}

function chooseExecutionMode(prompt, requestedMode) {
  const explicit = String(requestedMode || '').toUpperCase();
  if (PROVIDERS[explicit]) return explicit;
  if (/cinematic|realistic|generative video|text[- ]to[- ]video/i.test(prompt)) return 'VIDEO_QUALITY';
  return 'VIDEO_FAST';
}

function normalizeContentOutput(value, prompt) {
  const explicit = String(value || '').toUpperCase();
  if (CONTENT_OUTPUTS[explicit]) return explicit;
  if (/\b(text|copy|caption)s?\s+only\b|\bno\s+(?:image|images|media|video|videos)\b/i.test(prompt)) return 'TEXT';
  if (/\bcarousel\b/i.test(prompt)) return 'CAROUSEL';
  if (/\b(reel|reels|short|shorts)\b/i.test(prompt)) return 'REEL';
  if (/\b(video|videos|animation|animated)\b/i.test(prompt)) return 'VIDEO';
  return 'IMAGE';
}

function normalizeMediaModel(value, contentOutput, prompt) {
  const kind = CONTENT_OUTPUTS[contentOutput].mediaKind;
  if (kind === 'text') return 'TEXT_ONLY';
  const requested = String(value || '').toUpperCase();
  if (kind === 'image') return ['IMAGE_FAST', 'IMAGE_QUALITY'].includes(requested) ? requested : 'IMAGE_FAST';
  if (['template', 'generative-video'].includes(PROVIDERS[requested]?.kind)) return requested;
  return chooseExecutionMode(prompt, requested);
}

function canUseModel(subscriptionPlan, modelCode) {
  const planRank = PLAN_RANK[String(subscriptionPlan || 'TRIAL').toUpperCase()] ?? 0;
  const requiredRank = PLAN_RANK[PROVIDERS[modelCode]?.minimumPlan] ?? 0;
  return planRank >= requiredRank;
}

function mediaCatalog(subscriptionPlan) {
  return Object.entries(PROVIDERS).filter(([, provider]) => provider.customerSelectable !== false).map(([code, provider]) => ({
    code,
    label: provider.label,
    description: provider.description || '',
    kind: provider.kind,
    creditsPerAsset: provider.creditsPerAsset,
    minimumPlan: provider.minimumPlan,
    eligible: canUseModel(subscriptionPlan, code)
  }));
}

function requestsNewPage(prompt) {
  const saysPageAlreadyExists = /\b(?:page|profile)\s+(?:(?:which|that)\s+)?(?:is|was|has\s+been)\s+(?:(?:already|newly|just)\s+)*(?:created|set\s*up|connected)|\b(?:existing|already[- ]connected|newly[- ]created)\s+(?:facebook\s+)?page\b/i.test(prompt);
  if (saysPageAlreadyExists) return false;
  return /\b(?:create|set\s*up|launch|build)\s+(?:an?\s+)?(?:new\s+)?(?:facebook\s+|instagram\s+|youtube\s+|tiktok\s+|social(?:\s+media)?\s+)?page\b/i.test(prompt);
}

function normalizeOperationMode(value) {
  return String(value || '').toUpperCase() === 'AUTOPILOT' ? 'AUTOPILOT' : 'HYBRID';
}

function task(type, title, description, options = {}) {
  return {
    type,
    title,
    description,
    platform: options.platform || null,
    riskLevel: options.riskLevel || 'LOW',
    executionMode: options.executionMode || 'TEXT_ONLY',
    estimatedCostCents: Number(options.estimatedCostCents || 0)
  };
}

function buildPlan(input = {}) {
  const prompt = cleanPrompt(input.prompt);
  const platforms = normalizePlatforms(input.platforms, prompt);
  const assetCount = requestedAssetCount(prompt);
  const contentOutput = normalizeContentOutput(input.contentOutput, prompt);
  const executionMode = normalizeMediaModel(input.mediaModel || input.executionMode, contentOutput, prompt);
  const operationMode = normalizeOperationMode(input.operationMode);
  const provider = PROVIDERS[executionMode];
  if (input.subscriptionPlan && !canUseModel(input.subscriptionPlan, executionMode)) throw Object.assign(new Error(`${provider.label} requires the ${provider.minimumPlan} plan or above.`), { status: 403 });
  const tasks = [];
  const draftOnly = /\b(?:draft|plan)\s+only\b|\bdo\s+not\s+(?:publish|schedule|post)\b|\bno\s+publishing\b/i.test(prompt);
  const wantsVideo = CONTENT_OUTPUTS[contentOutput].mediaKind === 'video';
  const wantsImage = CONTENT_OUTPUTS[contentOutput].mediaKind === 'image';

  tasks.push(task('BRAND_REVIEW', 'Review the brand brief and supplied assets', 'Extract the business name, audience, offer, tone, logo rules and prohibited claims before generating content.'));
  tasks.push(task('WEB_RESEARCH', 'Research current audience and social-search opportunities', 'Check current public sources for audience needs, relevant competitors or alternatives, search language and engagement opportunities. Findings must include source links and never become permanent learning without review.'));

  if (requestsNewPage(prompt)) {
    tasks.push(task('PAGE_SETUP', 'Prepare the social Page setup checklist', 'Page creation and sensitive profile changes remain a guided manual step until the connected platform permission and App Review scope explicitly allow them.', { platform: platforms[0], riskLevel: 'HIGH' }));
  }

  tasks.push(task('CONTENT_STRATEGY', `Create a ${assetCount}-asset content plan`, `Plan ${assetCount} distinct ideas, campaign goals, calls to action and platform-specific formats without fabricating business facts.`));
  if (wantsImage) tasks.push(task('IMAGE_GENERATION', `Generate ${assetCount} branded ${contentOutput === 'CAROUSEL' ? 'carousel' : 'image'} asset${assetCount === 1 ? '' : 's'}`, `${provider.label} will create the visual assets within the administrator-controlled safety limit.`, {
    executionMode,
    operationMode,
    estimatedCostCents: 0,
    riskLevel: 'LOW'
  }));
  if (wantsVideo) tasks.push(task('VIDEO_GENERATION', `Generate ${assetCount} branded ${contentOutput === 'REEL' ? 'Reel' : 'video'} asset${assetCount === 1 ? '' : 's'}`, `${provider.label} is the selected route. Credits and provider availability are re-checked before generation.`, {
    executionMode,
    operationMode,
    estimatedCostCents: provider.estimatedCentsPerAsset * assetCount,
    riskLevel: executionMode === 'VIDEO_FAST' ? 'LOW' : 'MEDIUM'
  }));
  tasks.push(task('COPY_GENERATION', 'Write captions and accessibility text', 'Create platform-specific captions, calls to action, hashtags and alt-text while preserving the approved brand voice.'));

  for (const platform of platforms) {
    tasks.push(task('PLATFORM_VARIANT', `Prepare the ${platform} version`, `Adapt dimensions, duration, metadata and disclosure fields for ${platform}.`, { platform }));
  }

  if (!draftOnly) {
    tasks.push(task('SCHEDULE', 'Propose the publishing calendar', 'Check occupied slots, account limits and timezone rules, then present the exact schedule for approval.', { riskLevel: 'MEDIUM' }));
    tasks.push(task('PUBLISH', 'Publish approved content', 'This external action remains locked until the owner approves the plan and each connected platform is authorized.', { riskLevel: 'HIGH' }));
    tasks.push(task('ANALYTICS', 'Measure results and prepare the next recommendation', 'Collect permitted platform analytics, compare outcomes and store reusable structured lessons.'));
  }

  const sequenced = tasks.map((value, index) => ({ ...value, sequence: index + 1 }));
  return {
    prompt,
    platforms,
    assetCount,
    contentOutput,
    mediaModel: executionMode,
    executionMode,
    operationMode,
    estimatedCostCents: sequenced.reduce((sum, value) => sum + value.estimatedCostCents, 0),
    estimatedCredits: provider.creditsPerAsset * assetCount,
    provider: { code: executionMode, ...provider },
    tasks: sequenced,
    guardrails: [
      operationMode === 'AUTOPILOT' ? 'Organic content is prepared automatically; direct publishing remains locked until the governed platform publishing adapter is connected.' : 'Hybrid mode pauses for explicit approval at the selected review checkpoint before organic publishing.',
      'Paid promotion, advertising spend, Page deletion, ownership and security changes are never automatic.',
      'Platform permissions and commercial-content disclosures are checked at execution time.'
    ]
  };
}

module.exports = { SUPPORTED_PLATFORMS, PROVIDERS, CONTENT_OUTPUTS, buildPlan, cleanPrompt, normalizePlatforms, requestedAssetCount, chooseExecutionMode, normalizeContentOutput, normalizeMediaModel, requestsNewPage, canUseModel, mediaCatalog, normalizeOperationMode };
