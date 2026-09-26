const prisma = require('../db/prisma');
const env = require('../config/env');

const SETTING_KEY = 'ai_video_commercial_guard_v1';
const VERSION = 'video-commercial-guard-v1';

let loaded = false;
let state = { version: VERSION, blocks: {} };

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function policy() {
  const config = env.videoCommercial || {};
  return {
    creditCostBuffer: Math.max(1.15, Number(config.creditCostBuffer || 1.15)),
    maxGenerationCredits: Math.max(100, Number(config.maxGenerationCredits || 4000)),
    pricingMaxAgeHours: Math.max(1, Number(config.pricingMaxAgeHours || 24)),
    costDriftTolerance: Math.max(1.01, Number(config.costDriftTolerance || 1.10))
  };
}

function publicError(message, code, status = 503) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.publicMessage = message;
  return error;
}

async function load() {
  if (loaded) return state;
  loaded = true;
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (parsed?.version === VERSION && parsed.blocks && typeof parsed.blocks === 'object') state = parsed;
    }
  } catch (error) {
    console.warn('[VIDEO COMMERCIAL GUARD] state load failed', clean(error?.message, 500));
  }
  return state;
}

async function persist() {
  try {
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: JSON.stringify(state), description: 'Video Studio commercial pricing drift guard state' },
      update: { value: JSON.stringify(state), description: 'Video Studio commercial pricing drift guard state' }
    });
  } catch (error) {
    console.warn('[VIDEO COMMERCIAL GUARD] state persist failed', clean(error?.message, 500));
  }
}

function pricingAgeMs(snapshot) {
  return Date.now() - new Date(snapshot?.syncedAt || 0).getTime();
}

function isFresh(snapshot) {
  const age = pricingAgeMs(snapshot);
  const maxAge = policy().pricingMaxAgeHours * 60 * 60 * 1000;
  return Number.isFinite(age) && age >= 0 && age <= maxAge && snapshot?.source !== 'compatibility-fallback';
}

function assertFreshSnapshot(snapshot) {
  if (!isFresh(snapshot)) {
    throw publicError(
      'Video pricing is temporarily being refreshed. Please try again shortly.',
      'AI_VIDEO_PRICING_STALE',
      503
    );
  }
}

