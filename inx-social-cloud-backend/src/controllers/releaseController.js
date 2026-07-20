const prisma = require('../db/prisma');

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function publicRelease(release) {
  return {
    version: release.version,
    fileName: release.fileName,
    fileSizeBytes: release.fileSizeBytes.toString(),
    sha256: release.sha256,
    releaseNotes: release.releaseNotes,
    minimumSupportedVersion: release.minimumSupportedVersion,
    mandatory: release.mandatory,
    publishedAt: release.publishedAt
  };
}

function privateRelease(release) {
  return {
    id: release.id,
    ...publicRelease(release),
    storageKey: release.storageKey,
    active: release.active,
    downloadCount: release.downloadCount,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt
  };
}

function parseBoolean(value) {
  if (value === undefined) return false;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error('mandatory must be true or false');
}

function validateStorageUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('storageKey must be a credential-free HTTPS download URL');
  }
  return parsed.toString();
}

function validateReleaseInput(body = {}) {
  const version = String(body.version || '').trim();
  const fileName = String(body.fileName || '').trim();
  const sha256 = String(body.sha256 || '').trim().toLowerCase();
  const releaseNotes = body.releaseNotes ? String(body.releaseNotes).trim() : null;
  const minimumSupportedVersion = body.minimumSupportedVersion
    ? String(body.minimumSupportedVersion).trim()
    : null;

  if (!VERSION_PATTERN.test(version)) throw new Error('version must use semantic version format, for example 14.0.0');
  if (!fileName || /[\\/]/.test(fileName) || !fileName.toLowerCase().endsWith('.exe')) {
    throw new Error('fileName must be a Windows .exe file name without a path');
  }
  if (!SHA256_PATTERN.test(sha256)) throw new Error('sha256 must be a 64-character hexadecimal SHA-256 value');
  if (minimumSupportedVersion && !VERSION_PATTERN.test(minimumSupportedVersion)) {
    throw new Error('minimumSupportedVersion must use semantic version format');
  }
  if (releaseNotes && releaseNotes.length > 10000) throw new Error('releaseNotes must be 10,000 characters or fewer');

  let fileSizeBytes;
  try {
    fileSizeBytes = BigInt(String(body.fileSizeBytes || ''));
  } catch (_) {
    throw new Error('fileSizeBytes must be a whole number');
  }
  if (fileSizeBytes <= 0n) throw new Error('fileSizeBytes must be greater than zero');

  return {
    version,
    fileName,
    storageKey: validateStorageUrl(body.storageKey),
    fileSizeBytes,
    sha256,
    releaseNotes,
    minimumSupportedVersion,
    mandatory: parseBoolean(body.mandatory)
  };
}

async function publishRelease(req, res, next) {
  let input;
  try {
    input = validateReleaseInput(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const release = await prisma.$transaction(async tx => {
      const saved = await tx.desktopRelease.upsert({
        where: { version: input.version },
        update: {
          ...input,
          active: true,
          publishedAt: new Date()
        },
        create: {
          ...input,
          active: true
        }
      });

      await tx.desktopRelease.updateMany({
        where: { active: true, id: { not: saved.id } },
        data: { active: false }
      });

      return saved;
    });

    return res.status(201).json({
      message: 'Desktop release published successfully',
      release: privateRelease(release)
    });
  } catch (error) {
    next(error);
  }
}

async function getLatestRelease(req, res, next) {
  try {
    const release = await prisma.desktopRelease.findFirst({
      where: { active: true },
      orderBy: { publishedAt: 'desc' }
    });

    if (!release) {
      return res.status(404).json({ error: 'No active desktop release is available' });
    }

    return res.json({ release: publicRelease(release) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  publishRelease,
  getLatestRelease,
  validateReleaseInput,
  publicRelease
};
