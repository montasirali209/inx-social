const { z } = require('zod');
const prisma = require('../db/prisma');
const { getLicenseStatus } = require('../services/licenseService');
const { discoverMetaAccount } = require('../services/metaAccountService');
const { encryptToken, decryptToken } = require('../utils/tokenCrypto');

const pageInputSchema = z.object({
  facebookPageId: z.string().min(2),
  facebookPageName: z.string().min(1),
  facebookPageUsername: z.string().nullish(),
  facebookPagePicture: z.string().url().nullish(),
  facebookCategory: z.string().nullish(),
  accessToken: z.string().min(1).nullish(),
  tokenExpiresAt: z.coerce.date().nullish(),
  metaAppId: z.string().nullish()
});

const legacyConnectPageSchema = pageInputSchema;

const discoverSchema = z.object({
  accessToken: z.string().min(20)
});

const connectAccountSchema = z.object({
  accessToken: z.string().min(20),
  tokenExpiresAt: z.coerce.date().nullish(),
  selectedPageIds: z.array(z.string().min(2)).optional(),
  metaAppId: z.string().nullish()
});

const syncAccountSchema = z.object({
  selectedPageIds: z.array(z.string().min(2)).optional(),
  accessToken: z.string().min(20).optional(),
  tokenExpiresAt: z.coerce.date().nullish(),
  metaAppId: z.string().nullish()
});

function publicPage(page) {
  if (!page) return null;
  return {
    id: page.id,
    metaAccountId: page.metaAccountId,
    facebookPageId: page.facebookPageId,
    facebookPageName: page.facebookPageName,
    facebookPageUsername: page.facebookPageUsername,
    facebookPagePicture: page.facebookPagePicture,
    facebookCategory: page.facebookCategory,
    status: page.status,
    isSelected: page.isSelected,
    connectedAt: page.connectedAt,
    lastCheckedAt: page.lastCheckedAt,
    lastSyncAt: page.lastSyncAt,
    tokenExpiresAt: page.tokenExpiresAt,
    lastError: page.lastError
  };
}

async function getWorkspace(req, res, next) {
  try {
    const [accounts, pages, license] = await Promise.all([
      prisma.metaAccount.findMany({
        where: { userId: req.user.id, status: 'ACTIVE' },
        orderBy: { connectedAt: 'desc' },
        include: {
          pages: {
            where: { status: 'ACTIVE' },
            orderBy: { facebookPageName: 'asc' }
          }
        }
      }),
      prisma.connectedPage.findMany({
        where: { userId: req.user.id, status: 'ACTIVE' },
        orderBy: [
          { isSelected: 'desc' },
          { facebookPageName: 'asc' }
        ],
        include: {
          metaAccount: {
            select: {
              id: true,
              facebookUserName: true,
              facebookProfileImage: true,
              status: true
            }
          }
        }
      }),
      requireActiveLicense(req.user.id)
    ]);

    let activePage = pages.find(page => page.isSelected) || null;
    if (!activePage && pages.length) {
      activePage = pages[0];
      await prisma.$transaction([
        prisma.connectedPage.updateMany({
          where: { userId: req.user.id, isSelected: true },
          data: { isSelected: false }
        }),
        prisma.connectedPage.update({
          where: { id: activePage.id },
          data: { isSelected: true, lastCheckedAt: new Date() }
        })
      ]);
      activePage = { ...activePage, isSelected: true };
    }

    const activePageCredentials = activePage?.encryptedAccessToken
      ? {
          pageId: activePage.facebookPageId,
          pageName: activePage.facebookPageName,
          accessToken: decryptToken(activePage.encryptedAccessToken)
        }
      : null;

    res.json({
      accounts: accounts.map(publicAccount),
      pages: pages.map(page => ({
        ...publicPage(page),
        isSelected: Boolean(activePage && page.id === activePage.id),
        metaAccount: page.metaAccount
      })),
      activePage: publicPage(activePage),
      activePageCredentials,
      pageUsage: {
        connected: pages.length,
        limit: license.limits.pages
      },
      plan: license.plan
    });
  } catch (error) {
    next(error);
  }
}

function publicAccount(account) {
  return {
    id: account.id,
    facebookUserId: account.facebookUserId,
    facebookUserName: account.facebookUserName,
    facebookProfileImage: account.facebookProfileImage,
    status: account.status,
    connectedAt: account.connectedAt,
    lastSyncAt: account.lastSyncAt,
    tokenExpiresAt: account.tokenExpiresAt,
    lastError: account.lastError,
    pages: (account.pages || []).map(publicPage)
  };
}

