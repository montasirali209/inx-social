const { z } = require('zod');
const prisma = require('../db/prisma');
const env = require('../config/env');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');

const ACTIVE_STRIPE_STATUSES = new Set(['active', 'trialing']);

function unixToDate(value) {
  return value ? new Date(value * 1000) : null;
}

async function latestSubscriptionForUser(userId) {
  return prisma.subscription.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

async function findUserFromStripeObject(object) {
  const userId = object?.metadata?.userId || object?.subscription_details?.metadata?.userId;
  if (userId) return prisma.user.findUnique({ where: { id: userId } });

  const customerId = typeof object?.customer === 'string' ? object.customer : object?.customer?.id;
  if (!customerId) return null;

  const subscription = await prisma.subscription.findFirst({
    where: { providerCustomerId: customerId },
    orderBy: { createdAt: 'desc' },
    include: { user: true }
  });
  return subscription?.user || null;
}

async function ensureStripeCustomer(user, localSubscription) {
  const stripe = stripeService.getStripe();
  if (localSubscription?.providerCustomerId) return localSubscription.providerCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId: user.id, product: 'INX Social' }
  });

  if (localSubscription) {
    await prisma.subscription.update({
      where: { id: localSubscription.id },
      data: { providerCustomerId: customer.id }
    });
  }

  return customer.id;
}

async function createCheckoutSession(req, res, next) {
  try {
    if (!req.user.emailVerifiedAt && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Verify your email before choosing a subscription.' });
    }

    const input = z.object({ plan: z.enum(['STARTER', 'PRO']) }).parse(req.body);
    const stripe = stripeService.getStripe();
    const priceId = stripeService.priceIdForPlan(input.plan);
    if (!priceId) return res.status(503).json({ error: `${input.plan} Stripe Price ID is not configured.` });

    const latestSubscription = await latestSubscriptionForUser(req.user.id);
    const paidActive = latestSubscription?.provider === 'stripe' &&
      ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(String(latestSubscription.status || '').toUpperCase()) &&
      Boolean(latestSubscription.providerSubId);

    if (paidActive) {
      return res.status(409).json({
        error: 'You already have a Stripe subscription. Use Manage billing to change or cancel your plan.',
        code: 'SUBSCRIPTION_EXISTS'
      });
    }

    const customerId = await ensureStripeCustomer(req.user, latestSubscription);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.stripe.successUrl}${env.stripe.successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: env.stripe.cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: { address: 'auto', name: 'auto' },
      client_reference_id: req.user.id,
      metadata: { userId: req.user.id, plan: input.plan },
      subscription_data: { metadata: { userId: req.user.id, plan: input.plan } }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'STRIPE_CHECKOUT_CREATED',
        entity: 'Subscription',
        metadata: JSON.stringify({ plan: input.plan, sessionId: session.id, customerId })
      }
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) { next(error); }
}

async function checkoutSessionStatus(req, res, next) {
  try {
    const sessionId = z.string().min(10).parse(req.params.sessionId);
    const stripe = stripeService.getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });

    if (session.client_reference_id !== req.user.id && session.metadata?.userId !== req.user.id) {
      return res.status(403).json({ error: 'This checkout session does not belong to your account.' });
    }

    const local = await latestSubscriptionForUser(req.user.id);
    res.json({
      paymentStatus: session.payment_status,
      checkoutStatus: session.status,
      plan: session.metadata?.plan || local?.plan || null,
      subscriptionStatus: local?.status || null,
      activated: Boolean(local && local.provider === 'stripe' && ['ACTIVE', 'TRIALING'].includes(String(local.status).toUpperCase())),
      currentPeriodEnd: local?.currentPeriodEnd || null
    });
  } catch (error) { next(error); }
}

async function createCustomerPortalSession(req, res, next) {
  try {
    const stripe = stripeService.getStripe();
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id, providerCustomerId: { not: null } },
      orderBy: { createdAt: 'desc' }
    });
    if (!subscription?.providerCustomerId) {
      return res.status(400).json({ error: 'No Stripe billing account is linked to this user yet.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.providerCustomerId,
      return_url: env.stripe.portalReturnUrl
    });
    res.json({ url: session.url });
  } catch (error) { next(error); }
}

async function billingStatus(req, res, next) {
  try {
    const subscription = await latestSubscriptionForUser(req.user.id);
    res.json({
      configured: stripeService.isConfigured(),
      webhookConfigured: stripeService.isWebhookConfigured(),
      subscription: subscription ? {
        plan: subscription.plan,
        status: subscription.status,
        provider: subscription.provider,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canManage: Boolean(subscription.providerCustomerId)
      } : null
    });
  } catch (error) { next(error); }
}

