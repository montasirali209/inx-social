const { z } = require('zod');
const prisma = require('../db/prisma');
const env = require('../config/env');
const stripeService = require('../services/stripeService');
const creditService = require('../services/aiCreditService');
const studioService = require('../services/aiContentStudioService');
const postStudioService = require('../services/aiPostStudioService');
const runware = require('../services/runwareService');
const campaignService = require('../services/aiPostCampaignService');
const creativeFlowService = require('../services/creativeFlowService');

const contentType = z.enum(['image_post', 'carousel_post', 'short_video', 'ugc_ad']);
const generationSchema = z.object({
  type: contentType,
  prompt: z.string().trim().min(2).max(1500),
  platform: z.string().trim().max(80).optional(),
  aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9']).optional(),
  tone: z.string().trim().max(80).optional(),
  brandKitId: z.string().trim().max(100).optional(),
  options: z.record(z.unknown()).default({})
});
const assistantMessageSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(4000)
  })).min(1).max(18),
  urls: z.array(z.string().trim().min(1).max(2000)).max(2).default([]),
  referenceAssetIds: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
  platform: z.string().trim().max(80).optional(),
  aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9']).optional()
});
const conversationalImageSchema = z.object({
  prompt: z.string().trim().min(2).max(1500),
  platform: z.string().trim().max(80).optional(),
  aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9']).optional(),
  referenceAssetIds: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
  brief: z.object({
    objective: z.string().max(300).optional(),
    audience: z.string().max(300).optional(),
    platform: z.string().max(80).optional(),
    aspectRatio: z.string().max(20).optional(),
    tone: z.string().max(100).optional(),
    visualStyle: z.string().max(200).optional(),
    headline: z.string().max(200).optional(),
    supportingCopy: z.string().max(400).optional(),
    cta: z.string().max(160).optional(),
    visualDirection: z.string().max(6000).optional(),
    caption: z.string().max(10000).optional(),
    hashtags: z.array(z.string().max(100)).max(20).optional(),
    altText: z.string().max(2000).optional()
  }).default({})
});
const draftSchema = z.object({
  id: z.string().min(1).max(100),
  contentType,
  title: z.string().trim().min(1).max(200),
  thumbnailUrl: z.string().max(4000).nullish(),
  updatedAt: z.string().optional(),
  status: z.enum(['draft', 'ready']),
  prompt: z.string().max(1500).optional(),
  caption: z.string().max(10000).optional(),
  hashtags: z.array(z.string().max(100)).max(40).optional(),
  altText: z.string().max(2000).optional(),
  asset: z.record(z.unknown()).nullish(),
  mediaLibraryAsset: z.record(z.unknown()).nullish(),
  mediaLibraryAssets: z.array(z.record(z.unknown())).max(20).optional()
});

const campaignSchema = z.object({
  businessUrl: z.string().trim().max(2000).optional().default(''),
  goal: z.string().trim().min(8).max(1600),
  audience: z.string().trim().max(600).optional().default(''),
  contentMode: z.enum(['TEXT', 'IMAGE', 'MIXED']).default('TEXT'),
  platforms: z.array(z.string().trim().min(1).max(80)).min(1).max(9),
  postCount: z.number().int().min(10).max(30),
  imagePostCount: z.number().int().min(0).max(30).optional().default(0)
}).superRefine((value, context) => {
  if (value.contentMode === 'MIXED' && (value.imagePostCount < 1 || value.imagePostCount >= value.postCount)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['imagePostCount'], message: 'Mixed campaigns need at least one image post and one text post.' });
  }
});

const campaignPostSchema = z.object({
  pillar: z.string().max(180).optional(),
  hook: z.string().max(400).optional(),
  caption: z.string().max(7000).optional(),
  cta: z.string().max(300).optional(),
  hashtags: z.array(z.string().max(80)).max(10).optional(),
  imageBrief: z.string().max(4000).optional()
});


const creativeFlowAnalyzeSchema = z.object({
  website: z.string().trim().max(2000).optional().default(''),
  productName: z.string().trim().max(160).optional().default(''),
  prompt: z.string().trim().max(2500).optional().default(''),
  audience: z.string().trim().max(600).optional().default(''),
  referenceAssetIds: z.array(z.string().trim().min(1).max(120)).max(8).optional().default([])
}).superRefine((value, context) => {
  if (!value.website && !value.productName && !value.prompt && !value.referenceAssetIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['prompt'], message: 'Add a product website, product name, image or campaign brief.' });
  }
});

