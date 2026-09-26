const { z } = require('zod');
const prisma = require('../db/prisma');
const growth = require('../services/growthIntelligenceService');
const externalVisibility = require('../services/externalVisibilityService');
const googleAnalytics = require('../services/googleAnalyticsService');
const opportunities = require('../services/growthOpportunityService');

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


async function runExternalVisibility(req, res, next) {
  try {
    const input = z.object({
      provider: z.enum(['perplexity', 'claude']),
      limit: z.coerce.number().int().min(1).max(5).default(5)
    }).parse(req.body || {});
    const result = await externalVisibility.runScan(input.provider, growth.DEFAULT_PROMPTS, input.limit);
    await writeAudit(req.user.id, 'ADMIN_GROWTH_EXTERNAL_VISIBILITY_RUN', {
      provider: input.provider,
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

async function analyticsStatus(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await googleAnalytics.status());
  } catch (error) {
    next(error);
  }
}

async function selectAnalyticsProperty(req, res, next) {
  try {
    const input = z.object({
      propertyId: z.string().trim().regex(/^\d+$/),
      manual: z.boolean().optional().default(false),
      displayName: z.string().trim().max(140).optional()
    }).parse(req.body || {});
    const selectedProperty = await googleAnalytics.selectProperty(input.propertyId, {
      manual: input.manual,
      displayName: input.displayName
    });
    await writeAudit(req.user.id, 'ADMIN_GROWTH_GA4_PROPERTY_SELECTED', {
      propertyId: selectedProperty.propertyId,
      displayName: selectedProperty.displayName
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, selectedProperty });
  } catch (error) {
    next(error);
  }
}

async function analyticsRealtime(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await googleAnalytics.realtime());
  } catch (error) {
    next(error);
  }
}

async function analyticsPerformance(req, res, next) {
  try {
    const input = z.object({
      days: z.coerce.number().int().refine(value => [7, 28, 90].includes(value)).default(28)
    }).parse(req.query || {});
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await googleAnalytics.performance(input.days));
  } catch (error) {
    next(error);
  }
}

async function opportunityStatus(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ latest: await opportunities.latest() });
  } catch (error) {
    next(error);
  }
}

async function buildOpportunities(req, res, next) {
  try {
    const input = z.object({
      days: z.coerce.number().int().refine(value => [7, 28, 90].includes(value)).default(28)
    }).parse(req.body || {});
    const result = await opportunities.build(input.days);
    await writeAudit(req.user.id, 'ADMIN_GROWTH_OPPORTUNITIES_BUILT', {
      days: result.periodDays,
      total: result.summary?.total || 0,
      critical: result.summary?.critical || 0,
      high: result.summary?.high || 0,
      warnings: result.warnings?.length || 0
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
  runExternalVisibility,
  analyticsStatus,
  selectAnalyticsProperty,
  analyticsRealtime,
  analyticsPerformance,
  opportunityStatus,
  buildOpportunities,
  discoverReddit
};
