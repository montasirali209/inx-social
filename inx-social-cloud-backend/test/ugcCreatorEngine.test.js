const test = require('node:test');
const assert = require('node:assert/strict');

const creators = require('../src/services/ugcCreatorEngine');

test('Phase 4 creator profiles are versioned and retain persistent production compatibility', () => {
  const profile = creators.buildProfile({
    category: 'SaaS',
    presentation: 'Woman',
    ageBand: '25–34',
    locale: 'en-GB',
    environment: 'home office with laptop'
  });
  assert.equal(profile.version, 'ugc-creators-v2');
  assert.equal(profile.accent, 'British');
  assert.ok(profile.niches.includes('SaaS'));
  assert.ok(profile.environments.some(value => /home office/i.test(value)));
  assert.ok(profile.routeCompatibility.includes('H3_MAX_STANDARD_V1'));
  assert.ok(profile.routeCompatibility.includes('OMNIHUMAN_CREATOR_V1'));
  assert.equal(profile.referencePolicy.regeneration, 'REPAIR_ONCE_NOT_PER_CAMPAIGN');
});

test('Creator V2 scoring prefers niche relevance and compatible routes', () => {
  const business = {
    id: 'business', scope: 'SYSTEM', category: 'Business', presentation: 'Woman', ageBand: '25–34',
    locale: 'en-GB', environment: 'home office with laptop', referenceStorageKey: 'ready'
  };
  const lifestyle = {
    id: 'lifestyle', scope: 'SYSTEM', category: 'Lifestyle', presentation: 'Woman', ageBand: '25–34',
    locale: 'en-GB', environment: 'bright living room', referenceStorageKey: 'ready'
  };
  const desired = { category: 'Business', locale: 'en-GB', environment: 'office laptop', niches: ['Productivity'] };
  const businessScore = creators.scoreCreator(business, desired, { quality: 'PREMIUM' });
  const lifestyleScore = creators.scoreCreator(lifestyle, desired, { quality: 'PREMIUM' });
  assert.ok(businessScore.score > lifestyleScore.score);
  assert.ok(businessScore.reasons.includes('CATEGORY'));
  assert.ok(businessScore.reasons.includes('ROUTE_COMPATIBILITY'));
});

test('Creator V2 quality route requirements keep Standard and Premium model families explicit', () => {
  assert.deepEqual(creators.requiredRoutesForQuality('STANDARD'), ['H3_MAX_STANDARD_V1']);
  assert.deepEqual(creators.requiredRoutesForQuality('PREMIUM'), [
    'OMNIHUMAN_CREATOR_V1',
    'H3_MAX_STANDARD_V1'
  ]);
});

test('Creator V2 actor snapshots contain casting and reference provenance', () => {
  const snapshot = creators.actorSnapshot({
    id: 'creator-1', scope: 'USER', name: 'Saved Creator', category: 'Tech',
    presentation: 'Man', ageBand: '25–34', locale: 'en-GB', voice: 'Callum',
    referenceVersion: 4, referenceStorageKey: 'master', referenceQualityStatus: 'READY',
    referenceQualityScore: 96
  });
  assert.equal(snapshot.creatorVersion, 'ugc-creators-v2');
  assert.equal(snapshot.id, 'creator-1');
  assert.equal(snapshot.referenceVersion, 4);
  assert.equal(snapshot.referenceQualityStatus, 'READY');
  assert.equal(snapshot.referenceQualityScore, 96);
  assert.ok(snapshot.niches.length > 0);
  assert.ok(snapshot.routeCompatibility.length >= 4);
});

test('Creator V2 reference summary separates persistent master and alternate references', () => {
  const summary = creators.referenceSummary({
    referenceStorageKey: 'master',
    referenceVersion: 3,
    referenceQualityStatus: 'READY',
    referenceQualityScore: 100,
    alternateReferenceCount: 2
  });
  assert.equal(summary.master.ready, true);
  assert.equal(summary.alternateCount, 2);
  assert.equal(summary.policy, 'PERSISTENT_REUSE');
});
