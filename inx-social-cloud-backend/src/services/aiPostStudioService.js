const axios = require('axios');

// GPT-5.6 Luna/Terra currently accept only the model-default temperature.
// Keep the compatibility guard at the service boundary so source analysis and
// conversational routing cannot fail when callers supply tuning values.
axios.interceptors.request.use((config) => {
  const url = String(config?.url || '');
  const data = config?.data;
  if (!/\/chat\/completions(?:\?|$)/i.test(url) || !data || typeof data !== 'object' || Array.isArray(data)) return config;
  const model = String(data.model || '');
  if (/^gpt-5\.6-(?:luna|terra)(?:$|[-:])/i.test(model) && Object.prototype.hasOwnProperty.call(data, 'temperature')) {
    const nextData = { ...data };
    delete nextData.temperature;
    config.data = nextData;
  }
  return config;
});

const studio = require('./aiPostStudioServiceV2');
const references = require('./aiStudioReferenceService');
const research = require('./creativeFlowResearchService');

const baseGenerateImagePost = studio.generateImagePost;
const baseFetchUrlContext = studio.fetchUrlContext;
const basePerformSourceAnalysis = studio.performSourceAnalysis;
const researchByUrl = new Map();

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function cleanWords(value, maxWords, maxChars) {
  return clean(value, maxChars)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ');
}

async function fetchUrlContext(value) {
  const result = await research.researchWebsite(value, baseFetchUrlContext);
  const context = result?.context || await baseFetchUrlContext(value);
  if (context?.url) researchByUrl.set(context.url, result);
  const normalizedInput = studio.normalizeUrl(value);
  if (normalizedInput) researchByUrl.set(normalizedInput, result);
  return context;
}

async function performSourceAnalysis(messages, urlContexts, refs, fingerprint, options = {}) {
  const analysis = await basePerformSourceAnalysis(messages, urlContexts, refs, fingerprint, options);
  const context = (Array.isArray(urlContexts) ? urlContexts : []).find((item) => item && !item.error) || null;
  const result = context ? (researchByUrl.get(context.url) || {
    canonicalName: context.siteName || context.title || '',
    evidenceScore: context.research?.evidenceScore || 0,
    evidenceConfidence: context.research?.evidenceConfidence || 'low',
    sourceCoverage: context.research?.sourceCoverage || 0,
    researchMode: context.research?.browserRendered ? 'browser-assisted-crawl' : 'fast-fetch',
    pages: context.research?.pages || [],
  }) : null;
  return research.validateAnalysisIdentity(analysis, result);
}

function isCreativeFlowImage(input = {}) {
  return Boolean(
    input
    && input.quality === 'high'
    && input.brandLock
    && input.brief
    && (Array.isArray(input.referenceAssetIds) || Array.isArray(input.referenceUrls))
  );
}

function fallbackProductionBrief(input = {}) {
  const brief = input.brief || {};
  return {
    layoutArchetype: 'editorial SaaS feature spotlight',
    headline: cleanWords(brief.headline || brief.objective || input.prompt, 8, 100),
    supportingCopy: '',
    cta: cleanWords(brief.cta, 4, 60),
    typography: 'Modern editorial sans-serif with one strong display headline, clean body scale, consistent alignment, generous line height and no decorative novelty font.',
    composition: 'Use one clear focal product visual and one dedicated copy zone. Keep at least 8% safe margin on all sides. Separate copy, product UI and decorative accents into distinct non-overlapping regions.',
    productTreatment: 'Treat supplied product/dashboard references as source material, not stickers. Recompose them naturally into a premium device/browser frame or clean product scene. Never stack duplicate screenshots or place UI underneath text.',
    brandTreatment: 'Use the extracted brand palette as the visual system. If an official logo reference is supplied, either integrate it once at a modest scale as part of the composition or omit it; never add a standalone logo strip, white header band or oversized top-left badge.',
    negativeConstraints: [
      'no overlapping text',
      'no text over screenshots or faces',
      'no pasted logo header',
      'no giant logo',
      'no fake dashboard',
      'no duplicate product UI',
      'no collage of unrelated cards',
      'no tiny unreadable body copy',
      'no random social icons unless the concept is specifically about integrations',
      'no generic AI poster aesthetic',
      'no unsupported claims'
    ]
  };
}

