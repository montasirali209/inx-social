const assert = require('node:assert/strict');
const test = require('node:test');

const prismaPath = require.resolve('../src/db/prisma');
const rows = [];
const prisma = {
  agentAsset: {
    count: async ({ where }) => rows.filter(row => row.userId === where.userId && row.source === where.source).length,
    findFirst: async ({ where }) => rows.find(row => row.userId === where.userId && row.checksum === where.checksum && row.kind === where.kind) || null,
    create: async ({ data }) => {
      const row = { id: `asset-${rows.length + 1}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    findMany: async ({ where }) => rows.filter(row => row.userId === where.userId && (!where.id || where.id.in.includes(row.id))),
    deleteMany: async ({ where }) => {
      const before = rows.length;
      for (let index = rows.length - 1; index >= 0; index -= 1) if (rows[index].id === where.id && rows[index].userId === where.userId && rows[index].planId == null && rows[index].source === 'UPLOAD') rows.splice(index, 1);
      return { count: before - rows.length };
    }
  }
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const assets = require('../src/services/agentAssetService');

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';

test('brand uploads are bounded, private and deduplicated', async () => {
  const first = await assets.createUpload('user-1', { kind: 'logo', name: '../brand?.png', dataUrl: tinyPng });
  const duplicate = await assets.createUpload('user-1', { kind: 'logo', name: 'copy.png', dataUrl: tinyPng });
  assert.equal(first.id, duplicate.id);
  assert.equal(first.originalName, '..brand.png');
  assert.equal(first.source, 'UPLOAD');
  assert.match(assets.publicAsset(first).contentUrl, /^\/api\/agent\/assets\/asset-1\/content$/);
  assert.equal(assets.publicAsset(first).data, undefined);
});

test('brand uploads reject unsupported content and oversized mission selections', async () => {
  assert.throws(() => assets.decodeDataUrl('data:text/plain;base64,SGVsbG8='), /PNG, JPEG or WebP/);
  await assert.rejects(() => assets.resolveOwned('user-1', Array.from({ length: 11 }, (_, index) => `asset-${index}`)), /no more than 10/);
});
