const { z } = require('zod');
const express = require('express');
const service = require('../services/ugcStudioService');
const analytics = require('../services/ugcStudioAnalyticsService');

const durations = [15, 20, 30];
const counts = [1, 5, 10, 15, 20];

const createSchema = z.object({
  brandProfileId: z.string().trim().max(120).optional().nullable(),
  productUrl: z.string().trim().max(2000).optional().default(''),
  productDescription: z.string().trim().max(4000).optional().default(''),
  productAssetIds: z.array(z.string().trim().min(1).max(120)).max(8).optional().default([]),
  sourceType: z.enum(['WEBSITE', 'PRODUCT', 'BRIEF']).optional().default('WEBSITE'),
  campaignType: z.enum(['AUTO', 'AVATAR_EXPLAINER', 'PRODUCT_SHOWCASE']).optional().default('AUTO'),
  creativeFormat: z.enum(['AUTO','PROBLEM_SOLUTION','PRODUCT_DEMO','TESTIMONIAL','UNBOXING','REACTION','BEFORE_AFTER','STORYTIME','SPOKESPERSON','PRODUCT_FOCUSED']).optional().default('AUTO'),
  avatarId: z.string().trim().max(120).optional().nullable(),
  creatorMode: z.enum(['AUTO', 'SELECTED']).default('AUTO'),
  duration: z.number().int().refine(v => durations.includes(v), 'Choose 15, 20 or 30 seconds.'),
  adCount: z.number().int().refine(v => counts.includes(v), 'Choose 1, 5, 10, 15 or 20 ads.'),
  quality: z.enum(['STANDARD', 'PREMIUM']).default('STANDARD'),
  notes: z.string().trim().max(1200).optional().default('')
}).superRefine((value, ctx) => {
  if (!value.brandProfileId && !value.productUrl && !value.productDescription && !value.productAssetIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['productUrl'], message: 'Add a website, product image or short brand description.' });
  }
});

const estimateSchema = z.object({
  duration: z.number().int().refine(v => durations.includes(v), 'Choose 15, 20 or 30 seconds.'),
  adCount: z.number().int().refine(v => counts.includes(v), 'Choose 1, 5, 10, 15 or 20 ads.'),
  quality: z.enum(['STANDARD', 'PREMIUM']).default('STANDARD'),
  campaignType: z.enum(['AUTO', 'AVATAR_EXPLAINER', 'PRODUCT_SHOWCASE']).optional().default('AUTO'),
  creativeFormat: z.enum(['AUTO','PROBLEM_SOLUTION','PRODUCT_DEMO','TESTIMONIAL','UNBOXING','REACTION','BEFORE_AFTER','STORYTIME','SPOKESPERSON','PRODUCT_FOCUSED']).optional().default('AUTO')
});

const brandSchema = z.object({
  url: z.string().trim().min(3).max(2000),
  refresh: z.boolean().optional().default(false)
});

const generateAvatarSchema = z.object({
  prompt: z.string().trim().min(8).max(1200),
  name: z.string().trim().min(2).max(80),
  category: z.string().trim().max(80).optional().default('Lifestyle'),
  presentation: z.string().trim().max(80).optional().default('Unspecified'),
  ageBand: z.string().trim().max(80).optional().default('Adult'),
  locale: z.string().trim().max(20).optional().default('en-GB'),
  accent: z.string().trim().max(80).optional().default(''),
  niches: z.array(z.string().trim().min(1).max(100)).max(8).optional().default([]),
  voice: z.string().trim().max(100).optional().default('')
});

const editAdSchema = z.object({
  avatarId: z.string().trim().max(120).nullable().optional(),
  script: z.string().trim().min(2).max(12000).optional(),
  voice: z.string().trim().max(100).optional(),
  voicePrompt: z.string().trim().max(500).optional(),
  musicMode: z.enum(['AUTO', 'NONE']).optional(),
  captionsEnabled: z.boolean().optional(),
  cta: z.string().trim().max(500).optional(),
  caption: z.string().trim().max(10000).optional()
});

