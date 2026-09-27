'use strict';

const prisma = require('../db/prisma');
const websiteMedia = require('../services/websiteMediaService');

function decodeHeader(req, name, fallback = '') {
  const raw = String(req.headers[name] || fallback);
  try { return decodeURIComponent(raw); } catch (_) { return raw; }
}

async function audit(req, action, key, metadata = {}) {
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id || null,
      action,
      entity: 'WebsiteMediaAsset',
      entityId: key,
      metadata: JSON.stringify(metadata),
      ip: req.ip || null,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500) || null
    }
  }).catch(() => {});
}

async function list(req, res, next) {
  try {
    res.json({
      slots: await websiteMedia.list(),
      storage: {
        provider: 'CLOUDFLARE_R2',
        originalsPreserved: true,
        maxUploadBytes: websiteMedia.MAX_UPLOAD_BYTES
      }
    });
  } catch (error) { next(error); }
}

async function detail(req, res, next) {
  try {
    res.json({ slot: await websiteMedia.detail(req.params.key) });
  } catch (error) { next(error); }
}

async function upload(req, res, next) {
  try {
    const result = await websiteMedia.upload(req.params.key, {
      userId: req.user.id,
      data: Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || ''),
      originalName: decodeHeader(req, 'x-file-name', 'website-image'),
      altText: req.headers['x-alt-text'] !== undefined ? decodeHeader(req, 'x-alt-text') : undefined
    });
    await audit(req, 'ADMIN_WEBSITE_MEDIA_UPLOAD', req.params.key, {
      versionId: result.version.id,
      originalName: result.version.originalName,
      mimeType: result.version.mimeType,
      width: result.version.width,
      height: result.version.height,
      byteSize: result.version.byteSize,
      warnings: result.warnings
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
}

async function update(req, res, next) {
  try {
    const asset = await websiteMedia.updateMetadata(req.params.key, {
      altText: req.body?.altText
    });
    await audit(req, 'ADMIN_WEBSITE_MEDIA_UPDATE', req.params.key, {
      altText: asset.altText
    });
    res.json({ asset });
  } catch (error) { next(error); }
}

async function restore(req, res, next) {
  try {
    const asset = await websiteMedia.restore(req.params.key, req.params.versionId);
    await audit(req, 'ADMIN_WEBSITE_MEDIA_RESTORE', req.params.key, {
      versionId: req.params.versionId
    });
    res.json({ asset });
  } catch (error) { next(error); }
}

module.exports = { list, detail, upload, update, restore };
