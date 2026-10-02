const prisma = require('../db/prisma');
const postStudio = require('./aiPostStudioService');
const credits = require('./aiCreditService');
const campaignService = require('./aiPostCampaignService');

const MAX_CONCEPTS = 50;
const BATCH_SIZE = 20;

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function cleanList(value, maxItems = 12, maxChars = 320) {
  return (Array.isArray(value) ? value : []).map(item => clean(item, maxChars)).filter(Boolean).slice(0, maxItems);
}

function publicError(message, code = 'CREATIVE_FLOW_ERROR', status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.publicMessage = message;
  return error;
}

function requireProvider() {
  if (!postStudio.isConfigured()) {
    throw publicError('Creative Flow planning is temporarily unavailable because the AI provider is not configured.', 'CREATIVE_FLOW_PROVIDER_UNAVAILABLE', 503);
  }
}

function normalisePlatforms(values) {
  const allowed = new Map([
    ['facebook', 'Facebook'],
    ['instagram', 'Instagram'],
    ['x', 'X'],
    ['linkedin', 'LinkedIn'],
    ['tiktok', 'TikTok'],
    ['threads', 'Threads'],
    ['bluesky', 'Bluesky'],
    ['pinterest', 'Pinterest']
  ]);
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = allowed.get(String(value || '').trim().toLowerCase());
    if (normalized && !output.includes(normalized)) output.push(normalized);
  }
  return output.length ? output : ['Instagram'];
}

function emptySourceAnalysis(input, sources = []) {
  return {
    fingerprint: '',
    productName: clean(input.productName, 160),
    summary: clean(input.prompt, 900),
    positioning: '',
    audience: input.audience ? [clean(input.audience, 220)] : [],
    verifiedClaims: [],
    visualIdentity: [],
    assetObservations: [],
    strongestAngles: [],
    cautions: ['No external source was analysed. Treat product facts in the campaign brief as user-supplied context, not independently verified claims.'],
    sources
  };
}

async function analyzeCreativeFlow(userId, input) {
  requireProvider();

  const normalizedUrl = input.website ? postStudio.normalizeUrl(input.website) : '';
  if (input.website && !normalizedUrl) {
    throw publicError('Enter a public product or business website.', 'CREATIVE_FLOW_URL_INVALID', 400);
  }

  const referenceIds = [...new Set((input.referenceAssetIds || []).map(String).filter(Boolean))].slice(0, 8);
  const refs = referenceIds.length ? await postStudio.referenceAssets(userId, referenceIds, 8) : [];
  const contexts = normalizedUrl ? [await postStudio.fetchUrlContext(normalizedUrl)] : [];
  const sources = [
    ...contexts.map(item => ({ type: 'url', label: item.title || item.url || normalizedUrl, ok: !item.error })),
    ...refs.map(item => ({ type: 'reference', label: item.originalName || item.id, ok: Boolean(item.visionData) }))
  ];

  let sourceAnalysis;
  if (contexts.some(item => item.text) || refs.some(item => item.visionData)) {
    const fingerprint = postStudio.sourceFingerprint(
      normalizedUrl ? [normalizedUrl] : [],
      refs
    );
    sourceAnalysis = await postStudio.performSourceAnalysis(
      [{ role: 'user', content: [
        input.productName ? `Product name supplied by user: ${clean(input.productName, 160)}` : '',
        input.prompt ? `Campaign brief supplied by user: ${clean(input.prompt, 1800)}` : '',
        input.audience ? `Audience supplied by user: ${clean(input.audience, 500)}` : ''
      ].filter(Boolean).join('\n') || 'Analyse the supplied product sources for a marketing campaign.' }],
      contexts,
      refs,
      fingerprint,
      { maxVisionReferences: 6 }
    );
  } else {
    sourceAnalysis = emptySourceAnalysis(input, sources);
  }

  if (!sourceAnalysis.productName && input.productName) {
    sourceAnalysis.productName = clean(input.productName, 160);
  }

  const context = contexts.find(item => !item.error) || contexts[0] || null;
  const brandPack = postStudio.buildBrandPack(context);

  return {
    sourceAnalysis,
    brandPack: {
      sourceUrl: brandPack.sourceUrl || normalizedUrl || null,
      brandName: clean(brandPack.brandName || sourceAnalysis.productName || input.productName, 160),
      colors: cleanList(brandPack.colors, 6, 24),
      logo: brandPack.logo || null,
      icon: brandPack.icon || null,
      productVisuals: Array.isArray(brandPack.productVisuals) ? brandPack.productVisuals.slice(0, 4) : [],
      heroVisuals: Array.isArray(brandPack.heroVisuals) ? brandPack.heroVisuals.slice(0, 4) : [],
      confidence: brandPack.confidence || 'low',
      confidenceScore: Number(brandPack.confidenceScore || 0),
      lockLogo: Boolean(brandPack.lockLogo)
    },
    analysedUrl: context ? {
      url: context.url || normalizedUrl,
      ok: !context.error,
      title: context.title || null,
      description: context.description || null,
      error: context.error || null
    } : null,
    analysedReferences: refs.map(asset => ({
      id: asset.id,
      name: asset.originalName || asset.id,
      readable: Boolean(asset.visionData)
    }))
  };
}

