const test = require('node:test');
const assert = require('node:assert/strict');

const audit = require('../src/services/ugcProductionAuditService');

function baseSnapshot(overrides = {}) {
  const now = new Date('2026-09-24T10:00:00.000Z');
  const campaign = {
    id: 'c1', userId: 'u1', status: 'READY', adCount: 1, totalCredits: 100,
    quality: 'STANDARD', duration: 15, updatedAt: now
  };
  const engine = {
    campaignId: 'c1', userId: 'u1', status: 'READY',
    engineVersion: 'ugc-engine-v1', contractVersion: '1.3',
    skillsVersion: 'ugc-skills-v1', routerVersion: 'ugc-router-v1',
    briefJson: JSON.stringify({ sourceType: 'WEBSITE' }),
    actorJson: JSON.stringify({ assignments: [{ adSequence: 1, avatarId: 'av1' }] }),
    skillsJson: JSON.stringify({ brand: { status: 'READY' } }),
    productionPlanJson: JSON.stringify({ ads: [{ sequence: 1 }] }),
    routerJson: JSON.stringify({ mode: 'adaptive' }),
    pricingJson: JSON.stringify({ totalCredits: 100 }),
    renderJobsJson: JSON.stringify([{ adSequence: 1, adId: 'a1', generationId: 'g1', status: 'READY' }])
  };
  const ads = [{
    id: 'a1', campaignId: 'c1', userId: 'u1', sequence: 1, status: 'READY',
    generationId: 'g1', mediaAssetId: 'm1', credits: 100, duration: 15,
    updatedAt: now, errorMessage: null
  }];
  const scenes = [{
    id: 's1', adId: 'a1', sequence: 1, status: 'READY', duration: 15,
    videoStorageKey: 'ugc/scene.mp4', videoStorageProvider: 'R2'
  }];
  const generations = [{
    id: 'g1', userId: 'u1', status: 'COMPLETED', provider: 'runware',
    reservedCredits: 100, creditsUsed: 100, providerCostUsd: 0.42,
    requestJson: JSON.stringify({ ugcAdId: 'a1' })
  }];
  const assets = [{
    id: 'm1', userId: 'u1', kind: 'AI_VIDEO', mimeType: 'video/mp4', status: 'READY'
  }];
  const creditTransactions = [{
    id: 't1', generationId: 'g1', type: 'GENERATION_DEBIT', reference: 'debit:g1'
  }];
  return {
    campaign, engine, ads, scenes, generations, assets, creditTransactions,
    now,
    ...overrides
  };
}

test('Phase 8 production audit is versioned and declares full production domains', () => {
  assert.equal(audit.PRODUCTION_AUDIT_VERSION, 'ugc-production-audit-v1');
  const snapshot = audit.snapshot();
  assert.equal(snapshot.policy.readyAdsRequirePublishableQC, true);
  assert.equal(snapshot.policy.failedPaidGenerationsRequireRefund, true);
  assert.equal(snapshot.policy.zeroCreditReassemblyProtected, true);
  assert.ok(snapshot.domains.includes('MEDIA_LIBRARY'));
  assert.ok(snapshot.domains.includes('QUEUE_RECOVERY'));
});

test('A fully consistent ready campaign passes end-to-end audit', () => {
  const report = audit.evaluateCampaignSnapshot(baseSnapshot());
  assert.equal(report.status, 'PASS');
  assert.equal(report.recommendedAction, 'NONE');
  assert.equal(report.summary.publishableAds, 1);
  assert.equal(report.summary.currentGenerationUsedCredits, 100);
  assert.equal(report.summary.providerCostUsd, 0.42);
  assert.equal(report.lifecycle.at(-1).stage, 'PUBLISH_READY');
  assert.equal(report.lifecycle.at(-1).status, 'COMPLETE');
});

