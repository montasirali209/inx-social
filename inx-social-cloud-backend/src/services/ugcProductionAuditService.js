const prisma = require('../db/prisma');
const renderQuality = require('./ugcRenderQuality');
const runtimePolicy = require('./ugcRuntimePolicy');

const PRODUCTION_AUDIT_VERSION = 'ugc-production-audit-v1';
const STALE_RENDER_MS = runtimePolicy.STALE_RENDER_MS;

function parseJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  try { const out = JSON.parse(value || ''); return out ?? fallback; } catch (_) { return fallback; }
}
function num(value) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function iso(value) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
function nonEmpty(value) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === 'object' ? Object.keys(value).length : value);
}
function check(id, status, detail = {}, message = '') {
  return { id, status, message, detail };
}
function worstStatus(checks = []) {
  if (checks.some(item => item.status === 'FAIL')) return 'FAIL';
  if (checks.some(item => item.status === 'WARN')) return 'WARN';
  return 'PASS';
}
function ageMs(value, now = Date.now()) {
  const stamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(stamp) ? Math.max(0, now - stamp) : 0;
}
function mapBy(rows, key) {
  const out = new Map();
  for (const row of rows || []) if (row?.[key] != null) out.set(String(row[key]), row);
  return out;
}

function evaluateCampaignSnapshot(input = {}) {
  const campaign = input.campaign || null;
  const engine = input.engine || null;
  const ads = Array.isArray(input.ads) ? input.ads : [];
  const scenes = Array.isArray(input.scenes) ? input.scenes : [];
  const generations = Array.isArray(input.generations) ? input.generations : [];
  const assets = Array.isArray(input.assets) ? input.assets : [];
  const creditTransactions = Array.isArray(input.creditTransactions) ? input.creditTransactions : [];
  const now = input.now ? new Date(input.now).getTime() : Date.now();

  const scenesByAd = new Map();
  for (const scene of scenes) {
    const key = String(scene.adId || '');
    if (!scenesByAd.has(key)) scenesByAd.set(key, []);
    scenesByAd.get(key).push(scene);
  }
  const generationById = mapBy(generations, 'id');
  const assetById = mapBy(assets, 'id');
  const engineJobs = parseJson(engine?.renderJobsJson ?? engine?.renderJobs, []);
  const engineJobsByAd = new Map();
  const engineJobsBySequence = new Map();
  for (const job of Array.isArray(engineJobs) ? engineJobs : []) {
    if (job?.adId) engineJobsByAd.set(String(job.adId), job);
    if (job?.adSequence != null) engineJobsBySequence.set(String(job.adSequence), job);
  }
  const txByGeneration = new Map();
  for (const tx of creditTransactions) {
    const key = String(tx.generationId || '');
    if (!txByGeneration.has(key)) txByGeneration.set(key, []);
    txByGeneration.get(key).push(tx);
  }

  const checks = [];
  checks.push(check(
    'CAMPAIGN_PRESENT',
    campaign ? 'PASS' : 'FAIL',
    { campaignId: campaign?.id || null },
    campaign ? '' : 'Campaign row is missing.'
  ));
  checks.push(check(
    'ENGINE_PROJECT_PRESENT',
    engine ? 'PASS' : 'FAIL',
    { engineVersion: engine?.engineVersion || null, contractVersion: engine?.contractVersion || null },
    engine ? '' : 'UGC engine project is missing.'
  ));
  if (campaign && engine) {
    checks.push(check(
      'ENGINE_CAMPAIGN_IDENTITY',
      String(engine.campaignId) === String(campaign.id) && String(engine.userId) === String(campaign.userId) ? 'PASS' : 'FAIL',
      { campaignId: campaign.id, engineCampaignId: engine.campaignId, userId: campaign.userId, engineUserId: engine.userId },
      'Engine project ownership/campaign identity must match the campaign.'
    ));
    checks.push(check(
      'ENGINE_STATUS_SYNC',
      String(engine.status || '') === String(campaign.status || '') ? 'PASS' : (['PARTIAL','FAILED','READY'].includes(String(campaign.status || '')) ? 'FAIL' : 'WARN'),
      { campaignStatus: campaign.status || null, engineStatus: engine.status || null },
      'Campaign and engine lifecycle states should agree.'
    ));
  }

  const expectedAdCount = num(campaign?.adCount);
  checks.push(check(
    'VARIATION_COUNT',
    expectedAdCount && ads.length !== expectedAdCount ? 'FAIL' : ads.length ? 'PASS' : 'WARN',
    { expected: expectedAdCount || null, actual: ads.length },
    'Persisted UGC variations should match the confirmed campaign count.'
  ));
  checks.push(check(
    'ENGINE_RENDER_JOB_COUNT',
    engine && Array.isArray(engineJobs) && engineJobs.length !== ads.length ? 'FAIL' : engine ? 'PASS' : 'WARN',
    { jobs: Array.isArray(engineJobs) ? engineJobs.length : 0, ads: ads.length },
    'Each UGC variation should have one engine render job.'
  ));

  let reservedCredits = 0;
  let usedCredits = 0;
  let providerCostUsd = 0;
  let publishableAds = 0;
  let failedAds = 0;
  let recoveringAds = 0;
  let staleAds = 0;
  let localReassemblies = 0;
  const adReports = [];

  for (const ad of ads) {
    const adScenes = (scenesByAd.get(String(ad.id)) || []).sort((a,b) => num(a.sequence) - num(b.sequence));
    const generation = ad.generationId ? generationById.get(String(ad.generationId)) : null;
    const asset = ad.mediaAssetId ? assetById.get(String(ad.mediaAssetId)) : null;
    const job = engineJobsByAd.get(String(ad.id)) || engineJobsBySequence.get(String(ad.sequence));
    const qc = renderQuality.inspect({ ad, scenes: adScenes });
    const txs = generation ? (txByGeneration.get(String(generation.id)) || []) : [];
    const debit = txs.find(tx => tx.type === 'GENERATION_DEBIT' || String(tx.reference || '') === 'debit:' + generation.id);
    const refund = txs.find(tx => tx.type === 'GENERATION_REFUND' || String(tx.reference || '') === 'refund:' + generation.id);

    const adChecks = [];
    adChecks.push(check('SCENES_PRESENT', adScenes.length ? 'PASS' : 'FAIL', { count: adScenes.length }));
    adChecks.push(check(
      'ENGINE_JOB_LINK',
      job && String(job.adId || ad.id) === String(ad.id) ? 'PASS' : 'FAIL',
      { engineGenerationId: job?.generationId || null, adGenerationId: ad.generationId || null }
    ));
    adChecks.push(check(
      'GENERATION_LINK',
      ad.generationId && generation ? 'PASS' : 'FAIL',
      { generationId: ad.generationId || null, generationStatus: generation?.status || null }
    ));

    if (generation) {
      const reserved = num(generation.reservedCredits);
      const used = num(generation.creditsUsed);
      const cost = num(generation.providerCostUsd);
      reservedCredits += reserved;
      usedCredits += used;
      providerCostUsd += cost;
      const request = parseJson(generation.requestJson, {});
      const isLocalReassembly = generation.provider === 'local' || request.reassembly === true;
      if (isLocalReassembly) localReassemblies += 1;

      adChecks.push(check(
        'CREDIT_NONNEGATIVE',
        reserved >= 0 && used >= 0 && used <= reserved ? 'PASS' : 'FAIL',
        { reserved, used }
      ));
      if (isLocalReassembly) {
        adChecks.push(check(
          'ZERO_CREDIT_REASSEMBLY',
          reserved === 0 && used === 0 ? 'PASS' : 'FAIL',
          { provider: generation.provider || null, reserved, used }
        ));
      } else if (String(generation.status) === 'COMPLETED') {
        adChecks.push(check(
          'COMPLETED_CREDIT_FINALIZATION',
          reserved > 0 && used === reserved ? 'PASS' : 'FAIL',
          { reserved, used }
        ));
      } else if (String(generation.status) === 'FAILED' && reserved > 0) {
        adChecks.push(check(
          'FAILED_CREDIT_REFUND',
          !debit || Boolean(refund) ? 'PASS' : 'FAIL',
          { debitFound: Boolean(debit), refundFound: Boolean(refund), reserved }
        ));
      }
      adChecks.push(check('PROVIDER_COST_NONNEGATIVE', cost >= 0 ? 'PASS' : 'FAIL', { providerCostUsd: cost }));
    }

    if (String(ad.status) === 'READY') {
      adChecks.push(check('READY_QC', qc.publishable ? 'PASS' : 'FAIL', { qcStatus: qc.status, recoveryAction: qc.recovery.action }));
      adChecks.push(check(
        'MEDIA_LIBRARY_LINK',
        ad.mediaAssetId && asset ? 'PASS' : 'FAIL',
        { mediaAssetId: ad.mediaAssetId || null }
      ));
      if (asset) {
        adChecks.push(check(
          'MEDIA_ASSET_VIDEO',
          String(asset.kind) === 'AI_VIDEO' && /^video\//i.test(String(asset.mimeType || '')) && String(asset.status) === 'READY' ? 'PASS' : 'FAIL',
          { kind: asset.kind || null, mimeType: asset.mimeType || null, status: asset.status || null }
        ));
      }
    }

    const busy = ['QUEUED','RENDERING','RESERVING'].includes(String(ad.status || '').toUpperCase());
    const stale = busy && ageMs(ad.updatedAt, now) > STALE_RENDER_MS;
    if (stale) staleAds += 1;
    adChecks.push(check(
      'NOT_STALE',
      stale ? 'WARN' : 'PASS',
      { status: ad.status || null, updatedAt: iso(ad.updatedAt), thresholdMs: STALE_RENDER_MS }
    ));

    if (qc.publishable) publishableAds += 1;
    if (String(ad.status) === 'FAILED') failedAds += 1;
    if (['RETRY_SCENES','REASSEMBLE'].includes(qc.recovery.action)) recoveringAds += 1;

    adReports.push({
      adId: ad.id,
      sequence: num(ad.sequence),
      status: ad.status || null,
      generationId: ad.generationId || null,
      mediaAssetId: ad.mediaAssetId || null,
      renderQuality: qc,
      checks: adChecks,
      statusSummary: worstStatus(adChecks)
    });
  }

  const campaignPricing = parseJson(engine?.pricingJson ?? engine?.pricing, {});
  const expectedTotalCredits = num(campaign?.totalCredits || campaignPricing.totalCredits);
  const currentGenerationReserved = reservedCredits;
  checks.push(check(
    'CAMPAIGN_CREDIT_SHAPE',
    expectedTotalCredits >= 0 && currentGenerationReserved >= 0 ? 'PASS' : 'FAIL',
    { confirmedCampaignCredits: expectedTotalCredits, currentGenerationReserved, currentGenerationUsed: usedCredits }
  ));
  checks.push(check(
    'PROVIDER_COST_NONNEGATIVE',
    providerCostUsd >= 0 ? 'PASS' : 'FAIL',
    { providerCostUsd: Number(providerCostUsd.toFixed(6)) }
  ));

  const terminal = ['READY','PARTIAL','FAILED'].includes(String(campaign?.status || ''));
  if (terminal) {
    checks.push(check(
      'TERMINAL_AD_STATES',
      ads.every(ad => ['READY','FAILED'].includes(String(ad.status || ''))) ? 'PASS' : 'FAIL',
      { statuses: ads.map(ad => ad.status) },
      'Terminal campaigns must not retain queued/rendering variations.'
    ));
  }

  const lifecycle = [
    ['BRIEF', nonEmpty(parseJson(engine?.briefJson ?? engine?.brief, {}))],
    ['CASTING', nonEmpty(parseJson(engine?.actorJson ?? engine?.actor, {}))],
    ['SKILLS', Boolean(engine?.skillsVersion) && nonEmpty(parseJson(engine?.skillsJson ?? engine?.skills, {}))],
    ['CREATIVE_PLAN', nonEmpty(parseJson(engine?.productionPlanJson ?? engine?.productionPlan, {}))],
    ['ROUTING', Boolean(engine?.routerVersion) && nonEmpty(parseJson(engine?.routerJson ?? engine?.router, {}))],
    ['PRICING', nonEmpty(campaignPricing)],
    ['GENERATION_LINKS', ads.length > 0 && ads.every(ad => Boolean(ad.generationId))],
    ['SCENE_RENDER', scenes.length > 0],
    ['FINAL_QC', adReports.some(report => report.renderQuality.status !== 'PROCESSING')],
    ['MEDIA_LIBRARY', publishableAds > 0 ? adReports.filter(report => report.renderQuality.publishable).every(report => Boolean(report.mediaAssetId)) : false],
    ['PUBLISH_READY', publishableAds > 0]
  ].map(([stage, complete]) => ({ stage, status: complete ? 'COMPLETE' : 'PENDING' }));

  const allChecks = [...checks, ...adReports.flatMap(report => report.checks.map(item => ({ ...item, adId: report.adId })))];
  const auditStatus = worstStatus(allChecks);
  let recommendedAction = 'NONE';
  if (auditStatus === 'FAIL') recommendedAction = 'INVESTIGATE_INVARIANTS';
  else if (staleAds) recommendedAction = 'CHECK_STALE_QUEUE';
  else if (recoveringAds) recommendedAction = 'RECOVER_OUTPUTS';
  else if (!terminal) recommendedAction = 'WAIT_FOR_RENDER';

  return {
    version: PRODUCTION_AUDIT_VERSION,
    campaignId: campaign?.id || engine?.campaignId || null,
    status: auditStatus,
    recommendedAction,
    campaignStatus: campaign?.status || null,
    engineStatus: engine?.status || null,
    summary: {
      variationCount: ads.length,
      sceneCount: scenes.length,
      publishableAds,
      failedAds,
      recoveringAds,
      staleAds,
      currentGenerationReservedCredits: currentGenerationReserved,
      currentGenerationUsedCredits: usedCredits,
      providerCostUsd: Number(providerCostUsd.toFixed(6)),
      localReassemblies
    },
    lifecycle,
    checks,
    ads: adReports,
    generatedAt: new Date(now).toISOString()
  };
}