function strategySystemPrompt(count) {
  return [
    'You are the senior creative campaign strategist inside INXSocial Creative Flow.',
    'Build a practical campaign strategy and distinct visual-ad concepts. This stage plans creative work only; do not generate images.',
    'Treat the supplied source analysis as the only verified external evidence. Treat the customer brief as customer-provided direction.',
    'Never invent features, prices, statistics, testimonials, guarantees, integrations, awards, medical claims or performance claims.',
    'If a factual claim is not in verifiedClaims or clearly supplied by the customer, keep the concept non-quantified and brand-safe.',
    'Concepts must be materially different from each other: vary marketing angle, visual composition, hook structure and message emphasis rather than swapping backgrounds.',
    'Keep concepts useful for real social marketing, not generic AI-art prompts.',
    `Return exactly ${count} concepts in the requested sequence range.`,
    'Return json only.'
  ].join('\n');
}

function foundationShapePrompt() {
  return [
    'Return one valid json object with this shape:',
    '{"campaignTitle":"string","strategySummary":"string","audienceSummary":"string","contentPillars":["string"],"creativePrinciples":["string"],"claimGuardrails":["string"]}',
    'strategySummary should be approximately 120-220 words. contentPillars should contain 4-7 useful pillars. creativePrinciples should contain 4-7 practical art/copy principles.'
  ].join('\n');
}

async function buildFoundation(input) {
  const source = input.sourceAnalysis || {};
  const parsed = await postStudio.callChatModel(postStudio.REASONING_MODEL, [
    {
      role: 'system',
      content: [
        'You are the senior campaign strategist inside INXSocial Creative Flow.',
        'Plan the campaign before individual creative concepts are written.',
        'Never convert an inference into a factual claim. Never invent unsupported product facts.',
        foundationShapePrompt()
      ].join('\n\n')
    },
    {
      role: 'user',
      content: [
        `Product: ${clean(input.productName || source.productName || 'Unspecified product', 180)}`,
        `Campaign brief: ${clean(input.prompt, 2200)}`,
        `Goal: ${clean(input.goal || 'AI Recommended', 120)}`,
        `Audience preference: ${clean(input.audience || 'AI Recommended', 500)}`,
        `Creative style preference: ${clean(input.style || 'AI Recommended', 160)}`,
        `Platforms: ${normalisePlatforms(input.platforms).join(', ')}`,
        `Verified source analysis: ${JSON.stringify({
          summary: clean(source.summary, 1000),
          positioning: clean(source.positioning, 700),
          audience: cleanList(source.audience, 8, 220),
          verifiedClaims: cleanList(source.verifiedClaims, 12, 320),
          visualIdentity: cleanList(source.visualIdentity, 10, 260),
          assetObservations: cleanList(source.assetObservations, 10, 320),
          strongestAngles: cleanList(source.strongestAngles, 8, 320),
          cautions: cleanList(source.cautions, 8, 320)
        })}`
      ].join('\n\n')
    }
  ], { reasoningEffort: 'medium', temperature: 0.25, maxTokens: 2600, timeoutMs: 150000 });

  return {
    campaignTitle: clean(parsed.campaignTitle || 'Creative Flow Campaign', 160),
    strategySummary: clean(parsed.strategySummary, 1800),
    audienceSummary: clean(parsed.audienceSummary || input.audience, 900),
    contentPillars: cleanList(parsed.contentPillars, 7, 180),
    creativePrinciples: cleanList(parsed.creativePrinciples, 7, 220),
    claimGuardrails: cleanList(parsed.claimGuardrails, 8, 260)
  };
}

