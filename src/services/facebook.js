const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || process.env.GRAPH_VERSION || 'v25.0';

async function scheduleVideoPostFromFile({
  pageId,
  pageAccessToken,
  fileBuffer,
  fileName,
  caption,
  scheduledPublishTime,
}) {
  if (!pageId) throw new Error('Missing pageId. Set FB_PAGE_ID.');
  if (!pageAccessToken) throw new Error('Missing pageAccessToken. Set FB_PAGE_ACCESS_TOKEN.');
  if (!fileBuffer) throw new Error('Missing video file buffer.');
  if (!scheduledPublishTime) throw new Error('Missing scheduledPublishTime.');

  const url = `https://graph-video.facebook.com/${GRAPH_VERSION}/${pageId}/videos`;
  const form = new FormData();
  form.append('access_token', pageAccessToken);
  form.append('description', caption || '');
  form.append('published', 'false');
  form.append('scheduled_publish_time', String(scheduledPublishTime));
  form.append('source', fileBuffer, { filename: fileName || 'video.mp4' });

  const response = await axios.post(url, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 0,
    validateStatus: status => status >= 200 && status < 500,
  });

  if (response.status >= 400 || response.data.error) {
    const err = response.data.error;
    const message = err
      ? `${err.message}${err.code ? ` (#${err.code})` : ''}${err.error_subcode ? ` subcode ${err.error_subcode}` : ''}`
      : `Facebook upload failed with HTTP ${response.status}`;
    const wrapped = new Error(message);
    wrapped.meta = response.data;
    throw wrapped;
  }

  return response.data;
}

async function scheduleVideoPostFromPath({ pageId, pageAccessToken, videoPath, caption, scheduledPublishTime }) {
  const fileBuffer = fs.readFileSync(videoPath);
  const fileName = require('path').basename(videoPath);
  return scheduleVideoPostFromFile({
    pageId,
    pageAccessToken,
    fileBuffer,
    fileName,
    caption,
    scheduledPublishTime,
  });
}

module.exports = {
  scheduleVideoPostFromFile,
  scheduleVideoPostFromPath,
};