async function loadCampaignSnapshot(userId, campaignId) {
  const [campaignRows, engineRows, ads, scenes, generations, assets, creditTransactions] = await Promise.all([
    prisma.$queryRawUnsafe('SELECT * FROM "UGCCampaign" WHERE "id"=$1 AND "userId"=$2 LIMIT 1', campaignId, userId),
    prisma.$queryRawUnsafe('SELECT * FROM "UGCEngineProject" WHERE "campaignId"=$1 AND "userId"=$2 LIMIT 1', campaignId, userId),
    prisma.$queryRawUnsafe('SELECT * FROM "UGCAd" WHERE "campaignId"=$1 AND "userId"=$2 ORDER BY "sequence"', campaignId, userId),
    prisma.$queryRawUnsafe('SELECT s.* FROM "UGCScene" s JOIN "UGCAd" a ON a."id"=s."adId" WHERE a."campaignId"=$1 AND a."userId"=$2 ORDER BY a."sequence",s."sequence"', campaignId, userId),
    prisma.$queryRawUnsafe('SELECT g.* FROM "AiGeneration" g JOIN "UGCAd" a ON a."generationId"=g."id" WHERE a."campaignId"=$1 AND a."userId"=$2 ORDER BY a."sequence"', campaignId, userId),
    prisma.$queryRawUnsafe('SELECT m.* FROM "AgentAsset" m JOIN "UGCAd" a ON a."mediaAssetId"=m."id" WHERE a."campaignId"=$1 AND a."userId"=$2 ORDER BY a."sequence"', campaignId, userId),
    prisma.$queryRawUnsafe('SELECT t.* FROM "AiCreditTransaction" t JOIN "UGCAd" a ON a."generationId"=t."generationId" WHERE a."campaignId"=$1 AND a."userId"=$2 ORDER BY t."createdAt"', campaignId, userId)
  ]);
  return {
    campaign: campaignRows[0] || null,
    engine: engineRows[0] || null,
    ads,
    scenes,
    generations,
    assets,
    creditTransactions
  };
}

