const assert = require('node:assert/strict');
const test = require('node:test');

process.env.JWT_SECRET ||= 'media-library-test-secret';

const prismaPath = require.resolve('../src/db/prisma');
const assets = [];
const folders = [];
const prisma = {
  agentAsset: {
    aggregate: async ({ where }) => ({ _sum: { byteSize: assets.filter(asset => asset.userId === where.userId).reduce((total, asset) => total + asset.byteSize, 0) } }),
    findMany: async ({ where = {} }) => assets.filter(asset => {
      const ids = where.id?.in || (where.id ? [where.id] : null);
      if (where.userId && asset.userId !== where.userId) return false;
      if (ids && !ids.includes(asset.id)) return false;
      if (where.archivedAt === null && asset.archivedAt) return false;
      if (where.archivedAt?.not === null && !asset.archivedAt) return false;
      if (where.archivedAt?.lt && !(asset.archivedAt && asset.archivedAt < where.archivedAt.lt)) return false;
      if (where.byteSize?.gt != null && !(asset.byteSize > where.byteSize.gt)) return false;
      return true;
    }),
    findFirst: async ({ where }) => assets.find(asset => {
      if (asset.userId !== where.userId) return false;
      if (where.id && asset.id !== where.id) return false;
      if (where.checksum && asset.checksum !== where.checksum) return false;
      if (where.status && asset.status !== where.status) return false;
      if (where.archivedAt === null && asset.archivedAt) return false;
      if (where.archivedAt?.not === null && !asset.archivedAt) return false;
      return true;
    }) || null,
    create: async ({ data }) => {
      const row = { id: `asset-${assets.length + 1}`, createdAt: new Date('2026-08-30T12:00:00Z'), campaignPosts: [], scheduleJobs: [], folder: folders.find(folder => folder.id === data.folderId) || null, ...data };
      assets.push(row);
      return row;
    },
    update: async ({ where, data }) => {
      const row = assets.find(asset => asset.id === where.id);
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const ids = where.id?.in || (where.id ? [where.id] : null);
      const rows = assets.filter(asset =>
        (!where.userId || asset.userId === where.userId) &&
        (!ids || ids.includes(asset.id)) &&
        (where.archivedAt?.not === null ? Boolean(asset.archivedAt) : where.archivedAt === null ? !asset.archivedAt : true)
      );
      rows.forEach(row => Object.assign(row, data));
      return { count: rows.length };
    },
    deleteMany: async ({ where }) => {
      const requireArchived = Boolean(where.archivedAt && Object.prototype.hasOwnProperty.call(where.archivedAt, 'not'));
      const ids = where.id?.in || (where.id ? [where.id] : null);
      const indexes = assets
        .map((asset, index) => ({ asset, index }))
        .filter(({ asset }) =>
          (!where.userId || asset.userId === where.userId) &&
          (!ids || ids.includes(asset.id)) &&
          (!requireArchived || asset.archivedAt) &&
          (!where.archivedAt?.lt || (asset.archivedAt && asset.archivedAt < where.archivedAt.lt))
        )
        .map(({ index }) => index)
        .reverse();
      indexes.forEach(index => assets.splice(index, 1));
      return { count: indexes.length };
    }
  },
  mediaFolder: {
    findMany: async ({ where }) => folders.filter(folder => folder.userId === where.userId).map(folder => ({ ...folder, _count: { assets: assets.filter(asset => asset.folderId === folder.id && !asset.archivedAt).length } })),
    findFirst: async ({ where }) => folders.find(folder => folder.id === where.id && folder.userId === where.userId) || null,
    count: async ({ where }) => folders.filter(folder => folder.userId === where.userId).length,
    create: async ({ data }) => {
      const folder = { id: `folder-${folders.length + 1}`, ...data };
      folders.push(folder);
      return folder;
    }
  }
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const library = require('../src/services/mediaLibraryService');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('media uploads are private, persistent, deduplicated and measured against the fixed 200 MB storage cap', async () => {
  const first = await library.upload('user-1', 'PRO', { data: png, mimeType: 'image/png', fileName: '../Launch?.png' });
  const duplicate = await library.upload('user-1', 'PRO', { data: png, mimeType: 'image/png', fileName: 'copy.png' });
  assert.equal(first.id, duplicate.id);
  assert.equal(first.fileName, '..Launch.png');
  assert.equal(first.source, 'uploaded');
  assert.match(first.fileUrl, /^\/api\/studio\/media-library\/assets\/asset-1\/content\?access=/);
  const access = new URL(first.fileUrl, 'https://example.test').searchParams.get('access');
  assert.equal(library.verifyContentAccess(access, first.id), 'user-1');
  assert.throws(() => library.verifyContentAccess(access, 'asset-2'), /expired/);
  assert.equal(first.data, undefined);
  const workspace = await library.workspace('user-1', 'PRO');
  assert.equal(workspace.assets.length, 1);
  assert.equal(workspace.storage.usedBytes, png.length);
  assert.equal(workspace.storage.limitBytes, 200 * 1024 * 1024);
});

test('folders and asset content remain scoped to their owner', async () => {
  const folder = await library.createFolder('user-1', 'Launch Campaign');
  assert.equal(folder.name, 'Launch Campaign');
  await assert.rejects(() => library.upload('user-2', 'PRO', { data: Buffer.from('video'), mimeType: 'video/mp4', fileName: 'clip.mp4', folderId: folder.id }), /belongs to this account/);
  assert.equal(await library.findContent('user-2', 'asset-1'), null);
  assert.ok((await library.findContent('user-1', 'asset-1')).data.equals(png));
});

test('archive removes an owned asset from the active library', async () => {
  await library.archive('user-1', 'asset-1');
  const trashed = await library.workspace('user-1', 'PRO');
  assert.equal(trashed.assets.length, 0);
  assert.equal(trashed.trashAssets.length, 1);
  assert.equal(trashed.storage.usedBytes, png.length);
  await assert.rejects(() => library.archive('user-2', 'asset-1'), /not found/);
  await library.restore('user-1', 'asset-1');
  assert.equal((await library.workspace('user-1', 'PRO')).assets.length, 1);
  await library.archive('user-1', 'asset-1');
  await library.purge('user-1', 'asset-1');
  assert.equal((await library.workspace('user-1', 'PRO')).storage.usedBytes, 0);
});


test('bulk archive and purge apply only to the signed-in user assets', async () => {
  const a = await library.upload('user-bulk', 'AGENCY', { data: Buffer.from('first-bulk-image'), mimeType: 'image/png', fileName: 'first.png' });
  const b = await library.upload('user-bulk', 'AGENCY', { data: Buffer.from('second-bulk-image'), mimeType: 'image/png', fileName: 'second.png' });
  const foreign = await library.upload('other-user', 'AGENCY', { data: Buffer.from('foreign-bulk-image'), mimeType: 'image/png', fileName: 'foreign.png' });

  assert.equal(await library.archiveMany('user-bulk', [a.id, b.id, foreign.id]), 2);
  const trashed = await library.workspace('user-bulk', 'AGENCY');
  assert.equal(trashed.assets.length, 0);
  assert.equal(trashed.trashAssets.length, 2);

  assert.equal(await library.purgeMany('user-bulk', [a.id, b.id, foreign.id]), 2);
  assert.equal((await library.workspace('user-bulk', 'AGENCY')).storage.usedBytes, 0);
  assert.ok(await library.findContent('other-user', foreign.id));
});
