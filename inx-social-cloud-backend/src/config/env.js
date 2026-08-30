require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function modelName(value, fallback) {
  const raw = String(value || fallback || '').trim();
  const unquoted = raw.replace(/^(["'])(.*)\1$/, '$2').trim();
  return /^[a-zA-Z0-9._:/-]{1,160}$/.test(unquoted) ? unquoted : fallback;
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
    model: modelName(process.env.OLLAMA_MODEL, 'qwen3:8b'),
    apiKey: process.env.OLLAMA_API_KEY || '',
    cloudflareAccessClientId: process.env.OLLAMA_CF_ACCESS_CLIENT_ID || '',
    cloudflareAccessClientSecret: process.env.OLLAMA_CF_ACCESS_CLIENT_SECRET || '',
    timeoutMs: Math.max(10000, Number(process.env.OLLAMA_TIMEOUT_MS || 180000)),
    taskTimeoutMs: Math.max(60000, Number(process.env.OLLAMA_TASK_TIMEOUT_MS || 330000)),
    simpleContext: Math.max(4096, Math.min(16384, Number(process.env.OLLAMA_SIMPLE_CONTEXT || 8192))),
    complexContext: Math.max(8192, Math.min(32768, Number(process.env.OLLAMA_COMPLEX_CONTEXT || 32768))),
    visionEnabled: String(process.env.OLLAMA_VISION_ENABLED || 'false') === 'true',
    imageModel: modelName(process.env.OLLAMA_IMAGE_MODEL, 'x/z-image-turbo'),
    imageTimeoutMs: Math.max(30000, Number(process.env.OLLAMA_IMAGE_TIMEOUT_MS || 300000)),
    imageReviewEnabled: String(process.env.OLLAMA_IMAGE_REVIEW_ENABLED || 'true') === 'true',
    imageReviewMinScore: Math.max(50, Math.min(95, Number(process.env.OLLAMA_IMAGE_REVIEW_MIN_SCORE || 75)))
  },
  openaiImage: {
    baseUrl: String(process.env.OPENAI_IMAGE_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey: process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY || '',
    model: modelName(process.env.OPENAI_IMAGE_MODEL, 'gpt-image-2'),
    timeoutMs: Math.max(30000, Number(process.env.OPENAI_IMAGE_TIMEOUT_MS || 300000))
  },
  aiFallback: {
    enabled: String(process.env.AI_PAID_FALLBACK_ENABLED || 'false') === 'true',
    baseUrl: String(process.env.AI_PAID_FALLBACK_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey: process.env.AI_PAID_FALLBACK_API_KEY || process.env.OPENAI_API_KEY || '',
    model: process.env.AI_PAID_FALLBACK_MODEL || process.env.OPENAI_FALLBACK_MODEL || process.env.OPENAI_MODEL || '',
    maxCallsPerMission: Math.max(0, Math.min(5, Number(process.env.AI_PAID_FALLBACK_MAX_CALLS_PER_MISSION || 1)))
  },
  postEnhancement: {
    enabled: String(process.env.POST_ENHANCEMENT_ENABLED || 'true') === 'true',
    baseUrl: String(process.env.POST_ENHANCEMENT_BASE_URL || process.env.AI_PAID_FALLBACK_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey: process.env.POST_ENHANCEMENT_API_KEY || process.env.AI_PAID_FALLBACK_API_KEY || process.env.OPENAI_API_KEY || '',
    model: process.env.POST_ENHANCEMENT_MODEL || process.env.AI_PAID_FALLBACK_MODEL || process.env.OPENAI_MODEL || '',
    timeoutMs: Math.max(10000, Math.min(120000, Number(process.env.POST_ENHANCEMENT_TIMEOUT_MS || 60000)))
  },
  webResearch: {
    enabled: String(process.env.WEB_RESEARCH_ENABLED || 'false') === 'true',
    provider: String(process.env.WEB_RESEARCH_PROVIDER || 'openai').trim().toLowerCase(),
    baseUrl: String(process.env.WEB_RESEARCH_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey: process.env.WEB_RESEARCH_API_KEY || process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_WEB_SEARCH_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-terra',
    timeoutMs: Math.max(10000, Number(process.env.WEB_RESEARCH_TIMEOUT_MS || 120000)),
    maxSources: Math.max(1, Math.min(10, Number(process.env.WEB_RESEARCH_MAX_SOURCES || 8))),
    maxQueries: Math.max(1, Math.min(3, Number(process.env.WEB_RESEARCH_MAX_QUERIES || 3))),
    resultsPerQuery: Math.max(1, Math.min(10, Number(process.env.WEB_RESEARCH_RESULTS_PER_QUERY || 5))),
    searchDepth: String(process.env.WEB_RESEARCH_SEARCH_DEPTH || 'basic').toLowerCase() === 'advanced' ? 'advanced' : 'basic',
    country: String(process.env.WEB_RESEARCH_COUNTRY || 'GB').trim().toUpperCase().slice(0, 2),
    language: String(process.env.WEB_RESEARCH_LANGUAGE || 'en').trim().toLowerCase().slice(0, 12)
  }
};
