const crypto = require('node:crypto');
const axios = require('axios');
const env = require('../config/env');

const RETRYABLE_HTTP = new Set([429, 500, 502, 503, 504]);
const MODEL_ALIASES = new Map([
  ['openai-gpt-5-4-nano', 'openai:gpt@5.4-nano']
]);

function providerError(message, code = 'AI_PROVIDER_UNAVAILABLE', status = 503, detail = '') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  error.providerDetail = detail;
  return error;
}

function normalizeModelId(value) {
  const model = String(value || '').trim();
  return MODEL_ALIASES.get(model) || model;
}

function isConfigured() {
  return Boolean(env.runware?.apiKey);
}

function assertConfigured() {
  if (!isConfigured()) throw providerError('AI generation is not configured yet. Add the Runware API key in Railway and redeploy.', 'RUNWARE_NOT_CONFIGURED');
}

function providerDetail(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.slice(0, 700);
  const first = Array.isArray(payload.errors) ? payload.errors[0] : null;
  return String(first?.message || payload.message || payload.error || '').slice(0, 700);
}

function httpError(status, payload) {
  const detail = providerDetail(payload);
  if (status === 400) return providerError('The AI provider rejected this generation request. Please simplify the prompt or adjust the generation settings.', 'RUNWARE_BAD_REQUEST', 400, detail);
  if (status === 401 || status === 403) return providerError('AI provider authentication failed. Please check the Runware API setup in Railway.', 'RUNWARE_AUTH_ERROR', 503, detail);
  if (status === 402) return providerError('The Runware account may not have enough balance to complete this generation.', 'RUNWARE_BALANCE_ERROR', 503, detail);
  if (status === 429) return providerError('The AI provider is busy right now. Please retry in a moment.', 'RUNWARE_RATE_LIMITED', 429, detail);
  if (status >= 500) return providerError('The AI provider is temporarily unavailable. Please retry shortly.', 'RUNWARE_UPSTREAM_ERROR', 503, detail);
  return providerError('The AI provider could not complete this request.', 'RUNWARE_HTTP_ERROR', 502, detail);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(tasks, timeoutMs = env.runware?.timeoutMs || 360000) {
  assertConfigured();
  const attempts = 2;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response;
    try {
      response = await axios.post(env.runware.baseUrl, tasks, {
        headers: { Authorization: `Bearer ${env.runware.apiKey}`, 'Content-Type': 'application/json' },
        timeout: timeoutMs,
        maxContentLength: 5 * 1024 * 1024,
        validateStatus: () => true
      });
    } catch (caught) {
      const timedOut = caught?.code === 'ECONNABORTED';
      if (attempt < attempts - 1) {
        await wait(600 * (attempt + 1));
        continue;
      }
      throw providerError(`AI provider request failed: ${timedOut ? 'request timed out' : 'temporary network error'}.`, timedOut ? 'RUNWARE_TIMEOUT' : 'RUNWARE_NETWORK_ERROR', timedOut ? 504 : 503);
    }

    if (response.status >= 400) {
      if (RETRYABLE_HTTP.has(response.status) && attempt < attempts - 1) {
        await wait(response.status === 429 ? 1200 : 650);
        continue;
      }
      throw httpError(response.status, response.data);
    }

    const payload = response.data || {};
    if (Array.isArray(payload.errors) && payload.errors.length) {
      const first = payload.errors[0] || {};
      const code = String(first.code || 'RUNWARE_GENERATION_FAILED');
      const detail = String(first.message || '');
      const blocked = /nsfw|safety|moderation|content/i.test(`${code} ${detail}`);
      if (blocked) throw providerError('The requested content was blocked by the generation provider. Edit the input and try again.', 'CONTENT_BLOCKED', 422, detail);
      if (/balance|credit|fund|payment/i.test(`${code} ${detail}`)) throw providerError('The Runware account may not have enough balance to complete this generation.', 'RUNWARE_BALANCE_ERROR', 503, detail);
      if (/model|parameter|invalid|request|schema/i.test(`${code} ${detail}`)) throw providerError('The AI provider rejected part of this generation request. Please adjust the input and retry.', 'RUNWARE_BAD_REQUEST', 400, detail);
      throw providerError('The AI provider could not complete this generation. Please retry shortly.', code, 502, detail);
    }
    return Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [];
  }
  throw providerError('The AI provider could not complete this request.', 'RUNWARE_REQUEST_FAILED', 503);
}

