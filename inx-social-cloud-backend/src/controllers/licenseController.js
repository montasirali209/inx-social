const { z } = require('zod');
const prisma = require('../db/prisma');
const { getLicenseStatus } = require('../services/licenseService');
const { isVersionBelow } = require('../utils/version');

const deviceSchema = z.object({
  deviceId: z.string().min(3),
  deviceName: z.string().optional(),
  appVersion: z.string().optional()
});

async function status(req, res, next) {
  try {
    const license = await getLicenseStatus(req.user.id);
    res.json({ license });
  } catch (err) { next(err); }
}

async function activateDevice(req, res, next) {
  try {
    const input = deviceSchema.parse(req.body);
    const license = await getLicenseStatus(req.user.id);
    if (!license.allowed) return res.status(403).json({ error: 'Trial or subscription is not active' });

    const releasePolicy = await prisma.desktopRelease.findFirst({
      where: { active: true },
      select: { version: true, minimumSupportedVersion: true, mandatory: true }
    });
    if (releasePolicy?.minimumSupportedVersion) {
      const belowMinimum = isVersionBelow(input.appVersion, releasePolicy.minimumSupportedVersion);
      if (belowMinimum === null || belowMinimum) {
        return res.status(426).json({
          error: `INX Social ${releasePolicy.minimumSupportedVersion} or newer is required. Download the current signed installer from your customer portal.`,
          code: 'APP_UPDATE_REQUIRED',
          currentVersion: releasePolicy.version,
          minimumSupportedVersion: releasePolicy.minimumSupportedVersion,
          mandatory: releasePolicy.mandatory
        });
      }
    }

    const existing = await prisma.device.findUnique({ where: { userId_deviceId: { userId: req.user.id, deviceId: input.deviceId } } });
    if (!existing) {
      const activeDeviceCount = await prisma.device.count({ where: { userId: req.user.id, status: 'ACTIVE' } });
      if (activeDeviceCount >= license.limits.devices) {
        return res.status(403).json({ error: `Device limit reached for ${license.plan} plan (${license.limits.devices})` });
      }
    }

    const device = await prisma.device.upsert({
      where: { userId_deviceId: { userId: req.user.id, deviceId: input.deviceId } },
      create: {
        userId: req.user.id,
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        appVersion: input.appVersion,
        lastSeenAt: new Date()
      },
      update: {
        deviceName: input.deviceName,
        appVersion: input.appVersion,
        status: 'ACTIVE',
        lastSeenAt: new Date()
      }
    });
    res.json({ device });
  } catch (err) { next(err); }
}

module.exports = { status, activateDevice };
