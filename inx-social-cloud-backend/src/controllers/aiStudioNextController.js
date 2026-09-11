const { z } = require('zod');
const carouselStudio = require('../services/carouselStudioService');
const videoStudio = require('../services/videoStudioService');

const sourceAnalysisSchema = z.object({
  productName: z.string().max(160).optional(),
  summary: z.string().max(1200).optional(),
  positioning: z.string().max(800).optional(),
  verifiedClaims: z.array(z.string().max(400)).max(16).optional(),
  visualIdentity: z.array(z.string().max(320)).max(12).optional(),
  assetObservations: z.array(z.string().max(400)).max(12).optional(),
  strongestAngles: z.array(z.string().max(400)).max(10).optional(),
  cautions: z.array(z.string().max(400)).max(10).optional()
}).optional();

const briefSchema = z.object({
  objective: z.string().max(300).optional(), audience: z.string().max(300).optional(), platform: z.string().max(80).optional(),
  aspectRatio: z.string().max(20).optional(), tone: z.string().max(100).optional(), visualStyle: z.string().max(240).optional(),
  headline: z.string().max(220).optional(), supportingCopy: z.string().max(500).optional(), cta: z.string().max(180).optional(),
  visualDirection: z.string().max(6000).optional(), caption: z.string().max(10000).optional(), hashtags: z.array(z.string().max(100)).max(20).optional(),
  altText: z.string().max(2000).optional()
}).default({});

const carouselSchema = z.object({
  prompt: z.string().trim().min(2).max(1500),
  platform: z.string().trim().max(80).optional(),
  aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9']).default('1:1'),
  slides: z.coerce.number().int().min(3).max(10).default(5),
  referenceAssetIds: z.array(z.string().trim().min(1).max(120)).max(4).default([]),
  brief: briefSchema,
  sourceAnalysis: sourceAnalysisSchema
});

const videoSelectionSchema = z.object({
  modelRoute: z.enum(['fast', 'quality']).default('fast'),
  duration: z.coerce.number().int().min(2).max(15).default(5),
  resolution: z.enum(['480p', '720p', '1080p']).default('720p'),
  aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:5']).default('9:16'),
  draft: z.boolean().default(false),
  audio: z.boolean().default(true)
});

const videoGenerationSchema = videoSelectionSchema.extend({
  prompt: z.string().trim().min(2).max(1500),
  sourceMediaLibraryAssetId: z.string().trim().min(1).max(120).nullish(),
  caption: z.string().max(10000).optional(),
  hashtags: z.array(z.string().max(100)).max(20).optional(),
  script: z.string().max(5000).optional()
});

async function generateCarousel(req, res, next) {
  try { res.json(await carouselStudio.generateCarousel(req.user.id, carouselSchema.parse(req.body || {}))); } catch (error) { next(error); }
}

async function videoModels(req, res, next) {
  try { res.json({ models: videoStudio.catalog() }); } catch (error) { next(error); }
}

async function videoEstimate(req, res, next) {
  try {
    const input = videoSelectionSchema.parse(req.body || {});
    res.json({ credits: videoStudio.estimateCredits(input), source: 'backend', explanation: 'Credits update from the selected video model, duration, resolution and draft mode before generation starts.' });
  } catch (error) { next(error); }
}

async function generateVideo(req, res, next) {
  try { res.json(await videoStudio.generateVideo(req.user.id, videoGenerationSchema.parse(req.body || {}))); } catch (error) { next(error); }
}

module.exports = { generateCarousel, videoModels, videoEstimate, generateVideo };
