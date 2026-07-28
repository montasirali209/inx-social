const { Resend } = require('resend');
const prisma = require('../db/prisma');
const env = require('../config/env');

let resendClient = null;

function getResendApiKey() {
  return String(process.env.RESEND_API_KEY || '').trim();
}

function getEmailFrom() {
  return String(
    process.env.EMAIL_FROM ||
    env?.smtp?.from ||
    'INX Social <notifications@mail.inaxx.co.uk>'
  ).trim();
}

function getReplyTo() {
  return String(
    process.env.EMAIL_REPLY_TO ||
    env?.smtp?.replyTo ||
    'contact@inaxx.co.uk'
  ).trim();
}

function isConfigured() {
  return Boolean(getResendApiKey() && getEmailFrom());
}

function getClient() {
  if (resendClient) return resendClient;
  const apiKey = getResendApiKey();
  if (!apiKey) return null;
  resendClient = new Resend(apiKey);
  return resendClient;
}

function portalPage(fileName, params = {}) {
  const configured = String(
    env.portalUrl ||
    env.appUrl ||
    process.env.PORTAL_URL ||
    process.env.APP_URL ||
    'http://localhost:5050'
  ).trim();

  const parsed = new URL(configured);
  let pathname = parsed.pathname.replace(/\/+$/, '');
  if (!pathname.endsWith('/portal')) pathname += '/portal';

  parsed.pathname = `${pathname}/${fileName}`.replace(/\/+/g, '/');
  parsed.search = '';

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      parsed.searchParams.set(key, String(value));
    }
  });

  return parsed.toString();
}

function frame(title, body, buttonLabel, buttonUrl) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f3f6fb;font-family:Segoe UI,Arial,sans-serif;color:#17223a"><div style="max-width:620px;margin:35px auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e1e7f0"><div style="padding:25px 30px;background:#08152b;color:#fff;font-size:22px;font-weight:800">INX <span style="color:#55ddd5">Social</span></div><div style="padding:34px"><h1 style="font-size:28px;line-height:1.2;margin:0 0 15px">${title}</h1>${body}${buttonUrl ? `<p style="margin:28px 0"><a href="${buttonUrl}" style="display:inline-block;padding:14px 22px;background:#49d7d0;color:#071224;text-decoration:none;border-radius:10px;font-weight:800">${buttonLabel}</a></p>` : ''}<p style="font-size:13px;color:#7b879b;margin-top:30px">INX Social is provided by INAXX LTD.</p></div></div></body></html>`;
}

async function verifyConnection() {
  if (!isConfigured()) {
    return {
      configured: false,
      verified: false,
      provider: 'resend',
      message: 'Resend is not configured'
    };
  }

  return {
    configured: true,
    verified: true,
    provider: 'resend',
    message: 'Resend API is configured'
  };
}

async function createEmailLog({ userId, to, type, subject }) {
  return prisma.emailLog.create({
    data: {
      userId: userId || null,
      recipient: to,
      type,
      subject,
      status: 'QUEUED'
    }
  });
}

async function updateEmailLog(id, data) {
  try {
    await prisma.emailLog.update({ where: { id }, data });
  } catch (error) {
    console.error('[EMAIL LOG UPDATE FAILED]', error.message);
  }
}

async function send({ userId, to, type, subject, html, text }) {
  const log = await createEmailLog({ userId, to, type, subject });
  const client = getClient();

  if (!client) {
    await updateEmailLog(log.id, {
      status: 'DEV_LOGGED',
      errorMessage: 'RESEND_API_KEY is not configured'
    });

    console.log(`[EMAIL DEV MODE] ${type} -> ${to}`);
    return { dev: true, provider: 'resend', id: null };
  }

  try {
    const result = await client.emails.send({
      from: getEmailFrom(),
      to: [to],
      subject,
      html,
      text: text || subject,
      replyTo: getReplyTo()
    });

    if (result.error) {
      throw new Error(result.error.message || 'Resend email delivery failed');
    }

    const providerId = result.data?.id || null;

    await updateEmailLog(log.id, {
      status: 'SENT',
      providerId
    });

    console.log(`[RESEND] ${type} sent to ${to}${providerId ? ` (${providerId})` : ''}`);

    return {
      ...result,
      provider: 'resend',
      messageId: providerId
    };
  } catch (error) {
    await updateEmailLog(log.id, {
      status: 'FAILED',
      errorMessage: error.message
    });

    console.error(`[RESEND DELIVERY FAILED] ${type} -> ${to}: ${error.message}`);
    throw error;
  }
}

