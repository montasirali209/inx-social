const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateGenerationCost } = require('../src/services/aiContentStudioService');
const { customerPlan } = require('../src/services/aiCreditService');

test('AI Content Studio uses the approved fixed credit schedule', () => {
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
  assert.equal(estimateGenerationCost({ type: 'short_video', options: { duration: 15 } }), 35);

  assert.equal(estimateGenerationCost({ type: 'ugc_ad', options: { duration: 10 } }), 25);
  assert.equal(estimateGenerationCost({ type: 'ugc_ad', options: { duration: 15 } }), 50);
});

test('legacy Stripe plan ids map to the customer-facing Pro and Plus plans', () => {
  assert.equal(customerPlan('TRIAL', 'USER'), 'trial');
  assert.equal(customerPlan('STARTER', 'USER'), 'pro');
  assert.equal(customerPlan('PRO', 'USER'), 'plus');
  assert.equal(customerPlan('PLUS', 'USER'), 'plus');
  assert.equal(customerPlan('LIFETIME', 'USER'), 'plus');
  assert.equal(customerPlan('TRIAL', 'ADMIN'), 'plus');
});
