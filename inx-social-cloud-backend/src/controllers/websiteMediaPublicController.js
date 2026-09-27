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
    const value = await websiteMedia.content(req.params.key, req.query.v);
    if (String(req.headers['if-none-match'] || '') === value.etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('Content-Type', value.mimeType);
    res.setHeader('Content-Length', String(value.data.length));
    res.setHeader('ETag', value.etag);
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(value.data);
  } catch (error) { next(error); }
}

module.exports = { metadata, content };
