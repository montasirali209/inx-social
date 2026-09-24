const CREATIVE_FORMAT_VERSION = 'ugc-formats-v1';

const FORMAT_KEYS = Object.freeze({
  AUTO: 'AUTO',
  PROBLEM_SOLUTION: 'PROBLEM_SOLUTION',
  PRODUCT_DEMO: 'PRODUCT_DEMO',
  TESTIMONIAL: 'TESTIMONIAL',
  UNBOXING: 'UNBOXING',
  REACTION: 'REACTION',
  BEFORE_AFTER: 'BEFORE_AFTER',
  STORYTIME: 'STORYTIME',
  SPOKESPERSON: 'SPOKESPERSON',
  PRODUCT_FOCUSED: 'PRODUCT_FOCUSED'
});

const CATALOG = Object.freeze({
  PROBLEM_SOLUTION: Object.freeze({
    key: 'PROBLEM_SOLUTION',
    label: 'Problem → Solution',
    description: 'Open on a real pain point, introduce the offer as the solution, support it with verified proof, then close cleanly.',
    campaignTypes: ['AVATAR_EXPLAINER','PRODUCT_SHOWCASE'],
    bestFor: ['SaaS','services','physical products'],
    requiresProductReference: false,
    requiresVerifiedTransformation: false,
    beats: ['HOOK','PROBLEM','SOLUTION','PROOF','CTA'],
    hookFamilies: ['PAIN_POINT','PATTERN_INTERRUPT','SPECIFIC_PROBLEM'],
    ctaMode: 'LOW_PRESSURE',
    cameraEmphasis: 'CREATOR_NATIVE',
    rules: ['STATE_REAL_PROBLEM','INTRODUCE_SOLUTION_AFTER_PROBLEM','USE_VERIFIED_PROOF_ONLY','NO_FAKE_PERSONAL_EXPERIENCE']
  }),
  PRODUCT_DEMO: Object.freeze({
    key: 'PRODUCT_DEMO',
    label: 'Product Demo',
    description: 'Lead with the product, demonstrate a believable use case, show the useful detail and finish with the value.',
    campaignTypes: ['PRODUCT_SHOWCASE'],
    bestFor: ['physical products','tools','consumer goods'],
    requiresProductReference: true,
    requiresVerifiedTransformation: false,
    beats: ['HOOK','PRODUCT_INTRO','DEMO','BENEFIT','CTA'],
    hookFamilies: ['DEMO_FIRST','USE_CASE','FEATURE_REVEAL'],
    ctaMode: 'PRODUCT_DISCOVERY',
    cameraEmphasis: 'PRODUCT_DEMO',
    rules: ['EXACT_PRODUCT_REFERENCE','BELIEVABLE_HANDLING','NO_INVENTED_FEATURES','NO_PACKAGING_REDRAW']
  }),
  TESTIMONIAL: Object.freeze({
    key: 'TESTIMONIAL',
    label: 'Testimonial-style',
    description: 'A conversational recommendation structure that feels personal without fabricating customer history or unverified results.',
    campaignTypes: ['AVATAR_EXPLAINER','PRODUCT_SHOWCASE'],
    bestFor: ['offers needing trust','services','products'],
    requiresProductReference: false,
    requiresVerifiedTransformation: false,
    beats: ['HOOK','CONTEXT','VALUE','PROOF','CTA'],
    hookFamilies: ['RECOMMENDATION','WHY_IT_STANDS_OUT','WHO_IT_IS_FOR'],
    ctaMode: 'LOW_PRESSURE',
    cameraEmphasis: 'CREATOR_NATIVE',
    rules: ['NO_FAKE_TESTIMONIAL','NO_FALSE_FIRST_PERSON_USE','VERIFIED_CLAIMS_ONLY','NATURAL_SPEECH']
  }),
  UNBOXING: Object.freeze({
    key: 'UNBOXING',
    label: 'Unboxing',
    description: 'Reveal the real product, inspect useful details, show a first believable use and close on the strongest verified benefit.',
    campaignTypes: ['PRODUCT_SHOWCASE'],
    bestFor: ['packaged products','consumer goods'],
    requiresProductReference: true,
    requiresVerifiedTransformation: false,
    beats: ['HOOK','REVEAL','DETAIL','FIRST_USE','CTA'],
    hookFamilies: ['REVEAL','WHAT_IS_INSIDE','FIRST_LOOK'],
    ctaMode: 'PRODUCT_DISCOVERY',
    cameraEmphasis: 'HYBRID',
    rules: ['EXACT_PRODUCT_REFERENCE','NO_INVENTED_PACKAGING','NO_FAKE_ORDER_OR_DELIVERY_STORY','BELIEVABLE_HANDLING']
  }),
  REACTION: Object.freeze({
    key: 'REACTION',
    label: 'Reaction',
    description: 'Start with a restrained creator reaction, explain what caused it, connect the reaction to verified value and close naturally.',
    campaignTypes: ['AVATAR_EXPLAINER','PRODUCT_SHOWCASE'],
    bestFor: ['attention-led hooks','launches','simple benefits'],
    requiresProductReference: false,
    requiresVerifiedTransformation: false,
    beats: ['HOOK','REACTION','EXPLANATION','VALUE','CTA'],
    hookFamilies: ['SURPRISE','CURIOSITY','EXPECTATION_SHIFT'],
    ctaMode: 'LOW_PRESSURE',
    cameraEmphasis: 'CREATOR_NATIVE',
    rules: ['REACTION_MUST_BE_PLAUSIBLE','NO_EXAGGERATED_RESULT','NO_FAKE_PERSONAL_HISTORY','VERIFIED_CLAIMS_ONLY']
  }),
  BEFORE_AFTER: Object.freeze({
    key: 'BEFORE_AFTER',
    label: 'Before / After',
    description: 'Compare a verified starting state with a verified outcome. This format is blocked unless the supplied evidence supports the transformation.',
    campaignTypes: ['AVATAR_EXPLAINER','PRODUCT_SHOWCASE'],
    bestFor: ['verified transformations','measurable workflows'],
    requiresProductReference: false,
    requiresVerifiedTransformation: true,
    beats: ['HOOK','BEFORE','CHANGE','AFTER','CTA'],
    hookFamilies: ['CONTRAST','BEFORE_AFTER','RESULT_REVEAL'],
    ctaMode: 'EVIDENCE_LED',
    cameraEmphasis: 'HYBRID',
    rules: ['VERIFIED_TRANSFORMATION_REQUIRED','NO_FABRICATED_BEFORE_AFTER','NO_INVENTED_METRICS','MATCH_EVIDENCE_WORDING']
  }),
  STORYTIME: Object.freeze({
    key: 'STORYTIME',
    label: 'Storytime',
    description: 'Use a compact narrative arc: situation, friction, discovery, useful takeaway and a natural close.',
    campaignTypes: ['AVATAR_EXPLAINER','PRODUCT_SHOWCASE'],
    bestFor: ['services','SaaS','considered purchases'],
    requiresProductReference: false,
    requiresVerifiedTransformation: false,
    beats: ['HOOK','SETUP','FRICTION','DISCOVERY','TAKEAWAY','CTA'],
    hookFamilies: ['STORY_OPEN','SITUATION','MISTAKE_OR_FRICTION'],
    ctaMode: 'LOW_PRESSURE',
    cameraEmphasis: 'CREATOR_NATIVE',
    rules: ['NO_FAKE_CUSTOMER_HISTORY','NO_INVENTED_PERSONAL_EVENT','KEEP_STORY_GENERIC_WHEN_HISTORY_UNVERIFIED','VERIFIED_CLAIMS_ONLY']
  }),
  SPOKESPERSON: Object.freeze({
    key: 'SPOKESPERSON',
    label: 'Spokesperson',
    description: 'A clear creator-led explanation of what the offer is, who it helps, the strongest verified benefit and what to do next.',
    campaignTypes: ['AVATAR_EXPLAINER','PRODUCT_SHOWCASE'],
    bestFor: ['SaaS','services','brand explainers'],
    requiresProductReference: false,
    requiresVerifiedTransformation: false,
    beats: ['HOOK','WHAT_IT_IS','WHO_IT_HELPS','BENEFIT','PROOF','CTA'],
    hookFamilies: ['DIRECT_VALUE','WHO_IT_IS_FOR','CLEAR_PROMISE'],
    ctaMode: 'INFORMATIONAL',
    cameraEmphasis: 'CREATOR_NATIVE',
    rules: ['NO_CORPORATE_ANNOUNCER_TONE','VERIFIED_CLAIMS_ONLY','NO_INVENTED_FEATURES','ONE_CLEAR_CTA']
  }),
  PRODUCT_FOCUSED: Object.freeze({
    key: 'PRODUCT_FOCUSED',
    label: 'Product-focused UGC',
    description: 'Keep the real product visually dominant while a creator gives context, use-case value and a concise call to action.',
    campaignTypes: ['PRODUCT_SHOWCASE'],
    bestFor: ['visual products','design-led goods','product detail'],
    requiresProductReference: true,
    requiresVerifiedTransformation: false,
    beats: ['HOOK','PRODUCT_DETAIL','USE_CASE','BENEFIT','CTA'],
    hookFamilies: ['VISUAL_HOOK','DETAIL_REVEAL','USE_CASE'],
    ctaMode: 'PRODUCT_DISCOVERY',
    cameraEmphasis: 'PRODUCT_DEMO',
    rules: ['EXACT_PRODUCT_REFERENCE','PRODUCT_REMAINS_VISUALLY_DOMINANT','NO_INVENTED_PACKAGING','NO_IMPOSSIBLE_INTERACTION']
  })
});

