const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateGenerationCost, validateGenerationRequest, fallbackCopy } = require('../src/services/aiContentStudioService');
const { customerPlan } = require('../src/services/aiCreditService');
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

  assert.equal(estimateGenerationCost({ type: 'short_video', options: { duration: 5 } }), 15);
  assert.equal(estimateGenerationCost({ type: 'short_video', options: { duration: 10 } }), 25);
  assert.throws(() => estimateGenerationCost({ type: 'short_video', options: { duration: 15 } }), /5 or 10 seconds/);

  assert.equal(estimateGenerationCost({ type: 'ugc_ad', options: { duration: 5 } }), 25);
  assert.equal(estimateGenerationCost({ type: 'ugc_ad', options: { duration: 10 } }), 25);
  assert.throws(() => estimateGenerationCost({ type: 'ugc_ad', options: { duration: 15 } }), /5 or 10 seconds/);
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
    options: { duration: 15 }
  }), /5 or 10 seconds/);

  assert.throws(() => validateGenerationRequest({
    type: 'ugc_ad',
    prompt: 'INXSocial: promote the scheduler',
    aspectRatio: '9:16',
    options: { duration: 10, productName: '', productDescription: '' }
  }), /product or service name/);
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

test('legacy Stripe plan ids map to the customer-facing Pro and Plus plans', () => {
  assert.equal(customerPlan('TRIAL', 'USER'), 'trial');
  assert.equal(customerPlan('STARTER', 'USER'), 'pro');
  assert.equal(customerPlan('PRO', 'USER'), 'plus');
  assert.equal(customerPlan('PLUS', 'USER'), 'plus');
  assert.equal(customerPlan('LIFETIME', 'USER'), 'plus');
  assert.equal(customerPlan('TRIAL', 'ADMIN'), 'plus');
});
