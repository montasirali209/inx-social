const fs = require('fs');
const axios = require('axios');

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
  if (!response || response.status >= 400 || response.data?.error) {
    throw metaError(response, fallback);
  }
}

async function testPage({ pageId, pageAccessToken }) {
  const response = await axios.get(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}`,
    {
      params: { fields: 'id,name', access_token: pageAccessToken },
      timeout: 30000,
      validateStatus: status => status >= 200 && status < 500
    }
  );
  assertMetaResponse(response, 'Meta could not verify the active Page.');
  return { id: response.data.id, name: response.data.name || response.data.id };
}

async function listScheduledPosts({ pageId, pageAccessToken, limit = 200 }) {
  const collected = [];
  let url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}/scheduled_posts`;
  let params = {
    fields: 'id,message,created_time,scheduled_publish_time,is_published,permalink_url',
    limit: Math.min(100, Math.max(1, Number(limit) || 100)),
    access_token: pageAccessToken
  };

  while (url && collected.length < limit) {
    const response = await axios.get(url, {
      params,
      timeout: 30000,
      validateStatus: status => status >= 200 && status < 500
    });
    assertMetaResponse(response, 'Meta could not return scheduled posts.');
    collected.push(...(Array.isArray(response.data?.data) ? response.data.data : []));
    url = response.data?.paging?.next || null;
    params = undefined;
  }
  return { data: collected.slice(0, limit) };
}

async function getPost({ postId, pageAccessToken }) {
  const response = await axios.get(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(postId)}`,
    {
      params: {
        fields: 'id,is_published,scheduled_publish_time,permalink_url',
        access_token: pageAccessToken
      },
      timeout: 30000,
      validateStatus: status => status >= 200 && status < 500
    }
  );
  assertMetaResponse(response, 'Meta could not return this post.');
  return response.data || {};
}

async function reschedulePost({ postId, pageAccessToken, scheduledAt }) {
  const schedule = scheduledPublishFields(scheduledAt);
  const response = await axios.post(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(postId)}`,
    {
      published: false,
      scheduled_publish_time: schedule.scheduled_publish_time,
      access_token: pageAccessToken
    },
    {
      timeout: 30000,
      validateStatus: status => status >= 200 && status < 500
    }
  );
  assertMetaResponse(response, 'Facebook could not reschedule this post.');
  return { ...response.data, scheduled_publish_time: schedule.scheduled_publish_time };
}