function assertEstimate(credits) {
  const amount = Math.ceil(Number(credits || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw publicError('Current pricing is unavailable for this video configuration.', 'AI_VIDEO_PRICING_UNAVAILABLE', 503);
  }
  if (amount > policy().maxGenerationCredits) {
    throw publicError(
      'This video configuration is above the current generation credit limit. Choose a shorter duration, lower resolution or another model.',
      'AI_VIDEO_COMMERCIAL_LIMIT',
      422
    );
  }
  return amount;
}

function routeKeys(modelOrRoute) {
  if (!modelOrRoute) return [];
  if (typeof modelOrRoute === 'string') return [modelOrRoute];
  return [modelOrRoute.id, modelOrRoute.routeId, modelOrRoute.air, modelOrRoute.model].filter(Boolean);
}

function blockFor(modelOrRoute) {
  for (const key of routeKeys(modelOrRoute)) {
    if (state.blocks[key]) return state.blocks[key];
  }
  return null;
}

function isBlocked(modelOrRoute) {
  return Boolean(blockFor(modelOrRoute));
}

function assertModelAllowed(modelOrRoute) {
  const blocked = blockFor(modelOrRoute);
  if (blocked) {
    throw publicError(
      'This video model is temporarily paused while its provider pricing is revalidated. Choose another model.',
      'AI_VIDEO_MODEL_PRICING_REVIEW',
      503
    );
  }
}

async function recordActualCost({ model, selection, providerCostUsd, reservedCredits, requiredCredits }) {
  await load();
  const actual = Math.max(0, Number(providerCostUsd || 0));
  const reserved = Math.max(0, Number(reservedCredits || 0));
  const required = Math.max(0, Number(requiredCredits || 0));
  if (!actual || !required || !reserved) return { blocked: false };

  const tolerance = policy().costDriftTolerance;
  const drifted = required > Math.ceil(reserved * tolerance) || required > policy().maxGenerationCredits;
  if (!drifted) return { blocked: false };

  const key = clean(model?.id || model?.routeId || model?.air || model?.model, 180);
  if (!key) return { blocked: false };

  state.blocks[key] = {
    route: key,
    air: clean(model?.air || model?.model, 180),
    observedAt: new Date().toISOString(),
    providerCostUsd: actual,
    reservedCredits: reserved,
    requiredCredits: required,
    selection: {
      duration: Number(selection?.duration || 0) || null,
      resolution: clean(selection?.resolution, 32) || null,
      aspectRatio: clean(selection?.aspectRatio || selection?.aspect, 20) || null,
      fps: Number(selection?.fps || 0) || null,
      draft: Boolean(selection?.draft),
      audio: selection?.audio !== false
    }
  };
  await persist();
  console.warn('[VIDEO COMMERCIAL GUARD] model paused after provider cost drift', JSON.stringify(state.blocks[key]));
  return { blocked: true, block: state.blocks[key] };
}

async function reconcileAfterRefresh(snapshot, estimateCreditsForModel) {
  await load();
  let changed = false;
  for (const [key, blocked] of Object.entries(state.blocks)) {
    const model = (snapshot?.models || []).find(item => routeKeys(item).includes(key) || (blocked.air && routeKeys(item).includes(blocked.air)));
    if (!model || !model.generationReady || model.pricingStatus !== 'SYNCED') continue;
    try {
      const estimated = Number(estimateCreditsForModel(model, blocked.selection || {}));
      if (Number.isFinite(estimated) && estimated >= Number(blocked.requiredCredits || 0) && estimated <= policy().maxGenerationCredits) {
        delete state.blocks[key];
        changed = true;
        console.info('[VIDEO COMMERCIAL GUARD] model pricing revalidated', JSON.stringify({ route: key, estimatedCredits: estimated }));
      }
    } catch (_) {}
  }
  if (changed) await persist();
  return state;
}

function health(snapshot) {
  const p = policy();
  const ageMs = pricingAgeMs(snapshot);
  const fresh = isFresh(snapshot);
  const blocked = Object.values(state.blocks);
  const pricingSynced = Number(snapshot?.stats?.pricingSynced || 0);
  const total = Number(snapshot?.stats?.total || 0);
  const generationReady = Number(snapshot?.stats?.generationReady || 0);
  const reasons = [];
  if (!fresh) reasons.push('PRICING_STALE');
  if (blocked.length) reasons.push('PROVIDER_COST_DRIFT');
  if (!generationReady) reasons.push('NO_GENERATION_READY_MODELS');
  if (total && pricingSynced / total < 0.75) reasons.push('LOW_PRICING_COVERAGE');
  return {
    status: reasons.length ? 'DEGRADED' : 'HEALTHY',
    fresh,
    source: snapshot?.source || 'unknown',
    syncedAt: snapshot?.syncedAt || null,
    pricingAgeMinutes: Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 60000)) : null,
    pricingMaxAgeHours: p.pricingMaxAgeHours,
    creditCostBuffer: p.creditCostBuffer,
    maxGenerationCredits: p.maxGenerationCredits,
    costDriftTolerance: p.costDriftTolerance,
    blockedModels: blocked.length,
    generationReady,
    pricingSynced,
    total,
    reasons
  };
}

async function start() {
  await load();
  return state;
}

module.exports = {
  VERSION,
  policy,
  load,
  start,
  isFresh,
  assertFreshSnapshot,
  assertEstimate,
  isBlocked,
  assertModelAllowed,
  recordActualCost,
  reconcileAfterRefresh,
  health
};
