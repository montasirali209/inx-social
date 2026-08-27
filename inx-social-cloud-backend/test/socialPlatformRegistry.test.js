const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../src/services/socialPlatformRegistry');

test('platform registry exposes Facebook live and future connectors honestly', () => {
  const platforms = registry.listPlatforms();
  assert.deepEqual(platforms.map(platform => platform.code), ['facebook', 'instagram', 'threads', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'x']);
  assert.equal(registry.getPlatform('facebook').availability, 'LIVE');
  assert.equal(platforms.filter(platform => platform.availability === 'LIVE').length, 1);
  assert.ok(platforms.filter(platform => platform.availability === 'PLANNED').every(platform => platform.code !== 'facebook'));
});

test('callers cannot mutate registry definitions', () => {
  const first = registry.getPlatform('facebook');
  first.capabilities.analytics = false;
  assert.equal(registry.getPlatform('facebook').capabilities.analytics, true);
  assert.equal(registry.getPlatform('unknown'), null);
});
