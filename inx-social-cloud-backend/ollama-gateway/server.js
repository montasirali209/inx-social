const http = require('node:http');
const crypto = require('node:crypto');

const config = {
  token: process.env.INX_OLLAMA_GATEWAY_TOKEN || '',
  textOllamaUrl: process.env.OLLAMA_TEXT_URL || process.env.OLLAMA_LOCAL_URL || 'http://127.0.0.1:11434',
  imageOllamaUrl: process.env.OLLAMA_IMAGE_URL || process.env.OLLAMA_LOCAL_URL || 'http://127.0.0.1:11435',
  models: new Set((process.env.OLLAMA_ALLOWED_MODELS || 'qwen3:8b,qwen3:14b,qwen3.5:9b,qwen3-embedding:0.6b').split(',').map(value => value.trim()).filter(Boolean)),
  imageModels: new Set((process.env.OLLAMA_ALLOWED_IMAGE_MODELS || 'x/z-image-turbo').split(',').map(value => value.trim()).filter(Boolean)),
  host: process.env.GATEWAY_HOST || '127.0.0.1',
  port: Number(process.env.GATEWAY_PORT || 5051),
  maxQueue: Number(process.env.GATEWAY_MAX_QUEUE || 8),
  timeoutMs: Number(process.env.GATEWAY_TIMEOUT_MS || 300000)
};
let active = 0;
const queue = [];

function secureEqual(left, right) {
  const a = Buffer.from(String(left)); const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function authorised(req) { return config.token.length >= 32 && secureEqual(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), config.token); }
function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' }); res.end(JSON.stringify(body)); }
async function readJson(req) {
  // Authenticated vision reviews can contain one generated image encoded as base64.
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 12 * 1024 * 1024) throw Object.assign(new Error('Request too large.'), { status: 413 }); }
  try { return JSON.parse(raw || '{}'); } catch (_) { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
}
function release() { active -= 1; queue.shift()?.(); }
async function acquire() {
  if (active < 1) { active += 1; return; }
  if (queue.length >= config.maxQueue) throw Object.assign(new Error('Local Ollama queue is full.'), { status: 503 });
  await new Promise(resolve => queue.push(resolve)); active += 1;
}
async function proxy(req, res, ollamaPath, allowedModels = config.models) {
  const body = await readJson(req);
  if (!allowedModels.has(String(body.model || ''))) return json(res, 400, { error: 'Model is not allowed by this gateway.' });
  body.stream = false;
  if (ollamaPath === '/api/chat') {
    body.think = body.think === true;
    body.options = body.options && typeof body.options === 'object' ? body.options : {};
    body.options.num_ctx = Math.max(4096, Math.min(32768, Number(body.options.num_ctx || 8192)));
    body.keep_alive = ['0', '0s', '5m', '10m'].includes(String(body.keep_alive || '')) ? body.keep_alive : '10m';
  }
  await acquire();
  try {
    const response = await fetch(`${config.textOllamaUrl}${ollamaPath}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(config.timeoutMs) });
    let result = null;
    try { result = await response.json(); } catch (_) {}
    if (!result) return json(res, response.status, { error: 'The local text engine returned an invalid response.' });
    // Hidden thinking must never cross the authenticated gateway or enter logs/memory.
    if (result && typeof result === 'object') {
      delete result.thinking;
      if (result.message && typeof result.message === 'object') delete result.message.thinking;
    }
    return json(res, response.status, result);
  } finally { release(); }
}
function imageDimensions(size) {
  const allowed = new Set(['512x512', '1024x1024', '1024x1536', '1536x1024']);
  const normalized = allowed.has(String(size || '')) ? String(size) : '1024x1024';
  const [width, height] = normalized.split('x').map(Number);
  return { width, height };
}
async function imageProxy(req, res) {
  const body = await readJson(req);
  const model = String(body.model || '');
  if (!config.imageModels.has(model)) return json(res, 400, { error: 'Image model is not allowed by this gateway.' });
  const prompt = String(body.prompt || '').trim();
  if (!prompt || prompt.length > 12000) return json(res, 400, { error: 'A valid image prompt is required.' });
  const { width, height } = imageDimensions(body.size);
  await acquire();
  try {
    const response = await fetch(`${config.imageOllamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, width, height, keep_alive: 0 }),
      signal: AbortSignal.timeout(config.timeoutMs)
    });
    let result = null;
    try { result = await response.json(); } catch (_) {}
    if (!response.ok) return json(res, response.status, { error: String(result?.error || 'The local image engine rejected this request.').slice(0, 500) });
    const encoded = String(result?.image || '');
    if (!encoded) return json(res, 502, { error: 'The local image engine returned no image data.' });
    if (encoded.length > 12 * 1024 * 1024) return json(res, 502, { error: 'The generated image exceeded the gateway safety limit.' });
    return json(res, 200, { created: Math.floor(Date.now() / 1000), data: [{ b64_json: encoded }] });
  } finally { release(); }
}
async function upstreamVersion(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(3000) });
    const data = await response.json();
    return response.ok ? { reachable: true, version: String(data?.version || '') || null } : { reachable: false, version: null };
  } catch (_) { return { reachable: false, version: null }; }
}
function createServer() {
  if (config.token.length < 32) throw new Error('INX_OLLAMA_GATEWAY_TOKEN must contain at least 32 characters.');
  return http.createServer(async (req, res) => {
    try {
      if (!authorised(req)) return json(res, 401, { error: 'Unauthorized.' });
      if (req.method === 'GET' && req.url === '/health') {
        const [textEngine, imageEngine] = await Promise.all([upstreamVersion(config.textOllamaUrl), upstreamVersion(config.imageOllamaUrl)]);
        return json(res, 200, { ok: textEngine.reachable && imageEngine.reachable, service: 'inx-ollama-gateway', active, queued: queue.length, models: [...config.models], imageModels: [...config.imageModels], textEngine, imageEngine, imageGeneration: config.imageModels.size > 0 });
      }
      if (req.method === 'POST' && req.url === '/api/chat') return await proxy(req, res, '/api/chat');
      if (req.method === 'POST' && ['/api/embed', '/api/embeddings'].includes(req.url)) return await proxy(req, res, '/api/embed');
      if (req.method === 'POST' && req.url === '/v1/images/generations') return await imageProxy(req, res);
      return json(res, 404, { error: 'Not found.' });
    } catch (error) { return json(res, Number(error.status || 502), { error: error.message || 'Gateway request failed.' }); }
  });
}
if (require.main === module) createServer().listen(config.port, config.host, () => console.log(`INX Ollama Gateway listening on http://${config.host}:${config.port}`));
module.exports = { createServer, config, secureEqual, imageDimensions, imageProxy, upstreamVersion };