function clean(value, max = 500) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function normalizeFormat(value) {
  const key = clean(value || 'AUTO', 60).toUpperCase().replace(/[\s-]+/g, '_');
  return key === 'AUTO' || CATALOG[key] ? key : 'AUTO';
}

function hasVerifiedTransformationEvidence(verifiedClaims = []) {
  return (Array.isArray(verifiedClaims) ? verifiedClaims : []).some(claim =>
    /\b(before|after|improv(?:e|es|ed|ing|ement|ements)?|increas(?:e|es|ed|ing)|reduc(?:e|es|ed|ing|tion|tions)|decreas(?:e|es|ed|ing)|faster|slower|results?|transform(?:s|ed|ing|ation|ations)?|restor(?:e|es|ed|ing)|remov(?:e|es|ed|ing)|clear(?:s|ed|ing)?|sav(?:e|es|ed|ing)\s+time)\b/i.test(clean(claim, 800))
  );
}

function availability(spec, { resolvedType, hasProductReference, verifiedClaims = [] }) {
  const reasons = [];
  if (!spec.campaignTypes.includes(String(resolvedType || '').toUpperCase())) reasons.push('CAMPAIGN_TYPE');
  if (spec.requiresProductReference && !hasProductReference) reasons.push('PRODUCT_REFERENCE');
  const verifiedTransformation = hasVerifiedTransformationEvidence(verifiedClaims);
  if (spec.requiresVerifiedTransformation && !verifiedTransformation) reasons.push('VERIFIED_TRANSFORMATION');
  return { available: reasons.length === 0, reasons, verifiedTransformation };
}

