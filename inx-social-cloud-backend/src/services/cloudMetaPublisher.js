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

async function publishOrganicPost({ pageId, pageAccessToken, caption, scheduledAt, asset = null }) {
  const schedule = scheduledPublishFields(scheduledAt);
  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}`;
  let response;
  if (asset?.data?.length) {
    const form = new FormData();
    form.append('source', new Blob([asset.data], { type: asset.mimeType || 'image/png' }), asset.originalName || 'inx-social-post.png');
    form.append('caption', String(caption || ''));
    form.append('published', 'false');
    form.append('scheduled_publish_time', String(schedule.scheduled_publish_time));
    form.append('access_token', pageAccessToken);
    response = await axios.post(`${base}/photos`, form, {
      timeout: 60000,
      maxContentLength: 12 * 1024 * 1024,
      maxBodyLength: 12 * 1024 * 1024,
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
    scheduledUnix: schedule.scheduled_publish_time,
    response: response.data
  };
}

module.exports = {
  testPage,
  listScheduledPosts,
  getReelStatus,
  publishReel,
  publishScheduledReel,
  publishReelNow,
  publishOrganicPost,
  scheduledPublishFields
};
