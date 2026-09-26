'use strict';

const { z } = require('zod');
const autopilot = require('../services/growthAutopilotService');

async function status(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await autopilot.status());
  } catch (error) {
    next(error);
  }
}

async function updateConfig(req, res, next) {
  try {
    const input = z.object({
      enabled: z.boolean().optional(),
      intelligenceEveryHours: z.coerce.number().min(6).max(168).optional(),
      publishEveryHours: z.coerce.number().min(24).max(336).optional(),
      opportunityWindowDays: z.coerce.number().refine(value => [7, 28, 90].includes(value)).optional(),
      visibilityPromptCount: z.coerce.number().int().min(1).max(5).optional(),
      minQualityScore: z.coerce.number().int().min(65).max(95).optional(),
      maxDraftAttempts: z.coerce.number().int().min(1).max(3).optional(),
      autoGenerateImage: z.boolean().optional(),
      autoPublish: z.boolean().optional(),
      retryHours: z.coerce.number().min(1).max(24).optional()
    }).parse(req.body || {});

    res.setHeader('Cache-Control', 'no-store');
    return res.json(await autopilot.updateConfig(input));
  } catch (error) {
    next(error);
  }
}

async function runNow(req, res, next) {
  try {
    void autopilot.runCycle({ force: true }).catch(error => {
      console.error('[growth-autopilot] admin-triggered cycle failed', { error: error?.message || String(error) });
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(202).json({ ok: true, message: 'Growth Autopilot cycle started.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  status,
  updateConfig,
  runNow
};
