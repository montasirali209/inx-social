const { z } = require('zod');
const express = require('express');
const service = require('../services/ugcStudioService');

const createSchema = z.object({
  brandProfileId: z.string().trim().max(120).optional().nullable(),
  productUrl: z.string().trim().max(2000).optional().default(''),
  productDescription: z.string().trim().max(4000).optional().default(''),
  avatarId: z.string().trim().max(120).optional().nullable(),
  creatorMode: z.enum(['AUTO', 'SELECTED']).default('AUTO'),
  duration: z.number().int().refine(v => [15, 30, 60].includes(v), 'Choose 15, 30 or 60 seconds.'),
  adCount: z.number().int().refine(v => [1, 5, 10, 15, 20].includes(v), 'Choose 1, 5, 10, 15 or 20 ads.'),
  quality: z.enum(['STANDARD', 'PREMIUM']).default('STANDARD'),
  notes: z.string().trim().max(1200).optional().default('')
}).superRefine((value, ctx) => {
  if (!value.brandProfileId && !value.productUrl && !value.productDescription) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['productUrl'], message: 'Add a website, product or brand description.' });
  }
});

const estimateSchema = z.object({
  duration: z.number().int().refine(v => [15, 30, 60].includes(v), 'Choose 15, 30 or 60 seconds.'),
  adCount: z.number().int().refine(v => [1, 5, 10, 15, 20].includes(v), 'Choose 1, 5, 10, 15 or 20 ads.'),
  quality: z.enum(['STANDARD', 'PREMIUM']).default('STANDARD')
});

const brandSchema = z.object({
  url: z.string().trim().min(3).max(2000),
  refresh: z.boolean().optional().default(false)
});

const generateAvatarSchema = z.object({
  prompt: z.string().trim().min(8).max(1200),
  name: z.string().trim().min(2).max(80),
  category: z.string().trim().max(80).optional().default('Custom'),
  locale: z.string().trim().max(20).optional().default('en-GB'),
  voice: z.string().trim().max(100).optional().default('Pippa')
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
async function getAd(req, res, next) {
  try { res.json({ ad: await service.getAd(req.user.id, req.params.adId) }); } catch (error) { next(error); }
}
async function updateAd(req, res, next) {
  try { res.json({ ad: await service.updateAd(req.user.id, req.params.adId, editAdSchema.parse(req.body || {})) }); } catch (error) { next(error); }
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
    const avatar = await service.uploadCustomAvatar(req.user.id, {
      name,
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
async function removeAvatar(req, res, next) {
  try { await service.deleteCustomAvatar(req.user.id, req.params.avatarId); res.json({ ok: true }); } catch (error) { next(error); }
}
async function listMusic(req, res, next) {
  try { res.json({ tracks: await service.listMusicTracks() }); } catch (error) { next(error); }
}

module.exports = {
  overview, estimate, analyzeBrand, createCampaign, listCampaigns, getCampaign,
  getAd, updateAd, regenerateAd, regenerateScene,
  generateAvatar, uploadAvatar, avatarContent, removeAvatar, listMusic,
  avatarUploadMiddleware: express.raw({ type: ['image/png','image/jpeg','image/webp'], limit: '12mb' })
};
