const { z } = require('zod');
const prisma = require('../db/prisma');
const growth = require('../services/growthIntelligenceService');

async function writeAudit(userId, action, metadata = null) {
  if (!userId) return;
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: 'GrowthIntelligence',
        entityId: 'primary',
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
  } catch (error) {
    console.error('[GROWTH INTELLIGENCE AUDIT LOG FAILED]', error.message);
  }
}

async function overview(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await growth.overview());
  } catch (error) {
    next(error);
  }
}

async function runSiteAudit(req, res, next) {
  try {
    const result = await growth.runSiteAudit();
    await writeAudit(req.user.id, 'ADMIN_GROWTH_SITE_AUDIT_RUN', {
      score: result.score,
      crawlers: result.crawlers.map(item => ({ key: item.key, allowed: item.allowed }))
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

async function runOpenAIVisibility(req, res, next) {
  try {
    const input = z.object({
      limit: z.coerce.number().int().min(1).max(5).default(5)
    }).parse(req.body || {});
    const result = await growth.runOpenAIVisibilityScan(input.limit);
    await writeAudit(req.user.id, 'ADMIN_GROWTH_OPENAI_VISIBILITY_RUN', {
      promptsRun: result.promptsRun,
      successfulPrompts: result.successfulPrompts,
      mentionRate: result.mentionRate,
      citationRate: result.citationRate
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

async function discoverReddit(req, res, next) {
  try {
    const result = await growth.discoverRedditOpportunities();
    await writeAudit(req.user.id, 'ADMIN_GROWTH_REDDIT_DISCOVERY_RUN', {
      opportunities: result.threads.length
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  overview,
  runSiteAudit,
  runOpenAIVisibility,
  discoverReddit
};
