const crypto = require('node:crypto');
const prisma = require('../db/prisma');
const env = require('../config/env');
const { getLicenseStatus } = require('./licenseService');

const PLUS_MONTHLY_CREDITS = () => Math.max(1, Math.min(100000, Number(env.aiCredits?.plusMonthlyCredits || 500)));

function customerPlan(rawPlan, role) {
  if (['ADMIN', 'SUPER_ADMIN'].includes(String(role || '').toUpperCase())) return 'plus';
  const plan = String(rawPlan || 'TRIAL').toUpperCase();
  if (['PRO', 'PLUS', 'LIFETIME'].includes(plan)) return 'plus';
  if (plan === 'STARTER') return 'pro';
  return 'trial';
}

function monthWindow(now = new Date()) {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  };
}

function billingWindow(license, now = new Date()) {
  const fallback = monthWindow(now);
  const start = license.currentPeriodStart ? new Date(license.currentPeriodStart) : fallback.start;
  const end = license.currentPeriodEnd ? new Date(license.currentPeriodEnd) : fallback.end;
  return { start, end, key: `${start.toISOString()}::${end.toISOString()}` };
}

function accessError(message, code = 'AI_STUDIO_PLUS_REQUIRED', status = 403) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

async function getEntitlement(userId) {
  const license = await getLicenseStatus(userId);
  const plan = customerPlan(license.plan, license.userRole);
  const studioEnabled = Boolean(license.allowed && plan === 'plus');
  return { license, plan, studioEnabled };
}

async function ensureWallet(userId, now = new Date()) {
  const entitlement = await getEntitlement(userId);
  if (!entitlement.studioEnabled) throw accessError('AI Content Studio is available on the Plus plan.');
  const limit = PLUS_MONTHLY_CREDITS();
  const period = billingWindow(entitlement.license, now);
  return prisma.$transaction(async tx => {
    let rows = await tx.$queryRawUnsafe('SELECT * FROM "AiCreditWallet" WHERE "userId" = $1 FOR UPDATE', userId);
    let wallet = rows[0] || null;
    if (!wallet) {
      const id = crypto.randomUUID();
      rows = await tx.$queryRawUnsafe(
        'INSERT INTO "AiCreditWallet" ("id","userId","monthlyBalance","topupBalance","monthlyLimit","periodKey","periodStart","periodEnd","createdAt","updatedAt") VALUES ($1,$2,$3,0,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *',
        id, userId, limit, period.key, period.start, period.end
      );
      wallet = rows[0];
      await tx.$executeRawUnsafe(
        'INSERT INTO "AiCreditTransaction" ("id","userId","walletId","type","bucket","amount","balanceMonthly","balanceTopup","reference","metadataJson") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT ("reference") DO NOTHING',
        crypto.randomUUID(), userId, wallet.id, 'MONTHLY_GRANT', 'MONTHLY', limit, limit, Number(wallet.topupBalance || 0), `monthly:${userId}:${period.key}`, JSON.stringify({ periodStart: period.start, periodEnd: period.end })
      );
    } else if (wallet.periodKey !== period.key || Number(wallet.monthlyLimit) !== limit) {
      rows = await tx.$queryRawUnsafe(
        'UPDATE "AiCreditWallet" SET "monthlyBalance"=$2,"monthlyLimit"=$2,"periodKey"=$3,"periodStart"=$4,"periodEnd"=$5,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 RETURNING *',
        wallet.id, limit, period.key, period.start, period.end
      );
      wallet = rows[0];
      await tx.$executeRawUnsafe(
        'INSERT INTO "AiCreditTransaction" ("id","userId","walletId","type","bucket","amount","balanceMonthly","balanceTopup","reference","metadataJson") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT ("reference") DO NOTHING',
        crypto.randomUUID(), userId, wallet.id, 'MONTHLY_GRANT', 'MONTHLY', limit, limit, Number(wallet.topupBalance || 0), `monthly:${userId}:${period.key}`, JSON.stringify({ periodStart: period.start, periodEnd: period.end })
      );
    }
    return { ...wallet, plan: entitlement.plan };
  });
}

