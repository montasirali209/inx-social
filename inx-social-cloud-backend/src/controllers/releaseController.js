const prisma = require('../db/prisma');

function serializeRelease(release) {
  return {
    ...release,
    fileSizeBytes: release.fileSizeBytes.toString()
  };
}

async function publishRelease(req, res, next) {
  try {
    const {
      version,
      fileName,
      storageKey,
      fileSizeBytes,
      sha256,
      releaseNotes,
      minimumSupportedVersion,
      mandatory
    } = req.body;

    if (!version || !fileName || !storageKey || !fileSizeBytes || !sha256) {
      return res.status(400).json({
        error:
          'version, fileName, storageKey, fileSizeBytes and sha256 are required'
      });
    }

    const parsedFileSize = BigInt(String(fileSizeBytes));

    if (parsedFileSize <= 0n) {
      return res.status(400).json({
        error: 'fileSizeBytes must be greater than zero'
      });
    }

    // Only one release should be marked as the active current release.
    await prisma.desktopRelease.updateMany({
      where: { active: true },
      data: { active: false }
    });

    const release = await prisma.desktopRelease.upsert({
      where: { version: String(version).trim() },
      update: {
        fileName: String(fileName).trim(),
        storageKey: String(storageKey).trim(),
        fileSizeBytes: parsedFileSize,
        sha256: String(sha256).trim().toLowerCase(),
        releaseNotes: releaseNotes
          ? String(releaseNotes).trim()
          : null,
        minimumSupportedVersion: minimumSupportedVersion
          ? String(minimumSupportedVersion).trim()
          : null,
        mandatory: Boolean(mandatory),
        active: true,
        publishedAt: new Date()
      },
      create: {
        version: String(version).trim(),
        fileName: String(fileName).trim(),
        storageKey: String(storageKey).trim(),
        fileSizeBytes: parsedFileSize,
        sha256: String(sha256).trim().toLowerCase(),
        releaseNotes: releaseNotes
          ? String(releaseNotes).trim()
          : null,
        minimumSupportedVersion: minimumSupportedVersion
          ? String(minimumSupportedVersion).trim()
          : null,
        mandatory: Boolean(mandatory),
        active: true
      }
    });

    return res.status(201).json({
      message: 'Desktop release published successfully',
      release: serializeRelease(release)
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
      return res.status(404).json({
        error: 'No active desktop release is available'
      });
    }

    return res.json({
      release: serializeRelease(release)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  publishRelease,
  getLatestRelease
};