async function deletePost({ postId, pageAccessToken }) {
  const response = await axios.delete(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(postId)}`,
    {
      params: { access_token: pageAccessToken },
      timeout: 30000,
      validateStatus: status => status >= 200 && status < 500
    }
  );
  assertMetaResponse(response, 'Facebook could not delete this post.');
  return response.data || {};
}

function isMissingPostError(error) {
  const detail = error?.meta?.error || {};
  const message = String(detail.message || error?.message || '').toLowerCase();
  return Number(detail.code) === 100 && (
    message.includes('does not exist') ||
    message.includes('unsupported get request') ||
    message.includes('cannot be loaded')
  );
}

async function publishReel({
  pageId,
  pageAccessToken,
  filePath,
  fileSize,
  caption,
  scheduledAt,
  publishMode = 'SCHEDULED'
}) {
  const immediate = publishMode === 'NOW';
  const scheduledUnix = immediate ? null : Math.floor(new Date(scheduledAt).getTime() / 1000);
  if (!immediate && (!Number.isFinite(scheduledUnix) || scheduledUnix <= Math.floor(Date.now() / 1000))) {
    throw new Error('The selected schedule time is no longer in the future.');
  }

  const reelEndpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}/video_reels`;
  const start = await axios.post(reelEndpoint, {
    upload_phase: 'start',
    access_token: pageAccessToken
  }, {
    timeout: 60000,
    validateStatus: status => status >= 200 && status < 500
  });
  assertMetaResponse(start, 'Facebook Reel upload could not start.');

  const videoId = start.data?.video_id || start.data?.id;
  const uploadUrl = start.data?.upload_url;
  if (!videoId || !uploadUrl) {
    throw metaError(start, 'Meta did not return a Reel upload session.');
  }

  const upload = await axios.post(uploadUrl, fs.createReadStream(filePath), {
    headers: {
      Authorization: `OAuth ${pageAccessToken}`,
      offset: '0',
      file_size: String(fileSize),
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(fileSize),
      'X-Entity-Length': String(fileSize)
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 0,
    validateStatus: status => status >= 200 && status < 500
  });
  assertMetaResponse(upload, 'Facebook Reel video upload failed.');

  const finishBody = {
    upload_phase: 'finish',
    video_id: videoId,
    video_state: immediate ? 'PUBLISHED' : 'SCHEDULED',
    description: caption || '',
    access_token: pageAccessToken
  };
  if (!immediate) finishBody.scheduled_publish_time = scheduledUnix;

  const finish = await axios.post(reelEndpoint, finishBody, {
    timeout: 60000,
    validateStatus: status => status >= 200 && status < 500
  });
  assertMetaResponse(finish, immediate ? 'Facebook Reel publishing failed.' : 'Facebook Reel scheduling failed.');

  return {
    videoId: String(videoId),
    postId: finish.data?.post_id || finish.data?.id || null,
    publishMode: immediate ? 'NOW' : 'SCHEDULED',
    scheduledUnix,
    start: start.data,
    upload: upload.data,
    finish: finish.data
  };
}

async function getReelStatus({ videoId, pageAccessToken }) {
  const response = await axios.get(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(videoId)}`,
    {
      params: { fields: 'status', access_token: pageAccessToken },
      timeout: 30000,
      validateStatus: status => status >= 200 && status < 500
    }
  );
  assertMetaResponse(response, 'Facebook could not return the Reel processing status.');
  return response.data || {};
}

function publishScheduledReel(input) {
  return publishReel({ ...input, publishMode: 'SCHEDULED' });
}

function publishReelNow(input) {
  return publishReel({ ...input, publishMode: 'NOW', scheduledAt: null });
}

function scheduledPublishFields(scheduledAt) {
  const unix = Math.floor(new Date(scheduledAt).getTime() / 1000);
  const minimum = Math.floor(Date.now() / 1000) + (10 * 60);
  if (!Number.isFinite(unix) || unix < minimum) {
    throw new Error('Facebook scheduled posts must be at least 10 minutes in the future.');
  }
  return { published: false, scheduled_publish_time: unix };
}

async function publishOrganicPost({ pageId, pageAccessToken, caption, scheduledAt, publishMode = 'SCHEDULED', asset = null }) {
  const immediate = String(publishMode || '').toUpperCase() === 'NOW';
  const schedule = immediate ? { published: true } : scheduledPublishFields(scheduledAt);
  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}`;
  let response;
  if (asset?.data?.length) {
    const form = new FormData();
    form.append('source', new Blob([asset.data], { type: asset.mimeType || 'image/png' }), asset.originalName || 'inx-social-post.png');
    form.append('caption', String(caption || ''));
    form.append('published', immediate ? 'true' : 'false');
    if (!immediate) form.append('scheduled_publish_time', String(schedule.scheduled_publish_time));
    form.append('access_token', pageAccessToken);
    response = await axios.post(`${base}/photos`, form, {
      timeout: 60000,
      maxContentLength: 20 * 1024 * 1024,
      maxBodyLength: 20 * 1024 * 1024,
      validateStatus: status => status >= 200 && status < 500
    });
  } else {
    response = await axios.post(`${base}/feed`, {
      message: String(caption || ''),
      ...schedule,
      access_token: pageAccessToken
    }, {
      timeout: 60000,
      validateStatus: status => status >= 200 && status < 500
    });
  }
  assertMetaResponse(response, asset ? 'Facebook image scheduling failed.' : 'Facebook post scheduling failed.');
  return {
    postId: response.data?.post_id || response.data?.id || null,
    publishMode: immediate ? 'NOW' : 'SCHEDULED',
    scheduledUnix: immediate ? null : schedule.scheduled_publish_time,
    response: response.data
  };
}

async function publishCarouselPost({ pageId, pageAccessToken, caption, scheduledAt, publishMode = 'SCHEDULED', assets = [] }) {
  if (!Array.isArray(assets) || assets.length < 2 || assets.length > 10) {
    throw new Error('Facebook carousel posts require between 2 and 10 image slides.');
  }
  const immediate = String(publishMode || '').toUpperCase() === 'NOW';
  const schedule = immediate ? { published: true } : scheduledPublishFields(scheduledAt);
  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}`;
  const photoIds = [];

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
  }

  const response = await axios.post(`${base}/feed`, {
    message: String(caption || ''),
    attached_media: photoIds.map(media_fbid => ({ media_fbid })),
    ...schedule,
    access_token: pageAccessToken
  }, {
    timeout: 60000,
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 5 * 1024 * 1024,
    validateStatus: status => status >= 200 && status < 500
  });
  assertMetaResponse(response, immediate ? 'Facebook carousel publishing failed.' : 'Facebook carousel scheduling failed.');
  return {
    postId: response.data?.post_id || response.data?.id || null,
    photoIds,
    publishMode: immediate ? 'NOW' : 'SCHEDULED',
    scheduledUnix: immediate ? null : schedule.scheduled_publish_time,
    response: response.data
  };
}

module.exports = {
  testPage,
  listScheduledPosts,
  getPost,
  reschedulePost,
  deletePost,
  isMissingPostError,
  getReelStatus,
  publishReel,
  publishScheduledReel,
  publishReelNow,
  publishOrganicPost,
  publishCarouselPost,
  scheduledPublishFields
};