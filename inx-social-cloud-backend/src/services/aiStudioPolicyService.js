const prisma = require('../db/prisma');

const SETTING_KEY = 'ai_content_studio_policy';
const DEFAULT_POLICY = Object.freeze({
  enabled: true,
  trialEnabled: true,
  paidEnabled: true,
  administratorEnabled: true
});

function asBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function normalizePolicy(input = {}) {
  return {
    enabled: asBoolean(input.enabled, DEFAULT_POLICY.enabled),
    trialEnabled: asBoolean(input.trialEnabled, DEFAULT_POLICY.trialEnabled),
    paidEnabled: asBoolean(input.paidEnabled, DEFAULT_POLICY.paidEnabled),
    administratorEnabled: asBoolean(input.administratorEnabled, DEFAULT_POLICY.administratorEnabled)
  };
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
    create: { key: SETTING_KEY, value: JSON.stringify(policy), description: 'Global AI Content Studio access policy.' },
    update: { value: JSON.stringify(policy), description: 'Global AI Content Studio access policy.' }
  });
  return policy;
}

function permits(policy, { administrator, plan }) {
  if (!policy.enabled) return false;
  if (administrator) return Boolean(policy.administratorEnabled);
  if (String(plan || '').toLowerCase() === 'trial') return Boolean(policy.trialEnabled);
  return Boolean(policy.paidEnabled);
}

module.exports = { SETTING_KEY, DEFAULT_POLICY, normalizePolicy, getPolicy, updatePolicy, permits };
