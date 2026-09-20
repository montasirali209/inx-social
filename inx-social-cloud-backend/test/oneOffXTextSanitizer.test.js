const assert = require('node:assert/strict');
const test = require('node:test');

const {
  sanitizeXText,
  removeHashtagTokens,
  keepFirstEmojiOnly,
  splitIntoRecentBatches
} = require('../src/services/oneOffXTextSanitizer');

test('X cleanup removes hashtag tokens while preserving URLs, wording and line breaks', () => {
  const input = 'Building something useful today 🚀\n\nRead more: https://example.com/#features\n#SaaS #BuildInPublic';
  const output = sanitizeXText(input);
  assert.equal(output, 'Building something useful today 🚀\n\nRead more: https://example.com/#features');
});

test('X cleanup keeps at most the first emoji grapheme', () => {
  const input = 'Launch day 🚀 This is exciting 🎉🔥';
  const output = keepFirstEmojiOnly(input);
  assert.equal(output, 'Launch day 🚀 This is exciting ');
  assert.equal(sanitizeXText(input), 'Launch day 🚀 This is exciting');
});

test('X cleanup does not treat URL fragments as hashtags', () => {
  assert.equal(removeHashtagTokens('Docs https://example.com/#pricing #startup'), 'Docs https://example.com/#pricing');
});

test('recent batches split on large creation gaps', () => {
  const row = (minute) => ({
    content: { userId: 'user-1' },
    profileId: 'profile-x',
    createdAt: new Date(Date.UTC(2026, 8, 20, 10, minute))
  });
  const batches = splitIntoRecentBatches([row(0), row(5), row(45)]);
  assert.equal(batches.length, 2);
  assert.deepEqual(batches.map(batch => batch.rows.length).sort(), [1, 2]);
});
