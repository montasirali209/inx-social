const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/services/socialConnectionService.js'), 'utf8');

test('connected YouTube channels are marked analytics-capable after Analytics scope grant', () => {
  assert.match(source, /yt-analytics\.readonly/);
  assert.match(source, /platform: 'youtube'[\s\S]*?capabilitiesJson: JSON\.stringify\(\{ identity: true, publish: false, analytics: true, readonly: true \}\)/);
});
