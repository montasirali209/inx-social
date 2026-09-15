const mediaLibrary = require('../services/mediaLibraryService');
const MAX_VIDEO_CHUNK_BYTES = 2 * 1024 * 1024;

function parseRange(value, total) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(value || '').trim());
  if (!match || total <= 0) return null;

  let start;
  let end;
  if (!match[1] && match[2]) {
    const suffix = Math.min(total, Number(match[2]));
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = total - suffix;
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : total - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  }

  start = Math.max(0, Math.floor(start));
  end = Math.min(total - 1, Math.floor(end));
  if (start > end || start >= total) return null;
  return { start, end };
}

async function mediaLibraryAssetContent(req, res, next) {
  try {
    const userId = mediaLibrary.verifyContentAccess(req.query.access, req.params.id);
    const requestedRange = req.headers.range;
    const asset = await mediaLibrary.findContentMetadata(userId, req.params.id, { includeArchived: true });
    if (!asset) return res.status(404).json({ error: 'Media asset not found.' });

    const total = Number(asset.byteSize || 0);
    const isVideo = String(asset.mimeType || '').startsWith('video/');

    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('ETag', `"${asset.checksum}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (isVideo) res.setHeader('Accept-Ranges', 'bytes');
    if (String(req.query.download || '') === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${String(asset.originalName || 'media-asset').replace(/["\\]/g, '')}"`);
    }

    if (!isVideo || !requestedRange) {
      const content = await mediaLibrary.findContent(userId, req.params.id, { includeArchived: true });
      const data = Buffer.isBuffer(content?.data) ? content.data : Buffer.from(content?.data || []);
      if (!data.length && total) return res.status(404).end();
      res.setHeader('Content-Length', data.length);
      return res.status(200).end(data);
    }

    const range = parseRange(requestedRange, total);
    if (!range) {
      res.setHeader('Content-Range', `bytes */${total}`);
      return res.status(416).end();
    }

    const end = Math.min(range.end, range.start + MAX_VIDEO_CHUNK_BYTES - 1);
    const length = end - range.start + 1;
    const chunk = await mediaLibrary.findContentRange(userId, req.params.id, range.start, length, { includeArchived: true });
    if (!chunk?.length) return res.status(404).end();
    const actualEnd = range.start + chunk.length - 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${actualEnd}/${total}`);
    res.setHeader('Content-Length', chunk.length);
    return res.end(chunk);
  } catch (error) {
    next(error);
  }
}

module.exports = { MAX_VIDEO_CHUNK_BYTES, mediaLibraryAssetContent, parseRange };