function publicBalance(wallet) {
  const monthly = Number(wallet.monthlyBalance || 0);
  const topup = Number(wallet.topupBalance || 0);
  return {
    remaining: monthly + topup,
    limit: Number(wallet.monthlyLimit || PLUS_MONTHLY_CREDITS()),
    monthlyRemaining: monthly,
    topupRemaining: topup,
    unlimited: false,
    configured: true,
    periodStart: wallet.periodStart,
    periodEnd: wallet.periodEnd
  };
}

async function getAccess(userId) {
  const entitlement = await getEntitlement(userId);
  if (!entitlement.studioEnabled) {
    return {
      plan: entitlement.plan,
      studioEnabled: false,
      creditsRemaining: 0,
      creditsLimit: PLUS_MONTHLY_CREDITS(),
      unlimitedCredits: false,
      creditsConfigured: true,
      commercialUse: false,
      priorityProcessing: false
    };
  }
  const wallet = await ensureWallet(userId);
  const balance = publicBalance(wallet);
  return {
    plan: 'plus',
    studioEnabled: true,
    creditsRemaining: balance.remaining,
    creditsLimit: balance.limit,
    unlimitedCredits: false,
    creditsConfigured: true,
    commercialUse: true,
    priorityProcessing: true,
    monthlyRemaining: balance.monthlyRemaining,
    topupRemaining: balance.topupRemaining,
    periodStart: balance.periodStart,
    periodEnd: balance.periodEnd
  };
}

async function getBalance(userId) {
  const wallet = await ensureWallet(userId);
  return publicBalance(wallet);
}

async function reserve(userId, generationId, credits) {
  const amount = Math.max(1, Math.floor(Number(credits || 0)));
  await ensureWallet(userId);
  return prisma.$transaction(async tx => {
    const existing = await tx.$queryRawUnsafe('SELECT * FROM "AiCreditTransaction" WHERE "reference"=$1 LIMIT 1', `debit:${generationId}`);
    if (existing[0]) {
      const rows = await tx.$queryRawUnsafe('SELECT * FROM "AiGeneration" WHERE "id"=$1 AND "userId"=$2 LIMIT 1', generationId, userId);
      return rows[0] ? { monthly: Number(rows[0].reservedMonthly), topup: Number(rows[0].reservedTopup), total: Number(rows[0].reservedCredits) } : null;
    }
    const wallets = await tx.$queryRawUnsafe('SELECT * FROM "AiCreditWallet" WHERE "userId"=$1 FOR UPDATE', userId);
    const wallet = wallets[0];
    if (!wallet) throw accessError('AI credit wallet is unavailable.', 'AI_CREDIT_WALLET_MISSING', 503);
    const monthly = Number(wallet.monthlyBalance || 0);
    const topup = Number(wallet.topupBalance || 0);
    if (monthly + topup < amount) throw accessError('Not enough AI credits.', 'AI_CREDITS_INSUFFICIENT', 402);
    const fromMonthly = Math.min(monthly, amount);
    const fromTopup = amount - fromMonthly;
    const nextMonthly = monthly - fromMonthly;
    const nextTopup = topup - fromTopup;
    await tx.$executeRawUnsafe('UPDATE "AiCreditWallet" SET "monthlyBalance"=$2,"topupBalance"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', wallet.id, nextMonthly, nextTopup);
    await tx.$executeRawUnsafe(
      'INSERT INTO "AiCreditTransaction" ("id","userId","walletId","generationId","type","bucket","amount","balanceMonthly","balanceTopup","reference","metadataJson") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      crypto.randomUUID(), userId, wallet.id, generationId, 'GENERATION_DEBIT', fromTopup ? (fromMonthly ? 'MIXED' : 'TOPUP') : 'MONTHLY', -amount, nextMonthly, nextTopup, `debit:${generationId}`, JSON.stringify({ monthly: fromMonthly, topup: fromTopup })
    );
    await tx.$executeRawUnsafe('UPDATE "AiGeneration" SET "reservedCredits"=$2,"reservedMonthly"=$3,"reservedTopup"=$4,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "userId"=$5', generationId, amount, fromMonthly, fromTopup, userId);
    return { monthly: fromMonthly, topup: fromTopup, total: amount };
  });
}

