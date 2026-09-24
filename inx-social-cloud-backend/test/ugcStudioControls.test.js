const test = require('node:test');
const assert = require('node:assert/strict');

const controls = require('../src/services/ugcStudioControls');

const pricing = {
  STANDARD: { 15: 100, 20: 140, 30: 210 },
  PREMIUM: { 15: 180, 20: 260, 30: 390 }
};

test('Phase 6 Studio controls are versioned and customer-facing', () => {
  assert.equal(controls.STUDIO_CONTROLS_VERSION, 'ugc-studio-controls-v1');
  const snapshot = controls.snapshot(pricing);
  assert.equal(snapshot.version, 'ugc-studio-controls-v1');
  assert.equal(snapshot.qualityTiers.length, 2);
  assert.equal(snapshot.rules.modelNamesVisibleToCustomer, false);
  assert.equal(snapshot.rules.quoteBeforeGeneration, true);
  assert.equal(snapshot.rules.explicitCreditConfirmation, true);
  assert.doesNotMatch(JSON.stringify(snapshot), /hailuo|kling|seedance|omnihuman|runware|minimax|bytedance/i);
});

test('Phase 6 quote preserves the fixed pricing policy', () => {
  const quote = controls.quote({
    input: { duration: 20, adCount: 5, quality: 'STANDARD', campaignType: 'AUTO', creativeFormat: 'AUTO' },
    balanceRemaining: 1000,
    pricing
  });
  assert.equal(quote.perAd, 140);
  assert.equal(quote.credits, 700);
  assert.equal(quote.affordability.balanceBefore, 1000);
  assert.equal(quote.affordability.balanceAfter, 300);
  assert.equal(quote.pricing.policy, 'UGC_FIXED_V1');
  assert.equal(quote.pricing.formatAffectsPrice, false);
  assert.equal(quote.pricing.creatorSelectionAffectsPrice, false);
});

test('Phase 6 quote reports shortfall and an affordable alternative without spending credits', () => {
  const quote = controls.quote({
    input: { duration: 30, adCount: 10, quality: 'PREMIUM', campaignType: 'PRODUCT_SHOWCASE', creativeFormat: 'PRODUCT_DEMO' },
    balanceRemaining: 600,
    pricing
  });
  assert.equal(quote.affordability.affordable, false);
  assert.equal(quote.affordability.shortfall, 3300);
  assert.equal(quote.affordability.balanceAfter, 600);
  assert.ok(quote.affordability.alternative);
  assert.ok(quote.affordability.alternative.credits <= 600);
});

test('Phase 6 selection validation rejects unsupported controls before quoting', () => {
  assert.throws(
    () => controls.quote({ input: { duration: 12, adCount: 5, quality: 'STANDARD' }, balanceRemaining: 500, pricing }),
    error => error.code === 'UGC_DURATION_UNSUPPORTED'
  );
  assert.throws(
    () => controls.quote({ input: { duration: 15, adCount: 2, quality: 'STANDARD' }, balanceRemaining: 500, pricing }),
    error => error.code === 'UGC_AD_COUNT_UNSUPPORTED'
  );
  assert.throws(
    () => controls.quote({ input: { duration: 15, adCount: 1, quality: 'ULTRA' }, balanceRemaining: 500, pricing }),
    error => error.code === 'UGC_QUALITY_UNSUPPORTED'
  );
});

test('Phase 6 exposes descriptive duration and variation guidance', () => {
  const snapshot = controls.snapshot(pricing);
  assert.deepEqual(snapshot.durations.map(item => item.seconds), [15, 20, 30]);
  assert.deepEqual(snapshot.variationCounts.map(item => item.count), [1, 5, 10, 15, 20]);
  assert.match(snapshot.durations.find(item => item.seconds === 20).description, /proof/i);
  assert.match(snapshot.variationCounts.find(item => item.count === 5).description, /hooks|structures/i);
});