const eventSchema = z.object({
  event: z.string().trim().min(2).max(80),
  stage: z.string().trim().max(80).optional().nullable(),
  campaignId: z.string().trim().max(120).optional().nullable(),
  adId: z.string().trim().max(120).optional().nullable(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({})
});

async function overview(req, res, next) {
  try { res.json(await service.getOverview(req.user.id)); } catch (error) { next(error); }
}
async function estimate(req, res, next) {
  try { res.json(await service.estimateCampaign(req.user.id, estimateSchema.parse(req.body || {}))); } catch (error) { next(error); }
}
async function analyzeBrand(req, res, next) {
  try { res.json({ brand: await service.analyzeBrand(req.user.id, brandSchema.parse(req.body || {})) }); } catch (error) { next(error); }
}
async function createCampaign(req, res, next) {
  try { res.status(201).json({ campaign: await service.createCampaign(req.user.id, createSchema.parse(req.body || {})) }); } catch (error) { next(error); }
}
async function listCampaigns(req, res, next) {
  try {
    const limit = z.coerce.number().int().min(1).max(30).default(12).parse(req.query.limit);
    res.json({ campaigns: await service.listCampaigns(req.user.id, limit) });
  } catch (error) { next(error); }
}
async function getCampaign(req, res, next) {
  try { res.json({ campaign: await service.getCampaign(req.user.id, req.params.campaignId) }); } catch (error) { next(error); }
}
async function getEngineProject(req, res, next) {
  try { res.json({ engine: await service.getEngineProject(req.user.id, req.params.campaignId) }); } catch (error) { next(error); }
}
async function getProductionAudit(req, res, next) {
  try { res.json({ audit: await service.getProductionAudit(req.user.id, req.params.campaignId) }); } catch (error) { next(error); }
}
async function removeCampaign(req, res, next) {
  try { await service.deleteCampaign(req.user.id, req.params.campaignId); res.json({ ok: true }); } catch (error) { next(error); }
}
async function getAd(req, res, next) {
  try { res.json({ ad: await service.getAd(req.user.id, req.params.adId) }); } catch (error) { next(error); }
}
async function updateAd(req, res, next) {
  try { res.json({ ad: await service.updateAd(req.user.id, req.params.adId, editAdSchema.parse(req.body || {})) }); } catch (error) { next(error); }
}
async function reassembleAd(req, res, next) {
  try { res.status(202).json({ ad: await service.reassembleAd(req.user.id, req.params.adId) }); } catch (error) { next(error); }
}
async function regenerateAd(req, res, next) {
  try { res.status(202).json({ ad: await service.regenerateAd(req.user.id, req.params.adId) }); } catch (error) { next(error); }
}
async function regenerateScene(req, res, next) {
  try { res.status(202).json({ ad: await service.regenerateScene(req.user.id, req.params.sceneId) }); } catch (error) { next(error); }
}
async function generateAvatar(req, res, next) {
  try { res.status(201).json({ avatar: await service.generateCustomAvatar(req.user.id, generateAvatarSchema.parse(req.body || {})) }); } catch (error) { next(error); }
}
async function uploadAvatar(req, res, next) {
  try {
    const encoded = String(req.headers['x-file-name'] || 'Custom avatar');
    let name = encoded;
    try { name = decodeURIComponent(encoded); } catch (_) {}
    const decodeHeader = (key, fallback = '') => {
      const raw = String(req.headers[key] || fallback);
      try { return decodeURIComponent(raw); } catch (_) { return raw; }
    };
    const avatar = await service.uploadCustomAvatar(req.user.id, {
      name,
      category: decodeHeader('x-creator-category', 'Lifestyle'),
      presentation: decodeHeader('x-creator-presentation', 'Unspecified'),
      ageBand: decodeHeader('x-creator-age-band', 'Adult'),
      locale: decodeHeader('x-creator-locale', 'en-GB'),
      accent: decodeHeader('x-creator-accent', ''),
      mimeType: String(req.headers['content-type'] || 'application/octet-stream').split(';')[0],
      data: Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    });
    res.status(201).json({ avatar });
  } catch (error) { next(error); }
}
async function avatarContent(req, res, next) {
  try {
    const value = await service.getAvatarContent(req.user.id, req.params.avatarId);
    res.setHeader('Content-Type', value.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(value.data);
  } catch (error) { next(error); }
}

async function avatarReferences(req, res, next) {
  try { res.json(await service.listAvatarReferences(req.user.id, req.params.avatarId)); } catch (error) { next(error); }
}
async function uploadAvatarReference(req, res, next) {
  try {
    const encoded = String(req.headers['x-reference-label'] || req.headers['x-file-name'] || 'Alternate reference');
    let label = encoded;
    try { label = decodeURIComponent(encoded); } catch (_) {}
    const reference = await service.uploadAvatarReference(req.user.id, req.params.avatarId, {
      label,
      mimeType: String(req.headers['content-type'] || 'application/octet-stream').split(';')[0],
      data: Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    });
    res.status(201).json({ reference });
  } catch (error) { next(error); }
}
async function avatarReferenceContent(req, res, next) {
  try {
    const value = await service.getAvatarReferenceContent(req.user.id, req.params.avatarId, req.params.referenceId);
    res.setHeader('Content-Type', value.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(value.data);
  } catch (error) { next(error); }
}
async function removeAvatarReference(req, res, next) {
  try {
    await service.deleteAvatarReference(req.user.id, req.params.avatarId, req.params.referenceId);
    res.json({ ok: true });
  } catch (error) { next(error); }
}
async function removeAvatar(req, res, next) {
  try { await service.deleteCustomAvatar(req.user.id, req.params.avatarId); res.json({ ok: true }); } catch (error) { next(error); }
}
async function uploadProduct(req, res, next) {
  try {
    const encoded = String(req.headers['x-file-name'] || 'Product image');
    let name = encoded;
    try { name = decodeURIComponent(encoded); } catch (_) {}
    const asset = await service.uploadProductAsset(req.user.id, {
      name,
      brandProfileId: String(req.headers['x-brand-profile-id'] || '').trim() || null,
      mimeType: String(req.headers['content-type'] || 'application/octet-stream').split(';')[0],
      data: Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    });
    res.status(201).json({ asset });
  } catch (error) { next(error); }
}
async function productContent(req, res, next) {
  try {
    const value = await service.getProductAssetContent(req.user.id, req.params.assetId);
    res.setHeader('Content-Type', value.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(value.data);
  } catch (error) { next(error); }
}
async function samples(req, res, next) {
  try { res.json({ samples: await service.listSampleVideos() }); } catch (error) { next(error); }
}
async function sampleContent(req, res, next) {
  try {
    const value = await service.getSampleVideoContent(req.params.sampleId);
    res.setHeader('Content-Type', value.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(value.data);
  } catch (error) { next(error); }
}
async function uploadSample(req, res, next) {
  try {
    const title = String(req.headers['x-sample-title'] || 'UGC sample').slice(0, 140);
    const sample = await service.uploadSampleVideo(req.user, {
      title,
      description: String(req.headers['x-sample-description'] || '').slice(0, 600),
      campaignType: ['AVATAR_EXPLAINER','PRODUCT_SHOWCASE'].includes(String(req.headers['x-campaign-type'])) ? String(req.headers['x-campaign-type']) : 'AVATAR_EXPLAINER',
      quality: String(req.headers['x-quality']).toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'STANDARD',
      duration: [15,20,30].includes(Number(req.headers['x-duration'])) ? Number(req.headers['x-duration']) : 15,
      sortOrder: Number(req.headers['x-sort-order'] || 0),
      name: decodeURIComponent(String(req.headers['x-file-name'] || 'ugc-sample.mp4')),
      mimeType: String(req.headers['content-type'] || 'video/mp4').split(';')[0],
      data: Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    });
    res.status(201).json({ sample });
  } catch (error) { next(error); }
}
async function listMusic(req, res, next) {
  try { res.json({ tracks: await service.listMusicTracks() }); } catch (error) { next(error); }
}
async function trackEvent(req, res, next) {
  try {
    await analytics.track(req.user.id, eventSchema.parse(req.body || {}));
    res.status(202).json({ ok: true });
  } catch (error) { next(error); }
}

module.exports = {
  overview, estimate, analyzeBrand, createCampaign, listCampaigns, getCampaign, getEngineProject, getProductionAudit, removeCampaign,
  getAd, updateAd, reassembleAd, regenerateAd, regenerateScene,
  generateAvatar, uploadAvatar, avatarContent, avatarReferences, uploadAvatarReference, avatarReferenceContent, removeAvatarReference, removeAvatar,
  uploadProduct, productContent, samples, sampleContent, uploadSample, listMusic, trackEvent,
  avatarUploadMiddleware: express.raw({ type: ['image/png','image/jpeg','image/webp'], limit: '12mb' }),
  productUploadMiddleware: express.raw({ type: ['image/png','image/jpeg','image/webp'], limit: '15mb' }),
  sampleUploadMiddleware: express.raw({ type: ['video/mp4','video/webm','video/quicktime'], limit: '200mb' })
};
