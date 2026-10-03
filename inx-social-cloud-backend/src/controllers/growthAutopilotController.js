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
      aiModel: z.enum(['gpt-5.6-terra', 'gpt-5.6-sol']).optional(),
      aiReasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
      intelligenceEveryHours: z.coerce.number().min(6).max(168).optional(),
      editorialRadarEveryHours: z.coerce.number().min(3).max(24).optional(),
      hotTrendAutoEvaluate: z.boolean().optional(),
      maxArticlesPerLocalDay: z.coerce.number().int().min(1).max(3).optional(),
      publishEveryHours: z.coerce.number().min(24).max(336).optional(),
      dailyPublishTimeLocal: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
      publishTimeZone: z.string().min(1).max(80).optional(),
      authorityEveryHours: z.coerce.number().min(6).max(48).optional(),
      authorityAutoEmail: z.boolean().optional(),
      optimizationEveryHours: z.coerce.number().min(12).max(168).optional(),
      opportunityWindowDays: z.coerce.number().refine(value => [7, 28, 90].includes(value)).optional(),
      visibilityPromptCount: z.coerce.number().int().min(1).max(5).optional(),
      minQualityScore: z.coerce.number().int().min(65).max(95).optional(),
      maxDraftAttempts: z.coerce.number().int().min(1).max(3).optional(),
      autoGenerateImage: z.boolean().optional(),
      autoPublish: z.boolean().optional(),
      editorialRetryMinutes: z.coerce.number().min(5).max(30).optional(),
      retryHours: z.coerce.number().min(1).max(24).optional()
    }).parse(req.body || {});

    let effectiveInput = input;

    // Starting Autopilot applies a conservative operating profile. This keeps
    // the daily editorial lane while removing the high-frequency background
    // pattern that previously multiplied API calls.
    if (input.enabled === true) {
      const current = await autopilot.getConfig();
      effectiveInput = {
        ...input,
        intelligenceEveryHours: Math.max(Number(input.intelligenceEveryHours ?? current.intelligenceEveryHours ?? 24), 24),
        editorialRadarEveryHours: 24,
        hotTrendAutoEvaluate: false,
        maxArticlesPerLocalDay: 1,
        authorityEveryHours: 48,
        authorityAutoEmail: false,
        optimizationEveryHours: 168,
        visibilityPromptCount: 1,
        maxDraftAttempts: Math.min(Number(input.maxDraftAttempts ?? current.maxDraftAttempts ?? 2), 2),
        editorialRetryMinutes: 30,
        retryHours: Math.max(Number(input.retryHours ?? current.retryHours ?? 6), 6)
      };
    }

    const updated = await autopilot.updateConfig(effectiveInput);

    // Stop is a hard runtime stop. Persisting enabled=false alone prevents new
    // AI cycles, but these calls also remove the Autopilot-owned timers and
    // release its runtime lease. Start explicitly recreates those timers.
    if (input.enabled === false) {
      await autopilot.stopGrowthAutopilot();
    } else if (input.enabled === true) {
      autopilot.startGrowthAutopilot();
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json(await autopilot.status().catch(() => updated));
  } catch (error) {
    next(error);
  }
}

async function runNow(req, res, next) {
  try {
    const config = await autopilot.getConfig();
    if (config.enabled === false) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(409).json({
        ok: false,
        code: 'GROWTH_AUTOPILOT_STOPPED',
        message: 'Growth Autopilot is stopped. Press Start before running a manual cycle.'
      });
    }

    // A manual check must not force every expensive subsystem to become due at
    // once. It now runs only work that is actually due according to the saved
    // schedule, preventing one click from triggering intelligence + radar +
    // authority + optimisation + publishing simultaneously.
    void autopilot.runCycle({ force: false }).catch(error => {
      console.error('[growth-autopilot] admin-triggered cycle failed', { error: error?.message || String(error) });
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(202).json({ ok: true, message: 'Growth Autopilot due-work check started.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  status,
  updateConfig,
  runNow
};
