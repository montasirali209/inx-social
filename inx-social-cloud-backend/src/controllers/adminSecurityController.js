const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../db/prisma');
const { hashPassword, comparePassword } = require('../utils/auth');
const { createToken } = require('../utils/secureTokens');
const emailService = require('../services/emailService');

const SYSTEM_SETTINGS = {
  maintenance_mode: {
    label: 'Maintenance mode',
    type: 'boolean',
    description: 'Emergency application maintenance flag. Keep disabled during normal operation.',
    defaultValue: 'false'
  },
  latest_desktop_version: {
    label: 'Latest desktop version',
    type: 'text',
    description: 'Current desktop release value stored by the backend.',
    defaultValue: ''
  },
  trial_days: {
    label: 'Stored trial length',
    type: 'number',
    description: 'Database trial-duration setting. Registration defaults may also be controlled by deployment configuration.',
    defaultValue: '5'
  }
};

function requestMeta(req) {
  return {
    ip: req.ip || null,
    userAgent: String(req.get('user-agent') || '').slice(0, 500) || null
  };
}

async function audit(req, action, entity, entityId, metadata) {
  const meta = requestMeta(req);
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id || null,
      action,
      entity: entity || null,
      entityId: entityId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ip: meta.ip,
      userAgent: meta.userAgent
    }
  });
}

function sanitizeAdministrator(user, lastLoginAt = null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt
  };
}

async function administrators(req, res, next) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const ids = admins.map(admin => admin.id);
    const recentLogins = ids.length
      ? await prisma.auditLog.findMany({
          where: { userId: { in: ids }, action: 'ADMIN_LOGIN_SUCCESS' },
          orderBy: { createdAt: 'desc' },
          select: { userId: true, createdAt: true }
        })
      : [];

    const lastLoginByUser = {};
    for (const event of recentLogins) {
      if (event.userId && !lastLoginByUser[event.userId]) lastLoginByUser[event.userId] = event.createdAt;
    }

    res.json({
      administrators: admins.map(admin => sanitizeAdministrator(admin, lastLoginByUser[admin.id] || null)),
      currentAdminId: req.user.id
    });
  } catch (error) {
    next(error);
  }
}

async function sendSetupLink(user) {
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  const token = createToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: token.hash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    }
  });

  try {
    const result = await emailService.sendPasswordReset(user, token.raw);
    return { sent: !result?.dev, devLogged: Boolean(result?.dev), error: null };
  } catch (error) {
    return { sent: false, devLogged: false, error: error.message };
  }
}

async function createAdministrator(req, res, next) {
  try {
    const input = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email()
    }).parse(req.body || {});

    const email = input.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const randomPassword = crypto.randomBytes(48).toString('base64url');
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash: await hashPassword(randomPassword),
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: now
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const setup = await sendSetupLink(user);
    await audit(req, 'ADMIN_CREATE_ADMINISTRATOR', 'User', user.id, {
      email: user.email,
      role: user.role,
      setupEmailSent: setup.sent
    });

    res.status(201).json({
      ok: true,
      administrator: sanitizeAdministrator(user),
      setupEmailSent: setup.sent,
      setupEmailDevLogged: setup.devLogged,
      warning: setup.error ? 'Administrator created, but the setup email could not be delivered.' : null
    });
  } catch (error) {
    next(error);
  }
}

async function resendAdministratorSetup(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return res.status(404).json({ error: 'Administrator not found.' });
    }

    const setup = await sendSetupLink(user);
    await audit(req, 'ADMIN_RESEND_SETUP_LINK', 'User', user.id, {
      email: user.email,
      setupEmailSent: setup.sent
    });

    if (setup.error) {
      return res.status(502).json({ error: 'Setup link created, but email delivery failed.' });
    }

    return res.json({ ok: true, setupEmailSent: setup.sent, setupEmailDevLogged: setup.devLogged });
  } catch (error) {
    next(error);
  }
}

