'use strict';

const prisma = require('../db/prisma');
const growthContent = require('./growthContentService');

const ACTION = 'ONE_OFF_GROWTH_FEATURED_IMAGE_REPAIR';

async function runOneOffGrowthImageRepair() {
  const slug = String(process.env.ONE_OFF_GROWTH_IMAGE_REPAIR_SLUG || '').trim();
  if (!slug) return { skipped: true, reason: 'disabled' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('[growth-image-repair] invalid article slug');
  }

  const article = await growthContent.getArticleBySlug(slug, { publishedOnly: true });
  if (!article) throw new Error('[growth-image-repair] published article not found: ' + slug);

  if (article.featured_image_storage?.imageProvider === 'openai') {
    console.info('[growth-image-repair] OpenAI image already present; skipping', { slug });
    return { skipped: true, reason: 'already-openai', articleId: article.id };
  }

  const repaired = await growthContent.generateFeaturedImage(article.id);
  const result = {
    skipped: false,
    articleId: repaired.id,
    slug: repaired.slug,
    provider: repaired.featured_image_storage?.imageProvider || null,
    model: repaired.featured_image_storage?.model || null,
    generatedAt: repaired.featured_image_storage?.generatedAt || null
  };

  await prisma.auditLog.create({
    data: {
      userId: null,
      action: ACTION,
      entity: 'GrowthContentArticle',
      entityId: repaired.id,
      metadata: JSON.stringify(result)
    }
  }).catch(error => console.warn('[growth-image-repair] audit log failed', { error: error?.message }));

  console.info('[growth-image-repair] published featured image replaced', result);
  return result;
}

module.exports = { ACTION, runOneOffGrowthImageRepair };
