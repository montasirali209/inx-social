const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STANDARD_CREDITS,
  PREMIUM_CREDITS,
  AVATAR_CREDITS,
  SYSTEM_AVATAR_COUNT,
  avatarSeeds,
  creditsPerAd,
  splitDurations,
  splitScriptByDurations
} = require('../src/services/ugcStudioService');

test('UGC Studio launch pricing is deliberate and duration based', () => {
  assert.deepEqual(STANDARD_CREDITS, { 15: 75, 30: 150, 60: 300 });
  assert.deepEqual(PREMIUM_CREDITS, { 15: 250, 30: 500, 60: 1000 });
  assert.equal(AVATAR_CREDITS, 5);
  assert.equal(creditsPerAd(15, 'STANDARD'), 75);
  assert.equal(creditsPerAd(30, 'STANDARD'), 150);
  assert.equal(creditsPerAd(60, 'STANDARD'), 300);
  assert.equal(creditsPerAd(15, 'PREMIUM'), 250);
  assert.equal(creditsPerAd(30, 'PREMIUM'), 500);
  assert.equal(creditsPerAd(60, 'PREMIUM'), 1000);
});

test('UGC Studio launches with at least 50 reusable system creators', () => {
  assert.equal(SYSTEM_AVATAR_COUNT, 52);
  assert.equal(avatarSeeds.length, 52);
  assert.equal(new Set(avatarSeeds.map((avatar) => avatar.slug)).size, avatarSeeds.length);
});

test('P-Video scene splitting keeps every segment at or below 20 seconds', () => {
  assert.deepEqual(splitDurations(15, 20), [15]);
  assert.deepEqual(splitDurations(30, 20), [15, 15]);
  assert.deepEqual(splitDurations(60, 20), [20, 20, 20]);
  for (const total of [15, 30, 60]) {
    const parts = splitDurations(total, 20);
    assert.equal(parts.reduce((sum, value) => sum + value, 0), total);
    assert.ok(parts.every((value) => value <= 20));
  }
});

test('Premium scene splitting keeps every segment at or below 15 seconds', () => {
  for (const total of [15, 30, 60]) {
    const parts = splitDurations(total, 15);
    assert.equal(parts.reduce((sum, value) => sum + value, 0), total);
    assert.ok(parts.every((value) => value <= 15));
  }
});

test('script distribution preserves all words across scene durations', () => {
  const script = 'one two three four five six seven eight nine ten eleven twelve';
  const parts = splitScriptByDurations(script, [10, 10, 10]);
  assert.equal(parts.join(' '), script);
  assert.equal(parts.length, 3);
});