async function planConceptBatch(input, foundation, startSequence, batchCount, priorConcepts) {
  const endSequence = startSequence + batchCount - 1;
  const source = input.sourceAnalysis || {};
  const parsed = await postStudio.callChatModel(postStudio.REASONING_MODEL, [
    {
      role: 'system',
      content: [
        strategySystemPrompt(batchCount),
        `Sequence range: ${startSequence}-${endSequence}.`,
        'Return this exact shape:',
        '{"concepts":[{"sequence":1,"angle":"string","hook":"string","visualStyle":"string","message":"string","cta":"string","platformApproach":"string","evidenceBasis":"verified_source|user_brief|brand_safe_generic"}]}',
        'hook is concise public-facing ad/post copy, not an internal label. message describes what the creative communicates. visualStyle describes composition and art direction.',
        'Do not repeat angles or hooks already used in priorConcepts.'
      ].join('\n\n')
    },
    {
      role: 'user',
      content: [
        `Campaign foundation: ${JSON.stringify(foundation)}`,
        `Product: ${clean(input.productName || source.productName || 'Unspecified product', 180)}`,
        `Customer brief: ${clean(input.prompt, 2200)}`,
        `Platforms: ${normalisePlatforms(input.platforms).join(', ')}`,
        `Verified claims: ${JSON.stringify(cleanList(source.verifiedClaims, 12, 320))}`,
        `Verified/observed visual identity: ${JSON.stringify([...cleanList(source.visualIdentity, 8, 260), ...cleanList(source.assetObservations, 8, 300)].slice(0, 12))}`,
        `Strong source-backed angles: ${JSON.stringify(cleanList(source.strongestAngles, 8, 320))}`,
        `Cautions: ${JSON.stringify(cleanList(source.cautions, 8, 320))}`,
        `Prior concepts to avoid repeating: ${JSON.stringify(priorConcepts.slice(-30).map(item => ({ angle: item.angle, hook: item.hook })))}`
      ].join('\n\n')
    }
  ], { reasoningEffort: 'medium', temperature: 0.45, maxTokens: Math.max(3600, batchCount * 330), timeoutMs: 180000 });

  const rows = Array.isArray(parsed.concepts) ? parsed.concepts : [];
  if (rows.length !== batchCount) {
    throw publicError(
      `Creative Flow planned ${rows.length} concepts instead of ${batchCount}. Please run the strategy again.`,
      'CREATIVE_FLOW_INCOMPLETE_PLAN',
      502
    );
  }

  return rows.map((row, index) => ({
    sequence: startSequence + index,
    angle: clean(row.angle, 160),
    hook: clean(row.hook, 220),
    visualStyle: clean(row.visualStyle, 260),
    message: clean(row.message, 500),
    cta: clean(row.cta, 180),
    platformApproach: clean(row.platformApproach, 260),
    evidenceBasis: ['verified_source', 'user_brief', 'brand_safe_generic'].includes(row.evidenceBasis)
      ? row.evidenceBasis
      : 'brand_safe_generic'
  }));
}

async function planCreativeFlow(_userId, input) {
  requireProvider();
  const count = Math.max(1, Math.min(MAX_CONCEPTS, Number(input.creativeCount || 20)));
  const normalized = {
    ...input,
    creativeCount: count,
    platforms: normalisePlatforms(input.platforms)
  };

  const foundation = await buildFoundation(normalized);
  const concepts = [];
  for (let start = 1; start <= count; start += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, count - start + 1);
    concepts.push(...await planConceptBatch(normalized, foundation, start, batchCount, concepts));
  }

  return {
    requestedCount: count,
    strategy: foundation,
    concepts,
    model: postStudio.REASONING_MODEL
  };
}


