const mediaLibrary = require('../services/mediaLibraryService');

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
    const asset = await mediaLibrary.findContent(userId, req.params.id, { includeArchived: true });
    if (!asset) return res.status(404).json({ error: 'Media asset not found.' });

    const data = Buffer.isBuffer(asset.data) ? asset.data : Buffer.from(asset.data || []);
    const total = data.length;
    const isVideo = String(asset.mimeType || '').startsWith('video/');

    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('ETag', `"${asset.checksum}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (isVideo) res.setHeader('Accept-Ranges', 'bytes');
    if (String(req.query.download || '') === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${String(asset.originalName || 'media-asset').replace(/["\\]/g, '')}"`);
    }

    if (!isVideo || !req.headers.range) {
      res.setHeader('Content-Length', total);
      return res.status(200).end(data);
    }

    const range = parseRange(req.headers.range, total);
    if (!range) {
      res.setHeader('Content-Range', `bytes */${total}`);
      return res.status(416).end();
    }

    const length = range.end - range.start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${total}`);
    res.setHeader('Content-Length', length);
    return res.end(data.subarray(range.start, range.end + 1));
  } catch (error) {
    next(error);
  }
}

module.exports = { mediaLibraryAssetContent, parseRange };
