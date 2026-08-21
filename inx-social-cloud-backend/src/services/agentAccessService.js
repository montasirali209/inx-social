const prisma = require('../db/prisma');
const { getLicenseStatus } = require('./licenseService');

const SETTING_KEY = 'social_agent_access_policy';
const AVAILABILITY = Object.freeze({
  DISABLED: 'DISABLED',
  ADMIN_ONLY: 'ADMIN_ONLY',
  EVERYONE: 'EVERYONE'
});
const DEFAULT_POLICY = Object.freeze({
  availability: AVAILABILITY.ADMIN_ONLY,
  planLimits: Object.freeze({ TRIAL: 1, STARTER: 10, PRO: 100, LIFETIME: 100, CREATOR: 100, AGENCY: 500, BUSINESS: 500 })
});

function clampLimit(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1000000, Math.floor(number)));
}

function normalizePolicy(input = {}) {
  const availability = Object.values(AVAILABILITY).includes(String(input.availability || '').toUpperCase())
    ? String(input.availability).toUpperCase()
    : DEFAULT_POLICY.availability;
  const supplied = input.planLimits && typeof input.planLimits === 'object' ? input.planLimits : {};
  const planLimits = {};
  for (const [plan, fallback] of Object.entries(DEFAULT_POLICY.planLimits)) {
    planLimits[plan] = clampLimit(supplied[plan], fallback);
  }
  return { availability, planLimits };
}

async function getPolicy() {
  if (typeof prisma.appSetting?.findUnique !== 'function') return normalizePolicy(DEFAULT_POLICY);
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row?.value) return normalizePolicy(DEFAULT_POLICY);
  try { return normalizePolicy(JSON.parse(row.value)); } catch (_) { return normalizePolicy(DEFAULT_POLICY); }
}

async function updatePolicy(input) {
  const policy = normalizePolicy(input);
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(policy), description: 'Controls Social Agent visibility and monthly mission allowances.' },
    update: { value: JSON.stringify(policy), description: 'Controls Social Agent visibility and monthly mission allowances.' }
  });
  return policy;
}

function isAdministrator(role) {
  return ['ADMIN', 'SUPER_ADMIN'].includes(String(role || '').toUpperCase());
}

function startOfUtcMonth(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function endOfUtcMonth(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

async function getEntitlement(userId, options = {}) {
  const now = options.now || new Date();
  const [policy, license] = await Promise.all([getPolicy(), getLicenseStatus(userId)]);
  const admin = isAdministrator(license.userRole);
  const visible = policy.availability === AVAILABILITY.EVERYONE || (policy.availability === AVAILABILITY.ADMIN_ONLY && admin);
  const allowed = Boolean(visible && license.allowed);
  const plan = String(license.plan || 'TRIAL').toUpperCase();
  const limit = admin ? null : clampLimit(policy.planLimits[plan], 0);
  const periodStart = license.currentPeriodStart ? new Date(license.currentPeriodStart) : startOfUtcMonth(now);
  const periodEnd = license.currentPeriodEnd ? new Date(license.currentPeriodEnd) : endOfUtcMonth(now);
  const used = visible ? await prisma.agentPlan.count({ where: { userId, createdAt: { gte: periodStart, lt: periodEnd } } }) : 0;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  return {
    visible,
    allowed,
    admin,
    availability: policy.availability,
    plan,
    usage: {
      used,
      limit,
      remaining,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    }
  };
}

function accessError(message, code = 'AGENT_UNAVAILABLE') {
  const error = new Error(message);
  error.status = 403;
  error.code = code;
  return error;
}

async function requireAccess(userId, options = {}) {
  const entitlement = await getEntitlement(userId, options);
  if (!entitlement.visible) throw accessError('Social Agent is not currently available for this account.');
  if (!entitlement.allowed) throw accessError('An active INX Social plan is required to use Social Agent.', 'AGENT_LICENSE_REQUIRED');
  if (options.consume && entitlement.usage.limit !== null && entitlement.usage.remaining <= 0) {
    throw accessError('Your Social Agent mission allowance has been used for this billing period.', 'AGENT_USAGE_LIMIT');
  }
  return entitlement;
}

module.exports = { SETTING_KEY, AVAILABILITY, DEFAULT_POLICY, normalizePolicy, getPolicy, updatePolicy, getEntitlement, requireAccess, isAdministrator };