function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function safeBrandPack(value = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const cleanRef = item => item && typeof item === 'object' && item.url
    ? { url: clean(item.url, 2000), kind: clean(item.kind, 40), label: clean(item.label, 180) }
    : null;
  const logo = cleanRef(input.logo);
  const icon = cleanRef(input.icon);
  return {
    sourceUrl: clean(input.sourceUrl, 2000) || null,
    brandName: clean(input.brandName, 160),
    colors: cleanList(input.colors, 6, 24),
    logo,
    icon,
    productVisuals: (Array.isArray(input.productVisuals) ? input.productVisuals : []).map(cleanRef).filter(Boolean).slice(0, 4),
    heroVisuals: (Array.isArray(input.heroVisuals) ? input.heroVisuals : []).map(cleanRef).filter(Boolean).slice(0, 4),
    confidence: ['high', 'medium', 'low'].includes(input.confidence) ? input.confidence : 'low',
    confidenceScore: Math.max(0, Math.min(100, Number(input.confidenceScore || 0))),
    lockLogo: Boolean(input.lockLogo && logo)
  };
}

function conceptImageBrief(concept, input) {
  return [
    `Marketing angle: ${clean(concept.angle, 180)}.`,
    `Public hook: ${clean(concept.hook, 240)}.`,
    `Message: ${clean(concept.message, 600)}.`,
    concept.cta ? `CTA: ${clean(concept.cta, 180)}.` : '',
    concept.platformApproach ? `Platform approach: ${clean(concept.platformApproach, 280)}.` : '',
    `Visual direction: ${clean(concept.visualStyle, 800)}.`,
    input.style && input.style !== 'auto' ? `Customer-selected creative style: ${clean(input.style, 160)}.` : '',
    'Create this as its own campaign creative. Do not reuse the composition, layout, hook treatment or visual metaphor from another Creative Flow concept.',
    'Use only supported product facts. Do not invent prices, statistics, testimonials, awards, guarantees, integrations or performance claims.'
  ].filter(Boolean).join('\n').slice(0, 2600);
}

function conceptCaption(concept) {
  return [clean(concept.message, 1200), clean(concept.cta, 220)].filter(Boolean).join('\n\n') || clean(concept.hook, 1200) || 'Campaign creative';
}

async function creativeFlowAccess(userId, requiredCredits = 0) {
  const access = await credits.getAccess(userId);
  if (!access?.studioEnabled) {
    throw publicError('Creative Flow generation is available on plans with AI Content Studio access.', 'CREATIVE_FLOW_UPGRADE_REQUIRED', 403);
  }
  if (requiredCredits > 0 && Number(access.creditsRemaining || 0) < requiredCredits) {
    throw publicError(
      `This Creative Flow render needs ${requiredCredits} AI credits, but only ${Number(access.creditsRemaining || 0)} credits remain.`,
      'CREATIVE_FLOW_CREDITS_INSUFFICIENT',
      402
    );
  }
  return access;
}

async function estimateCreativeFlowRender(userId, count) {
  const normalizedCount = Math.max(1, Math.min(MAX_CONCEPTS, Number(count || 1)));
  const access = await creativeFlowAccess(userId, 0);
  const creditsPerCreative = postStudio.IMAGE_CREDITS;
  const requiredCredits = normalizedCount * creditsPerCreative;
  const creditsRemaining = Number(access?.creditsRemaining || 0);
  return {
    count: normalizedCount,
    creditsPerCreative,
    requiredCredits,
    creditsRemaining,
    canGenerate: creditsRemaining >= requiredCredits
  };
}

async function rawCreativeFlowCampaign(userId, campaignId) {
  const campaign = await prisma.aiPostCampaign.findFirst({
    where: { id: String(campaignId), userId },
    include: { posts: { orderBy: { sequence: 'asc' } } }
  });
  if (!campaign) throw publicError('Creative Flow campaign not found.', 'CREATIVE_FLOW_NOT_FOUND', 404);
  const analysis = parseJson(campaign.analysisJson, {});
  if (!analysis?.creativeFlow || Number(analysis.creativeFlow.version || 0) < 3) {
    throw publicError('This campaign was not created by Creative Flow Stage 3.', 'CREATIVE_FLOW_NOT_FOUND', 404);
  }
  return { campaign, analysis };
}

