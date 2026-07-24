'use strict';

const prisma = require('../db/prisma');
const stripeService = require('./stripeService');
const { decryptToken } = require('../utils/tokenCrypto');

function isStripeMissingResource(error) {
  return error?.code === 'resource_missing' || error?.statusCode === 404;
}

async function revokeMetaAccess(accounts, decrypt = decryptToken, fetchImpl = global.fetch) {
  const warnings = [];
  if (typeof fetchImpl !== 'function') return ['Meta access could not be revoked automatically.'];

  for (const account of accounts) {
    try {
      const accessToken = decrypt(account.encryptedAccessToken);
      if (!accessToken) continue;
      const graphVersion = String(process.env.FACEBOOK_GRAPH_VERSION || 'v25.0').replace(/^\/+/, '');
      const response = await fetchImpl(
        `https://graph.facebook.com/${graphVersion}/me/permissions?access_token=${encodeURIComponent(accessToken)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) warnings.push('One Facebook connection could not be revoked automatically.');
    } catch (_) {
      warnings.push('One Facebook connection could not be revoked automatically.');
    }
  }
  return [...new Set(warnings)];
}

async function removeStripeCustomerData(subscriptions, stripeFactory = () => stripeService.getStripe()) {
  const stripeSubscriptions = subscriptions.filter(item => item.provider === 'stripe');
  const subscriptionIds = [...new Set(stripeSubscriptions.map(item => item.providerSubId).filter(Boolean))];
  const customerIds = [...new Set(stripeSubscriptions.map(item => item.providerCustomerId).filter(Boolean))];
  if (!subscriptionIds.length && !customerIds.length) return;

  let stripe;
  try {
    stripe = stripeFactory();
  } catch (error) {
    error.status = 503;
    error.publicMessage = 'Your billing connection could not be reached, so the account was not deleted. Please try again.';
    throw error;
  }

  for (const subscriptionId of subscriptionIds) {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      if (!isStripeMissingResource(error)) {
        error.status = 502;
        error.publicMessage = 'Your Stripe subscription could not be cancelled, so the account was not deleted. Please try again or use Manage billing.';
        throw error;
      }
    }
  }

  for (const customerId of customerIds) {
    try {
      await stripe.customers.del(customerId);
    } catch (error) {
      if (!isStripeMissingResource(error)) {
        error.status = 502;
        error.publicMessage = 'Your Stripe customer record could not be removed, so the account was not deleted. Please try again.';
        throw error;
      }
    }
  }
}

async function deleteCustomerAccount(userId, dependencies = {}) {
  const db = dependencies.prisma || prisma;
  const [subscriptions, metaAccounts] = await Promise.all([
    db.subscription.findMany({
      where: { userId },
      select: { provider: true, providerSubId: true, providerCustomerId: true }
    }),
    db.metaAccount.findMany({
      where: { userId },
      select: { encryptedAccessToken: true }
    })
  ]);

  // Billing is handled first so deleting an INX account can never leave a
  // customer paying for a subscription that can no longer be managed.
  await removeStripeCustomerData(subscriptions, dependencies.stripeFactory);
  const warnings = await revokeMetaAccess(
    metaAccounts,
    dependencies.decryptToken || decryptToken,
    dependencies.fetchImpl || global.fetch
  );

  await db.$transaction(async tx => {
    // These two relations use SetNull for operational history. Account deletion
    // intentionally removes the user's copies instead of anonymising them.
    await tx.auditLog.deleteMany({ where: { userId } });
    await tx.emailLog.deleteMany({ where: { userId } });
    // All remaining user-owned rows use database cascades.
    await tx.user.delete({ where: { id: userId } });
  });

  return { deleted: true, warnings };
}

module.exports = {
  deleteCustomerAccount,
  removeStripeCustomerData,
  revokeMetaAccess,
  isStripeMissingResource
};
