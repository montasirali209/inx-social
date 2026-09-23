const Stripe = require('stripe');
const env = require('../config/env');

let stripeClient;

const PAID_PLANS = Object.freeze(['CREATOR', 'PRO', 'BUSINESS', 'AGENCY']);
const DEFINITIONS = Object.freeze({
  CREATOR: { id: 'CREATOR', name: 'Creator', price: 18.99, pages: 5, aiCredits: 150, support: 'standard' },
  PRO: { id: 'PRO', name: 'Pro', price: 34.99, pages: 12, aiCredits: 500, support: 'priority' },
  BUSINESS: { id: 'BUSINESS', name: 'Business', price: 59.99, pages: 25, aiCredits: 1200, support: 'priority' },
  AGENCY: { id: 'AGENCY', name: 'Agency', price: 99.99, pages: 50, aiCredits: 2500, support: 'priority_plus' }
});

function isConfigured() {
  return Boolean(
    env.stripe.secretKey &&
    env.stripe.creatorPriceId &&
    env.stripe.proPriceId &&
    env.stripe.businessPriceId &&
    env.stripe.agencyPriceId
  );
}

function isWebhookConfigured() {
  return Boolean(env.stripe.webhookSecret);
}

function getStripe() {
  if (!env.stripe.secretKey) {
    const error = new Error('Stripe secret key is not configured');
    error.status = 503;
    error.publicMessage = 'Online billing is not configured yet.';
    throw error;
  }
  if (!stripeClient) stripeClient = new Stripe(env.stripe.secretKey);
  return stripeClient;
}

function priceIdForPlan(plan) {
  const normalized = String(plan || '').toUpperCase();
  if (normalized === 'CREATOR') return env.stripe.creatorPriceId;
  if (normalized === 'PRO') return env.stripe.proPriceId;
  if (normalized === 'BUSINESS') return env.stripe.businessPriceId;
  if (normalized === 'AGENCY') return env.stripe.agencyPriceId;
  throw new Error('Unsupported subscription plan');
}

function planForPriceId(priceId) {
  if (priceId === env.stripe.creatorPriceId) return 'CREATOR';
  if (priceId === env.stripe.proPriceId) return 'PRO';
  if (priceId === env.stripe.businessPriceId) return 'BUSINESS';
  if (priceId === env.stripe.agencyPriceId) return 'AGENCY';
  if (priceId && priceId === env.stripe.legacyStarterPriceId) return 'CREATOR';
  if (priceId && priceId === env.stripe.legacyPlusPriceId) return 'PRO';
  return null;
}

function planDefinition(plan) {
  return DEFINITIONS[String(plan || '').toUpperCase()] || null;
}

function planAvailability() {
  return {
    creator: { monthly: Boolean(env.stripe.creatorPriceId), yearly: false },
    pro: { monthly: Boolean(env.stripe.proPriceId), yearly: false },
    business: { monthly: Boolean(env.stripe.businessPriceId), yearly: false },
    agency: { monthly: Boolean(env.stripe.agencyPriceId), yearly: false }
  };
}

function configurationSnapshot() {
  const prices = {
    CREATOR: env.stripe.creatorPriceId,
    PRO: env.stripe.proPriceId,
    BUSINESS: env.stripe.businessPriceId,
    AGENCY: env.stripe.agencyPriceId
  };
  return Object.fromEntries(Object.entries(prices).map(([plan, priceId]) => [plan, {
    configured: Boolean(priceId),
    priceSuffix: String(priceId || '').slice(-8),
    aiCredits: DEFINITIONS[plan].aiCredits,
    monthlyPriceGbp: DEFINITIONS[plan].price
  }]));
}

module.exports = {
  PAID_PLANS,
  isConfigured,
  isWebhookConfigured,
  getStripe,
  priceIdForPlan,
  planForPriceId,
  planDefinition,
  planAvailability,
  configurationSnapshot
};