async function publicCreativeFlowCampaign(userId, campaignId) {
  const { campaign, analysis } = await rawCreativeFlowCampaign(userId, campaignId);
  const value = campaignService.publicCampaign(campaign);
  const creditsPerCreative = postStudio.IMAGE_CREDITS;
  return {
    ...value,
    creativeFlow: {
      version: Number(analysis.creativeFlow.version || 3),
      creditsPerCreative,
      plannedCredits: Number(analysis.creativeFlow.plannedCredits || value.imagePostCount * creditsPerCreative),
      originalConceptCount: Number(analysis.creativeFlow.originalConceptCount || value.imagePostCount),
      referenceAssetIds: cleanList(analysis.creativeFlow.referenceAssetIds, 8, 120)
    }
  };
}

async function startCreativeFlowRender(userId, input) {
  requireProvider();
  const concepts = (Array.isArray(input.concepts) ? input.concepts : []).slice(0, MAX_CONCEPTS);
  if (!concepts.length) throw publicError('Keep at least one creative concept before generation.', 'CREATIVE_FLOW_NO_CONCEPTS', 400);

  const requiredCredits = concepts.length * postStudio.IMAGE_CREDITS;
  await creativeFlowAccess(userId, requiredCredits);

  const normalizedUrl = input.website ? postStudio.normalizeUrl(input.website) : '';
  if (input.website && !normalizedUrl) throw publicError('Enter a public product or business website.', 'CREATIVE_FLOW_URL_INVALID', 400);

  const platforms = normalisePlatforms(input.platforms);
  const brandPack = safeBrandPack(input.brandPack);
  const sourceAnalysis = input.sourceAnalysis && typeof input.sourceAnalysis === 'object' ? input.sourceAnalysis : {};
  const strategy = input.strategy && typeof input.strategy === 'object' ? input.strategy : {};
  const referenceAssetIds = [...new Set((input.referenceAssetIds || []).map(String).filter(Boolean))].slice(0, 8);

  const posts = concepts.map((concept, index) => ({
    sequence: index + 1,
    status: 'READY',
    contentType: 'IMAGE',
    title: '',
    pillar: clean(concept.angle, 160) || null,
    hook: clean(concept.hook, 180) || null,
    caption: conceptCaption(concept),
    cta: clean(concept.cta, 180) || null,
    hashtagsJson: '[]',
    imageBrief: conceptImageBrief(concept, input)
  }));

  const campaignMap = concepts.map((concept, index) => ({
    sequence: index + 1,
    contentType: 'IMAGE',
    pillar: clean(concept.angle, 160),
    objective: clean(concept.message, 280),
    hookType: clean(concept.angle, 80),
    ctaStyle: concept.cta ? 'concept-specific' : 'none',
    platformApproach: clean(concept.platformApproach, 180)
  }));

  const campaign = await prisma.aiPostCampaign.create({
    data: {
      userId,
      title: clean(strategy.campaignTitle || `${input.productName || sourceAnalysis.productName || 'Creative Flow'} campaign`, 160),
      businessUrl: normalizedUrl || brandPack.sourceUrl || null,
      goal: clean(input.goal || 'Creative Flow campaign', 1600),
      audience: clean(strategy.audienceSummary || input.audience || sourceAnalysis.audience?.[0], 1000) || null,
      tone: null,
      contentMode: 'IMAGE',
      platformsJson: JSON.stringify(platforms),
      postCount: posts.length,
      imagePostCount: posts.length,
      status: 'GENERATING_IMAGES',
      analysisJson: JSON.stringify({
        strategySummary: clean(strategy.strategySummary, 1800),
        audienceSummary: clean(strategy.audienceSummary || input.audience, 1000),
        contentPillars: cleanList(strategy.contentPillars, 8, 180),
        sourceSummary: clean(sourceAnalysis.summary, 1000),
        sourceUrl: normalizedUrl || brandPack.sourceUrl || null,
        brandPack,
        sourceAnalysis,
        campaignMap,
        creativeFlow: {
          version: 3,
          projectId: clean(input.projectId, 160) || null,
          originalConceptCount: concepts.length,
          plannedCredits: requiredCredits,
          referenceAssetIds,
          concepts: concepts.map((concept, index) => ({
            sequence: index + 1,
            originalSequence: Number(concept.sequence || index + 1),
            angle: clean(concept.angle, 160),
            hook: clean(concept.hook, 220),
            visualStyle: clean(concept.visualStyle, 300),
            message: clean(concept.message, 600),
            cta: clean(concept.cta, 180),
            platformApproach: clean(concept.platformApproach, 260),
            evidenceBasis: ['verified_source', 'user_brief', 'brand_safe_generic'].includes(concept.evidenceBasis)
              ? concept.evidenceBasis
              : 'brand_safe_generic'
          }))
        }
      }),
      posts: { create: posts }
    },
    include: { posts: { orderBy: { sequence: 'asc' } } }
  });

  campaignService.queueCampaignRender(userId, campaign.id);

  return {
    campaign: await publicCreativeFlowCampaign(userId, campaign.id),
    creditsPerCreative: postStudio.IMAGE_CREDITS,
    plannedCredits: requiredCredits
  };
}

