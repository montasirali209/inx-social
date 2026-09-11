const { z } = require('zod');
const prisma = require('../db/prisma');
const env = require('../config/env');
const { comparePassword, signToken } = require('../utils/auth');

const ADMIN_COOKIE = 'inx_admin_session';
const ADMIN_TOKEN_TTL = '8h';
const ADMIN_COOKIE_MAX_AGE = 8 * 60 * 60 * 1000;

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(256)
});

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE
  };
}

function safeAdmin(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function requestMeta(req) {
  return {
    ip: req.ip || null,
    userAgent: String(req.get('user-agent') || '').slice(0, 500) || null
  };
}

async function writeAudit({ userId = null, action, entity = 'AdminSession', entityId = null, metadata = null, req }) {
  try {
    const meta = requestMeta(req);
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ip: meta.ip,
        userAgent: meta.userAgent
      }
    });
  } catch (error) {
    console.error('[ADMIN AUDIT LOG FAILED]', error.message);
  }
}

async function login(req, res, next) {
  try {
    const input = loginSchema.parse(req.body || {});
    const email = input.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    const validRole = user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
    const validPassword = user ? await comparePassword(input.password, user.passwordHash) : false;

    if (!user || !validRole || !validPassword || user.status !== 'ACTIVE') {
      await writeAudit({
        userId: validRole ? user.id : null,
        action: 'ADMIN_LOGIN_FAILED',
        metadata: { email },
        req
      });
      return res.status(401).json({ error: 'Invalid administrator credentials' });
    }

    const token = signToken(user, ADMIN_TOKEN_TTL);
    res.cookie(ADMIN_COOKIE, token, cookieOptions());
    res.setHeader('Cache-Control', 'no-store');

    await writeAudit({
      userId: user.id,
      action: 'ADMIN_LOGIN_SUCCESS',
      entityId: user.id,
      req
    });

    return res.json({ user: safeAdmin(user), sessionExpiresInHours: 8 });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res) {
  res.clearCookie(ADMIN_COOKIE, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true });
}

async function me(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ user: safeAdmin(req.user), sessionExpiresInHours: 8 });
}

module.exports = { login, logout, me, ADMIN_COOKIE };
