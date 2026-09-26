const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateGenerationCost, validateGenerationRequest, fallbackCopy } = require('../src/services/aiContentStudioService');
const { customerPlan, refundableReservationAmounts } = require('../src/services/aiCreditService');
const { planDefinition } = require('../src/services/stripeService');
const { normalizeModelId } = require('../src/services/runwareService');

test('AI Content Studio keeps the launch credit schedule', () => {
  assert.equal(estimateGenerationCost({ type: 'image_post', options: { variants: 1 } }), 5);
  assert.equal(estimateGenerationCost({ type: 'image_post', options: { variants: 4 } }), 20);

  assert.equal(estimateGenerationCost({ type: 'carousel_post', options: { slides: 3 } }), 10);
  assert.equal(estimateGenerationCost({ type: 'carousel_post', options: { slides: 5 } }), 10);
  assert.equal(estimateGenerationCost({ type: 'carousel_post', options: { slides: 6 } }), 15);
  assert.equal(estimateGenerationCost({ type: 'carousel_post', options: { slides: 8 } }), 15);
  assert.equal(estimateGenerationCost({ type: 'carousel_post', options: { slides: 9 } }), 20);
  assert.equal(estimateGenerationCost({ type: 'carousel_post', options: { slides: 10 } }), 20);

  assert.throws(
    () => estimateGenerationCost({ type: 'short_video', options: { duration: 5 } }),
    error => error.code === 'AI_STUDIO_LEGACY_PRICING_RETIRED' && /AI Video Studio/.test(error.message)
  );
  assert.throws(
    () => estimateGenerationCost({ type: 'ugc_ad', options: { duration: 20 } }),
    error => error.code === 'AI_STUDIO_LEGACY_PRICING_RETIRED' && /UGC Studio/.test(error.message)
  );
});

test('Studio validates core requests before spending provider money', () => {
  assert.doesNotThrow(() => validateGenerationRequest({
    type: 'image_post',
    prompt: 'Create a modern launch graphic for INXSocial.',
    platform: 'Facebook',
    aspectRatio: '4:5',
    options: { variants: 1 }
  }));

  assert.throws(() => validateGenerationRequest({
    type: 'short_video',
    prompt: 'Create a product reveal.',
    aspectRatio: '9:16',
    options: { duration: 10 }
  }), error => error.code === 'AI_STUDIO_LEGACY_GENERATOR_RETIRED' && /AI Video Studio/.test(error.message));

  assert.throws(() => validateGenerationRequest({
    type: 'ugc_ad',
    prompt: 'INXSocial: promote the scheduler',
    aspectRatio: '9:16',
    options: { duration: 20 }
  }), error => error.code === 'AI_STUDIO_LEGACY_GENERATOR_RETIRED' && /UGC Studio/.test(error.message));
});

test('copy fallback preserves media generation inputs when helper AI is unavailable', () => {
  const image = fallbackCopy({ type: 'image_post', prompt: 'A premium social scheduler launch visual', options: {} });
  assert.equal(image.visualPrompt, 'A premium social scheduler launch visual');
  assert.deepEqual(image.hashtags, []);

  const carousel = fallbackCopy({ type: 'carousel_post', prompt: 'Five scheduling tips', options: { slides: 5 } });
  assert.equal(carousel.slides.length, 5);
  assert.match(carousel.slides[0].visualPrompt, /Five scheduling tips/);
});

test('Runware text model aliases normalize to the supported AIR model id', () => {
  assert.equal(normalizeModelId('openai-gpt-5-4-nano'), 'openai:gpt@5.4-nano');
  assert.equal(normalizeModelId('runware:400@4'), 'runware:400@4');
});

test('legacy and current Stripe plan ids map to the new customer-facing plan ladder', () => {
  assert.equal(customerPlan('TRIAL', 'USER'), 'trial');
  assert.equal(customerPlan('STARTER', 'USER'), 'creator');
  assert.equal(customerPlan('CREATOR', 'USER'), 'creator');
  assert.equal(customerPlan('PRO', 'USER'), 'pro');
  assert.equal(customerPlan('PLUS', 'USER'), 'pro');
  assert.equal(customerPlan('LIFETIME', 'USER'), 'pro');
  assert.equal(customerPlan('BUSINESS', 'USER'), 'business');
  assert.equal(customerPlan('AGENCY', 'USER'), 'agency');
  assert.equal(customerPlan('TRIAL', 'ADMIN'), 'agency');
});


test('Stripe plan definitions and published AI allowances stay aligned', () => {
  assert.equal(planDefinition('CREATOR').price, 18.99);
  assert.equal(planDefinition('CREATOR').aiCredits, 300);
  assert.equal(planDefinition('PRO').price, 34.99);
  assert.equal(planDefinition('PRO').aiCredits, 900);
  assert.equal(planDefinition('BUSINESS').price, 59.99);
  assert.equal(planDefinition('BUSINESS').aiCredits, 2000);
  assert.equal(planDefinition('AGENCY').price, 99.99);
  assert.equal(planDefinition('AGENCY').aiCredits, 4000);
});

test('generation refunds never carry expired monthly credits into a new billing period', () => {
  const wallet = {
    monthlyBalance: 500,
    monthlyLimit: 500,
    topupBalance: 40,
    periodStart: new Date('2026-09-01T00:00:00.000Z')
  };
  const generation = {
    reservedMonthly: 100,
    reservedTopup: 20,
    createdAt: new Date('2026-08-31T22:00:00.000Z')
  };
  const debit = { createdAt: new Date('2026-08-31T22:00:00.000Z') };
  assert.deepEqual(refundableReservationAmounts(generation, debit, wallet), {
    monthly: 0,
    topup: 20,
    unrestoredMonthly: 100,
    sameBillingPeriod: false
  });
});

test('same-period refunds restore the original buckets without exceeding the monthly allowance', () => {
  const wallet = {
    monthlyBalance: 420,
    monthlyLimit: 500,
    topupBalance: 0,
    periodStart: new Date('2026-09-01T00:00:00.000Z')
  };
  const generation = {
    reservedMonthly: 100,
    reservedTopup: 25,
    createdAt: new Date('2026-09-10T12:00:00.000Z')
  };
  const debit = { createdAt: new Date('2026-09-10T12:00:00.000Z') };
  assert.deepEqual(refundableReservationAmounts(generation, debit, wallet), {
    monthly: 80,
    topup: 25,
    unrestoredMonthly: 20,
    sameBillingPeriod: true
  });
});
