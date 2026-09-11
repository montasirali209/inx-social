const prisma = require('../db/prisma');
const { verifyToken } = require('../utils/auth');

const ADMIN_COOKIE = 'inx_admin_session';

function readCookie(req, name) {
  const source = String(req.headers.cookie || '');
  if (!source) return null;
  const prefix = `${name}=`;
  for (const part of source.split(';')) {
    const item = part.trim();
    if (item.startsWith(prefix)) {
      try {
        return decodeURIComponent(item.slice(prefix.length));
      } catch {
        return item.slice(prefix.length);
      }
    }
  }
  return null;
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    const adminCookieAllowed = String(req.originalUrl || req.url || '').startsWith('/api/admin');
    const token = bearerToken || (adminCookieAllowed ? readCookie(req, ADMIN_COOKIE) : null);
    if (!token) return res.status(401).json({ error: 'Missing authentication token' });

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'Invalid token user' });
    if (user.status === 'SUSPENDED') return res.status(403).json({ error: 'Account suspended' });

    req.user = user;
    req.authMethod = bearerToken ? 'bearer' : 'admin-cookie';
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super administrator access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin };
