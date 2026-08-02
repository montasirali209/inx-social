const assert = require('node:assert/strict');
const test = require('node:test');

const prismaPath = require.resolve('../src/db/prisma');
const licenseServicePath = require.resolve('../src/services/licenseService');

const page = {
  id: 'page-row-1',
  userId: 'user-1',
  facebookPageId: 'facebook-page-1',
  facebookPageName: 'INX Test Page',
  facebookPagePicture: 'https://example.com/page.png',
  facebookCategory: 'Digital creator',
  encryptedAccessToken: 'must-never-be-returned',
  status: 'ACTIVE',
  isSelected: true
};

let createdInput = null;
const prisma = {
  metaAccount: {
    findMany: async () => [{
      id: 'account-1',
      facebookUserId: 'fb-user-1',
      facebookUserName: 'Owner',
      encryptedAccessToken: 'must-never-be-returned-account-token',
      status: 'ACTIVE',
      pages: [page]
    }]
  },
  cloudPreference: {
    findUnique: async () => ({
      settingsJson: JSON.stringify({ uiTheme: 'midnight' }),
      uiTextsJson: JSON.stringify({ appSubtitle: 'Content Scheduler' })
    })
  },
  connectedPage: {
    findMany: async () => [page],
    findFirst: async () => page
  },
  scheduleJob: {
    groupBy: async () => [{ status: 'DRAFT', _count: { _all: 1 } }],
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
    count: async () => 0,
    create: async input => {
      createdInput = input;
      return {
        id: 'job-1',
        ...input.data,
        attemptCount: 0,
        nextAttemptAt: null,
        completedAt: null,
        metaPostId: null,
        metaVideoId: null,
        errorMessage: null,
        createdAt: new Date('2026-07-23T10:00:00.000Z'),
        updatedAt: new Date('2026-07-23T10:00:00.000Z'),
        connectedPage: page,
        cloudAsset: {
          id: 'asset-1',
          ...input.data.cloudAsset.create,
          sha256: null,
          expiresAt: null,
          createdAt: new Date('2026-07-23T10:00:00.000Z'),
          updatedAt: new Date('2026-07-23T10:00:00.000Z')
        }
      };
    }
  }
};

require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
require.cache[licenseServicePath] = {
  id: licenseServicePath,
  filename: licenseServicePath,
  loaded: true,
  exports: {
    getLicenseStatus: async () => ({
      allowed: true,
      plan: 'STARTER',
      subscriptionStatus: 'ACTIVE',
      limits: { pages: 10, batchPosts: 100, postsPerDay: 100, devices: 1 }
    })
  }
};

const controller = require('../src/controllers/studioController');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('studio capabilities enable temporary streaming without persistent video storage', async () => {
  const res = responseRecorder();
  let forwardedError = null;
  await controller.capabilities({ user: { id: 'user-1' } }, res, error => { forwardedError = error; });
  assert.equal(forwardedError, null);
  assert.equal(res.body.phase, '10.0');
  assert.equal(res.body.mode, 'FULL_BROWSER_STUDIO');
  assert.equal(res.body.upload.enabled, true);
  assert.equal(res.body.upload.persistentStorage, false);
  assert.equal(res.body.upload.provider, 'TEMPORARY_STREAM_TO_META');
  assert.equal(res.body.publishing.enabled, true);
});

test('studio overview returns safe Page data without credentials', async () => {
  const res = responseRecorder();
  let forwardedError = null;
  await controller.overview({
    user: { id: 'user-1', name: 'Owner', businessName: 'INX', email: 'owner@example.com' }
  }, res, error => { forwardedError = error; });
  assert.equal(forwardedError, null);
  assert.equal(res.body.activePage.facebookPageName, 'INX Test Page');
  assert.equal(Object.hasOwn(res.body.activePage, 'encryptedAccessToken'), false);
  assert.equal(JSON.stringify(res.body).includes('must-never-be-returned'), false);
});

test('desktop-shaped cloud state reuses the renderer contract without returning Meta tokens', async () => {
  const res = responseRecorder();
  let forwardedError = null;
  await controller.desktopState({
    user: { id: 'user-1', name: 'Owner', businessName: 'INX', email: 'owner@example.com', status: 'ACTIVE' }
  }, res, error => { forwardedError = error; });
  assert.equal(forwardedError, null);
  assert.equal(res.body.state.account.authenticated, true);
  assert.equal(res.body.state.settings.uiTheme, 'midnight');
  assert.equal(res.body.state.workspace.activePage.facebookPageName, 'INX Test Page');
  assert.equal(JSON.stringify(res.body).includes('must-never-be-returned'), false);
});

test('creating a scheduled cloud upload stores metadata but no video or storage key', async () => {
  const res = responseRecorder();
  let forwardedError = null;
  await controller.createDraft({
    user: { id: 'user-1' },
    body: {
      connectedPageId: 'page-row-1',
      clientRequestId: 'request-12345678',
      title: 'Campaign A',
      caption: 'A safe cloud draft',
      originalFileName: 'reel.mp4',
      mimeType: 'video/mp4',
      fileSizeBytes: '1048576',
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      publishMode: 'SCHEDULED'
    }
  }, res, error => { forwardedError = error; });

  assert.equal(forwardedError, null);
  assert.equal(res.statusCode, 201);
  assert.equal(createdInput.data.origin, 'CLOUD');
  assert.equal(createdInput.data.status, 'AWAITING_UPLOAD');
  assert.equal(createdInput.data.cloudAsset.create.provider, 'TEMPORARY_STREAM');
  assert.equal(createdInput.data.cloudAsset.create.fileSizeBytes, 1048576n);
  assert.equal(Object.hasOwn(createdInput.data.cloudAsset.create, 'storageKey'), false);
  assert.equal(Object.hasOwn(res.body.job.asset, 'storageKey'), false);
  assert.equal(res.body.uploadAvailable, true);
  assert.equal(res.body.uploadUrl, '/api/studio/jobs/job-1/video');
});

test('creating an immediate cloud upload stores NOW mode without a schedule time', async () => {
  createdInput = null;
  const res = responseRecorder();
  let forwardedError = null;
  await controller.createDraft({
    user: { id: 'user-1' },
    body: {
      connectedPageId: 'page-row-1',
      clientRequestId: 'request-now-12345678',
      caption: 'Publish immediately',
      originalFileName: 'now.mp4',
      mimeType: 'video/mp4',
      fileSizeBytes: '2048',
      scheduledAt: null,
      publishMode: 'NOW'
    }
  }, res, error => { forwardedError = error; });

  assert.equal(forwardedError, null);
  assert.equal(res.statusCode, 201);
  assert.equal(createdInput.data.publishMode, 'NOW');
  assert.equal(createdInput.data.scheduledAt, null);
  assert.equal(createdInput.data.status, 'AWAITING_UPLOAD');
  assert.equal(res.body.job.publishMode, 'NOW');
});
