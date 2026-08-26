const assert = require('node:assert/strict');
const test = require('node:test');
const intelligence = require('../src/services/socialManagerIntelligence');

test('short human social-manager commands receive permanent professional intelligence', () => {
  const prompt = 'Create and schedule a post for my Facebook Page';
  assert.equal(intelligence.isSimpleManagerCommand(prompt), true);
  assert.equal(intelligence.requiresResearch(prompt), true);
  assert.equal(intelligence.generationPreference(prompt), 'QUALITY');
  const rules = intelligence.playbookForTask('IMAGE_GENERATION').join(' ');
  assert.match(rules, /connected Page/i);
  assert.match(rules, /competitor analysis/i);
  assert.match(rules, /social search/i);
  assert.match(rules, /Page profile picture/i);
  assert.match(rules, /fake dashboards/i);
});
