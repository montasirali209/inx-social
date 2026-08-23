const http = require('node:http');
const crypto = require('node:crypto');

const config = {
  token: process.env.INX_OLLAMA_GATEWAY_TOKEN || '',
  ollamaUrl: process.env.OLLAMA_LOCAL_URL || 'http://127.0.0.1:11434',
  models: new Set((process.env.OLLAMA_ALLOWED_MODELS || 'qwen3:8b,qwen3:14b,qwen3-embedding:0.6b').split(',').map(value => value.trim()).filter(Boolean)),
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
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 524288) throw Object.assign(new Error('Request too large.'), { status: 413 }); }
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
  if (ollamaPath !== '/v1/images/generations') body.stream = false;
  await acquire();
  try {
    const response = await fetch(`${config.ollamaUrl}${ollamaPath}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(config.timeoutMs) });
    const text = await response.text();
    res.writeHead(response.status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(text);
  } finally { release(); }
}
function createServer() {
  if (config.token.length < 32) throw new Error('INX_OLLAMA_GATEWAY_TOKEN must contain at least 32 characters.');
  return http.createServer(async (req, res) => {
    try {
      if (!authorised(req)) return json(res, 401, { error: 'Unauthorized.' });
      if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, service: 'inx-ollama-gateway', active, queued: queue.length, models: [...config.models], imageModels: [...config.imageModels], imageGeneration: config.imageModels.size > 0 });
      if (req.method === 'POST' && req.url === '/api/chat') return await proxy(req, res, '/api/chat');
      if (req.method === 'POST' && ['/api/embed', '/api/embeddings'].includes(req.url)) return await proxy(req, res, '/api/embed');
      if (req.method === 'POST' && req.url === '/v1/images/generations') return await proxy(req, res, '/v1/images/generations', config.imageModels);
      return json(res, 404, { error: 'Not found.' });
    } catch (error) { return json(res, Number(error.status || 502), { error: error.message || 'Gateway request failed.' }); }
  });
}
if (require.main === module) createServer().listen(config.port, config.host, () => console.log(`INX Ollama Gateway listening on http://${config.host}:${config.port}`));
module.exports = { createServer, config, secureEqual };
