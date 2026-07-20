const assert = require('node:assert/strict');
const test = require('node:test');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'inx-social-test-jwt-secret';
process.env.TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || 'inx-social-test-token-encryption-key';
process.env.NODE_ENV = 'test';

const prismaPath = require.resolve('../src/db/prisma');
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {}
};

const {
  validateReleaseInput,
  publicRelease
} = require('../src/controllers/releaseController');
const {
  safeDownloadUrl,
  releaseSummary
} = require('../src/controllers/portalController');
const { compareVersions, isVersionBelow } = require('../src/utils/version');

const validRelease = {
  version: '14.0.0',
  fileName: 'INX-Social-Setup-14.0.0.exe',
  storageKey: 'https://github.com/inaxx/inx-social/releases/download/v14.0.0/INX-Social-Setup-14.0.0.exe',
  fileSizeBytes: '123456',
  sha256: 'a'.repeat(64),
  mandatory: false
};

test('release input accepts a signed-release metadata shape', () => {
  const parsed = validateReleaseInput(validRelease);
  assert.equal(parsed.version, '14.0.0');
  assert.equal(parsed.fileSizeBytes, 123456n);
  assert.equal(parsed.mandatory, false);
});

test('release input rejects unsafe download URLs and invalid hashes', () => {
  assert.throws(
    () => validateReleaseInput({ ...validRelease, storageKey: 'http://downloads.example.com/setup.exe' }),
    /HTTPS download URL/
  );
  assert.throws(
    () => validateReleaseInput({ ...validRelease, sha256: 'not-a-sha256' }),
    /64-character/
  );
});

test('public release metadata never exposes the storage URL', () => {
  const release = {
    ...validRelease,
    fileSizeBytes: 123456n,
    releaseNotes: null,
    minimumSupportedVersion: null,
    publishedAt: new Date('2026-07-19T00:00:00Z')
  };
  const output = publicRelease(release);
  assert.equal(Object.hasOwn(output, 'storageKey'), false);
  assert.equal(output.sha256, 'a'.repeat(64));
});

test('portal exposes availability without exposing its protected URL', () => {
  const summary = releaseSummary({
    version: '14.0.0',
    fileName: 'INX-Social-Setup-14.0.0.exe',
    fileSizeBytes: 123456n,
    sha256: 'b'.repeat(64),
    publishedAt: new Date('2026-07-19T00:00:00Z')
  });
  assert.equal(summary.installerAvailable, true);
  assert.equal(Object.hasOwn(summary, 'storageKey'), false);
  assert.equal(safeDownloadUrl(validRelease.storageKey), validRelease.storageKey);
  assert.equal(safeDownloadUrl('file:///C:/setup.exe'), null);
});

test('desktop release versions compare safely for minimum-version policy', () => {
  assert.equal(compareVersions('14.0.0', '14.0.0'), 0);
  assert.equal(isVersionBelow('13.9.9', '14.0.0'), true);
  assert.equal(isVersionBelow('14.1.0', '14.0.0'), false);
  assert.equal(isVersionBelow('patched-version', '14.0.0'), null);
});
