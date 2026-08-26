const SUPPORTED_PLATFORMS = ['facebook', 'instagram', 'youtube', 'tiktok'];
const managerIntelligence = require('./socialManagerIntelligence');

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
  const saysTextOnly = /\b(text|copy|caption)s?\s+only\b|\bno\s+(?:image|images|media|video|videos)\b/i.test(prompt);
  const asksForCarousel = /\bcarousel\b/i.test(prompt);
  const asksForReel = /\b(reel|reels|short|shorts)\b/i.test(prompt);
  const asksForVideo = /\b(video|videos|animation|animated)\b/i.test(prompt);
  const asksForImage = /\b(?:create|generate|make|design|include|with|using|need|want)(?:\s+(?:an?|one|the|my|our|branded|professional|premium|quality|related|relevant)){0,5}\s+(?:image|visual|graphic|picture|photo)\b|\b(?:image|visual|graphic|picture|photo)\s+(?:for|with|related|showing|using)\b/i.test(prompt);
  if (saysTextOnly) return 'TEXT';
  if (asksForCarousel) return 'CAROUSEL';
  if (asksForReel) return 'REEL';
  if (asksForVideo) return 'VIDEO';
  if (asksForImage) return 'IMAGE';
  const explicit = String(value || '').toUpperCase();
  if (CONTENT_OUTPUTS[explicit]) return explicit;
  return 'IMAGE';
}