async function requireActiveLicense(userId) {
  const license = await getLicenseStatus(userId);
  if (!license.allowed) {
    const error = new Error('Your trial or subscription is not active.');
    error.status = 403;
    throw error;
  }
  return license;
}

async function ensurePageCapacity(userId, discoveredPages, selectedPageIds, license) {
  const selectedSet = selectedPageIds?.length
    ? new Set(selectedPageIds.map(String))
    : new Set(discoveredPages.map(page => page.facebookPageId));

  const selectedPages = discoveredPages.filter(page => selectedSet.has(page.facebookPageId));
  if (!selectedPages.length) {
    const error = new Error('Select at least one Facebook Page to connect.');
    error.status = 400;
    throw error;
  }

  const existing = await prisma.connectedPage.findMany({
    where: {
      userId,
      facebookPageId: { in: selectedPages.map(page => page.facebookPageId) }
    },
    select: { facebookPageId: true }
  });

  const existingIds = new Set(existing.map(page => page.facebookPageId));
  const newPageCount = selectedPages.filter(page => !existingIds.has(page.facebookPageId)).length;
  const currentActiveCount = await prisma.connectedPage.count({
    where: { userId, status: 'ACTIVE' }
  });

  if (currentActiveCount + newPageCount > license.limits.pages) {
    const error = new Error(
      `Connecting these Pages would exceed the ${license.plan} limit of ${license.limits.pages}. ` +
      `You currently have ${currentActiveCount} active Page(s) and selected ${newPageCount} new Page(s).`
    );
    error.status = 403;
    error.code = 'PAGE_LIMIT_REACHED';
    error.details = {
      plan: license.plan,
      limit: license.limits.pages,
      currentActiveCount,
      newPageCount
    };
    throw error;
  }

  return selectedPages;
}

async function saveDiscoveredAccount({
  userId,
  userAccessToken,
  tokenExpiresAt,
  selectedPageIds,
  metaAppId,
  discovery
}) {
  const license = await requireActiveLicense(userId);
  const pagesToConnect = await ensurePageCapacity(
    userId,
    discovery.pages,
    selectedPageIds,
    license
  );

  const encryptedUserToken = encryptToken(userAccessToken);
  const hasSelectedPage = await prisma.connectedPage.count({
    where: { userId, status: 'ACTIVE', isSelected: true }
  });

  const result = await prisma.$transaction(async tx => {
    const account = await tx.metaAccount.upsert({
      where: {
        userId_facebookUserId: {
          userId,
          facebookUserId: discovery.account.facebookUserId
        }
      },
      create: {
        userId,
        facebookUserId: discovery.account.facebookUserId,
        facebookUserName: discovery.account.facebookUserName,
        facebookProfileImage: discovery.account.facebookProfileImage,
        encryptedAccessToken: encryptedUserToken,
        tokenExpiresAt: tokenExpiresAt || null,
        status: 'ACTIVE',
        lastSyncAt: new Date(),
        lastError: null
      },
      update: {
        facebookUserName: discovery.account.facebookUserName,
        facebookProfileImage: discovery.account.facebookProfileImage,
        encryptedAccessToken: encryptedUserToken,
        tokenExpiresAt: tokenExpiresAt || undefined,
        status: 'ACTIVE',
        lastSyncAt: new Date(),
        lastError: null
      }
    });

    let firstPage = hasSelectedPage === 0;
    for (const page of pagesToConnect) {
      await tx.connectedPage.upsert({
        where: {
          userId_facebookPageId: {
            userId,
            facebookPageId: page.facebookPageId
          }
        },
        create: {
          userId,
          metaAccountId: account.id,
          facebookPageId: page.facebookPageId,
          facebookPageName: page.facebookPageName,
          facebookPageUsername: page.facebookPageUsername,
          facebookPagePicture: page.facebookPagePicture,
          facebookCategory: page.facebookCategory,
          metaAppId: metaAppId || null,
          encryptedAccessToken: encryptToken(page.accessToken),
          tokenExpiresAt: null,
          status: 'ACTIVE',
          isSelected: firstPage,
          lastCheckedAt: new Date(),
          lastSyncAt: new Date(),
          lastError: null
        },
        update: {
          metaAccountId: account.id,
          facebookPageName: page.facebookPageName,
          facebookPageUsername: page.facebookPageUsername,
          facebookPagePicture: page.facebookPagePicture,
          facebookCategory: page.facebookCategory,
          metaAppId: metaAppId || undefined,
          encryptedAccessToken: page.accessToken ? encryptToken(page.accessToken) : undefined,
          status: 'ACTIVE',
          lastCheckedAt: new Date(),
          lastSyncAt: new Date(),
          lastError: null
        }
      });
      firstPage = false;
    }

    return tx.metaAccount.findUnique({
      where: { id: account.id },
      include: {
        pages: {
          where: { status: 'ACTIVE' },
          orderBy: { facebookPageName: 'asc' }
        }
      }
    });
  });

  return {
    account: publicAccount(result),
    discoveredPageCount: discovery.pages.length,
    connectedPageCount: pagesToConnect.length,
    limit: license.limits.pages,
    plan: license.plan
  };
}

