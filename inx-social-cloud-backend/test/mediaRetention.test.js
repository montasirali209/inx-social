'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VIDEO_RETENTION_DAYS,
  OTHER_MEDIA_RETENTION_DAYS,
  MEDIA_STORAGE_LIMIT_BYTES,
  retentionDays,
  expiresAtFor,
  runMediaRetention,
  runUserStorageQuota,
} = require('../src/services/mediaRetentionService');

test('media retention keeps videos for 10 days and other media for 30 days', () => {
  const now = new Date('2026-09-12T00:00:00.000Z');
  assert.equal(VIDEO_RETENTION_DAYS, 10);
  assert.equal(OTHER_MEDIA_RETENTION_DAYS, 30);
  assert.equal(retentionDays('video/mp4'), 10);
  assert.equal(retentionDays('image/png'), 30);
  assert.equal(expiresAtFor('video/mp4', now).toISOString(), '2026-09-22T00:00:00.000Z');
  assert.equal(expiresAtFor('image/png', now).toISOString(), '2026-10-12T00:00:00.000Z');
});

test('media retention removes explicit expiries and applies limits to legacy assets', async () => {
  let where;
  const count = await runMediaRetention({
    now: new Date('2026-09-12T00:00:00.000Z'),
    prisma: { agentAsset: { deleteMany: async input => { where = input.where; return { count: 3 }; } } },
  });
  assert.equal(count, 3);
  assert.equal(where.OR[0].expiresAt.lte.toISOString(), '2026-09-12T00:00:00.000Z');
  assert.equal(where.OR[1].createdAt.lte.toISOString(), '2026-09-02T00:00:00.000Z');
  assert.equal(where.OR[2].createdAt.lte.toISOString(), '2026-08-13T00:00:00.000Z');
});


test('media quota is fixed at 200 MB and evicts oldest assets first', async () => {
  const mb = 1024 * 1024;
  const assets = [
    { id: 'oldest', userId: 'user-1', byteSize: 120 * mb, storageKey: null, createdAt: new Date('2026-09-01T00:00:00Z') },
    { id: 'middle', userId: 'user-1', byteSize: 90 * mb, storageKey: null, createdAt: new Date('2026-09-02T00:00:00Z') },
    { id: 'newest', userId: 'user-1', byteSize: 40 * mb, storageKey: null, createdAt: new Date('2026-09-03T00:00:00Z') },
  ];
  let deletedIds = [];
  const database = {
    agentAsset: {
      aggregate: async () => ({ _sum: { byteSize: assets.reduce((total, asset) => total + asset.byteSize, 0) } }),
      findMany: async () => assets,
      deleteMany: async ({ where }) => {
        deletedIds = where.id.in;
        return { count: deletedIds.length };
      },
    },
  };

  assert.equal(MEDIA_STORAGE_LIMIT_BYTES, 200 * mb);
  const removed = await runUserStorageQuota('user-1', { prisma: database });
  assert.equal(removed, 1);
  assert.deepEqual(deletedIds, ['oldest']);
});