async function sendVerification(user, rawToken) {
  const url = portalPage('verify.html', { token: rawToken });

  return send({
    userId: user.id,
    to: user.email,
    type: 'VERIFY_EMAIL',
    subject: 'Verify your INX Social email',
    html: frame(
      'Verify your email',
      '<p>Confirm your email address to activate your 5-day INX Social trial.</p><p>This secure link expires in 60 minutes.</p>',
      'Verify email',
      url
    ),
    text: `Verify your INX Social email: ${url}`
  });
}

async function sendPasswordReset(user, rawToken) {
  const url = portalPage('reset-password.html', { token: rawToken });

  return send({
    userId: user.id,
    to: user.email,
    type: 'PASSWORD_RESET',
    subject: 'Reset your INX Social password',
    html: frame(
      'Reset your password',
      '<p>Use the button below to create a new password. This link expires in 30 minutes.</p>',
      'Reset password',
      url
    ),
    text: `Reset your INX Social password: ${url}`
  });
}

async function sendTrialStarted(user) {
  return send({
    userId: user.id,
    to: user.email,
    type: 'TRIAL_STARTED',
    subject: 'Your INX Social trial has started',
    html: frame(
      'Your trial is active',
      '<p>Your email is verified and your 5-day trial has started. You can now sign in to the customer portal and desktop app.</p>',
      'Sign in to INX Social',
      portalPage('login.html')
    ),
    text: 'Your INX Social 5-day trial is now active.'
  });
}

async function sendSubscriptionActivated(user, plan) {
  const safePlan = String(plan || 'subscription');

  return send({
    userId: user.id,
    to: user.email,
    type: 'SUBSCRIPTION_ACTIVATED',
    subject: `Your INX Social ${safePlan} subscription is active`,
    html: frame(
      `${safePlan} is now active`,
      `<p>Thank you for subscribing to INX Social ${safePlan}. Your account limits have been updated automatically.</p>`,
      'Open customer portal',
      portalPage('index.html')
    ),
    text: `Your INX Social ${safePlan} subscription is active.`
  });
}

function displayDate(value) {
  if (!value) return 'the end of your grace period';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London'
  });
}

async function sendTrialEnding(user, daysRemaining) {
  const days = Number(daysRemaining) === 1 ? 1 : 2;
  return send({
    userId: user.id,
    to: user.email,
    type: `TRIAL_ENDING_${days}_DAYS`,
    subject: `Your INX Social trial ends in ${days} day${days === 1 ? '' : 's'}`,
    html: frame(
      'Your trial is ending',
      `<p>Your INX Social trial ends in ${days} day${days === 1 ? '' : 's'}. Choose Starter or Pro to keep publishing without interruption.</p><p>Your account, connected Pages and history will remain saved if the trial expires.</p>`,
      'Choose a plan',
      portalPage('index.html', { section: 'subscription' })
    ),
    text: `Your INX Social trial ends in ${days} day${days === 1 ? '' : 's'}.`
  });
}

async function sendTrialExpired(user) {
  return send({
    userId: user.id,
    to: user.email,
    type: 'TRIAL_EXPIRED',
    subject: 'Your INX Social trial has ended',
    html: frame(
      'Your trial has ended',
      '<p>Publishing access is now paused. Your account, connected Pages, settings and history remain saved.</p><p>Choose Starter or Pro to restore publishing access.</p>',
      'Choose a plan',
      portalPage('index.html', { section: 'subscription' })
    ),
    text: 'Your INX Social trial has ended. Choose a plan to restore publishing access.'
  });
}