function imageDimensions(aspectRatio = '1:1') {
  const map = {
    '1:1': [1024, 1024],
    '4:5': [1024, 1280],
    '9:16': [768, 1344],
    '16:9': [1344, 768]
  };
  const [width, height] = map[aspectRatio] || map['1:1'];
  return { width, height };
}

function videoDimensions(aspectRatio = '9:16', model = '') {
  const wan = String(model).startsWith('alibaba:wan@3.0');
  const map = wan ? {
    '1:1': [960, 960],
    '4:5': [832, 1104],
    '9:16': [720, 1280],
    '16:9': [1280, 720]
  } : {
    '1:1': [720, 720],
    '4:5': [720, 960],
    '9:16': [720, 1280],
    '16:9': [1280, 720]
  };
  const [width, height] = map[aspectRatio] || map['9:16'];
  return { width, height };
}

function costOf(items) {
  return items.reduce((total, item) => total + (Number(item?.cost) || 0), 0);
}

async function generateText(prompt, options = {}) {
  const taskUUID = crypto.randomUUID();
  const model = normalizeModelId(options.model || env.runware.textModel);
  const results = await request([{
    taskType: 'textInference',
    taskUUID,
    model,
    deliveryMethod: 'sync',
    messages: [{ role: 'user', content: prompt }],
    settings: {
      systemPrompt: options.systemPrompt || 'You are the INXSocial content engine. Follow the requested output format exactly. Never invent product claims, prices or facts that were not provided.',
      temperature: options.temperature ?? 0.55,
      maxTokens: options.maxTokens || 1800,
      thinkingLevel: 'low'
    },
    includeCost: true
  }], env.runware.textTimeoutMs);
  const item = results.find(entry => entry.taskUUID === taskUUID) || results[0];
  const text = item?.text ?? item?.output?.text ?? item?.message?.content;
  if (!text) throw providerError('AI copy generation returned an empty result.', 'RUNWARE_EMPTY_TEXT', 502);
  return { text: String(text), cost: Number(item.cost || 0), model, taskUUID };
}

async function generateImages(prompts, options = {}) {
  const { width, height } = imageDimensions(options.aspectRatio);
  const model = normalizeModelId(options.model || env.runware.imageModel);
  const tasks = prompts.map(prompt => ({
    taskType: 'imageInference',
    taskUUID: crypto.randomUUID(),
    model,
    deliveryMethod: 'sync',
    positivePrompt: String(prompt).slice(0, 10000),
    width,
    height,
    numberResults: 1,
    outputType: 'URL',
    includeCost: true
  }));
  const results = await request(tasks, env.runware.imageTimeoutMs);
  const images = tasks.map(task => {
    const item = results.find(entry => entry.taskUUID === task.taskUUID);
    if (!item?.imageURL) throw providerError('AI image generation returned no image.', 'RUNWARE_EMPTY_IMAGE', 502);
    return { taskUUID: task.taskUUID, url: item.imageURL, cost: Number(item.cost || 0), model, width, height };
  });
  return { images, cost: costOf(images), model };
}