async function buildCreativeFlowProductionBrief(input = {}) {
  const brief = input.brief || {};
  const brand = input.brandLock || {};
  const fallback = fallbackProductionBrief(input);

  try {
    const parsed = await studio.callChatModel(studio.REASONING_MODEL, [
      {
        role: 'system',
        content: [
          'You are the senior production art director and prompt engineer for INXSocial Creative Flow.',
          'Your job is to turn one campaign concept into a concise, production-grade image-generation brief for a premium social ad.',
          'The result must look like a human-designed SaaS/social creative, not generic AI poster art.',
          'Use a single dominant layout idea. Prefer editorial SaaS layouts, product feature spotlights, clean workflow diagrams, device/browser-frame product showcases, or restrained lifestyle-plus-product compositions when appropriate.',
          'Typography rules: one primary headline only; maximum 8 words. Supporting copy is optional and maximum 12 words. CTA maximum 4 words. Never create paragraphs inside the image.',
          'Composition rules: reserve at least 8% safe margin; keep headline, CTA, logo/brand mark, faces and product UI in separate non-overlapping zones; maintain obvious hierarchy; avoid clutter.',
          'Product rules: supplied screenshots/UI are authoritative visual references. Never cover them with text. Never create multiple overlapping copies of the same dashboard. Never invent a competing dashboard when a product reference exists.',
          'Logo rules: never create a separate white logo header, logo strip or oversized badge. If an official logo is present in references, use it once at a modest scale only if it can be integrated naturally; otherwise omit it. Never redraw or fabricate a different logo.',
          'Brand rules: use the supplied palette and product evidence, but do not force every brand colour into one design.',
          'Quality rules: avoid tiny type, busy collage layouts, stock-template gradients, decorative stickers, random platform icons, awkward crops, text touching edges, or text crossing product imagery.',
          'Return JSON only with this exact shape:',
          '{"layoutArchetype":"string","headline":"string","supportingCopy":"string","cta":"string","typography":"string","composition":"string","productTreatment":"string","brandTreatment":"string","negativeConstraints":["string"]}'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          `Campaign concept: ${clean(input.prompt, 1400)}`,
          `Objective: ${clean(brief.objective, 300)}`,
          `Current headline idea: ${clean(brief.headline, 180)}`,
          `Current supporting copy: ${clean(brief.supportingCopy, 300)}`,
          `CTA idea: ${clean(brief.cta, 120)}`,
          `Visual direction: ${clean(brief.visualDirection, 3200)}`,
          `Audience: ${clean(brief.audience, 300)}`,
          `Platform: ${clean(input.platform || brief.platform || 'Instagram', 80)}`,
          `Brand: ${clean(brand.brandName, 160) || 'Unknown'}`,
          `Brand colours: ${Array.isArray(brand.colors) ? brand.colors.slice(0, 6).join(', ') : ''}`,
          `Authoritative references supplied: ${Number((input.referenceAssetIds || []).length) + Number((input.referenceUrls || []).length)}`,
          'Do not explain your reasoning. Return the production brief only.'
        ].join('\n\n')
      }
    ], {
      reasoningEffort: 'medium',
      temperature: 0.2,
      maxTokens: 1500,
      timeoutMs: 120000
    });

    return {
      layoutArchetype: clean(parsed.layoutArchetype || fallback.layoutArchetype, 160),
      headline: cleanWords(parsed.headline || fallback.headline, 8, 100),
      supportingCopy: cleanWords(parsed.supportingCopy, 12, 150),
      cta: cleanWords(parsed.cta || fallback.cta, 4, 60),
      typography: clean(parsed.typography || fallback.typography, 500),
      composition: clean(parsed.composition || fallback.composition, 900),
      productTreatment: clean(parsed.productTreatment || fallback.productTreatment, 900),
      brandTreatment: clean(parsed.brandTreatment || fallback.brandTreatment, 900),
      negativeConstraints: (Array.isArray(parsed.negativeConstraints) ? parsed.negativeConstraints : fallback.negativeConstraints)
        .map((item) => clean(item, 180))
        .filter(Boolean)
        .slice(0, 14)
    };
  } catch (error) {
    console.warn('[CREATIVE FLOW PROMPT ENGINE] fallback', { error: clean(error?.message, 300) });
    return fallback;
  }
}

async function generateImagePost(userId, input = {}) {
  if (!isCreativeFlowImage(input)) return baseGenerateImagePost(userId, input);

  const production = await buildCreativeFlowProductionBrief(input);
  const brand = input.brandLock || {};
  const enhancedDirection = [
    `LAYOUT ARCHETYPE: ${production.layoutArchetype}.`,
    `COMPOSITION: ${production.composition}`,
    `TYPOGRAPHY: ${production.typography}`,
    `PRODUCT TREATMENT: ${production.productTreatment}`,
    `BRAND TREATMENT: ${production.brandTreatment}`,
    production.negativeConstraints.length ? `HARD NEGATIVE CONSTRAINTS: ${production.negativeConstraints.join('; ')}.` : '',
    'Final QA before rendering: nothing may overlap; headline must remain fully legible; UI/screenshots must be unobstructed; all visible text must be intentionally aligned and comfortably inside safe margins; the composition must look like a professionally art-directed campaign asset.',
    'Do not add a standalone logo band, white logo header, pasted badge, or duplicated brand mark. Do not paste a dashboard as a floating card on top of unrelated content. Integrate product imagery into the layout naturally.'
  ].filter(Boolean).join('\n\n');

  const nextInput = {
    ...input,
    quality: 'high',
    prompt: [
      '[CREATIVE FLOW PRODUCTION V3]',
      clean(input.prompt, 1400),
      `Production layout: ${production.layoutArchetype}`,
      enhancedDirection
    ].filter(Boolean).join('\n\n').slice(0, 12000),
    // Creative Flow previously added a deterministic white logo header and a
    // pasted product card after OpenAI finished rendering. That produced the
    // visibly unprofessional strip/collage effect. Keep all references in the
    // OpenAI edit request, but disable post-render compositing so the design is
    // generated as one coherent composition.
    brandLock: {
      ...brand,
      lockLogo: false,
      useExactProductVisual: false
    },
    brief: {
      ...input.brief,
      headline: production.headline,
      supportingCopy: production.supportingCopy,
      cta: production.cta,
      visualStyle: `Production-grade ${production.layoutArchetype}; premium editorial SaaS/social campaign design`,
      visualDirection: enhancedDirection
    }
  };

  const asset = await baseGenerateImagePost(userId, nextInput);
  return {
    ...asset,
    qualityEngine: 'creative-flow-production-v3',
    productionLayout: production.layoutArchetype
  };
}

module.exports = {
  ...studio,
  fetchUrlContext,
  performSourceAnalysis,
  generateImagePost,
  buildCreativeFlowProductionBrief,
  saveReference: references.saveReference
};
