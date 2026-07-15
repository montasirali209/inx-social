const { z } = require('zod');
const prisma = require('../db/prisma');
const { getLicenseStatus } = require('../services/licenseService');

const connectPageSchema = z.object({
  facebookPageId: z.string().min(2),
  facebookPageName: z.string().min(1),
  accessToken: z.string().optional(),
  metaAppId: z.string().optional()
});

async function listPages(req, res, next) {
  try {
    const pages = await prisma.connectedPage.findMany({
      where: { userId: req.user.id },
      orderBy: { connectedAt: 'desc' },
      select: {
        id: true,
        facebookPageId: true,
        facebookPageName: true,
        status: true,
        connectedAt: true,
        lastCheckedAt: true,
        tokenExpiresAt: true
      }
    });
    const license = await getLicenseStatus(req.user.id);
    res.json({ pages, limit: license.limits.pages, plan: license.plan });
  } catch (err) { next(err); }
}

async function connectPage(req, res, next) {
  try {
    const input = connectPageSchema.parse(req.body);
    const existing = await prisma.connectedPage.findUnique({
      where: { userId_facebookPageId: { userId: req.user.id, facebookPageId: input.facebookPageId } }
    });

    if (!existing) {
      const license = await getLicenseStatus(req.user.id);
      if (!license.allowed) return res.status(403).json({ error: 'Your trial or subscription is not active.' });
      const count = await prisma.connectedPage.count({ where: { userId: req.user.id, status: 'ACTIVE' } });
      if (count >= license.limits.pages) {
        return res.status(403).json({
          error: `Facebook Page limit reached for ${license.plan} (${license.limits.pages}). Upgrade your plan to connect more Pages.`,
          code: 'PAGE_LIMIT_REACHED',
          limit: license.limits.pages,
          plan: license.plan
        });
      }
    }

    const page = await prisma.connectedPage.upsert({
      where: { userId_facebookPageId: { userId: req.user.id, facebookPageId: input.facebookPageId } },
      create: {
        userId: req.user.id,
        facebookPageId: input.facebookPageId,
        facebookPageName: input.facebookPageName,
        metaAppId: input.metaAppId,
        encryptedAccessToken: input.accessToken || null,
        status: 'ACTIVE',
        lastCheckedAt: new Date()
      },
      update: {
        facebookPageName: input.facebookPageName,
        metaAppId: input.metaAppId,
        encryptedAccessToken: input.accessToken || undefined,
        status: 'ACTIVE',
        lastCheckedAt: new Date()
      }
    });
    res.json({ page: { ...page, encryptedAccessToken: undefined } });
  } catch (err) { next(err); }
}

async function revokePage(req, res, next) {
  try {
    const page = await prisma.connectedPage.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { status: 'REVOKED', encryptedAccessToken: null }
    });
    res.json({ success: page.count > 0 });
  } catch (err) { next(err); }
}

module.exports = { listPages, connectPage, revokePage };