async function discoverAccount(req, res, next) {
  try {
    await requireActiveLicense(req.user.id);
    const input = discoverSchema.parse(req.body);
    const discovery = await discoverMetaAccount(input.accessToken);

    res.json({
      account: discovery.account,
      pages: discovery.pages.map(page => ({
        ...page,
        accessToken: undefined,
        hasPageAccessToken: Boolean(page.accessToken)
      }))
    });
  } catch (error) {
    next(error);
  }
}

async function connectAccount(req, res, next) {
  try {
    const input = connectAccountSchema.parse(req.body);
    const discovery = await discoverMetaAccount(input.accessToken);
    const result = await saveDiscoveredAccount({
      userId: req.user.id,
      userAccessToken: input.accessToken,
      tokenExpiresAt: input.tokenExpiresAt,
      selectedPageIds: input.selectedPageIds,
      metaAppId: input.metaAppId,
      discovery
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function listAccounts(req, res, next) {
  try {
    const [accounts, license] = await Promise.all([
      prisma.metaAccount.findMany({
        where: { userId: req.user.id },
        orderBy: { connectedAt: 'desc' },
        include: {
          pages: {
            orderBy: { facebookPageName: 'asc' }
          }
        }
      }),
      getLicenseStatus(req.user.id)
    ]);

    res.json({
      accounts: accounts.map(publicAccount),
      pageUsage: {
        connected: accounts.reduce(
          (total, account) => total + account.pages.filter(page => page.status === 'ACTIVE').length,
          0
        ),
        limit: license.limits.pages
      },
      plan: license.plan
    });
  } catch (error) {
    next(error);
  }
}

async function syncAccount(req, res, next) {
  try {
    const input = syncAccountSchema.parse(req.body || {});
    const account = await prisma.metaAccount.findFirst({
      where: { id: req.params.accountId, userId: req.user.id }
    });

    if (!account) return res.status(404).json({ error: 'Meta account not found' });

    const userAccessToken = input.accessToken || decryptToken(account.encryptedAccessToken);
    const discovery = await discoverMetaAccount(userAccessToken);
    const result = await saveDiscoveredAccount({
      userId: req.user.id,
      userAccessToken,
      tokenExpiresAt: input.tokenExpiresAt || account.tokenExpiresAt,
      selectedPageIds: input.selectedPageIds,
      metaAppId: input.metaAppId,
      discovery
    });

    res.json(result);
  } catch (error) {
    try {
      await prisma.metaAccount.updateMany({
        where: { id: req.params.accountId, userId: req.user.id },
        data: { lastError: error.message }
      });
    } catch (_) {}
    next(error);
  }
}

async function disconnectAccount(req, res, next) {
  try {
    const account = await prisma.metaAccount.findFirst({
      where: { id: req.params.accountId, userId: req.user.id },
      include: { pages: { select: { id: true, isSelected: true } } }
    });

    if (!account) return res.status(404).json({ error: 'Meta account not found' });

    const selectedRemoved = account.pages.some(page => page.isSelected);

    await prisma.$transaction(async tx => {
      await tx.connectedPage.updateMany({
        where: { userId: req.user.id, metaAccountId: account.id },
        data: {
          status: 'REVOKED',
          isSelected: false,
          encryptedAccessToken: null,
          lastError: null
        }
      });

      await tx.metaAccount.update({
        where: { id: account.id },
        data: {
          status: 'REVOKED',
          encryptedAccessToken: '',
          lastError: null
        }
      });

      if (selectedRemoved) {
        const replacement = await tx.connectedPage.findFirst({
          where: { userId: req.user.id, status: 'ACTIVE' },
          orderBy: { connectedAt: 'desc' }
        });
        if (replacement) {
          await tx.connectedPage.update({
            where: { id: replacement.id },
            data: { isSelected: true }
          });
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

async function listPages(req, res, next) {
  try {
    const [pages, license] = await Promise.all([
      prisma.connectedPage.findMany({
        where: { userId: req.user.id },
        orderBy: [
          { isSelected: 'desc' },
          { facebookPageName: 'asc' }
        ],
        include: {
          metaAccount: {
            select: {
              id: true,
              facebookUserName: true,
              facebookProfileImage: true,
              status: true
            }
          }
        }
      }),
      getLicenseStatus(req.user.id)
    ]);

    res.json({
      pages: pages.map(page => ({
        ...publicPage(page),
        metaAccount: page.metaAccount
      })),
      selectedPage: publicPage(pages.find(page => page.isSelected && page.status === 'ACTIVE') || null),
      usage: pages.filter(page => page.status === 'ACTIVE').length,
      limit: license.limits.pages,
      plan: license.plan
    });
  } catch (error) {
    next(error);
  }
}

async function selectPage(req, res, next) {
  try {
    const page = await prisma.connectedPage.findFirst({
      where: { id: req.params.id, userId: req.user.id, status: 'ACTIVE' }
    });

    if (!page) return res.status(404).json({ error: 'Active Facebook Page not found' });

    await prisma.$transaction([
      prisma.connectedPage.updateMany({
        where: { userId: req.user.id, isSelected: true },
        data: { isSelected: false }
      }),
      prisma.connectedPage.update({
        where: { id: page.id },
        data: { isSelected: true, lastCheckedAt: new Date() }
      })
    ]);

    const selected = await prisma.connectedPage.findUnique({ where: { id: page.id } });
    res.json({ selectedPage: publicPage(selected) });
  } catch (error) {
    next(error);
  }
}

// Backwards-compatible single Page connection used by the current desktop build.
async function connectPage(req, res, next) {
  try {
    const input = legacyConnectPageSchema.parse(req.body);
    const existing = await prisma.connectedPage.findUnique({
      where: {
        userId_facebookPageId: {
          userId: req.user.id,
          facebookPageId: input.facebookPageId
        }
      }
    });

    const license = await requireActiveLicense(req.user.id);
    if (!existing) {
      const count = await prisma.connectedPage.count({
        where: { userId: req.user.id, status: 'ACTIVE' }
      });
      if (count >= license.limits.pages) {
        return res.status(403).json({
          error: `Facebook Page limit reached for ${license.plan} (${license.limits.pages}).`,
          code: 'PAGE_LIMIT_REACHED',
          limit: license.limits.pages,
          plan: license.plan
        });
      }
    }

    const selectedCount = await prisma.connectedPage.count({
      where: { userId: req.user.id, status: 'ACTIVE', isSelected: true }
    });

    const page = await prisma.connectedPage.upsert({
      where: {
        userId_facebookPageId: {
          userId: req.user.id,
          facebookPageId: input.facebookPageId
        }
      },
      create: {
        userId: req.user.id,
        facebookPageId: input.facebookPageId,
        facebookPageName: input.facebookPageName,
        facebookPageUsername: input.facebookPageUsername || null,
        facebookPagePicture: input.facebookPagePicture || null,
        facebookCategory: input.facebookCategory || null,
        metaAppId: input.metaAppId || null,
        encryptedAccessToken: encryptToken(input.accessToken),
        tokenExpiresAt: input.tokenExpiresAt || null,
        status: 'ACTIVE',
        isSelected: selectedCount === 0,
        lastCheckedAt: new Date(),
        lastSyncAt: new Date()
      },
      update: {
        facebookPageName: input.facebookPageName,
        facebookPageUsername: input.facebookPageUsername || undefined,
        facebookPagePicture: input.facebookPagePicture || undefined,
        facebookCategory: input.facebookCategory || undefined,
        metaAppId: input.metaAppId || undefined,
        encryptedAccessToken: input.accessToken ? encryptToken(input.accessToken) : undefined,
        tokenExpiresAt: input.tokenExpiresAt || undefined,
        status: 'ACTIVE',
        isSelected: selectedCount === 0 ? true : undefined,
        lastCheckedAt: new Date(),
        lastSyncAt: new Date(),
        lastError: null
      }
    });

    res.json({ page: publicPage(page) });
  } catch (error) {
    next(error);
  }
}

async function revokePage(req, res, next) {
  try {
    const page = await prisma.connectedPage.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!page) return res.status(404).json({ error: 'Facebook Page not found' });

    await prisma.$transaction(async tx => {
      await tx.connectedPage.update({
        where: { id: page.id },
        data: {
          status: 'REVOKED',
          isSelected: false,
          encryptedAccessToken: null
        }
      });

      if (page.isSelected) {
        const replacement = await tx.connectedPage.findFirst({
          where: { userId: req.user.id, status: 'ACTIVE', id: { not: page.id } },
          orderBy: { connectedAt: 'desc' }
        });
        if (replacement) {
          await tx.connectedPage.update({
            where: { id: replacement.id },
            data: { isSelected: true }
          });
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getWorkspace,
  discoverAccount,
  connectAccount,
  listAccounts,
  syncAccount,
  disconnectAccount,
  listPages,
  selectPage,
  connectPage,
  revokePage
};
