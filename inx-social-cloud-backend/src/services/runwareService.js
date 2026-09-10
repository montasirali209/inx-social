const crypto = require('node:crypto');
const axios = require('axios');
const env = require('../config/env');

function providerError(message, code = 'AI_PROVIDER_UNAVAILABLE', status = 503) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function isConfigured() {
  return Boolean(env.runware?.apiKey);
}

function assertConfigured() {
  if (!isConfigured()) throw providerError('AI generation is not configured yet. Add the Runware API key in Railway and redeploy.', 'RUNWARE_NOT_CONFIGURED');
}

async function request(tasks, timeoutMs = env.runware?.timeoutMs || 360000) {
  assertConfigured();
  let response;
  try {
    response = await axios.post(env.runware.baseUrl, tasks, {
      headers: { Authorization: `Bearer ${env.runware.apiKey}`, 'Content-Type': 'application/json' },
      timeout: timeoutMs,
      maxContentLength: 5 * 1024 * 1024,
      validateStatus: status => status >= 200 && status < 500
    });
  } catch (error) {
    throw providerError(`AI provider request failed: ${error.code === 'ECONNABORTED' ? 'request timed out' : 'temporary network error'}.`, 'RUNWARE_NETWORK_ERROR');
  }
  if (response.status >= 400) throw providerError(`AI provider returned HTTP ${response.status}. Please retry shortly.`, 'RUNWARE_HTTP_ERROR', 502);
  const payload = response.data || {};
  if (Array.isArray(payload.errors) && payload.errors.length) {
    const first = payload.errors[0] || {};
    const code = String(first.code || 'RUNWARE_GENERATION_FAILED');
    const blocked = /nsfw|safety|moderation|content/i.test(`${code} ${first.message || ''}`);
    throw providerError(blocked ? 'The requested content was blocked by the generation provider. Edit the input and try again.' : String(first.message || 'AI generation failed.'), blocked ? 'CONTENT_BLOCKED' : code, blocked ? 422 : 502);
  }
  return Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [];
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

function videoDimensions(aspectRatio = '9:16') {
  const map = {
    '1:1': [1024, 1024],
    '4:5': [864, 1080],
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
  const results = await request([{
    taskType: 'textInference',
    taskUUID,
    model: options.model || env.runware.textModel,
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
  return { text: String(text), cost: Number(item.cost || 0), model: options.model || env.runware.textModel, taskUUID };
}

async function generateImages(prompts, options = {}) {
  const { width, height } = imageDimensions(options.aspectRatio);
  const model = options.model || env.runware.imageModel;
  const tasks = prompts.map(prompt => ({
    taskType: 'imageInference',
    taskUUID: crypto.randomUUID(),
    model,
    deliveryMethod: 'sync',
    positivePrompt: prompt,
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
    await new Promise(resolve => setTimeout(resolve, env.runware.pollIntervalMs));
    const results = await request([{ taskType: 'getResponse', taskUUID }], Math.min(60000, env.runware.videoTimeoutMs));
    const item = results.find(entry => entry.taskUUID === taskUUID) || results[0];
    if (!item) continue;
    if (item.status === 'processing') {
      onProgress(Math.max(5, Math.min(95, Number(item.progress || 35))));
      continue;
    }
    if (item.status === 'error') throw providerError(item.error?.message || 'AI video generation failed.', item.error?.code || 'RUNWARE_VIDEO_FAILED', 502);
    if (item.videoURL || item.status === 'success') return item;
  }
  throw providerError('AI video generation timed out. Your credits will be returned automatically.', 'RUNWARE_VIDEO_TIMEOUT', 504);
}

async function generateVideo(input, onProgress = () => {}) {
  const duration = Math.max(2, Math.min(15, Math.floor(Number(input.duration || 5))));
  const long = duration > 10;
  const model = input.model || (long ? env.runware.videoLongModel : env.runware.videoModel);
  const { width, height } = videoDimensions(input.aspectRatio);
  const taskUUID = crypto.randomUUID();
  const task = {
    taskType: 'videoInference',
    taskUUID,
    model,
    deliveryMethod: 'async',
    positivePrompt: input.prompt,
    width,
    height,
    duration,
    includeCost: true,
    settings: { audio: input.audio !== false }
  };
  if (input.referenceImage) task.inputs = { frameImages: [input.referenceImage] };
  onProgress(5);
  const initial = await request([task], 60000);
  const first = initial.find(entry => entry.taskUUID === taskUUID) || initial[0];
  if (first?.videoURL) return { url: first.videoURL, cost: Number(first.cost || 0), model, taskUUID, width, height, duration };
  const final = await pollTask(taskUUID, onProgress);
  onProgress(100);
  return { url: final.videoURL, cost: Number(final.cost || 0), model, taskUUID, width, height, duration };
}

module.exports = { isConfigured, request, generateText, generateImages, generateVideo, imageDimensions, videoDimensions };
