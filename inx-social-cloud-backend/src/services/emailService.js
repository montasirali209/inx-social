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

async function sendPaymentFailed(user) {
  return send({
    userId: user.id,
    to: user.email,
    type: 'PAYMENT_FAILED',
    subject: 'Action needed: INX Social payment failed',
    html: frame(
      'Payment failed',
      '<p>We could not collect your latest INX Social subscription payment. Please update your payment method to avoid losing access.</p>',
      'Manage billing',
      portalPage('index.html')
    ),
    text: 'We could not collect your latest INX Social subscription payment.'
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
  sendSubscriptionActivated,
  sendPaymentFailed,
  sendTestEmail
};
