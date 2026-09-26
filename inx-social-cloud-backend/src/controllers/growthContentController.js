'use strict';

const { z } = require('zod');
const prisma = require('../db/prisma');
const content = require('../services/growthContentService');

async function writeAudit(userId, action, entityId, metadata = null) {
  if (!userId) return;
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: 'GrowthContent',
        entityId: entityId || 'content-engine',
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
  } catch (error) {
    console.error('[GROWTH CONTENT AUDIT LOG FAILED]', error.message);
  }
}

async function overview(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await content.overview());
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const input = z.object({
      status: z.enum(['DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED']).optional()
    }).parse(req.query || {});
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ articles: await content.listArticles({ status: input.status || null }) });
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ article: await content.getArticleById(req.params.id) });
  } catch (error) {
    next(error);
  }
}

async function createDraft(req, res, next) {
  try {
    const input = z.object({
      opportunityId: z.string().trim().max(180).optional(),
      topic: z.string().trim().max(280).optional(),
      intent: z.string().trim().max(100).optional(),
      action: z.string().trim().max(180).optional(),
      existingPage: z.string().trim().max(500).optional(),
      notes: z.string().trim().max(1000).optional()
    }).refine(value => Boolean(value.opportunityId || value.topic), {
      message: 'Choose an opportunity or provide a topic.'
    }).parse(req.body || {});

    const article = await content.createDraft(input);
    await writeAudit(req.user.id, 'ADMIN_GROWTH_CONTENT_DRAFT_CREATED', article.id, {
      slug: article.slug,
      title: article.title,
      opportunityId: article.opportunity_id,
      qualityScore: article.quality?.score || 0
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ article });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const faqItem = z.object({
      question: z.string().trim().min(2).max(220),
      answer: z.string().trim().min(2).max(900)
    });
    const input = z.object({
      slug: z.string().trim().min(2).max(100).optional(),
      title: z.string().trim().min(8).max(180).optional(),
      excerpt: z.string().trim().max(500).optional(),
      meta_description: z.string().trim().max(300).optional(),
      keywords: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
      content_markdown: z.string().trim().min(100).max(50000).optional(),
      faq: z.array(faqItem).max(6).optional(),
      featured_image_prompt: z.string().trim().max(1200).optional()
    }).parse(req.body || {});

    const article = await content.updateArticle(req.params.id, input);
    await writeAudit(req.user.id, 'ADMIN_GROWTH_CONTENT_UPDATED', article.id, {
      slug: article.slug,
      status: article.status,
      qualityScore: article.quality?.score || 0
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ article });
  } catch (error) {
    next(error);
  }
}

async function approve(req, res, next) {
  try {
    const article = await content.approveArticle(req.params.id);
    await writeAudit(req.user.id, 'ADMIN_GROWTH_CONTENT_APPROVED', article.id, {
      slug: article.slug,
      qualityScore: article.quality?.score || 0
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ article });
  } catch (error) {
    next(error);
  }
}

async function publish(req, res, next) {
  try {
    const article = await content.publishArticle(req.params.id);
    await writeAudit(req.user.id, 'ADMIN_GROWTH_CONTENT_PUBLISHED', article.id, {
      slug: article.slug,
      publishedAt: article.published_at
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ article });
  } catch (error) {
    next(error);
  }
}

async function unpublish(req, res, next) {
  try {
    const article = await content.unpublishArticle(req.params.id);
    await writeAudit(req.user.id, 'ADMIN_GROWTH_CONTENT_UNPUBLISHED', article.id, {
      slug: article.slug
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ article });
  } catch (error) {
    next(error);
  }
}

async function archive(req, res, next) {
  try {
    const article = await content.archiveArticle(req.params.id);
    await writeAudit(req.user.id, 'ADMIN_GROWTH_CONTENT_ARCHIVED', article.id, {
      slug: article.slug
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ article });
  } catch (error) {
    next(error);
  }
}

async function featuredImage(req, res, next) {
  try {
    const article = await content.generateFeaturedImage(req.params.id);
    await writeAudit(req.user.id, 'ADMIN_GROWTH_CONTENT_IMAGE_GENERATED', article.id, {
      slug: article.slug,
      providerCostUsd: article.featured_image_storage?.providerCostUsd || 0,
      model: article.featured_image_storage?.model || null
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ article });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  overview,
  list,
  detail,
  createDraft,
  update,
  approve,
  publish,
  unpublish,
  archive,
  featuredImage
};