const creativeFlowSourceAnalysisSchema = z.object({
  fingerprint: z.string().max(120).optional().default(''),
  productName: z.string().max(160).optional().default(''),
  summary: z.string().max(1200).optional().default(''),
  positioning: z.string().max(800).optional().default(''),
  audience: z.array(z.string().max(240)).max(8).optional().default([]),
  verifiedClaims: z.array(z.string().max(360)).max(12).optional().default([]),
  visualIdentity: z.array(z.string().max(300)).max(10).optional().default([]),
  assetObservations: z.array(z.string().max(360)).max(10).optional().default([]),
  strongestAngles: z.array(z.string().max(360)).max(8).optional().default([]),
  cautions: z.array(z.string().max(360)).max(8).optional().default([]),
  sources: z.array(z.object({
    type: z.enum(['url', 'reference']),
    label: z.string().max(300),
    ok: z.boolean()
  })).max(10).optional().default([])
});

const creativeFlowStrategySchema = z.object({
  productName: z.string().trim().max(160).optional().default(''),
  prompt: z.string().trim().min(2).max(2500),
  platforms: z.array(z.string().trim().min(1).max(80)).max(8).optional().default([]),
  creativeCount: z.number().int().min(1).max(50).default(20),
  goal: z.string().trim().max(120).optional().default('auto'),
  style: z.string().trim().max(160).optional().default('auto'),
  audience: z.string().trim().max(600).optional().default(''),
  sourceAnalysis: creativeFlowSourceAnalysisSchema
});


const creativeFlowBrandRefSchema = z.object({
  url: z.string().trim().max(2000),
  kind: z.string().trim().max(40).optional().default('reference'),
  label: z.string().trim().max(180).optional().default('Official reference')
});

const creativeFlowBrandPackSchema = z.object({
  sourceUrl: z.string().trim().max(2000).nullish(),
  brandName: z.string().trim().max(160).optional().default(''),
  colors: z.array(z.string().trim().max(24)).max(6).optional().default([]),
  logo: creativeFlowBrandRefSchema.nullish(),
  icon: creativeFlowBrandRefSchema.nullish(),
  productVisuals: z.array(creativeFlowBrandRefSchema).max(4).optional().default([]),
  heroVisuals: z.array(creativeFlowBrandRefSchema).max(4).optional().default([]),
  confidence: z.enum(['high', 'medium', 'low']).optional().default('low'),
  confidenceScore: z.number().min(0).max(100).optional().default(0),
  lockLogo: z.boolean().optional().default(false)
});

const creativeFlowConceptSchema = z.object({
  sequence: z.number().int().min(1).max(100),
  angle: z.string().trim().min(1).max(160),
  hook: z.string().trim().min(1).max(220),
  visualStyle: z.string().trim().min(1).max(300),
  message: z.string().trim().min(1).max(600),
  cta: z.string().trim().max(180).optional().default(''),
  platformApproach: z.string().trim().max(260).optional().default(''),
  evidenceBasis: z.enum(['verified_source', 'user_brief', 'brand_safe_generic']).optional().default('brand_safe_generic')
});

const creativeFlowFoundationSchema = z.object({
  campaignTitle: z.string().trim().max(160).optional().default('Creative Flow Campaign'),
  strategySummary: z.string().trim().max(1800).optional().default(''),
  audienceSummary: z.string().trim().max(1000).optional().default(''),
  contentPillars: z.array(z.string().trim().max(180)).max(8).optional().default([]),
  creativePrinciples: z.array(z.string().trim().max(220)).max(8).optional().default([]),
  claimGuardrails: z.array(z.string().trim().max(260)).max(10).optional().default([])
});

const creativeFlowRenderSchema = z.object({
  website: z.string().trim().max(2000).optional().default(''),
  productName: z.string().trim().max(160).optional().default(''),
  prompt: z.string().trim().min(2).max(2500),
  platforms: z.array(z.string().trim().min(1).max(80)).max(8).optional().default([]),
  goal: z.string().trim().max(120).optional().default('auto'),
  style: z.string().trim().max(160).optional().default('auto'),
  audience: z.string().trim().max(600).optional().default(''),
  referenceAssetIds: z.array(z.string().trim().min(1).max(120)).max(8).optional().default([]),
  sourceAnalysis: creativeFlowSourceAnalysisSchema,
  brandPack: creativeFlowBrandPackSchema,
  strategy: creativeFlowFoundationSchema,
  concepts: z.array(creativeFlowConceptSchema).min(1).max(50)
});

