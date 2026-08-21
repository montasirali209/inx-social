const SUPPORTED_PLATFORMS = ['facebook', 'instagram', 'youtube', 'tiktok'];

const PROVIDERS = Object.freeze({
  INX_TEMPLATE: { label: 'INX Template Video', estimatedCentsPerAsset: 5, kind: 'template' },
  WAN_2_2_FAST: { label: 'Wan 2.2 Fast', estimatedCentsPerAsset: 11, kind: 'generative-video' },
  LTX_2_3_FAST: { label: 'LTX 2.3 Fast', estimatedCentsPerAsset: 24, kind: 'generative-video' }
});

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
  if (/cinematic|realistic|generative video|text[- ]to[- ]video/i.test(prompt)) return 'WAN_2_2_FAST';
  return 'INX_TEMPLATE';
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
    executionMode: options.executionMode || 'INX_TEMPLATE',
    estimatedCostCents: Number(options.estimatedCostCents || 0)
  };
}

function buildPlan(input = {}) {
  const prompt = cleanPrompt(input.prompt);
  const platforms = normalizePlatforms(input.platforms, prompt);
  const assetCount = requestedAssetCount(prompt);
  const executionMode = chooseExecutionMode(prompt, input.executionMode);
  const operationMode = normalizeOperationMode(input.operationMode);
  const provider = PROVIDERS[executionMode];
  const tasks = [];

  tasks.push(task('BRAND_REVIEW', 'Review the brand brief and supplied assets', 'Extract the business name, audience, offer, tone, logo rules and prohibited claims before generating content.'));

  if (/create|set up|setup|new\s+(facebook\s+)?page/i.test(prompt)) {
    tasks.push(task('PAGE_SETUP', 'Prepare the social Page setup checklist', 'Page creation and sensitive profile changes remain a guided manual step until the connected platform permission and App Review scope explicitly allow them.', { platform: platforms[0], riskLevel: 'HIGH' }));
  }

  tasks.push(task('CONTENT_STRATEGY', `Create a ${assetCount}-asset content plan`, `Plan ${assetCount} distinct ideas, campaign goals, calls to action and platform-specific formats without fabricating business facts.`));
  tasks.push(task('MEDIA_GENERATION', `Generate ${assetCount} branded media asset${assetCount === 1 ? '' : 's'}`, `${provider.label} is the selected route. The final provider and price are re-checked before generation.`, {
    executionMode,
    operationMode,
    estimatedCostCents: provider.estimatedCentsPerAsset * assetCount,
    riskLevel: executionMode === 'INX_TEMPLATE' ? 'LOW' : 'MEDIUM'
  }));
  tasks.push(task('COPY_GENERATION', 'Write captions and accessibility text', 'Create platform-specific captions, calls to action, hashtags and alt-text while preserving the approved brand voice.'));

  for (const platform of platforms) {
    tasks.push(task('PLATFORM_VARIANT', `Prepare the ${platform} version`, `Adapt dimensions, duration, metadata and disclosure fields for ${platform}.`, { platform }));
  }

  tasks.push(task('SCHEDULE', 'Propose the publishing calendar', 'Check occupied slots, account limits and timezone rules, then present the exact schedule for approval.', { riskLevel: 'MEDIUM' }));
  tasks.push(task('PUBLISH', 'Publish approved content', 'This external action remains locked until the owner approves the plan and each connected platform is authorized.', { riskLevel: 'HIGH' }));
  tasks.push(task('ANALYTICS', 'Measure results and prepare the next recommendation', 'Collect permitted platform analytics, compare outcomes and store reusable structured lessons.'));

  const sequenced = tasks.map((value, index) => ({ ...value, sequence: index + 1 }));
  return {
    prompt,
    platforms,
    assetCount,
    executionMode,
    operationMode,
    estimatedCostCents: sequenced.reduce((sum, value) => sum + value.estimatedCostCents, 0),
    provider: { code: executionMode, ...provider },
    tasks: sequenced,
    guardrails: [
      operationMode === 'AUTOPILOT' ? 'Organic content may publish automatically inside the owner-defined schedule and platform limits.' : 'Hybrid mode pauses for explicit approval at the selected review checkpoint before organic publishing.',
      'Paid promotion, advertising spend, Page deletion, ownership and security changes are never automatic.',
      'Platform permissions and commercial-content disclosures are checked at execution time.'
    ]
  };
}

module.exports = { SUPPORTED_PLATFORMS, PROVIDERS, buildPlan, cleanPrompt, normalizePlatforms, requestedAssetCount, chooseExecutionMode, normalizeOperationMode };