test('Ready ad without Media Library asset fails production audit', () => {
  const snapshot = baseSnapshot();
  snapshot.assets = [];
  const report = audit.evaluateCampaignSnapshot(snapshot);
  assert.equal(report.status, 'FAIL');
  const ad = report.ads[0];
  assert.equal(ad.checks.find(item => item.id === 'MEDIA_LIBRARY_LINK').status, 'FAIL');
  assert.equal(report.recommendedAction, 'INVESTIGATE_INVARIANTS');
});

test('Failed paid generation requires a recorded refund after debit', () => {
  const snapshot = baseSnapshot();
  snapshot.campaign.status = 'FAILED';
  snapshot.engine.status = 'FAILED';
  snapshot.ads[0] = { ...snapshot.ads[0], status: 'FAILED', mediaAssetId: null, errorMessage: 'provider failed' };
  snapshot.scenes[0] = { ...snapshot.scenes[0], status: 'FAILED', videoStorageKey: null, errorMessage: 'provider failed' };
  snapshot.generations[0] = { ...snapshot.generations[0], status: 'FAILED', creditsUsed: 0 };
  snapshot.assets = [];
  snapshot.creditTransactions = [{ generationId: 'g1', type: 'GENERATION_DEBIT', reference: 'debit:g1' }];

  const broken = audit.evaluateCampaignSnapshot(snapshot);
  assert.equal(broken.status, 'FAIL');
  assert.equal(broken.ads[0].checks.find(item => item.id === 'FAILED_CREDIT_REFUND').status, 'FAIL');

  snapshot.creditTransactions.push({ generationId: 'g1', type: 'GENERATION_REFUND', reference: 'refund:g1' });
  const reconciled = audit.evaluateCampaignSnapshot(snapshot);
  assert.equal(reconciled.ads[0].checks.find(item => item.id === 'FAILED_CREDIT_REFUND').status, 'PASS');
  assert.equal(reconciled.recommendedAction, 'RECOVER_OUTPUTS');
});

test('Zero-credit reassembly stays separate from paid generation credits', () => {
  const snapshot = baseSnapshot();
  snapshot.generations[0] = {
    ...snapshot.generations[0],
    provider: 'local',
    reservedCredits: 0,
    creditsUsed: 0,
    providerCostUsd: 0,
    requestJson: JSON.stringify({ ugcAdId: 'a1', reassembly: true })
  };
  snapshot.creditTransactions = [];
  const report = audit.evaluateCampaignSnapshot(snapshot);
  const check = report.ads[0].checks.find(item => item.id === 'ZERO_CREDIT_REASSEMBLY');
  assert.equal(check.status, 'PASS');
  assert.equal(report.summary.localReassemblies, 1);
});

test('Stale active render is visible as an operational warning', () => {
  const snapshot = baseSnapshot();
  snapshot.campaign.status = 'RENDERING';
  snapshot.engine.status = 'RENDERING';
  snapshot.ads[0] = {
    ...snapshot.ads[0],
    status: 'RENDERING',
    mediaAssetId: null,
    updatedAt: new Date('2026-09-24T09:50:00.000Z')
  };
  snapshot.generations[0] = { ...snapshot.generations[0], status: 'PROCESSING', creditsUsed: 0 };
  snapshot.assets = [];
  snapshot.now = new Date('2026-09-24T10:00:00.000Z');

  const report = audit.evaluateCampaignSnapshot(snapshot);
  assert.equal(report.status, 'WARN');
  assert.equal(report.summary.staleAds, 1);
  assert.equal(report.recommendedAction, 'CHECK_STALE_QUEUE');
});

test('Terminal campaign cannot retain a rendering variation', () => {
  const snapshot = baseSnapshot();
  snapshot.ads[0] = { ...snapshot.ads[0], status: 'RENDERING', mediaAssetId: null };
  snapshot.assets = [];
  const report = audit.evaluateCampaignSnapshot(snapshot);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.checks.find(item => item.id === 'TERMINAL_AD_STATES').status, 'FAIL');
});