const creativeFlowHandoffSchema = z.object({
  approvedPostIds: z.array(z.string().trim().min(1).max(120)).min(1).max(50)
});

const TRANSIENT_AI_STATUSES = new Set([500, 502, 503, 504]);

function topupPacks() {
  return [250, 500, 1000, 2500].map(credits => ({ credits, priceId: env.aiCredits.topupPriceIds[String(credits)] || '' })).filter(pack => Boolean(pack.priceId));
}

function transientOpenAIError(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || '');
  return TRANSIENT_AI_STATUSES.has(status) && code.startsWith('OPENAI_');
}

async function withStudioRetry(operation, label) {
  try {
    return await operation();
  } catch (error) {
    if (!transientOpenAIError(error)) throw error;
    console.warn(`[AI POST STUDIO] ${label} transient failure (${error.code || error.status}); retrying once.`);
    await new Promise(resolve => setTimeout(resolve, 900));
    return operation();
  }
}

async function access(req, res, next) {
  try {
    const value = await creditService.getAccess(req.user.id);
    res.json({ ...value, providerConfigured: postStudioService.isConfigured() || runware.isConfigured(), topupsSupported: Boolean(value.topupsEnabled && topupPacks().length > 0) });
  } catch (error) { next(error); }
}

async function balance(req, res, next) {
  try { res.json(await creditService.getBalance(req.user.id)); } catch (error) { next(error); }
}

async function estimate(req, res, next) {
  try {
    const input = generationSchema.parse(req.body || {});
    await creditService.getBalance(req.user.id);
    res.json({ credits: studioService.estimateGenerationCost(input), source: 'backend', explanation: 'Fixed INXSocial Studio credits. Provider cost never changes the displayed customer credit price after generation starts.' });
  } catch (error) { next(error); }
}

async function uploadReference(req, res, next) {
  try {
    const encodedName = String(req.headers['x-file-name'] || 'reference');
    let fileName = encodedName;
    try { fileName = decodeURIComponent(encodedName); } catch (_) { /* keep raw name */ }
    const reference = await postStudioService.saveReference(req.user.id, {
      fileName,
      mimeType: String(req.headers['content-type'] || 'application/octet-stream').split(';')[0],
      data: Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    });
    res.status(201).json({ reference });
  } catch (error) { next(error); }
}

async function assistantMessage(req, res, next) {
  try {
    const input = assistantMessageSchema.parse(req.body || {});
    res.json(await withStudioRetry(() => postStudioService.assistantReply(req.user.id, input), 'assistant'));
  } catch (error) { next(error); }
}

async function generateConversationalImagePost(req, res, next) {
  try {
    const input = conversationalImageSchema.parse(req.body || {});
    res.json(await withStudioRetry(() => postStudioService.generateImagePost(req.user.id, input), 'image render'));
  } catch (error) { next(error); }
}

function generation(expectedType) {
  return async (req, res, next) => {
    try {
      const input = generationSchema.parse({ ...(req.body || {}), type: expectedType });
      res.json(await studioService.generate(req.user.id, input));
    } catch (error) { next(error); }
  };
}

async function generationStatus(req, res, next) {
  try { res.json(await studioService.getGeneration(req.user.id, req.params.id)); } catch (error) { next(error); }
}

async function cancelGeneration(req, res, next) {
  try { res.json(await studioService.cancelGeneration(req.user.id, req.params.id)); } catch (error) { next(error); }
}

async function dismissGeneration(req, res, next) {
  try { await studioService.dismissGeneration(req.user.id, req.params.id); res.json({ ok: true }); } catch (error) { next(error); }
}

async function recentDrafts(req, res, next) {
  try {
    const limit = z.coerce.number().int().min(1).max(40).default(8).parse(req.query.limit);
    res.json({ drafts: await studioService.recentDrafts(req.user.id, limit) });
  } catch (error) { next(error); }
}

async function saveDraft(req, res, next) {
  try { res.json(await studioService.saveDraft(req.user.id, draftSchema.parse(req.body || {}))); } catch (error) { next(error); }
}

