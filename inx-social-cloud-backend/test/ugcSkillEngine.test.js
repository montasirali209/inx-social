const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SKILLS_VERSION,
  SCRIPT_BUDGETS,
  brandUnderstandingSkill,
  creatorCastingSkill,
  scriptTimingSpec,
  scriptTimingSkill,
  scenePlanningSkill,
  creatorConsistencySkill,
  voiceConsistencySkill,
  productFidelitySkill,
  naturalMotionSkill,
  cameraStyleSkill,
  adFinishingSkill,
  qualityControlSkill,
  compileScenePrompt,
  splitScriptByWeightedDuration
} = require('../src/services/ugcSkillEngine');

function creators() {
  return [
    { id: 'maya', name: 'Maya', category: 'Lifestyle', presentation: 'Woman', ageBand: '25–34', locale: 'en-GB', voice: 'Pippa', environment: 'bright lived-in apartment lounge' },
    { id: 'priya', name: 'Priya', category: 'Business', presentation: 'Woman', ageBand: '25–34', locale: 'en-GB', voice: 'Priya', environment: 'real home office with laptop and books' },
    { id: 'daniel', name: 'Daniel', category: 'Tech', presentation: 'Man', ageBand: '25–34', locale: 'en-GB', voice: 'Callum', environment: 'real home-office desk setup with laptop and monitor' }
  ];
}

test('Phase 2 skills are versioned and script timing budgets are explicit', () => {
  assert.equal(SKILLS_VERSION, 'ugc-skills-v1');
  assert.deepEqual(Object.keys(SCRIPT_BUDGETS).map(Number), [20,30,45,60]);
  assert.equal(scriptTimingSpec(20).hardMax, 52);
  assert.equal(scriptTimingSpec(30).closingRule, 'SPEECH_FINISHES_BEFORE_CUT');
});

test('brand understanding skill stores only evidence-grounded creative inputs', () => {
  const result = brandUnderstandingSkill({
    input: { sourceType: 'WEBSITE', productDescription: '' },
    brand: {
      name: 'INX',
      productName: 'Planner',
      summary: 'A scheduling tool.',
      audience: ['creators'],
      verifiedClaims: ['Schedules social posts'],
      analysis: { offerType: 'SOFTWARE', ugcDirections: ['creator explainer'], productInteractionUseful: false }
    },
    productAssetIds: [],
    resolvedType: 'AVATAR_EXPLAINER'
  });
  assert.equal(result.skill, 'BRAND_UNDERSTANDING');
  assert.equal(result.offerType, 'SOFTWARE');
  assert.deepEqual(result.verifiedClaims, ['Schedules social posts']);
  assert.equal(result.evidencePolicy.claims, 'VERIFIED_ONLY');
  assert.ok(result.evidencePolicy.forbidden.includes('invented_testimonial'));
});

test('script timing prevents overlong speech and preserves the CTA inside the hard budget', () => {
  const long = Array.from({ length: 60 }, (_, i) => 'word' + i).join(' ') + '.';
  const timed = scriptTimingSkill({ script: long, duration: 20, cta: 'Try it today.' });
  assert.ok(timed.finalWordCount <= 52);
  assert.equal(timed.spokenCtaIncluded, true);
  assert.match(timed.script, /Try it today\./i);
  assert.equal(timed.minSpeechRateMultiplier, 1);
  assert.equal(timed.maxSpeechRateMultiplier, 1.3);
});

test('creator casting honours a user-selected creator', () => {
  const list = creators();
  const cast = creatorCastingSkill({
    ads: [{ creatorProfile: { category: 'Business' } }, { creatorProfile: { category: 'Tech' } }],
    avatars: list,
    creatorMode: 'SELECTED',
    selectedAvatarId: 'daniel'
  });
  assert.equal(cast.mode, 'USER_SELECTED');
  assert.deepEqual(cast.assignments.map(x => x.avatarId), ['daniel','daniel']);
});

test('automatic creator casting scores relevance and reduces unnecessary repetition', () => {
  const list = creators();
  const cast = creatorCastingSkill({
    ads: [
      { creatorProfile: { category: 'Business', locale: 'en-GB', environment: 'home office laptop' } },
      { creatorProfile: { category: 'Tech', locale: 'en-GB', environment: 'desk monitor laptop' } }
    ],
    avatars: list,
    creatorMode: 'AUTO',
    selectedAvatarId: null
  });
  assert.equal(cast.assignments[0].avatarId, 'priya');
  assert.equal(cast.assignments[1].avatarId, 'daniel');
});