async function getCreativeFlowRender(userId, campaignId) {
  return publicCreativeFlowCampaign(userId, campaignId);
}

async function retryCreativeFlowRender(userId, campaignId) {
  const { campaign } = await rawCreativeFlowCampaign(userId, campaignId);
  const pending = campaign.posts.filter(post => post.contentType === 'IMAGE' && !post.mediaAssetId);
  if (!pending.length) return publicCreativeFlowCampaign(userId, campaignId);

  await creativeFlowAccess(userId, pending.length * postStudio.IMAGE_CREDITS);
  await prisma.aiPostCampaign.update({
    where: { id: campaign.id },
    data: { status: 'GENERATING_IMAGES', updatedAt: new Date() }
  });
  campaignService.queueCampaignRender(userId, campaign.id);
  return publicCreativeFlowCampaign(userId, campaign.id);
}

async function regenerateCreativeFlowPost(userId, campaignId, postId) {
  await rawCreativeFlowCampaign(userId, campaignId);
  await creativeFlowAccess(userId, postStudio.IMAGE_CREDITS);
  await campaignService.generatePostImage(userId, campaignId, postId);
  return publicCreativeFlowCampaign(userId, campaignId);
}

async function removeCreativeFlowRender(userId, campaignId) {
  await rawCreativeFlowCampaign(userId, campaignId);
  return campaignService.removeCampaign(userId, campaignId);
}


