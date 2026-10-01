const postStudio = require('./aiPostStudioService');

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
    'Return JSON only.'
  ].join('\n');
}

function foundationShapePrompt() {
  return [
    'Return this shape:',
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

module.exports = {
  MAX_CONCEPTS,
  analyzeCreativeFlow,
  planCreativeFlow,
  normalisePlatforms
};