async function sendPaymentFailed(user, graceEndsAt) {
  return send({
    userId: user.id,
    to: user.email,
    type: 'PAYMENT_FAILED',
    subject: 'Action needed: INX Social payment failed',
    html: frame(
      'Payment failed',
      `<p>We could not collect your latest INX Social subscription payment. Stripe may retry automatically.</p><p>Your publishing access remains available until ${displayDate(graceEndsAt)}. Please update your payment method before then.</p>`,
      'Manage billing',
      portalPage('index.html')
    ),
    text: `We could not collect your latest INX Social subscription payment. Update your payment method before ${displayDate(graceEndsAt)}.`
  });
}

async function sendPaymentRecovered(user) {
  return send({
    userId: user.id,
    to: user.email,
    type: 'PAYMENT_RECOVERED',
    subject: 'Your INX Social payment was successful',
    html: frame(
      'Payment recovered',
      '<p>Your subscription payment is now successful and your INX Social publishing access is active.</p>',
      'Open customer portal',
      portalPage('index.html')
    ),
    text: 'Your INX Social payment was successful and publishing access is active.'
  });
}

async function sendCancellationScheduled(user, currentPeriodEnd) {
  return send({
    userId: user.id,
    to: user.email,
    type: 'SUBSCRIPTION_CANCELLATION_SCHEDULED',
    subject: 'Your INX Social cancellation is scheduled',
    html: frame(
      'Cancellation scheduled',
      `<p>Your subscription will not renew. Publishing access remains available until ${displayDate(currentPeriodEnd)}.</p><p>You can manage or resume the subscription from Stripe before that date.</p>`,
      'Manage billing',
      portalPage('index.html')
    ),
    text: `Your INX Social subscription will end on ${displayDate(currentPeriodEnd)}.`
  });
}

async function sendSubscriptionEnded(user) {
  return send({
    userId: user.id,
    to: user.email,
    type: 'SUBSCRIPTION_ENDED',
    subject: 'Your INX Social subscription has ended',
    html: frame(
      'Subscription ended',
      '<p>Publishing access is now paused. Your account, connected Pages, settings and history remain saved.</p><p>Choose a plan to restore access.</p>',
      'Choose a plan',
      portalPage('index.html', { section: 'subscription' })
    ),
    text: 'Your INX Social subscription has ended. Choose a plan to restore publishing access.'
  });
}

async function sendAccessRestricted(user) {
  return send({
    userId: user.id,
    to: user.email,
    type: 'PAYMENT_GRACE_EXPIRED',
    subject: 'INX Social publishing access is paused',
    html: frame(
      'Publishing access is paused',
      '<p>The payment grace period has ended, so publishing access is paused. Your account, connected Pages, settings and history remain saved.</p>',
      'Update payment method',
      portalPage('index.html')
    ),
    text: 'The payment grace period has ended. Update your payment method to restore INX Social publishing access.'
  });
}

async function sendTestEmail(to, userId = null) {
  return send({
    userId,
    to,
    type: 'RESEND_TEST',
    subject: 'INX Social email delivery test',
    html: frame(
      'Resend is working',
      '<p>This confirms that INX Social can deliver transactional email through the Resend API.</p>'
    ),
    text: 'This confirms that INX Social can deliver transactional email through Resend.'
  });
}

module.exports = {
  isConfigured,
  verifyConnection,
  sendVerification,
  sendPasswordReset,
  sendTrialStarted,
  sendTrialEnding,
  sendTrialExpired,
  sendSubscriptionActivated,
  sendPaymentFailed,
  sendPaymentRecovered,
  sendCancellationScheduled,
  sendSubscriptionEnded,
  sendAccessRestricted,
  sendTestEmail
};