async function handoffCreativeFlowCampaign(userId, campaignId, approvedPostIds) {
  const requestedIds = [...new Set((Array.isArray(approvedPostIds) ? approvedPostIds : []).map(String).filter(Boolean))].slice(0, MAX_CONCEPTS);
  if (!requestedIds.length) {
    throw publicError('Approve at least one completed creative before sending the campaign to Bulk Scheduler.', 'CREATIVE_FLOW_HANDOFF_EMPTY', 400);
  }

  return prisma.$transaction(async tx => {
    const locked = await tx.$queryRawUnsafe(
      'SELECT "id","userId","title","businessUrl","goal","audience","tone","platformsJson","analysisJson" FROM "AiPostCampaign" WHERE "id"=$1 AND "userId"=$2 FOR UPDATE',
      String(campaignId),
      userId
    );
    const sourceCampaign = locked[0];
    if (!sourceCampaign) throw publicError('Creative Flow campaign not found.', 'CREATIVE_FLOW_NOT_FOUND', 404);

    const analysis = parseJson(sourceCampaign.analysisJson, {});
    if (!analysis?.creativeFlow || Number(analysis.creativeFlow.version || 0) < 3) {
      throw publicError('This campaign was not created by Creative Flow.', 'CREATIVE_FLOW_NOT_FOUND', 404);
    }

    const posts = await tx.aiPostCampaignPost.findMany({
      where: { campaignId: sourceCampaign.id, id: { in: requestedIds } },
      orderBy: { sequence: 'asc' }
    });
    if (posts.length !== requestedIds.length) {
      throw publicError('One or more approved creatives no longer belong to this Creative Flow campaign.', 'CREATIVE_FLOW_HANDOFF_INVALID_POSTS', 409);
    }
    const notReady = posts.filter(post => post.contentType !== 'IMAGE' || !post.mediaAssetId);
    if (notReady.length) {
      throw publicError('Only completed image creatives can be sent to Bulk Scheduler.', 'CREATIVE_FLOW_HANDOFF_NOT_READY', 409);
    }

    const fingerprint = posts.map(post => post.id).sort().join(':');
    const prior = analysis?.creativeFlow?.lastHandoff;
    if (prior?.fingerprint === fingerprint && prior?.campaignId) {
      const existing = await tx.aiPostCampaign.findFirst({
        where: { id: String(prior.campaignId), userId },
        include: { posts: { orderBy: { sequence: 'asc' } } }
      });
      if (existing) return { campaign: campaignService.publicCampaign(existing), reused: true };
    }

    const sourceMap = Array.isArray(analysis.campaignMap) ? analysis.campaignMap : [];
    const targetMap = posts.map((post, index) => {
      const original = sourceMap.find(item => Number(item?.sequence) === Number(post.sequence)) || {};
      return { ...original, sequence: index + 1, contentType: 'IMAGE', sourceSequence: post.sequence };
    });

    const target = await tx.aiPostCampaign.create({
      data: {
        userId,
        title: clean(sourceCampaign.title || 'Creative Flow Campaign', 160),
        businessUrl: sourceCampaign.businessUrl || null,
        goal: clean(sourceCampaign.goal || 'Creative Flow campaign', 1600),
        audience: clean(sourceCampaign.audience, 1000) || null,
        tone: sourceCampaign.tone || null,
        contentMode: 'IMAGE',
        platformsJson: sourceCampaign.platformsJson || '[]',
        postCount: posts.length,
        imagePostCount: posts.length,
        status: 'READY',
        analysisJson: JSON.stringify({
          strategySummary: clean(analysis.strategySummary, 1800),
          audienceSummary: clean(analysis.audienceSummary, 1000),
          contentPillars: cleanList(analysis.contentPillars, 8, 180),
          sourceSummary: clean(analysis.sourceSummary, 1000),
          sourceUrl: clean(analysis.sourceUrl, 2000) || null,
          brandPack: analysis.brandPack || null,
          campaignMap: targetMap,
          handoffSource: {
            type: 'CREATIVE_FLOW',
            sourceCampaignId: sourceCampaign.id,
            approvedOriginalSequences: posts.map(post => post.sequence)
          }
        }),
        posts: {
          create: posts.map((post, index) => ({
            sequence: index + 1,
            status: 'READY',
            contentType: 'IMAGE',
            title: '',
            pillar: post.pillar,
            hook: post.hook,
            caption: post.caption,
            cta: post.cta,
            hashtagsJson: post.hashtagsJson || '[]',
            imageBrief: post.imageBrief,
            mediaAssetId: post.mediaAssetId,
            mediaAssetJson: post.mediaAssetJson
          }))
        }
      },
      include: { posts: { orderBy: { sequence: 'asc' } } }
    });

    analysis.creativeFlow = {
      ...analysis.creativeFlow,
      lastHandoff: {
        campaignId: target.id,
        fingerprint,
        approvedPostIds: posts.map(post => post.id),
        approvedOriginalSequences: posts.map(post => post.sequence),
        createdAt: new Date().toISOString()
      }
    };
    await tx.aiPostCampaign.update({
      where: { id: sourceCampaign.id },
      data: { analysisJson: JSON.stringify(analysis), updatedAt: new Date() }
    });

    return { campaign: campaignService.publicCampaign(target), reused: false };
  });
}

module.exports = {
  MAX_CONCEPTS,
  analyzeCreativeFlow,
  planCreativeFlow,
  estimateCreativeFlowRender,
  startCreativeFlowRender,
  getCreativeFlowRender,
  retryCreativeFlowRender,
  regenerateCreativeFlowPost,
  removeCreativeFlowRender,
  handoffCreativeFlowCampaign,
  normalisePlatforms
};