async function deleteDraft(req, res, next) {
  try { await studioService.deleteDraft(req.user.id, req.params.id); res.json({ ok: true }); } catch (error) { next(error); }
}

async function sendDraftToPosts(req, res, next) {
  try { res.json(await studioService.sendDraftToPosts(req.user.id, req.params.id)); } catch (error) { next(error); }
}

async function generationHistory(req, res, next) {
  try {
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
    res.json({ history: await studioService.history(req.user.id, limit) });
  } catch (error) { next(error); }
}

async function brandKits(req, res, next) {
  try { res.json({ brandKits: await studioService.brandKits(req.user.id) }); } catch (error) { next(error); }
}

async function packs(req, res, next) {
  try {
    const entitlement = await creditService.getEntitlement(req.user.id);
    res.json({ supported: entitlement.topupsEnabled && topupPacks().length > 0, packs: topupPacks().map(({ credits }) => ({ credits })) });
  } catch (error) { next(error); }
}

async function createTopupCheckout(req, res, next) {
  try {
    const input = z.object({ credits: z.number().int() }).parse(req.body || {});
    const pack = topupPacks().find(item => item.credits === input.credits);
    if (!pack) return res.status(503).json({ error: 'This AI credit top-up is not configured in Stripe.' });
    const entitlement = await creditService.getEntitlement(req.user.id);
    if (!entitlement.topupsEnabled) return res.status(403).json({ error: 'AI credit top-ups are available on paid INXSocial plans.' });
    const stripe = stripeService.getStripe();
    const subscription = await prisma.subscription.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
    let customerId = subscription?.providerCustomerId || null;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: req.user.email, name: req.user.name || undefined, metadata: { userId: req.user.id, product: 'INX Social' } });
      customerId = customer.id;
      if (subscription) await prisma.subscription.update({ where: { id: subscription.id }, data: { providerCustomerId: customerId } });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [{ price: pack.priceId, quantity: 1 }],
      success_url: `${env.portalUrl.replace(/\/$/, '')}/app/billing?credits=success`,
      cancel_url: `${env.portalUrl.replace(/\/$/, '')}/app/billing?credits=cancelled`,
      allow_promotion_codes: true,
      client_reference_id: req.user.id,
      metadata: { product: 'inx_ai_credit_topup', userId: req.user.id, credits: String(pack.credits) }
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (error) { next(error); }
}

async function analyzeCreativeFlow(req, res, next) {
  try {
    const input = creativeFlowAnalyzeSchema.parse(req.body || {});
    res.json(await withStudioRetry(
      () => creativeFlowService.analyzeCreativeFlow(req.user.id, input),
      'Creative Flow source analysis'
    ));
  } catch (error) { next(error); }
}

async function planCreativeFlow(req, res, next) {
  try {
    const input = creativeFlowStrategySchema.parse(req.body || {});
    res.json(await withStudioRetry(
      () => creativeFlowService.planCreativeFlow(req.user.id, input),
      'Creative Flow strategy'
    ));
  } catch (error) { next(error); }
}

async function startCreativeFlowRender(req, res, next) {
  try {
    const input = creativeFlowRenderSchema.parse(req.body || {});
    res.status(202).json(await creativeFlowService.startCreativeFlowRender(req.user.id, input));
  } catch (error) { next(error); }
}

async function getCreativeFlowRender(req, res, next) {
  try {
    res.json({ campaign: await creativeFlowService.getCreativeFlowRender(req.user.id, req.params.campaignId) });
  } catch (error) { next(error); }
}

async function retryCreativeFlowRender(req, res, next) {
  try {
    res.status(202).json({ campaign: await creativeFlowService.retryCreativeFlowRender(req.user.id, req.params.campaignId) });
  } catch (error) { next(error); }
}

async function regenerateCreativeFlowPost(req, res, next) {
  try {
    res.json({ campaign: await withStudioRetry(
      () => creativeFlowService.regenerateCreativeFlowPost(req.user.id, req.params.campaignId, req.params.postId),
      'Creative Flow image regeneration'
    ) });
  } catch (error) { next(error); }
}

async function deleteCreativeFlowRender(req, res, next) {
  try {
    res.json(await creativeFlowService.removeCreativeFlowRender(req.user.id, req.params.campaignId));
  } catch (error) { next(error); }
}