test('Creator V2 preflight rejects a creator that cannot serve the requested production tier', () => {
  const limited = {
    id: 'standard-only',
    name: 'Standard Creator',
    category: 'Lifestyle',
    presentation: 'Woman',
    ageBand: '25–34',
    locale: 'en-GB',
    voice: 'Pippa',
    routeCompatibilityJson: JSON.stringify(['H3_MAX_STANDARD_V1'])
  };
  const cast = creatorCastingSkill({
    ads: [{ creatorProfile: { category: 'Lifestyle' } }],
    avatars: [limited],
    creatorMode: 'SELECTED',
    selectedAvatarId: limited.id,
    quality: 'PREMIUM'
  });
  assert.equal(cast.assignments[0].routeCompatible, false);

  const timing = scriptTimingSkill({ script: 'A concise creator explanation that fits the requested ad duration.', duration: 20, cta: '' });
  const scenePlan = scenePlanningSkill({
    resolvedType: 'AVATAR_EXPLAINER',
    providerDurations: [10, 10],
    playbackDurations: [10, 10],
    rawScenes: [{ kind: 'CREATOR' }, { kind: 'CREATOR' }]
  });
  const qc = qualityControlSkill({
    resolvedType: 'AVATAR_EXPLAINER',
    timing,
    scenePlan,
    avatar: limited,
    hasProductReference: false,
    castingDecision: cast.assignments[0]
  });
  assert.equal(qc.status, 'FAIL');
  assert.ok(qc.failedChecks.includes('CREATOR_ROUTE_COMPATIBILITY'));
});

test('scene planning locks avatar explainers to creator scenes and preserves provider/playback durations', () => {
  const plan = scenePlanningSkill({
    resolvedType: 'AVATAR_EXPLAINER',
    providerDurations: [10, 10],
    playbackDurations: [10, 10],
    rawScenes: [{ kind: 'PRODUCT', objective: 'wrong kind' }, { kind: 'CTA', objective: 'finish' }]
  });
  assert.deepEqual(plan.scenes.map(x => x.kind), ['CREATOR','CREATOR']);
  assert.deepEqual(plan.scenes.map(x => x.providerDuration), [10,10]);
  assert.deepEqual(plan.scenes.map(x => x.playbackDuration), [10,10]);
});

test('consistency, motion, camera and fidelity skills return structured safeguards', () => {
  const avatar = creators()[0];
  const identity = creatorConsistencySkill({ avatar, campaignType: 'AVATAR_EXPLAINER' });
  const voice = voiceConsistencySkill({ avatar, timing: scriptTimingSpec(20) });
  const product = productFidelitySkill({ hasProductReference: true });
  const motion = naturalMotionSkill({ energy: 'ENERGETIC' });
  const camera = cameraStyleSkill({ campaignType: 'PRODUCT_SHOWCASE', strategy: { cameraStyle: 'HYBRID' } });
  const finish = adFinishingSkill({ duration: 20, captionsEnabled: true, musicMode: 'AUTO' });

  assert.equal(identity.identityLock, 'EXACT_REFERENCE');
  assert.ok(identity.preferredEnvironments.length > 0);
  assert.ok(identity.wardrobeProfile.length > 0);
  assert.ok(identity.gestureProfile.length > 0);
  assert.ok(identity.prohibit.includes('identity_morph'));
  assert.equal(voice.voice, 'Pippa');
  assert.equal(voice.accent, 'British');
  assert.ok(voice.languages.includes('English'));
  assert.ok(voice.prohibit.includes('voice_switch_between_scenes'));
  assert.equal(product.referencePolicy, 'EXACT_PRODUCT_REFERENCE');
  assert.ok(product.prohibit.includes('substitute_product'));
  assert.equal(motion.temporalSpeed, 'REAL_TIME_1X');
  assert.ok(motion.prohibit.includes('slow_motion'));
  assert.equal(camera.captureLook, 'SMARTPHONE_REALISM');
  assert.equal(finish.exactDurationSeconds, 20);
  assert.equal(finish.audio.preventFinalWordCutoff, true);
});

test('quality-control preflight blocks missing product references before provider spend', () => {
  const timing = scriptTimingSkill({ script: 'This is a concise product recommendation with a clean ending.', duration: 20, cta: '' });
  const scenePlan = scenePlanningSkill({
    resolvedType: 'PRODUCT_SHOWCASE',
    providerDurations: [10, 10],
    playbackDurations: [10, 10],
    rawScenes: [{ kind: 'CREATOR' }, { kind: 'PRODUCT' }]
  });
  const qc = qualityControlSkill({
    resolvedType: 'PRODUCT_SHOWCASE',
    timing,
    scenePlan,
    avatar: creators()[0],
    hasProductReference: false
  });
  assert.equal(qc.status, 'FAIL');
  assert.ok(qc.failedChecks.includes('PRODUCT_REFERENCE'));
});

test('compiled scene prompt stays minimal and leaves visual direction to the video model', () => {
  const avatar = creators()[0];
  const prompt = compileScenePrompt({
    scene: { kind: 'CREATOR', objective: 'Explain the benefit', visualDirection: 'This old storyboard direction must be ignored.' },
    consistency: creatorConsistencySkill({ avatar, campaignType: 'AVATAR_EXPLAINER' }),
    productFidelity: productFidelitySkill({ hasProductReference: false })
  });
  assert.match(prompt, /Explain the benefit/i);
  assert.match(prompt, /EXACT_REFERENCE/i);
  assert.match(prompt, /Let the video model choose framing, actions and transitions/i);
  assert.match(prompt, /Do not invent unsupported/i);
  assert.doesNotMatch(prompt, /old storyboard direction/i);
  assert.doesNotMatch(prompt, /REAL_TIME_1X/i);
});

test('weighted script splitting preserves every word', () => {
  const script = 'one two three four five six seven eight nine ten eleven twelve';
  const parts = splitScriptByWeightedDuration(script, [10,5]);
  assert.equal(parts.join(' '), script);
  assert.equal(parts.length, 2);
});
