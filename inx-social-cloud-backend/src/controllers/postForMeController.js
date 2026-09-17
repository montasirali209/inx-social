const { z } = require('zod');
const postForMe = require('../services/postForMeService');

const platformSchema = z.enum(['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads', 'bluesky', 'x']);
const startSchema = z.object({
  handle: z.string().trim().min(1).max(255).optional(),
  appPassword: z.string().trim().min(1).max(255).optional(),
  connectionType: z.enum(['instagram', 'facebook']).optional()
}).passthrough();

function completionPage(res, payload) {
  const safePayload = JSON.stringify({ type: 'inx-social-oauth-result', ...payload }).replace(/</g, '\\u003c');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>INXSocial connection</title></head><body style="margin:0;background:#06131f;color:#e2e8f0;font:16px system-ui;display:grid;min-height:100vh;place-items:center"><main style="max-width:520px;padding:32px;text-align:center"><h1>${payload.ok ? 'Account connected' : 'Connection failed'}</h1><p>${payload.ok ? 'Your account is connected. You can return to INXSocial.' : 'Return to INXSocial and try the connection again.'}</p></main><script>const payload=${safePayload};try{window.opener?.postMessage(payload,location.origin);localStorage.setItem('inx-social-oauth-result',JSON.stringify(payload));}catch(_){}setTimeout(()=>window.close(),650);</script></body></html>`);
}

async function start(req, res, next) {
  try {
    const platform = platformSchema.parse(String(req.params.platform || '').toLowerCase());
    const input = startSchema.parse(req.body || {});
    res.json(await postForMe.createAuthUrl(req.user.id, platform, input));
  } catch (error) { next(error); }
}

async function sync(req, res, next) {
  try {
    await postForMe.syncConnections(req.user.id);
    res.json({ ok: true });
  } catch (error) { next(error); }
}

function callback(req, res) {
  const rawProvider = String(req.query.provider || req.query.platform || '').toLowerCase();
  const platform = rawProvider === 'tiktok_business' ? 'tiktok' : rawProvider;
  const explicitSuccess = String(req.query.isSuccess ?? req.query.success ?? '').toLowerCase();
  const error = String(req.query.error || req.query.error_description || '').trim();
  const ok = explicitSuccess ? ['1', 'true', 'yes'].includes(explicitSuccess) : !error;

  completionPage(res, {
    ok,
    platform: platform || undefined,
    error: ok ? undefined : (error || 'The social account connection was not completed.'),
    notice: ok && platform ? `${platform[0].toUpperCase()}${platform.slice(1)} connected to INXSocial.` : undefined
  });
}

function webhook(req, res) {
  const received = req.get('Post-For-Me-Webhook-Secret');
  if (!postForMe.verifyWebhookSecret(received)) {
    return res.status(401).json({ error: 'Invalid Post for Me webhook secret.' });
  }

  const payload = req.body || {};
  // Post for Me expects a 2XX response within one second. Acknowledge first and
  // then process idempotently through our database upserts.
  res.status(202).json({ ok: true });
  setImmediate(() => {
    postForMe.handleWebhook(payload).catch((error) => {
      console.error('[post-for-me] webhook processing failed:', error?.message || error);
    });
  });
}

module.exports = { start, sync, callback, webhook };
