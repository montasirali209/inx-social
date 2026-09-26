'use strict';

const { z } = require('zod');
const optimization = require('../services/growthOptimizationService');

async function status(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await optimization.status());
  } catch (error) {
    next(error);
  }
}

async function runNow(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await optimization.run({ days: 28, force: true }));
  } catch (error) {
    next(error);
  }
}

async function action(req, res, next) {
  try {
    const params = z.object({ id: z.string().trim().min(8).max(80) }).parse(req.params || {});
    const input = z.object({
      action: z.enum(['approve', 'apply', 'dismiss', 'done']),
      note: z.string().trim().max(700).optional()
    }).parse(req.body || {});
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await optimization.updateAction(params.id, input.action, input.note || ''));
  } catch (error) {
    next(error);
  }
}

module.exports = { status, runNow, action };
