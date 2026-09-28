'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const env = require('../config/env');
const convergence = require('../services/uiStudioConvergenceService');

const workerId = process.env.UI_STUDIO_RENDER_WORKER_ID || ('ui-render-' + crypto.randomUUID().slice(0, 8));
const port = Number(process.env.PORT || 8080);
let shuttingDown = false;
let busy = false;
let lastProcessedAt = null;
let lastError = null;

async function tick() {
  if (shuttingDown || busy) return;
  busy = true;
  try {
    const result = await convergence.processNextQueuedRender(workerId);
    if (result.processed) {
      lastProcessedAt = new Date().toISOString();
      lastError = null;
      console.log('[ui-studio-worker] render completed', result);
    }
  } catch (error) {
    lastError = String(error?.publicMessage || error?.message || error).slice(0, 1200);
    console.error('[ui-studio-worker] render failed', { workerId, error: lastError });
  } finally {
    busy = false;
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    const payload = {
      ok: true,
      service: 'INXSocial UI Studio Renderer Worker',
      workerId,
      busy,
      rendererConfigured: convergence.rendererConfigured(),
      lastProcessedAt,
      lastError
    };
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(payload));
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log('[ui-studio-worker] started', {
    workerId,
    port,
    pollMs: env.uiStudioConvergence?.pollMs,
    rendererConfigured: convergence.rendererConfigured()
  });
});

const interval = setInterval(() => void tick(), Number(env.uiStudioConvergence?.pollMs || 1500));
interval.unref();
void convergence.recoverStaleJobs().catch(error => {
  console.error('[ui-studio-worker] stale-job recovery failed', { error: error?.message });
});
void tick();

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('[ui-studio-worker] shutting down', { signal });
  clearInterval(interval);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
