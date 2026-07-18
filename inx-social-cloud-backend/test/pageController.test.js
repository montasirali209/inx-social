const assert = require('node:assert/strict');
const test = require('node:test');

process.env.TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || 'inx-social-test-token-encryption-key';

const prismaPath = require.resolve('../src/db/prisma');
const licenseServicePath = require.resolve('../src/services/licenseService');
const metaAccountServicePath = require.resolve('../src/services/metaAccountService');
const prisma = {
  metaAccount: { findMany: async () => [] },
  connectedPage: {
    findMany: async () => [],
    updateMany: async () => ({ count: 0 }),
    update: async ({ data }) => ({ id: 'page-row-1', ...data })
  },
  $transaction: async operations => Promise.all(operations)
};

require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
require.cache[licenseServicePath] = { id: licenseServicePath, filename: licenseServicePath, loaded: true, exports: { getLicenseStatus: async () => ({ allowed: true, plan: 'TRIAL', limits: { pages: 10 } }) } };
require.cache[metaAccountServicePath] = { id: metaAccountServicePath, filename: metaAccountServicePath, loaded: true, exports: { discoverMetaAccount: async () => ({ account: {}, pages: [] }) } };

const { connectPage, getWorkspace, listPages } = require('../src/controllers/pageController');
function responseRecorder() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('listPages returns an empty workspace when no Page is selected', async () => {
  prisma.connectedPage.findMany = async () => [];
  const res = responseRecorder();
  let forwardedError = null;
  await listPages({ user: { id: 'user-1' } }, res, error => { forwardedError = error; });
  assert.equal(forwardedError, null);
  assert.deepEqual(res.body.pages, []);
  assert.equal(res.body.selectedPage, null);
  assert.equal(res.body.usage, 0);
});

test('getWorkspace repairs an older active Page without a selected flag', async () => {
  prisma.metaAccount.findMany = async () => [];
  prisma.connectedPage.findMany = async () => [{
    id: 'page-row-1', userId: 'user-1', facebookPageId: 'facebook-page-1',
    facebookPageName: 'INX Demo', status: 'ACTIVE', isSelected: false,
    encryptedAccessToken: 'legacy-plain-page-token', metaAccount: null
  }];
  const res = responseRecorder();
  let forwardedError = null;
  await getWorkspace({ user: { id: 'user-1' } }, res, error => { forwardedError = error; });
  assert.equal(forwardedError, null);
  assert.equal(res.body.activePage.id, 'page-row-1');
  assert.equal(res.body.pages[0].isSelected, true);
  assert.equal(res.body.activePageCredentials.accessToken, 'legacy-plain-page-token');
});

test('connectPage stores an encrypted token and selects the first active Page', async () => {
  let upsertInput = null;
  prisma.connectedPage.findUnique = async () => null;
  prisma.connectedPage.count = async () => 0;
  prisma.connectedPage.upsert = async input => {
    upsertInput = input;
    return { id: 'page-row-2', ...input.create };
  };

  const res = responseRecorder();
  let forwardedError = null;
  await connectPage({
    user: { id: 'user-1' },
    body: {
      facebookPageId: 'facebook-page-2',
      facebookPageName: 'INX Release Test',
      accessToken: 'test-facebook-page-token'
    }
  }, res, error => { forwardedError = error; });

  assert.equal(forwardedError, null);
  assert.equal(upsertInput.create.isSelected, true);
  assert.match(upsertInput.create.encryptedAccessToken, /^enc:v1:/);
  assert.equal(res.body.page.facebookPageName, 'INX Release Test');
  assert.equal(Object.hasOwn(res.body.page, 'encryptedAccessToken'), false);
});