function publicCatalog() {
  return [
    {
      key: 'AUTO',
      label: 'Choose for me',
      description: 'Automatically mix compatible creative structures across the campaign while respecting the production type and evidence.',
      campaignTypes: ['AVATAR_EXPLAINER','PRODUCT_SHOWCASE'],
      bestFor: ['multi-ad campaigns'],
      requiresProductReference: false,
      requiresVerifiedTransformation: false
    },
    ...Object.values(CATALOG).map(spec => ({
      key: spec.key,
      label: spec.label,
      description: spec.description,
      campaignTypes: [...spec.campaignTypes],
      bestFor: [...spec.bestFor],
      requiresProductReference: spec.requiresProductReference,
      requiresVerifiedTransformation: spec.requiresVerifiedTransformation
    }))
  ];
}

function compatibleKeys(context) {
  return Object.values(CATALOG)
    .filter(spec => availability(spec, context).available)
    .map(spec => spec.key);
}

function autoOrder(resolvedType, context) {
  const preferred = String(resolvedType || '').toUpperCase() === 'PRODUCT_SHOWCASE'
    ? ['PRODUCT_DEMO','PROBLEM_SOLUTION','PRODUCT_FOCUSED','UNBOXING','REACTION','STORYTIME','TESTIMONIAL','SPOKESPERSON','BEFORE_AFTER']
    : ['PROBLEM_SOLUTION','STORYTIME','SPOKESPERSON','TESTIMONIAL','REACTION','BEFORE_AFTER'];
  const compatible = new Set(compatibleKeys(context));
  return preferred.filter(key => compatible.has(key));
}

