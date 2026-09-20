const { z } = require('zod');
const prisma = require('../db/prisma');
const env = require('../config/env');
const searchConsole = require('../services/googleSearchConsoleService');

function adminReturnUrl(params = {}) {
  const query = new URLSearchParams(params).toString();
  if (env.adminHost) return `https://${env.adminHost}/?${query}`;
  return `/admin?${query}`;
}

async function writeAudit(userId, action, metadata = null) {
  if (!userId) return;
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: 'SearchConsoleConnection',
        entityId: searchConsole.CONNECTION_ID,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
  } catch (error) {
    console.error('[GSC AUDIT LOG FAILED]', error.message);
  }
}

async function status(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await searchConsole.status());
  } catch (error) {
    next(error);
  }
}

async function startOAuth(req, res, next) {
  try {
    const payload = searchConsole.authorization(req.user.id);
    await writeAudit(req.user.id, 'ADMIN_GSC_OAUTH_STARTED', {
      redirectUri: payload.redirectUri,
      scope: payload.scope
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (error) {
    next(error);
  }
}

async function oauthCallback(req, res) {
  try {
    const result = await searchConsole.completeOAuth(req.query || {});
    await writeAudit(result.adminUserId, 'ADMIN_GSC_CONNECTED', {
      selectedSiteUrl: result.connection?.selectedSiteUrl || null,
      properties: result.sites?.length || 0
    });
    return res.redirect(303, adminReturnUrl({ gsc: 'connected' }));
  } catch (error) {
    const message = String(error.publicMessage || error.message || 'Google Search Console connection failed.').slice(0, 280);
    return res.redirect(303, adminReturnUrl({ gsc: 'error', message }));
  }
}

async function selectSite(req, res, next) {
  try {
    const input = z.object({
      siteUrl: z.string().trim().min(1).max(500)
    }).parse(req.body || {});
    const connection = await searchConsole.selectSite(input.siteUrl);
    await writeAudit(req.user.id, 'ADMIN_GSC_PROPERTY_SELECTED', {
      siteUrl: connection.selectedSiteUrl
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, selectedSiteUrl: connection.selectedSiteUrl });
  } catch (error) {
    next(error);
  }
}

async function performance(req, res, next) {
  try {
    const input = z.object({
      days: z.coerce.number().int().refine(value => [7, 28, 90].includes(value)).default(28)
    }).parse(req.query || {});
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await searchConsole.performance(input.days));
  } catch (error) {
    next(error);
  }
}

async function disconnect(req, res, next) {
  try {
    const snapshot = await searchConsole.status().catch(() => null);
    await searchConsole.disconnect();
    await writeAudit(req.user.id, 'ADMIN_GSC_DISCONNECTED', {
      siteUrl: snapshot?.selectedSiteUrl || null
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  status,
  startOAuth,
  oauthCallback,
  selectSite,
  performance,
  disconnect
};
