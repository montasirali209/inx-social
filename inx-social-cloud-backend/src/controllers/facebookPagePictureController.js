const axios = require('axios');
const prisma = require('../db/prisma');
const { decryptToken } = require('../utils/tokenCrypto');

async function fetchImage(url, options = {}) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: status => status >= 200 && status < 500,
    ...options
  });
  const contentType = String(response.headers['content-type'] || '');
  if (response.status >= 400 || !contentType.startsWith('image/')) return null;
  return { data: Buffer.from(response.data), contentType };
}

async function pagePicture(req, res, next) {
  try {
    const page = await prisma.connectedPage.findFirst({
      where: { id: req.params.id, status: 'ACTIVE' },
      select: {
        id: true,
        facebookPageId: true,
        facebookPagePicture: true,
        encryptedAccessToken: true
      }
    });
    if (!page?.facebookPageId || !page?.encryptedAccessToken) return res.status(404).end();

    const graphVersion = process.env.FB_GRAPH_VERSION || process.env.GRAPH_VERSION || 'v25.0';
    const pageAccessToken = decryptToken(page.encryptedAccessToken);

    // Prefer Graph's authenticated picture edge so the browser never depends
    // on short-lived Meta CDN URLs and never receives the Page token.
    try {
      const direct = await fetchImage(
        `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(page.facebookPageId)}/picture`,
        { params: { type: 'large', access_token: pageAccessToken } }
      );
      if (direct) {
        res.setHeader('Content-Type', direct.contentType);
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(direct.data);
      }
    } catch (_) {
      // Fall through to refreshed/stored picture URLs.
    }

    let livePictureUrl = null;
    try {
      const picture = await axios.get(
        `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(page.facebookPageId)}`,
        {
          params: { fields: 'picture.type(large)', access_token: pageAccessToken },
          timeout: 15000,
          validateStatus: status => status >= 200 && status < 500
        }
      );
      if (picture.status < 400 && !picture.data?.error) {
        livePictureUrl = picture.data?.picture?.data?.url || null;
      }
    } catch (_) {
      // Keep the stored picture as the final fallback.
    }

    for (const pictureUrl of [...new Set([livePictureUrl, page.facebookPagePicture].filter(Boolean))]) {
      try {
        const image = await fetchImage(pictureUrl);
        if (!image) continue;
        res.setHeader('Content-Type', image.contentType);
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(image.data);
      } catch (_) {
        // Try the next source.
      }
    }

    return res.status(404).end();
  } catch (error) {
    if (error.response?.status >= 400 && error.response?.status < 500) return res.status(404).end();
    return next(error);
  }
}

module.exports = { pagePicture };
