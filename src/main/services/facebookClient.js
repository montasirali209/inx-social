const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

class FacebookClient {
  constructor(settings) {
    this.pageId = settings.pageId;
    this.pageAccessToken = settings.pageAccessToken;
    this.graphVersion = settings.graphVersion || 'v25.0';
  }

  validateSettings() {
    if (!this.pageId) throw new Error('Missing Facebook Page ID in Settings.');
    if (!this.pageAccessToken) throw new Error('Missing Page Access Token in Settings.');
  }

  async testConnection() {
    this.validateSettings();
    const url = `https://graph.facebook.com/${this.graphVersion}/${this.pageId}`;
    const response = await axios.get(url, {
      params: {
        fields: 'id,name,access_token',
        access_token: this.pageAccessToken
      },
      timeout: 30000
    });
    return response.data;
  }

  async uploadScheduledVideo(job, options = {}) {
    this.validateSettings();
    if (!fs.existsSync(job.videoPath)) {
      throw new Error(`Video file not found: ${job.videoPath}`);
    }

    const url = `https://graph-video.facebook.com/${this.graphVersion}/${this.pageId}/videos`;
    const form = new FormData();
    form.append('access_token', this.pageAccessToken);
    form.append('description', job.caption || '');
    form.append('published', 'false');
    form.append('scheduled_publish_time', String(job.scheduledUnix));
    form.append('source', fs.createReadStream(job.videoPath), {
      filename: path.basename(job.videoPath)
    });

    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 0,
      signal: options.signal,
      validateStatus: status => status >= 200 && status < 500
    });

    if (response.status >= 400 || response.data.error) {
      const err = response.data.error;
      const message = err ? `${err.message} (${err.type || 'Meta error'} ${err.code || ''})` : `HTTP ${response.status}`;
      const wrapped = new Error(message.trim());
      wrapped.meta = response.data;
      throw wrapped;
    }

    return response.data;
  }

  async listScheduledPosts(limit = 200, options = {}) {
    this.validateSettings();
    const firstUrl = `https://graph.facebook.com/${this.graphVersion}/${this.pageId}/scheduled_posts`;
    const collected = [];
    let url = firstUrl;
    let params = {
      fields: 'id,message,created_time,scheduled_publish_time,is_published,permalink_url',
      limit: Math.min(100, Math.max(1, Number(limit) || 100)),
      access_token: this.pageAccessToken
    };

    while (url && collected.length < limit) {
      const response = await axios.get(url, { params, timeout: 30000, signal: options.signal });
      const data = response.data && Array.isArray(response.data.data) ? response.data.data : [];
      collected.push(...data);
      url = response.data && response.data.paging && response.data.paging.next ? response.data.paging.next : null;
      params = undefined;
    }

    return { data: collected.slice(0, limit) };
  }


  async uploadDraftVideo(job, options = {}) {
    this.validateSettings();
    if (!fs.existsSync(job.videoPath)) {
      throw new Error(`Video file not found: ${job.videoPath}`);
    }

    const url = `https://graph-video.facebook.com/${this.graphVersion}/${this.pageId}/videos`;
    const form = new FormData();
    form.append('access_token', this.pageAccessToken);
    form.append('description', job.caption || '');
    form.append('published', 'false');
    form.append('unpublished_content_type', 'DRAFT');
    if (options.includeScheduleTime !== false && job.scheduledUnix) {
      // Experimental: Meta may ignore or reject schedule time on true drafts.
      // The local app still stores the intended schedule slot so you can manually schedule it later.
      form.append('scheduled_publish_time', String(job.scheduledUnix));
    }
    form.append('source', fs.createReadStream(job.videoPath), {
      filename: path.basename(job.videoPath)
    });

    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 0,
      signal: options.signal,
      validateStatus: status => status >= 200 && status < 500
    });

    if (response.status >= 400 || response.data.error) {
      const err = response.data.error;
      const message = err ? `${err.message} (${err.type || 'Meta error'} ${err.code || ''})` : `HTTP ${response.status}`;
      const wrapped = new Error(message.trim());
      wrapped.meta = response.data;
      throw wrapped;
    }

    return response.data;
  }


  async publishReel(job, options = {}) {
    this.validateSettings();
    if (!fs.existsSync(job.videoPath)) {
      throw new Error(`Video file not found: ${job.videoPath}`);
    }

    const stat = fs.statSync(job.videoPath);
    if (!stat.size) throw new Error(`Video file is empty: ${job.videoPath}`);

    const reelEndpoint = `https://graph.facebook.com/${this.graphVersion}/${this.pageId}/video_reels`;
    const scheduledUnix = Number(job.scheduledUnix || 0);
    const nowUnix = Math.floor(Date.now() / 1000);
    const wantsScheduled = options.forceScheduled !== false && Boolean(job.scheduledUnix);
    if (wantsScheduled && scheduledUnix <= nowUnix) {
      throw new Error(`Selected schedule time is already in the past. Meta would publish it immediately instead of scheduling it. Choose a future time.`);
    }
    const videoState = wantsScheduled ? 'SCHEDULED' : 'PUBLISHED';

    // Phase 1: initialize a Facebook Reel upload session.
    const startResponse = await axios.post(reelEndpoint, {
      upload_phase: 'start',
      access_token: this.pageAccessToken
    }, {
      timeout: 60000,
      signal: options.signal,
      validateStatus: status => status >= 200 && status < 500
    });
    this.throwIfMetaError(startResponse, 'Facebook Reel start failed');

    const videoId = startResponse.data && (startResponse.data.video_id || startResponse.data.id);
    const uploadUrl = startResponse.data && startResponse.data.upload_url;
    if (!videoId || !uploadUrl) {
      const wrapped = new Error('Facebook Reel start did not return video_id/upload_url. Check permissions and Graph API version.');
      wrapped.meta = startResponse.data;
      throw wrapped;
    }

    // Phase 2: upload the raw video bytes to the rupload URL.
    // Meta's rupload endpoint is strict about upload-size headers.
    // Do NOT let Axios send a chunked stream here; send a fixed-length payload
    // with both Content-Length and X-Entity-Length.
    const videoBuffer = fs.readFileSync(job.videoPath);
    const uploadHeaders = {
      Authorization: `OAuth ${this.pageAccessToken}`,
      offset: '0',
      file_size: String(stat.size),
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(stat.size),
      'X-Entity-Length': String(stat.size)
    };

    const uploadResponse = await axios.post(uploadUrl, videoBuffer, {
      headers: uploadHeaders,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 0,
      signal: options.signal,
      validateStatus: status => status >= 200 && status < 500,
      transitional: { clarifyTimeoutError: true }
    });
    this.throwIfMetaError(uploadResponse, 'Facebook Reel binary upload failed');

    // Phase 3: finish the Reel. For scheduled uploads, Meta stores it for the future.
    const finishPayload = {
      upload_phase: 'finish',
      video_id: videoId,
      video_state: videoState,
      description: job.caption || '',
      access_token: this.pageAccessToken
    };
    if (videoState === 'SCHEDULED') {
      finishPayload.scheduled_publish_time = scheduledUnix;
    }

    const finishResponse = await axios.post(reelEndpoint, finishPayload, {
      timeout: 60000,
      signal: options.signal,
      validateStatus: status => status >= 200 && status < 500
    });
    this.throwIfMetaError(finishResponse, `Facebook Reel finish/${videoState.toLowerCase()} failed`);

    return {
      mode: videoState === 'SCHEDULED' ? 'facebook-reel-scheduled' : 'facebook-reel-published',
      endpoint: `/${this.pageId}/video_reels`,
      videoState,
      scheduled_publish_time: videoState === 'SCHEDULED' ? scheduledUnix : null,
      startResponse: startResponse.data,
      uploadResponse: uploadResponse.data,
      finishResponse: finishResponse.data,
      video_id: videoId,
      id: finishResponse.data && (finishResponse.data.id || finishResponse.data.post_id || videoId),
      post_id: finishResponse.data && finishResponse.data.post_id ? finishResponse.data.post_id : null,
      raw: finishResponse.data
    };
  }

  async scheduleReel(job, options = {}) {
    return this.publishReel(job, { ...options, forceScheduled: true });
  }

  async publishLegacyVideoNow(job, options = {}) {
    this.validateSettings();
    if (!fs.existsSync(job.videoPath)) {
      throw new Error(`Video file not found: ${job.videoPath}`);
    }
    const url = `https://graph-video.facebook.com/${this.graphVersion}/${this.pageId}/videos`;
    const form = new FormData();
    form.append('access_token', this.pageAccessToken);
    form.append('description', job.caption || '');
    form.append('published', 'true');
    form.append('source', fs.createReadStream(job.videoPath), { filename: path.basename(job.videoPath) });

    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 0,
      signal: options.signal,
      validateStatus: status => status >= 200 && status < 500
    });
    this.throwIfMetaError(response, 'Legacy Page video publish failed');
    return { mode: 'legacy-page-video', endpoint: `/${this.pageId}/videos`, id: response.data && response.data.id, raw: response.data };
  }

  async getVideoDiagnostics(objectId) {
    this.validateSettings();
    if (!objectId) throw new Error('Missing video/post ID for diagnostics.');
    const url = `https://graph.facebook.com/${this.graphVersion}/${objectId}`;
    const response = await axios.get(url, {
      params: {
        fields: 'id,created_time,description,permalink_url,status,post_id,embed_html,source',
        access_token: this.pageAccessToken
      },
      timeout: 30000,
      validateStatus: status => status >= 200 && status < 500
    });
    this.throwIfMetaError(response, 'Diagnostics fetch failed');
    return response.data;
  }

  throwIfMetaError(response, prefix) {
    if (response.status >= 400 || (response.data && response.data.error)) {
      const err = response.data && response.data.error;
      const message = err
        ? `${prefix}: ${err.message}${err.code ? ` (#${err.code})` : ''}${err.error_subcode ? ` subcode ${err.error_subcode}` : ''}`
        : `${prefix}: HTTP ${response.status}`;
      const wrapped = new Error(message);
      wrapped.meta = response.data;
      wrapped.httpStatus = response.status;
      throw wrapped;
    }
  }


  async deleteObject(objectId) {
    this.validateSettings();
    const url = `https://graph.facebook.com/${this.graphVersion}/${objectId}`;
    const response = await axios.delete(url, {
      params: { access_token: this.pageAccessToken },
      timeout: 30000,
      validateStatus: status => status >= 200 && status < 500
    });

    if (response.status >= 400 || response.data.error) {
      const err = response.data.error;
      throw new Error(err ? err.message : `HTTP ${response.status}`);
    }
    return response.data;
  }
}

module.exports = { FacebookClient };
