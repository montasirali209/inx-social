const nodemailer = require('nodemailer');
const prisma = require('../db/prisma');
const env = require('../config/env');

let transporter;

function isConfigured() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isConfigured()) return null;

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    requireTLS: !env.smtp.secure && env.smtp.requireTls,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000
  });
  return transporter;
}

function portalPage(fileName, params = {}) {
  const configured = String(env.portalUrl || env.appUrl || 'http://localhost:5050').trim();
  const parsed = new URL(configured);
  let pathname = parsed.pathname.replace(/\/+$/, '');

  // Accept both of these configurations:
  // PORTAL_URL=http://localhost:5050
  // PORTAL_URL=http://localhost:5050/portal/
  if (!pathname.endsWith('/portal')) pathname += '/portal';
  parsed.pathname = `${pathname}/${fileName}`.replace(/\/+/g, '/');
  parsed.search = '';

  Object.entries(params).forEach(([key, value]) => {
    parsed.searchParams.set(key, value);
  });

  return parsed.toString();
}

function frame(title, body, buttonLabel, buttonUrl) {
  return `<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Segoe UI,Arial;color:#17223a"><div style="max-width:620px;margin:35px auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e1e7f0"><div style="padding:25px 30px;background:#08152b;color:#fff;font-size:22px;font-weight:800">INX <span style="color:#55ddd5">Social</span></div><div style="padding:34px"><h1 style="font-size:28px;margin:0 0 15px">${title}</h1>${body}${buttonUrl ? `<p style="margin:28px 0"><a href="${buttonUrl}" style="display:inline-block;padding:14px 22px;background:#49d7d0;color:#071224;text-decoration:none;border-radius:10px;font-weight:800">${buttonLabel}</a></p>` : ''}<p style="font-size:13px;color:#7b879b;margin-top:30px">INX Social is provided by INAXX LTD.</p></div></div></body></html>`;
}

async function verifyConnection() {
  const tx = getTransporter();
  if (!tx) return { configured: false, verified: false, message: 'SMTP is not configured' };
  await tx.verify();
  return { configured: true, verified: true, message: 'SMTP connection verified' };
}

async function send({ userId, to, type, subject, html, text }) {
  const log = await prisma.emailLog.create({
    data: { userId, recipient: to, type, subject, status: 'QUEUED' }
  });

  const tx = getTransporter();
  if (!tx) {
    await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'DEV_LOGGED' } });
    console.log(`[EMAIL DEV MODE] ${type} -> ${to}`);
    return { dev: true, messageId: null };
  }

  try {
    const result = await tx.sendMail({
      from: env.smtp.from,
      replyTo: env.smtp.replyTo,
      to,
      subject,
      html,
      text: text || subject
    });
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'SENT', providerId: result.messageId }
    });
    return result;
  } catch (error) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', errorMessage: error.message }
    });
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
    html: frame('Reset your password', '<p>Use the button below to create a new password. This link expires in 30 minutes.</p>', 'Reset password', url),
    text: `Reset your INX Social password: ${url}`
  });
}

async function sendTrialStarted(user) {
  return send({
    userId: user.id,
    to: user.email,
    type: 'TRIAL_STARTED',
    subject: 'Your INX Social trial has started',
    html: frame('Your trial is active', '<p>Your email is verified and your 5-day trial has started. You can now sign in to the customer portal and desktop app.</p>', 'Sign in to INX Social', portalPage('login.html'))
  });
}

async function sendSubscriptionActivated(user, plan) {
  return send({
    userId: user.id,
    to: user.email,
    type: 'SUBSCRIPTION_ACTIVATED',
    subject: `Your INX Social ${plan} subscription is active`,
    html: frame(`${plan} is now active`, `<p>Thank you for subscribing to INX Social ${plan}. Your account limits have been updated automatically.</p>`, 'Open customer portal', portalPage('index.html'))
  });
}

async function sendPaymentFailed(user) {
  return send({
    userId: user.id,
    to: user.email,
    type: 'PAYMENT_FAILED',
    subject: 'Action needed: INX Social payment failed',
    html: frame('Payment failed', '<p>We could not collect your latest INX Social subscription payment. Please update your payment method to avoid losing access.</p>', 'Manage billing', portalPage('index.html'))
  });
}

async function sendTestEmail(to, userId = null) {
  return send({
    userId,
    to,
    type: 'SMTP_TEST',
    subject: 'INX Social SMTP test',
    html: frame('SMTP is working', '<p>This confirms that INX Social can deliver transactional email from the configured mail server.</p>')
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
