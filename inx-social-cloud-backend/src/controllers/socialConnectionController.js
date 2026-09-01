const { z } = require('zod');
const service = require('../services/socialConnectionService');

const oauthPlatformSchema = z.enum(['linkedin', 'youtube']);

function completionPage(res, payload) {
  const safePayload = JSON.stringify({ type: 'inx-social-oauth-result', ...payload }).replace(/</g, '\\u003c');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>INX Social connection</title></head><body style="margin:0;background:#06131f;color:#e2e8f0;font:16px system-ui;display:grid;min-height:100vh;place-items:center"><main style="max-width:480px;padding:32px;text-align:center"><h1>${payload.ok ? 'Account connected' : 'Connection failed'}</h1><p>${payload.ok ? 'You can return to INX Social. This window will close automatically.' : 'Return to INX Social and try the connection again.'}</p></main><script>const payload=${safePayload};try{window.opener?.postMessage(payload,location.origin);localStorage.setItem('inx-social-oauth-result',JSON.stringify(payload));}catch(_){}setTimeout(()=>window.close(),500);</script></body></html>`);
}

async function list(req, res, next) {
  try {
    const connections = await service.listConnections(req.user.id);
    res.json({
      connections,
      providers: {
        instagram: { configured: true, method: 'META_LINKED_ACCOUNT' },
        linkedin: { configured: Boolean(String(process.env.LINKEDIN_CLIENT_ID || '').trim() && String(process.env.LINKEDIN_CLIENT_SECRET || '').trim()), method: 'OAUTH_CODE' },
        youtube: { configured: Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim() && String(process.env.GOOGLE_CLIENT_SECRET || '').trim()), method: 'OAUTH_CODE' }
      }
    });
  } catch (error) { next(error); }
}

async function startOAuth(req, res, next) {
  try {
    const platform = oauthPlatformSchema.parse(req.params.platform);
    res.json(service.authorization(platform, req.user.id));
  } catch (error) { next(error); }
}

async function oauthCallback(req, res) {
  const platform = String(req.params.platform || '').toLowerCase();
  try {
    oauthPlatformSchema.parse(platform);
    const connection = await service.completeOAuth(platform, req.query || {});
    completionPage(res, { ok: true, platform, connectionId: connection.id });
  } catch (error) {
    completionPage(res, { ok: false, platform, error: String(error.message || 'The social account could not be connected.').slice(0, 300) });
  }
}

async function syncInstagram(req, res, next) {
  try {
    const result = await service.syncInstagram(req.user.id);
    res.json({ connections: result.connections.map(service.publicConnection), warnings: result.errors });
  } catch (error) { next(error); }
}

async function disconnect(req, res, next) {
  try {
    res.json(await service.disconnect(req.user.id, req.params.id));
  } catch (error) { next(error); }
}

module.exports = { list, startOAuth, oauthCallback, syncInstagram, disconnect };