async function updateAdministrator(req, res, next) {
  try {
    const input = z.object({
      role: z.enum(['ADMIN', 'SUPER_ADMIN']).optional(),
      status: z.enum(['ACTIVE', 'SUSPENDED']).optional()
    }).refine(value => value.role || value.status, { message: 'No administrator change supplied.' }).parse(req.body || {});

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target || !['ADMIN', 'SUPER_ADMIN'].includes(target.role)) {
      return res.status(404).json({ error: 'Administrator not found.' });
    }

    if (target.id === req.user.id) {
      if ((input.role && input.role !== target.role) || (input.status && input.status !== 'ACTIVE')) {
        return res.status(400).json({ error: 'You cannot demote or suspend your own administrator account.' });
      }
    }

    const removingActiveSuperAdmin = target.role === 'SUPER_ADMIN' && target.status === 'ACTIVE' &&
      ((input.role && input.role !== 'SUPER_ADMIN') || input.status === 'SUSPENDED');

    if (removingActiveSuperAdmin) {
      const activeSuperAdmins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } });
      if (activeSuperAdmins <= 1) {
        return res.status(400).json({ error: 'At least one active super administrator must remain.' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        role: input.role || undefined,
        status: input.status || undefined
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    await audit(req, 'ADMIN_UPDATE_ADMINISTRATOR', 'User', target.id, {
      before: { role: target.role, status: target.status },
      after: { role: updated.role, status: updated.status }
    });

    res.json({ ok: true, administrator: sanitizeAdministrator(updated) });
  } catch (error) {
    next(error);
  }
}

async function changeOwnPassword(req, res, next) {
  try {
    const input = z.object({
      currentPassword: z.string().min(1).max(256),
      newPassword: z.string().min(12).max(128)
        .regex(/[a-z]/, 'New password must include a lowercase letter.')
        .regex(/[A-Z]/, 'New password must include an uppercase letter.')
        .regex(/[0-9]/, 'New password must include a number.')
        .regex(/[^A-Za-z0-9]/, 'New password must include a symbol.')
    }).parse(req.body || {});

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await comparePassword(input.currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    if (await comparePassword(input.newPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'Choose a new password that is different from your current password.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) }
    });
    await audit(req, 'ADMIN_CHANGE_OWN_PASSWORD', 'User', user.id, null);

    res.json({ ok: true, message: 'Administrator password updated.' });
  } catch (error) {
    next(error);
  }
}

async function auditLogs(req, res, next) {
  try {
    const limit = Math.max(20, Math.min(200, Number(req.query.limit || 100)));
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    });

    res.json({
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata,
        ip: log.ip,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        user: log.user
      }))
    });
  } catch (error) {
    next(error);
  }
}

function validateSystemSetting(key, rawValue) {
  const value = String(rawValue ?? '').trim();
  if (key === 'maintenance_mode') {
    if (!['true', 'false'].includes(value)) throw new Error('Maintenance mode must be true or false.');
    return value;
  }
  if (key === 'trial_days') {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 30) throw new Error('Trial days must be an integer from 1 to 30.');
    return String(number);
  }
  if (key === 'latest_desktop_version') {
    if (!/^\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9.-]+)?$/.test(value)) throw new Error('Enter a valid desktop version such as 14.0.1.');
    return value;
  }
  throw new Error('This setting cannot be changed from the Control Centre.');
}

async function systemSettings(req, res, next) {
  try {
    const keys = Object.keys(SYSTEM_SETTINGS);
    const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } });
    const byKey = Object.fromEntries(rows.map(row => [row.key, row]));
    const settings = keys.map(key => {
      const definition = SYSTEM_SETTINGS[key];
      const row = byKey[key];
      return {
        key,
        label: definition.label,
        type: definition.type,
        description: definition.description,
        value: row?.value ?? definition.defaultValue,
        updatedAt: row?.updatedAt || null
      };
    });

    res.json({ settings, canEdit: req.user.role === 'SUPER_ADMIN' });
  } catch (error) {
    next(error);
  }
}

async function updateSystemSetting(req, res, next) {
  try {
    const key = String(req.params.key || '').trim();
    if (!SYSTEM_SETTINGS[key]) return res.status(404).json({ error: 'Setting is not available in the Control Centre.' });

    let value;
    try {
      value = validateSystemSetting(key, req.body?.value);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const definition = SYSTEM_SETTINGS[key];
    const setting = await prisma.appSetting.upsert({
      where: { key },
      create: { key, value, description: definition.description },
      update: { value, description: definition.description }
    });

    await audit(req, 'ADMIN_UPDATE_SYSTEM_SETTING', 'AppSetting', setting.id, { key, value });
    res.json({ ok: true, setting });
  } catch (error) {
    next(error);
  }
}

async function secureLegacySettingUpdate(req, res, next) {
  req.params.key = String(req.body?.key || '').trim();
  req.body = { value: req.body?.value };
  return updateSystemSetting(req, res, next);
}

module.exports = {
  administrators,
  createAdministrator,
  resendAdministratorSetup,
  updateAdministrator,
  changeOwnPassword,
  auditLogs,
  systemSettings,
  updateSystemSetting,
  secureLegacySettingUpdate
};
