const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('YouTube refresh failure returns a reconnect contract instead of raw provider credentials error', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/services/youtubeTokenService.js'), 'utf8');
  assert.match(source, /YOUTUBE_RECONNECT_REQUIRED/);
  assert.match(source, /Reconnect YouTube to restore analytics access/);
  assert.doesNotMatch(source, /developers\.google\.com\/identity\/sign-in\/web\/devconsole-project/);
});
