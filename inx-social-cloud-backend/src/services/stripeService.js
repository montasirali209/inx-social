const Stripe = require('stripe');
const env = require('../config/env');

let stripeClient;

function isConfigured() {
  return Boolean(env.stripe.secretKey && env.stripe.starterPriceId && env.stripe.proPriceId);
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
  if (normalized === 'STARTER') return env.stripe.starterPriceId;
  if (normalized === 'PRO') return env.stripe.proPriceId;
  throw new Error('Unsupported subscription plan');
}

function planForPriceId(priceId) {
  if (priceId === env.stripe.starterPriceId) return 'STARTER';
  if (priceId === env.stripe.proPriceId) return 'PRO';
  return null;
}

function planDefinition(plan) {
  const normalized = String(plan || '').toUpperCase();
  if (normalized === 'STARTER') {
    return { id: 'STARTER', name: 'Starter', price: 9.99, pages: 10, batchPosts: 100, devices: 1 };
  }
  if (normalized === 'PRO') {
    return { id: 'PRO', name: 'Pro', price: 15.99, pages: 50, batchPosts: null, devices: 3 };
  }
  return null;
}

module.exports = {
  isConfigured,
  isWebhookConfigured,
  getStripe,
  priceIdForPlan,
  planForPriceId,
  planDefinition
};