async function processSubscriptionObject(stripeSubscription) {
  const stripe = stripeService.getStripe();
  const customerId = typeof stripeSubscription.customer === 'string'
    ? stripeSubscription.customer
    : stripeSubscription.customer?.id;

  let user = await findUserFromStripeObject(stripeSubscription);
  if (!user && customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && !customer.deleted && customer.metadata?.userId) {
      user = await prisma.user.findUnique({ where: { id: customer.metadata.userId } });
    }
  }
  if (!user) throw new Error(`Unable to map Stripe subscription ${stripeSubscription.id} to an INX Social user`);

  const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
  const plan = stripeSubscription.metadata?.plan || stripeService.planForPriceId(priceId);
  if (!plan) throw new Error(`Unknown Stripe Price ID: ${priceId || 'missing'}`);

  const status = String(stripeSubscription.status || '').toUpperCase();
  const existing = await prisma.subscription.findFirst({ where: { providerSubId: stripeSubscription.id } });
  const data = {
    userId: user.id,
    plan,
    status,
    provider: 'stripe',
    providerCustomerId: customerId,
    providerSubId: stripeSubscription.id,
    currentPeriodStart: unixToDate(stripeSubscription.current_period_start),
    currentPeriodEnd: unixToDate(stripeSubscription.current_period_end),
    cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end)
  };

  if (existing) {
    await prisma.subscription.update({ where: { id: existing.id }, data });
  } else {
    const pending = await prisma.subscription.findFirst({
      where: { userId: user.id, providerSubId: null, providerCustomerId: customerId },
      orderBy: { createdAt: 'desc' }
    });
    if (pending) await prisma.subscription.update({ where: { id: pending.id }, data });
    else await prisma.subscription.create({ data });
  }

  const stripeStatus = String(stripeSubscription.status || '').toLowerCase();
  let accountStatus = user.status;
  if (ACTIVE_STRIPE_STATUSES.has(stripeStatus)) accountStatus = 'ACTIVE';
  else if (['canceled', 'unpaid', 'incomplete_expired'].includes(stripeStatus)) accountStatus = 'EXPIRED';
  else if (stripeStatus === 'past_due') accountStatus = 'PAYMENT_DUE';

  if (accountStatus !== user.status) {
    await prisma.user.update({ where: { id: user.id }, data: { status: accountStatus } });
    user = { ...user, status: accountStatus };
  }

  return { user, plan, status };
}

async function webhook(req, res) {
  let event;
  try {
    if (!env.stripe.webhookSecret) return res.status(503).send('Stripe webhook secret is not configured');
    const stripe = stripeService.getStripe();
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], env.stripe.webhookSecret);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    const alreadyProcessed = await prisma.billingEvent.findUnique({ where: { providerEventId: event.id } });
    if (alreadyProcessed?.status === 'PROCESSED') return res.json({ received: true, duplicate: true });

    await prisma.billingEvent.upsert({
      where: { providerEventId: event.id },
      create: { provider: 'stripe', providerEventId: event.id, eventType: event.type, status: 'PROCESSING' },
      update: { eventType: event.type, status: 'PROCESSING', errorMessage: null }
    });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.subscription) {
        const stripe = stripeService.getStripe();
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const result = await processSubscriptionObject(subscription);
        await emailService.sendSubscriptionActivated(result.user, result.plan).catch(error => console.error('[SUBSCRIPTION EMAIL]', error.message));
      }
    }

    if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      await processSubscriptionObject(event.data.object);
    }

    if (['invoice.payment_failed', 'invoice.payment_action_required'].includes(event.type)) {
      const invoice = event.data.object;
      const user = await findUserFromStripeObject(invoice);
      if (user) {
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subscriptionId) {
          const local = await prisma.subscription.findFirst({ where: { providerSubId: subscriptionId } });
          if (local) await prisma.subscription.update({ where: { id: local.id }, data: { status: 'PAST_DUE' } });
        }
        await prisma.user.update({ where: { id: user.id }, data: { status: 'PAYMENT_DUE' } }).catch(() => {});
        await emailService.sendPaymentFailed(user).catch(error => console.error('[PAYMENT EMAIL]', error.message));
      }
    }

    await prisma.billingEvent.update({
      where: { providerEventId: event.id },
      data: { status: 'PROCESSED', processedAt: new Date(), errorMessage: null }
    });
    return res.json({ received: true });
  } catch (error) {
    await prisma.billingEvent.updateMany({
      where: { providerEventId: event.id },
      data: { status: 'FAILED', errorMessage: error.message }
    });
    console.error('Stripe webhook processing failed:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

module.exports = {
  createCheckoutSession,
  checkoutSessionStatus,
  createCustomerPortalSession,
  billingStatus,
  webhook
};