function distributeBeats(beats, sceneCount) {
  const count = Math.max(1, Number(sceneCount || 1));
  const source = Array.isArray(beats) && beats.length ? beats : ['HOOK','VALUE','CTA'];
  if (count === 1) return [source.slice()];
  const groups = Array.from({ length: count }, () => []);
  source.forEach((beat, index) => {
    const bucket = Math.min(count - 1, Math.floor(index * count / source.length));
    groups[bucket].push(beat);
  });
  for (let i = 0; i < groups.length; i += 1) {
    if (!groups[i].length) groups[i].push(i === 0 ? 'HOOK' : i === groups.length - 1 ? 'CTA' : 'VALUE');
  }
  return groups;
}

function fallbackHook(key, productName = 'this offer') {
  const offer = clean(productName, 220) || 'this offer';
  const map = {
    PROBLEM_SOLUTION: 'If this problem keeps getting in the way, here is a simpler option.',
    PRODUCT_DEMO: 'Here is what ' + offer + ' actually looks like in use.',
    TESTIMONIAL: 'If you are comparing options, this is the part worth paying attention to.',
    UNBOXING: 'Here is a quick first look at ' + offer + '.',
    REACTION: 'This detail is easier to miss than you might expect.',
    BEFORE_AFTER: 'The useful comparison is what changes from the starting point to the verified result.',
    STORYTIME: 'Here is the short version of why this is useful.',
    SPOKESPERSON: 'Here is what ' + offer + ' does and who it is for.',
    PRODUCT_FOCUSED: 'Take a closer look at ' + offer + '.'
  };
  return map[key] || 'Here is the useful part worth knowing about.';
}

function planCreativeFormats({
  requestedFormat = 'AUTO',
  resolvedType,
  variationCount = 1,
  sceneCount = 1,
  hasProductReference = false,
  verifiedClaims = []
}) {
  const requested = normalizeFormat(requestedFormat);
  const context = { resolvedType, hasProductReference, verifiedClaims };
  let keys = [];

  if (requested !== 'AUTO') {
    const spec = CATALOG[requested];
    const state = availability(spec, context);
    if (!state.available) {
      const error = new Error('Creative format ' + requested + ' is not compatible with this campaign: ' + state.reasons.join(', '));
      error.code = 'UGC_CREATIVE_FORMAT_INCOMPATIBLE';
      error.format = requested;
      error.reasons = state.reasons;
      throw error;
    }
    keys = Array.from({ length: Math.max(1, Number(variationCount || 1)) }, () => requested);
  } else {
    const order = autoOrder(resolvedType, context);
    const safeOrder = order.length ? order : ['PROBLEM_SOLUTION'];
    keys = Array.from({ length: Math.max(1, Number(variationCount || 1)) }, (_, index) => safeOrder[index % safeOrder.length]);
  }

  const ads = keys.map((key, index) => {
    const spec = CATALOG[key];
    const state = availability(spec, context);
    return {
      adSequence: index + 1,
      formatKey: key,
      label: spec.label,
      status: state.available ? 'READY' : 'INVALID',
      requirements: {
        productReference: spec.requiresProductReference,
        verifiedTransformation: spec.requiresVerifiedTransformation
      },
      evidence: {
        verifiedTransformation: state.verifiedTransformation
      },
      grammar: {
        beats: [...spec.beats],
        sceneBeats: distributeBeats(spec.beats, sceneCount),
        hookFamilies: [...spec.hookFamilies],
        ctaMode: spec.ctaMode,
        cameraEmphasis: spec.cameraEmphasis,
        rules: [...spec.rules]
      }
    };
  });

  return {
    version: CREATIVE_FORMAT_VERSION,
    requested,
    mode: requested === 'AUTO' ? 'AUTO_MIX' : 'LOCKED',
    resolvedType: String(resolvedType || '').toUpperCase(),
    formats: [...new Set(keys)],
    ads
  };
}

function formatSnapshot() {
  return {
    version: CREATIVE_FORMAT_VERSION,
    keys: Object.keys(CATALOG),
    autoPolicy: 'DETERMINISTIC_COMPATIBLE_MIX',
    evidencePolicy: {
      testimonial: 'NO_FALSE_FIRST_PERSON_EXPERIENCE',
      beforeAfter: 'VERIFIED_TRANSFORMATION_REQUIRED',
      productFormats: 'EXACT_PRODUCT_REFERENCE_WHEN_REQUIRED'
    }
  };
}

module.exports = {
  CREATIVE_FORMAT_VERSION,
  FORMAT_KEYS,
  CATALOG,
  normalizeFormat,
  hasVerifiedTransformationEvidence,
  publicCatalog,
  compatibleKeys,
  distributeBeats,
  fallbackHook,
  planCreativeFormats,
  formatSnapshot
};
