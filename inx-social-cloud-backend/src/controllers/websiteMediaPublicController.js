'use strict';

const websiteMedia = require('../services/websiteMediaService');

async function metadata(req, res, next) {
  try {
    const value = await websiteMedia.publicMetadata(req.params.key);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(value);
  } catch (error) { next(error); }
}

async function content(req, res, next) {
  try {
    const value = await websiteMedia.content(req.params.key, req.query.v, req.headers.range);

    if (value.redirectUrl) {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.redirect(307, value.redirectUrl);
    }

    if (!value.range && String(req.headers['if-none-match'] || '') === value.etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('Content-Type', value.mimeType);
    res.setHeader('Content-Length', String(value.data.length));
    if (String(value.mimeType || '').startsWith('video/')) res.setHeader('Accept-Ranges', 'bytes');
    if (value.range) {
      res.setHeader('Content-Range', `bytes ${value.range.start}-${value.range.end}/${value.range.total}`);
      res.status(206);
    }
    res.setHeader('ETag', value.etag);
    res.setHeader(
      'Cache-Control',
      req.query.v
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=60, stale-while-revalidate=300'
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (value.effectiveKey) res.setHeader('X-INX-Website-Media-Source', value.effectiveKey);
    res.send(value.data);
  } catch (error) { next(error); }
}

module.exports = { metadata, content };
