const test = require('node:test');
const assert = require('node:assert/strict');

const formats = require('../src/services/ugcCreativeFormats');

test('Phase 5 creative format catalog is versioned and exposes the original format family', () => {
  assert.equal(formats.CREATIVE_FORMAT_VERSION, 'ugc-formats-v1');
  const keys = formats.publicCatalog().map(item => item.key);
  for (const key of ['AUTO','PROBLEM_SOLUTION','PRODUCT_DEMO','TESTIMONIAL','UNBOXING','REACTION','BEFORE_AFTER','STORYTIME','SPOKESPERSON','PRODUCT_FOCUSED']) {
    assert.ok(keys.includes(key), key);
  }
});

test('Auto format planning mixes only compatible structures', () => {
  const plan = formats.planCreativeFormats({
    requestedFormat: 'AUTO',
    resolvedType: 'AVATAR_EXPLAINER',
    variationCount: 5,
    sceneCount: 2,
    hasProductReference: false,
    verifiedClaims: ['Schedules approved social posts']
  });
  assert.equal(plan.mode, 'AUTO_MIX');
  assert.equal(plan.ads.length, 5);
  assert.ok(plan.formats.length > 1);
  assert.ok(plan.ads.every(ad => !['PRODUCT_DEMO','UNBOXING','PRODUCT_FOCUSED'].includes(ad.formatKey)));
  assert.ok(plan.ads.every(ad => ad.grammar.sceneBeats.length === 2));
});

test('Product demo and unboxing require a real product reference', () => {
  assert.throws(
    () => formats.planCreativeFormats({
      requestedFormat: 'PRODUCT_DEMO',
      resolvedType: 'PRODUCT_SHOWCASE',
      variationCount: 1,
      sceneCount: 2,
      hasProductReference: false,
      verifiedClaims: []
    }),
    error => error.code === 'UGC_CREATIVE_FORMAT_INCOMPATIBLE' && error.reasons.includes('PRODUCT_REFERENCE')
  );
  const plan = formats.planCreativeFormats({
    requestedFormat: 'UNBOXING',
    resolvedType: 'PRODUCT_SHOWCASE',
    variationCount: 1,
    sceneCount: 2,
    hasProductReference: true,
    verifiedClaims: []
  });
  assert.equal(plan.ads[0].formatKey, 'UNBOXING');
});

test('Before/after is blocked without verified transformation evidence', () => {
  assert.throws(
    () => formats.planCreativeFormats({
      requestedFormat: 'BEFORE_AFTER',
      resolvedType: 'AVATAR_EXPLAINER',
      variationCount: 1,
      sceneCount: 1,
      hasProductReference: false,
      verifiedClaims: ['A scheduling tool for social teams']
    }),
    error => error.code === 'UGC_CREATIVE_FORMAT_INCOMPATIBLE' && error.reasons.includes('VERIFIED_TRANSFORMATION')
  );
  const plan = formats.planCreativeFormats({
    requestedFormat: 'BEFORE_AFTER',
    resolvedType: 'AVATAR_EXPLAINER',
    variationCount: 1,
    sceneCount: 1,
    hasProductReference: false,
    verifiedClaims: ['Reduces manual scheduling time for approved workflows']
  });
  assert.equal(plan.ads[0].evidence.verifiedTransformation, true);
});

test('Testimonial-style grammar explicitly forbids fabricated personal experience', () => {
  const plan = formats.planCreativeFormats({
    requestedFormat: 'TESTIMONIAL',
    resolvedType: 'AVATAR_EXPLAINER',
    variationCount: 1,
    sceneCount: 1,
    hasProductReference: false,
    verifiedClaims: []
  });
  assert.ok(plan.ads[0].grammar.rules.includes('NO_FAKE_TESTIMONIAL'));
  assert.ok(plan.ads[0].grammar.rules.includes('NO_FALSE_FIRST_PERSON_USE'));
});

test('Creative beats are distributed across the real scene count without losing order', () => {
  const source = ['HOOK','PROBLEM','SOLUTION','PROOF','CTA'];
  const groups = formats.distributeBeats(source, 2);
  assert.deepEqual(groups.flat(), source);
  assert.deepEqual(groups[0], ['HOOK','PROBLEM','SOLUTION']);
  assert.deepEqual(groups[1], ['PROOF','CTA']);
});

test('Format snapshot is provider agnostic', () => {
  const snapshot = JSON.stringify(formats.formatSnapshot());
  assert.doesNotMatch(snapshot, /hailuo|kling|seedance|omnihuman|runware/i);
  assert.match(snapshot, /VERIFIED_TRANSFORMATION_REQUIRED/);
});
