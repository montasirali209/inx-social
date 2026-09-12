const axios = require('axios');
const metaPublisher = require('./cloudMetaPublisher');

const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || process.env.GRAPH_VERSION || 'v25.0';

function metaError(response, fallback) {
  const detail = response?.data?.error;
  const message = detail?.message || fallback || `Meta returned HTTP ${response?.status || 'error'}.`;
  const error = new Error(message);
  error.publicMessage = message;
  error.meta = response?.data || null;
  return error;
}

function assertMetaResponse(response, fallback) {
  if (!response || response.status >= 400 || response.data?.error) throw metaError(response, fallback);
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function scheduledPublishFields(scheduledAt) {
  const unix = Math.floor(new Date(scheduledAt).getTime() / 1000);
  const minimum = Math.floor(Date.now() / 1000) + (10 * 60);
  if (!Number.isFinite(unix) || unix < minimum) throw new Error('Facebook scheduled posts must be at least 10 minutes in the future.');
  return { published: false, scheduled_publish_time: unix };
}

async function publishCarouselPost({ pageId, pageAccessToken, caption, scheduledAt, publishMode = 'SCHEDULED', assets = [] }) {
  if (!Array.isArray(assets) || assets.length < 2 || assets.length > 10) {
    throw new Error('Facebook carousel posts require between 2 and 10 image slides.');
  }

  const immediate = String(publishMode || '').toUpperCase() === 'NOW';
  const schedule = immediate ? { published: true } : scheduledPublishFields(scheduledAt);
  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}`;
  const linkedCarousel = assets.some(asset => Boolean(asset?.linkUrl));

  if (linkedCarousel && (assets.length > 5 || assets.some(asset => !isHttpUrl(asset?.linkUrl)))) {
    throw new Error('Facebook link carousels require a destination link on each of 2 to 5 slides.');
  }

  const photoIds = [];
  const photoUrls = [];

  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    if (!asset?.data?.length || !/^image\/(png|jpeg|webp)$/i.test(String(asset.mimeType || ''))) {
      throw new Error(`Carousel slide ${index + 1} is not a supported image.`);
    }

    const form = new FormData();
    form.append('source', new Blob([asset.data], { type: asset.mimeType }), asset.originalName || `carousel-slide-${index + 1}.png`);
    form.append('published', 'false');
    form.append('access_token', pageAccessToken);

    const upload = await axios.post(`${base}/photos`, form, {
      timeout: 60000,
      maxContentLength: 20 * 1024 * 1024,
      maxBodyLength: 20 * 1024 * 1024,
      validateStatus: status => status >= 200 && status < 500
    });
    assertMetaResponse(upload, `Facebook could not upload carousel slide ${index + 1}.`);

    const photoId = upload.data?.id;
    if (!photoId) throw metaError(upload, `Facebook did not return an ID for carousel slide ${index + 1}.`);
    photoIds.push(String(photoId));

    if (linkedCarousel) {
      const photo = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(photoId)}`, {
        params: { fields: 'images', access_token: pageAccessToken },
        timeout: 60000,
        validateStatus: status => status >= 200 && status < 500
      });
      assertMetaResponse(photo, `Facebook could not prepare linked carousel slide ${index + 1}.`);
      const source = photo.data?.images?.[0]?.source;
      if (!source) throw metaError(photo, `Facebook did not return an image URL for linked carousel slide ${index + 1}.`);
      photoUrls.push(String(source));
    }
  }

  // Meta's /feed endpoint is most reliable for nested attachment arrays when
  // they are form-encoded JSON fields. Sending child_attachments/attached_media
  // as raw nested JSON can be accepted inconsistently and was returning 207
  // failures after all slide uploads had already succeeded.
  const body = new URLSearchParams();
  body.set('message', String(caption || ''));
  body.set('published', immediate ? 'true' : 'false');
  if (!immediate) body.set('scheduled_publish_time', String(schedule.scheduled_publish_time));
  if (linkedCarousel) {
    body.set('child_attachments', JSON.stringify(assets.map((asset, index) => ({
      link: asset.linkUrl,
      picture: photoUrls[index]
    }))));
  } else {
    body.set('attached_media', JSON.stringify(photoIds.map(media_fbid => ({ media_fbid }))));
  }
  body.set('access_token', pageAccessToken);

  const response = await axios.post(`${base}/feed`, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 60000,
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 5 * 1024 * 1024,
    validateStatus: status => status >= 200 && status < 500
  });
  assertMetaResponse(response, immediate ? 'Facebook carousel publishing failed.' : 'Facebook carousel scheduling failed.');

  return {
    postId: response.data?.post_id || response.data?.id || null,
    photoIds,
    linkedCarousel,
    publishMode: immediate ? 'NOW' : 'SCHEDULED',
    scheduledUnix: immediate ? null : schedule.scheduled_publish_time,
    response: response.data
  };
}

function install() {
  metaPublisher.publishCarouselPost = publishCarouselPost;
  return metaPublisher;
}

module.exports = { install, publishCarouselPost };