async function handoffCreativeFlowCampaign(req, res, next) {
  try {
    const input = creativeFlowHandoffSchema.parse(req.body || {});
    res.status(201).json(await creativeFlowService.handoffCreativeFlowCampaign(
      req.user.id,
      req.params.campaignId,
      input.approvedPostIds
    ));
  } catch (error) { next(error); }
}

async function createCampaign(req, res, next) {
  try {
    const input = campaignSchema.parse(req.body || {});
    res.status(201).json({ campaign: await campaignService.generateCampaign(req.user.id, input) });
  } catch (error) { next(error); }
}

async function listCampaigns(req, res, next) {
  try {
    const limit = z.coerce.number().int().min(1).max(20).default(8).parse(req.query.limit);
    res.json({ campaigns: await campaignService.listCampaigns(req.user.id, limit) });
  } catch (error) { next(error); }
}

async function getCampaign(req, res, next) {
  try {
    res.json({ campaign: await campaignService.getCampaign(req.user.id, req.params.campaignId) });
  } catch (error) { next(error); }
}

async function updateCampaignPost(req, res, next) {
  try {
    const input = campaignPostSchema.parse(req.body || {});
    res.json({ campaign: await campaignService.updatePost(req.user.id, req.params.campaignId, req.params.postId, input) });
  } catch (error) { next(error); }
}

async function regenerateCampaignPost(req, res, next) {
  try {
    res.json({ campaign: await campaignService.regeneratePost(req.user.id, req.params.campaignId, req.params.postId) });
  } catch (error) { next(error); }
}

async function generateCampaignPostImage(req, res, next) {
  try {
    res.json({ campaign: await withStudioRetry(
      () => campaignService.generatePostImage(req.user.id, req.params.campaignId, req.params.postId),
      'campaign image render'
    ) });
  } catch (error) { next(error); }
}

async function deleteCampaign(req, res, next) {
  try {
    res.json(await campaignService.removeCampaign(req.user.id, req.params.campaignId));
  } catch (error) { next(error); }
}

async function creditWebhook(req, res) {
  let event;
  try {
    if (!env.aiCredits.stripeWebhookSecret) return res.status(503).send('AI credit Stripe webhook is not configured');
    const stripe = stripeService.getStripe();
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], env.aiCredits.stripeWebhookSecret);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
  try {
    if (event.type !== 'checkout.session.completed') return res.json({ received: true, ignored: true });
    const session = event.data.object;
    if (session.metadata?.product !== 'inx_ai_credit_topup' || session.payment_status !== 'paid') return res.json({ received: true, ignored: true });
    const userId = session.metadata?.userId || session.client_reference_id;
    const amount = Number(session.metadata?.credits || 0);
    if (!userId || ![250, 500, 1000, 2500].includes(amount)) return res.status(400).json({ error: 'Invalid AI credit checkout metadata.' });
    const balance = await creditService.addTopup(userId, amount, `stripe:${session.id}`, { stripeSessionId: session.id, paymentIntent: session.payment_intent || null });
    await prisma.auditLog.create({ data: { userId, action: 'AI_CREDITS_TOPPED_UP', entity: 'AiCreditWallet', metadata: JSON.stringify({ credits: amount, stripeSessionId: session.id }) } }).catch(() => {});
    return res.json({ received: true, balance });
  } catch (error) {
    console.error('[AI CREDIT WEBHOOK]', error.message);
    return res.status(500).json({ error: 'AI credit webhook processing failed' });
  }
}

module.exports = {
  access, balance, estimate, uploadReference, assistantMessage, generateConversationalImagePost,
  generateImagePost: generation('image_post'),
  generateCarouselPost: generation('carousel_post'),
  generateShortVideo: generation('short_video'),
  generateUGCAd: generation('ugc_ad'),
  generationStatus, cancelGeneration, dismissGeneration, recentDrafts, saveDraft, deleteDraft, sendDraftToPosts,
  generationHistory, brandKits, packs, createTopupCheckout, creditWebhook,
  analyzeCreativeFlow, planCreativeFlow, startCreativeFlowRender, getCreativeFlowRender, retryCreativeFlowRender, regenerateCreativeFlowPost, deleteCreativeFlowRender, handoffCreativeFlowCampaign,
  createCampaign, listCampaigns, getCampaign, updateCampaignPost, regenerateCampaignPost, generateCampaignPostImage, deleteCampaign
};
