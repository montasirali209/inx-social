'use strict';

const growthContent = require('../services/growthContentService');

async function listArticles(req, res, next) {
  try {
    const tag = String(req.query?.tag || '').trim();
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
    return res.json({ articles: await growthContent.publicArticles({ tag: tag || null }) });
  } catch (error) {
    next(error);
  }
}

async function articleBySlug(req, res, next) {
  try {
    const article = await growthContent.publicArticleBySlug(req.params.slug);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
    return res.json({ article });
  } catch (error) {
    next(error);
  }
}

async function sitemap(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    return res.json({ entries: await growthContent.publicSitemapEntries() });
  } catch (error) {
    next(error);
  }
}

async function media(req, res, next) {
  try {
    const asset = await growthContent.imageBuffer(req.params.id);
    res.type(asset.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Last-Modified', new Date(asset.generatedAt || Date.now()).toUTCString());
    return res.send(asset.data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listArticles,
  articleBySlug,
  sitemap,
  media
};
