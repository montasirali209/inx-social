const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../src/services/socialPlatformRegistry');

test('platform registry distinguishes live publishing, account linking, and planned connectors', () => {
  const platforms = registry.listPlatforms();
  assert.deepEqual(platforms.map(platform => platform.code), ['facebook', 'instagram', 'threads', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'x']);
  assert.equal(registry.getPlatform('facebook').availability, 'LIVE');
  assert.equal(platforms.filter(platform => platform.availability === 'LIVE').length, 1);
  assert.deepEqual(
    platforms.filter(platform => platform.availability === 'CONNECT_ONLY').map(platform => platform.code),
    ['instagram', 'linkedin', 'youtube']
  );
  assert.deepEqual(
    platforms.filter(platform => platform.availability === 'PLANNED').map(platform => platform.code),
    ['threads', 'tiktok', 'pinterest', 'x']
  );
});

test('callers cannot mutate registry definitions', () => {
  const first = registry.getPlatform('facebook');
  first.capabilities.analytics = false;
  assert.equal(registry.getPlatform('facebook').capabilities.analytics, true);
  assert.equal(registry.getPlatform('unknown'), null);
});
