require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

module.exports = {
  port: Number(process.env.PORT || 5050),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: required('JWT_SECRET'),
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  defaultTrialDays: Number(process.env.DEFAULT_TRIAL_DAYS || 5),
  appUrl: process.env.APP_URL || 'http://localhost:5050',
  portalUrl: process.env.PORTAL_URL || process.env.APP_URL || 'http://localhost:5050',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'INX Social <no-reply@inaxx.co.uk>',
    replyTo: process.env.EMAIL_REPLY_TO || 'contact@inaxx.co.uk',
    requireTls: String(process.env.SMTP_REQUIRE_TLS || 'true') === 'true'
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    starterPriceId: process.env.STRIPE_STARTER_PRICE_ID || '',
    proPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
    successUrl: process.env.STRIPE_SUCCESS_URL || `${process.env.PORTAL_URL || process.env.APP_URL || 'http://localhost:5050'}/portal/?checkout=success`,
    cancelUrl: process.env.STRIPE_CANCEL_URL || `${process.env.PORTAL_URL || process.env.APP_URL || 'http://localhost:5050'}/portal/?checkout=cancelled`,
    portalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL || `${process.env.PORTAL_URL || process.env.APP_URL || 'http://localhost:5050'}/portal/`,
    paymentGraceDays: Math.max(1, Number(process.env.PAYMENT_GRACE_DAYS || 7))
  },
  installerUrl: process.env.INSTALLER_URL || '',
  latestVersion: process.env.LATEST_DESKTOP_VERSION || '14.0.1',
  ollama: {
    baseUrl: String(process.env.OLLAMA_BASE_URL || '').replace(/\/$/, ''),
    model: process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct',
    apiKey: process.env.OLLAMA_API_KEY || '',
    cloudflareAccessClientId: process.env.OLLAMA_CF_ACCESS_CLIENT_ID || '',
    cloudflareAccessClientSecret: process.env.OLLAMA_CF_ACCESS_CLIENT_SECRET || '',
    timeoutMs: Math.max(10000, Number(process.env.OLLAMA_TIMEOUT_MS || 120000))
  },
  aiFallback: {
    enabled: String(process.env.AI_PAID_FALLBACK_ENABLED || 'false') === 'true',
    baseUrl: String(process.env.AI_PAID_FALLBACK_BASE_URL || '').replace(/\/$/, ''),
    apiKey: process.env.AI_PAID_FALLBACK_API_KEY || '',
    model: process.env.AI_PAID_FALLBACK_MODEL || '',
    maxCallsPerMission: Math.max(0, Math.min(5, Number(process.env.AI_PAID_FALLBACK_MAX_CALLS_PER_MISSION || 1)))
  }
};