async function pollTask(taskUUID, onProgress = () => {}) {
  const started = Date.now();
  while (Date.now() - started < env.runware.videoTimeoutMs) {
    await wait(env.runware.pollIntervalMs);
    const results = await request([{ taskType: 'getResponse', taskUUID }], Math.min(60000, env.runware.videoTimeoutMs));
    const item = results.find(entry => entry.taskUUID === taskUUID) || results[0];
    if (!item) continue;
    if (item.status === 'processing') {
      onProgress(Math.max(5, Math.min(95, Number(item.progress || 35))));
      continue;
    }
    if (item.status === 'error') throw providerError('AI video generation failed. Please adjust the prompt or source media and retry.', item.error?.code || 'RUNWARE_VIDEO_FAILED', 502, item.error?.message || '');
    if (item.videoURL || item.status === 'success') {
      if (!item.videoURL) throw providerError('AI video generation completed without a video URL.', 'RUNWARE_EMPTY_VIDEO', 502);
      return item;
    }
  }
  throw providerError('AI video generation timed out. Your credits will be returned automatically.', 'RUNWARE_VIDEO_TIMEOUT', 504);
}

async function generateVideo(input, onProgress = () => {}) {
  const requestedDuration = Math.floor(Number(input.duration || 5));
  if (![5, 10].includes(requestedDuration)) throw providerError('Standard AI Studio video generation currently supports 5 or 10 seconds.', 'RUNWARE_VIDEO_DURATION_UNSUPPORTED', 422);
  const duration = requestedDuration;
  const requestedModel = normalizeModelId(input.model || '');
  let model = requestedModel || (input.referenceVideo ? env.runware.videoEditModel : env.runware.videoModel);
  model = normalizeModelId(model);

  if (input.referenceVideo && String(model) === String(env.runware.videoModel)) model = normalizeModelId(env.runware.videoEditModel);

  const isPVideo = String(model) === 'prunaai:p-video@0';
  const isPVideoEdit = String(model) === 'prunaai:p-video@edit';
  const isWan = String(model).startsWith('alibaba:wan@3.0');
  const { width, height } = videoDimensions(input.aspectRatio, model);
  const taskUUID = crypto.randomUUID();
  const task = {
    taskType: 'videoInference',
    taskUUID,
    model,
    deliveryMethod: 'async',
    positivePrompt: String(input.prompt || '').slice(0, isPVideo ? 2000 : 10000),
    includeCost: true,
    settings: { audio: input.audio !== false }
  };

  if (isPVideoEdit) {
    if (!input.referenceVideo) throw providerError('A source video is required for this video-edit workflow.', 'RUNWARE_SOURCE_VIDEO_REQUIRED', 422);
    task.inputs = { video: input.referenceVideo };
  } else {
    task.duration = duration;
    if (input.referenceVideo) {
      if (!isWan) throw providerError('The selected source video requires the configured video-edit model.', 'RUNWARE_VIDEO_EDIT_MODEL_UNSUPPORTED', 422);
      task.inputs = { referenceVideos: [input.referenceVideo] };
      task.width = width;
      task.height = height;
    } else if (input.referenceImage) {
      if (isPVideo) {
        task.inputs = { frameImages: [input.referenceImage] };
        task.resolution = '720p';
      } else if (isWan) {
        task.inputs = { referenceImages: [input.referenceImage] };
        task.width = width;
        task.height = height;
      } else {
        task.inputs = { frameImages: [input.referenceImage] };
        task.width = width;
        task.height = height;
      }
    } else {
      task.width = width;
      task.height = height;
    }
  }

  onProgress(5);
  const initial = await request([task], 60000);
  const first = initial.find(entry => entry.taskUUID === taskUUID) || initial[0];
  if (first?.videoURL) return { url: first.videoURL, cost: Number(first.cost || 0), model, taskUUID, width: isPVideoEdit ? null : width, height: isPVideoEdit ? null : height, duration: isPVideoEdit ? null : duration };
  const final = await pollTask(taskUUID, onProgress);
  onProgress(100);
  return { url: final.videoURL, cost: Number(final.cost || 0), model, taskUUID, width: isPVideoEdit ? null : width, height: isPVideoEdit ? null : height, duration: isPVideoEdit ? null : duration };
}

module.exports = { isConfigured, request, generateText, generateImages, generateVideo, imageDimensions, videoDimensions, normalizeModelId };