function normalizeMediaModel(value, contentOutput, prompt) {
  const kind = CONTENT_OUTPUTS[contentOutput].mediaKind;
  if (kind === 'text') return 'TEXT_ONLY';
  const requested = String(value || '').toUpperCase();
  if (kind === 'image') return ['IMAGE_FAST', 'IMAGE_QUALITY'].includes(requested) ? requested : 'IMAGE_QUALITY';
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

function needsCurrentResearch(prompt, assetCount = 1) {
  return managerIntelligence.requiresResearch(prompt, assetCount);
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
  const approvalRequested = /\b(?:wait|pause|stop)\s+(?:for|until)\s+(?:my|our|owner|customer)?\s*approval\b|\bdo\s+not\s+(?:schedule|publish|post)[\s\S]{0,50}\b(?:automatically|without\s+(?:my|our|owner|customer)?\s*approval)\b|\b(?:date|time|schedule)[\s\S]{0,35}\bfor\s+(?:my|our|owner|customer)\s+approval\b/i.test(prompt);
  const draftOnly = !approvalRequested && /\b(?:draft|plan)\s+only\b|\bas\s+(?:a\s+)?draft\b|\b(?:save|keep)(?:\s+it)?\s+as\s+(?:a\s+)?draft\b|\bno\s+publishing\b|\bdo\s+not\s+(?:publish|schedule|post)(?:\s+this|\s+anything)?[.!]?$/i.test(prompt);
  const wantsVideo = CONTENT_OUTPUTS[contentOutput].mediaKind === 'video';
  const wantsImage = CONTENT_OUTPUTS[contentOutput].mediaKind === 'image';
  const researchRequired = needsCurrentResearch(prompt, assetCount);

  tasks.push(task('BRAND_REVIEW', 'Understand the Page, brand and service', 'Analyse the connected Page identity, trusted profile image, selected assets, business category, likely official website, customer offer, audience, tone, brand rules and facts that require verification.'));
  if (researchRequired) tasks.push(task('WEB_RESEARCH', 'Research the brand, audience, competitors and social search', 'Ollama prepares the first analysis, then one governed current-web review verifies official service facts, audience needs, competitor positioning, current social-search language, hashtags, content opportunities and publishing-time evidence. Findings include source links and never become permanent learning without review.'));

  if (requestsNewPage(prompt)) {
    tasks.push(task('PAGE_SETUP', 'Prepare the social Page setup checklist', 'Page creation and sensitive profile changes remain a guided manual step until the connected platform permission and App Review scope explicitly allow them.', { platform: platforms[0], riskLevel: 'HIGH' }));
  }

  tasks.push(task('CONTENT_STRATEGY', `Create a ${assetCount}-asset professional content plan`, `Plan ${assetCount} audience-relevant ideas, objectives, hooks, calls to action, social-search themes and platform formats from verified brand and research evidence.`));
  tasks.push(task('COPY_GENERATION', 'Write social-search-ready posts and visual briefs', 'Create distinct publish-ready captions, natural search wording, focused hashtags, service-relevant visual directions and accessibility text while preserving the verified brand voice.'));
  if (wantsImage) tasks.push(task('IMAGE_GENERATION', `Generate ${assetCount} branded ${contentOutput === 'CAROUSEL' ? 'carousel' : 'image'} asset${assetCount === 1 ? '' : 's'}`, `${provider.label} will create the visual assets within the administrator-controlled safety limit.`, {
    executionMode,
    operationMode,
    researchRequired,
    estimatedCostCents: 0,
    riskLevel: 'LOW'
  }));
  if (wantsVideo) tasks.push(task('VIDEO_GENERATION', `Generate ${assetCount} branded ${contentOutput === 'REEL' ? 'Reel' : 'video'} asset${assetCount === 1 ? '' : 's'}`, `${provider.label} is the selected route. Credits and provider availability are re-checked before generation.`, {
    executionMode,
    operationMode,
    estimatedCostCents: provider.estimatedCentsPerAsset * assetCount,
    riskLevel: executionMode === 'VIDEO_FAST' ? 'LOW' : 'MEDIUM'
  }));
  for (const platform of platforms) {
    tasks.push(task('PLATFORM_VARIANT', `Prepare the ${platform} version`, `Adapt dimensions, duration, metadata and disclosure fields for ${platform}.`, { platform }));
  }

  if (!draftOnly) {
    tasks.push(task('SCHEDULE', 'Choose evidence-led publishing times', 'Combine researched audience guidance, saved preferences, occupied slots, account limits, platform lead time and timezone rules, then present the exact schedule for approval.', { riskLevel: 'MEDIUM' }));
  }
  tasks.push(task('PUBLISH', 'Assemble Campaign Review', draftOnly
    ? 'Create the customer-facing Campaign Review with the completed caption and media. Keep publishing disabled because the mission requested a draft only.'
    : 'Create the customer-facing Campaign Review with the completed caption, media and publishing time. External publishing remains locked until the required approval or explicit Autopilot authorization.', { riskLevel: 'HIGH' }));
  if (!draftOnly) tasks.push(task('ANALYTICS', 'Measure results and improve the next post', 'After publication, collect permitted platform analytics, compare outcomes with the objective and send only bounded reusable lessons through administrator review.'));

  const sequenced = tasks.map((value, index) => ({ ...value, sequence: index + 1 }));
  return {
    prompt,
    platforms,
    assetCount,
    contentOutput,
    mediaModel: executionMode,
    executionMode,
    operationMode,
    approvalRequested,
    draftOnly,
    estimatedCostCents: sequenced.reduce((sum, value) => sum + value.estimatedCostCents, 0),
    estimatedCredits: provider.creditsPerAsset * assetCount,
    provider: { code: executionMode, ...provider },
    tasks: sequenced,
    guardrails: [
      approvalRequested || operationMode !== 'AUTOPILOT' ? 'Campaign Review is mandatory and publishing pauses for explicit approval by the owner.' : 'Autopilot may schedule review-ready organic content only when the connected publishing adapter and all final artifact checks succeed.',
      'Paid promotion, advertising spend, Page deletion, ownership and security changes are never automatic.',
      'Platform permissions and commercial-content disclosures are checked at execution time.'
    ]
  };
}

module.exports = { SUPPORTED_PLATFORMS, PROVIDERS, CONTENT_OUTPUTS, buildPlan, cleanPrompt, normalizePlatforms, requestedAssetCount, chooseExecutionMode, normalizeContentOutput, normalizeMediaModel, requestsNewPage, needsCurrentResearch, canUseModel, mediaCatalog, normalizeOperationMode };