async function refund(userId, generationId, reason) {
  return prisma.$transaction(async tx => {
    const prior = await tx.$queryRawUnsafe('SELECT * FROM "AiCreditTransaction" WHERE "reference"=$1 LIMIT 1', `refund:${generationId}`);
    if (prior[0]) return false;
    const generations = await tx.$queryRawUnsafe('SELECT * FROM "AiGeneration" WHERE "id"=$1 AND "userId"=$2 FOR UPDATE', generationId, userId);
    const generation = generations[0];
    if (!generation || Number(generation.reservedCredits || 0) <= 0 || Number(generation.creditsUsed || 0) > 0) return false;
    const wallets = await tx.$queryRawUnsafe('SELECT * FROM "AiCreditWallet" WHERE "userId"=$1 FOR UPDATE', userId);
    const wallet = wallets[0];
    if (!wallet) return false;
    const monthly = Number(wallet.monthlyBalance || 0) + Number(generation.reservedMonthly || 0);
    const topup = Number(wallet.topupBalance || 0) + Number(generation.reservedTopup || 0);
    await tx.$executeRawUnsafe('UPDATE "AiCreditWallet" SET "monthlyBalance"=$2,"topupBalance"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', wallet.id, monthly, topup);
    await tx.$executeRawUnsafe(
      'INSERT INTO "AiCreditTransaction" ("id","userId","walletId","generationId","type","bucket","amount","balanceMonthly","balanceTopup","reference","metadataJson") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      crypto.randomUUID(), userId, wallet.id, generationId, 'GENERATION_REFUND', 'MIXED', Number(generation.reservedCredits), monthly, topup, `refund:${generationId}`, JSON.stringify({ reason: String(reason || 'generation_failed').slice(0, 300) })
    );
    return true;
  });
}

async function complete(userId, generationId, creditsUsed) {
  const amount = Math.max(0, Math.floor(Number(creditsUsed || 0)));
  await prisma.$executeRawUnsafe('UPDATE "AiGeneration" SET "creditsUsed"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "userId"=$2', generationId, userId, amount);
  return amount;
}

async function addTopup(userId, credits, reference, metadata = {}) {
  const amount = Math.max(1, Math.floor(Number(credits || 0)));
  await ensureWallet(userId);
  return prisma.$transaction(async tx => {
    const duplicate = await tx.$queryRawUnsafe('SELECT * FROM "AiCreditTransaction" WHERE "reference"=$1 LIMIT 1', reference);
    if (duplicate[0]) {
      const wallets = await tx.$queryRawUnsafe('SELECT * FROM "AiCreditWallet" WHERE "userId"=$1 LIMIT 1', userId);
      return publicBalance(wallets[0]);
    }
    const wallets = await tx.$queryRawUnsafe('SELECT * FROM "AiCreditWallet" WHERE "userId"=$1 FOR UPDATE', userId);
    const wallet = wallets[0];
    const monthly = Number(wallet.monthlyBalance || 0);
    const topup = Number(wallet.topupBalance || 0) + amount;
    await tx.$executeRawUnsafe('UPDATE "AiCreditWallet" SET "topupBalance"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', wallet.id, topup);
    await tx.$executeRawUnsafe(
      'INSERT INTO "AiCreditTransaction" ("id","userId","walletId","type","bucket","amount","balanceMonthly","balanceTopup","reference","metadataJson") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      crypto.randomUUID(), userId, wallet.id, 'TOPUP_PURCHASE', 'TOPUP', amount, monthly, topup, reference, JSON.stringify(metadata)
    );
    return publicBalance({ ...wallet, monthlyBalance: monthly, topupBalance: topup });
  });
}

module.exports = { customerPlan, getEntitlement, getAccess, getBalance, ensureWallet, reserve, refund, complete, addTopup, PLUS_MONTHLY_CREDITS };