async function auditCampaign(userId, campaignId, options = {}) {
  const snapshot = await loadCampaignSnapshot(userId, campaignId);
  if (!snapshot.campaign) {
    const error = new Error('UGC campaign not found.');
    error.code = 'UGC_CAMPAIGN_NOT_FOUND';
    error.status = 404;
    throw error;
  }
  const report = evaluateCampaignSnapshot(snapshot);
  if (options.persist !== false && snapshot.engine) {
    const existingQc = parseJson(snapshot.engine.qcJson, {});
    const nextQc = {
      ...existingQc,
      productionAuditVersion: PRODUCTION_AUDIT_VERSION,
      productionAudit: report
    };
    await prisma.$executeRawUnsafe(
      'UPDATE "UGCEngineProject" SET "qcJson"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "campaignId"=$1 AND "userId"=$2',
      campaignId,
      userId,
      JSON.stringify(nextQc)
    ).catch(() => {});
  }
  return report;
}

async function operationsSummary(options = {}) {
  const limit = Math.max(1, Math.min(40, Number(options.limit || 20)));
  const [statusRows, queueRows, generationRows, recentCampaigns] = await Promise.all([
    prisma.$queryRawUnsafe('SELECT "status",COUNT(*)::int AS "count" FROM "UGCCampaign" WHERE "deletedAt" IS NULL GROUP BY "status"'),
    prisma.$queryRawUnsafe('SELECT "id","campaignId","userId","status","updatedAt","errorMessage" FROM "UGCAd" WHERE "status" IN (\'QUEUED\',\'RENDERING\',\'FAILED\') ORDER BY "updatedAt" ASC LIMIT 100'),
    prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS "count",COALESCE(SUM("reservedCredits"),0)::int AS "reservedCredits",COALESCE(SUM("creditsUsed"),0)::int AS "creditsUsed",COALESCE(SUM("providerCostUsd"),0)::float AS "providerCostUsd" FROM "AiGeneration" WHERE "contentType"=\'ugc_ad\' AND "createdAt" >= CURRENT_TIMESTAMP - INTERVAL \'30 days\''),
    prisma.$queryRawUnsafe('SELECT "id","userId","status","createdAt","updatedAt" FROM "UGCCampaign" WHERE "deletedAt" IS NULL ORDER BY "updatedAt" DESC LIMIT $1', limit)
  ]);

  const queue = queueRows || [];
  const stale = queue.filter(row => ['QUEUED','RENDERING'].includes(String(row.status)) && ageMs(row.updatedAt) > STALE_RENDER_MS);
  const audits = [];
  for (const campaign of recentCampaigns) {
    if (!['READY','PARTIAL','FAILED'].includes(String(campaign.status))) continue;
    try {
      const report = await auditCampaign(campaign.userId, campaign.id, { persist: true });
      if (report.status !== 'PASS') audits.push({
        campaignId: campaign.id,
        status: report.status,
        campaignStatus: report.campaignStatus,
        recommendedAction: report.recommendedAction,
        summary: report.summary
      });
    } catch (_) {}
    if (audits.length >= 10) break;
  }

  const generation = generationRows[0] || {};
  const statusCounts = Object.fromEntries((statusRows || []).map(row => [row.status, num(row.count)]));
  const failedQueue = queue.filter(row => String(row.status) === 'FAILED');
  const health = stale.length || audits.some(item => item.status === 'FAIL')
    ? 'DEGRADED'
    : (failedQueue.length || audits.length ? 'ATTENTION' : 'HEALTHY');

  return {
    version: PRODUCTION_AUDIT_VERSION,
    health,
    staleThresholdMs: STALE_RENDER_MS,
    campaignStatuses: statusCounts,
    queue: {
      queued: queue.filter(row => row.status === 'QUEUED').length,
      rendering: queue.filter(row => row.status === 'RENDERING').length,
      failedVisible: failedQueue.length,
      stale: stale.length,
      oldestActiveUpdatedAt: iso(queue.find(row => ['QUEUED','RENDERING'].includes(String(row.status)))?.updatedAt),
      staleItems: stale.slice(0, 10).map(row => ({
        adId: row.id,
        campaignId: row.campaignId,
        status: row.status,
        updatedAt: iso(row.updatedAt)
      }))
    },
    economics30d: {
      generationRows: num(generation.count),
      reservedCredits: num(generation.reservedCredits),
      creditsUsed: num(generation.creditsUsed),
      providerCostUsd: Number(num(generation.providerCostUsd).toFixed(6))
    },
    recentAuditIssues: audits,
    generatedAt: new Date().toISOString()
  };
}

function snapshot() {
  return {
    version: PRODUCTION_AUDIT_VERSION,
    domains: [
      'ENGINE_CONTRACT',
      'LIFECYCLE_STATUS',
      'RENDER_JOBS',
      'SCENES',
      'CREDITS',
      'PROVIDER_COST',
      'FINAL_QC',
      'MEDIA_LIBRARY',
      'PUBLISH_READINESS',
      'QUEUE_RECOVERY'
    ],
    staleRenderMs: STALE_RENDER_MS,
    runtime: runtimePolicy.snapshot(),
    policy: {
      immutablePlanningFingerprint: true,
      terminalCampaignsRequireTerminalAds: true,
      readyAdsRequirePublishableQC: true,
      readyAdsRequireMediaLibraryAsset: true,
      failedPaidGenerationsRequireRefund: true,
      zeroCreditReassemblyProtected: true
    }
  };
}

module.exports = {
  PRODUCTION_AUDIT_VERSION,
  STALE_RENDER_MS,
  evaluateCampaignSnapshot,
  loadCampaignSnapshot,
  auditCampaign,
  operationsSummary,
  snapshot
};
