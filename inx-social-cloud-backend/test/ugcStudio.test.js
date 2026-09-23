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
  splitScriptByDurations,
  narratorVoice,
  narratorLanguage,
  narratorSpeed,
  captionsForScenes
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


test('UGC narrator locks legacy and presentation voices to one consistent TTS identity', () => {
  assert.equal(narratorVoice('Puck (Male)', { presentation: 'Man' }), 'Callum');
  assert.equal(narratorVoice('Aoede (Female)', { presentation: 'Woman' }), 'Pippa');
  assert.equal(narratorVoice('', { presentation: 'Man' }), 'Callum');
  assert.equal(narratorVoice('', { presentation: 'Woman' }), 'Pippa');
  assert.equal(narratorVoice('Arjun', { presentation: 'Man' }), 'Arjun');
  assert.equal(narratorLanguage('en-GB'), 'en');
  assert.equal(narratorLanguage('es-ES'), 'es');
  assert.ok(narratorSpeed('one two three four five six seven eight nine ten', 5) >= 0.7);
});

test('UGC captions emit valid SRT timestamp rows', () => {
  const srt = captionsForScenes([{ duration: 5, script: 'one two three four five six' }]);
  assert.match(srt, /00:00:00,000 --> 00:00:05,000/);
  assert.doesNotMatch(srt, /00:00:00,000\n--> /);
});
