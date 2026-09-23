const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STANDARD_CREDITS,
  PREMIUM_CREDITS,
  AVATAR_CREDITS,
  SYSTEM_AVATAR_COUNT,
  FEATURED_AVATAR_COUNT,
  avatarSeeds,
  creditsPerAd,
  visualDurations,
  resolveCampaignType,
  splitScriptByDurations,
  narratorVoice,
  narratorLanguage,
  narratorSpeed,
  captionsForScenes
} = require('../src/services/ugcStudioService');

test('UGC v2 pricing supports 15, 20 and 30 second Standard and Premium ads', () => {
  assert.deepEqual(STANDARD_CREDITS, { 15: 100, 20: 140, 30: 210 });
  assert.deepEqual(PREMIUM_CREDITS, { 15: 180, 20: 260, 30: 390 });
  assert.equal(AVATAR_CREDITS, 5);
  assert.equal(creditsPerAd(15, 'STANDARD'), 100);
  assert.equal(creditsPerAd(20, 'STANDARD'), 140);
  assert.equal(creditsPerAd(30, 'STANDARD'), 210);
  assert.equal(creditsPerAd(15, 'PREMIUM'), 180);
  assert.equal(creditsPerAd(20, 'PREMIUM'), 260);
  assert.equal(creditsPerAd(30, 'PREMIUM'), 390);
  assert.throws(() => creditsPerAd(60, 'STANDARD'));
});

test('creator library retains 52 system seeds and launches with 20 featured creators', () => {
  assert.equal(SYSTEM_AVATAR_COUNT, 52);
  assert.equal(FEATURED_AVATAR_COUNT, 20);
  assert.equal(avatarSeeds.length, 52);
  assert.equal(new Set(avatarSeeds.map((avatar) => avatar.slug)).size, avatarSeeds.length);
});

test('Standard Hailuo scene templates use only supported 6 or 10 second generations', () => {
  assert.deepEqual(visualDurations(15, 'STANDARD', 'AVATAR_EXPLAINER'), [10, 6]);
  assert.deepEqual(visualDurations(20, 'STANDARD', 'PRODUCT_SHOWCASE'), [10, 10]);
  assert.deepEqual(visualDurations(30, 'STANDARD', 'AVATAR_EXPLAINER'), [10, 10, 10]);
  for (const duration of [15,20,30]) {
    const clips = visualDurations(duration, 'STANDARD', 'PRODUCT_SHOWCASE');
    assert.ok(clips.every((value) => value === 6 || value === 10));
    assert.ok(clips.reduce((sum, value) => sum + value, 0) >= duration);
  }
});

test('Premium Kling scene templates never exceed 15 seconds', () => {
  for (const duration of [15,20,30]) {
    for (const campaignType of ['AVATAR_EXPLAINER','PRODUCT_SHOWCASE']) {
      const clips = visualDurations(duration, 'PREMIUM', campaignType);
      assert.ok(clips.every((value) => value >= 3 && value <= 15));
      assert.equal(clips.reduce((sum, value) => sum + value, 0), duration);
    }
  }
});

test('campaign type resolver prefers avatar explainers for SaaS and product showcases for real products', () => {
  assert.equal(resolveCampaignType({ campaignType: 'AUTO' }, { analysis: { offerType: 'SOFTWARE' } }, []), 'AVATAR_EXPLAINER');
  assert.equal(resolveCampaignType({ campaignType: 'AUTO' }, { analysis: { offerType: 'SERVICE' } }, []), 'AVATAR_EXPLAINER');
  assert.equal(resolveCampaignType({ campaignType: 'AUTO' }, { analysis: { offerType: 'PRODUCT' } }, []), 'PRODUCT_SHOWCASE');
  assert.equal(resolveCampaignType({ campaignType: 'AUTO' }, { analysis: { offerType: 'BRAND' } }, [{}]), 'PRODUCT_SHOWCASE');
  assert.equal(resolveCampaignType({ campaignType: 'AVATAR_EXPLAINER' }, { analysis: { offerType: 'PRODUCT' } }, [{}]), 'AVATAR_EXPLAINER');
  assert.equal(resolveCampaignType({ campaignType: 'PRODUCT_SHOWCASE' }, { analysis: { offerType: 'SOFTWARE' } }, []), 'PRODUCT_SHOWCASE');
});

test('script distribution preserves all words across scene durations', () => {
  const script = 'one two three four five six seven eight nine ten eleven twelve';
  const parts = splitScriptByDurations(script, [10, 10, 10]);
  assert.equal(parts.join(' '), script);
  assert.equal(parts.length, 3);
});

test('UGC narrator keeps a stable voice identity', () => {
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


test('UGC website analysis accepts a bare domain without requiring protocol or www', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const service = fs.readFileSync(path.join(root, 'src/services/ugcStudioService.js'), 'utf8');
  const wizard = fs.readFileSync(path.join(root, 'frontend/src/components/ai-content-studio/UGCWizardModal.tsx'), 'utf8');

  assert.match(service, /raw \? 'https:\/\/' \+ raw : ''/);
  assert.match(wizard, /yourbrand\.com/);
  assert.doesNotMatch(wizard, /placeholder=\{sourceType === 'PRODUCT' \? 'https:\/\/shop\.com\/product'/);
});


test('featured UGC library is female-forward while retaining mixed creator choice', () => {
  const featuredNames = new Set([
    'Maya','Sofia','Chloe','Aisha','Priya','Isla','Nadia','Ruby','Olivia','Jasmine','Ava','Camila','Elena','Keisha','Mei',
    'Daniel','James','Arjun','Marcus','Alex'
  ]);
  const featured = avatarSeeds.filter((avatar) => featuredNames.has(avatar.name));
  assert.equal(featured.length, 20);
  assert.equal(featured.filter((avatar) => avatar.presentation === 'Woman').length, 15);
  assert.equal(featured.filter((avatar) => avatar.presentation === 'Man').length, 5);
});

test('UGC realism skill protects creator continuity and physical product realism', () => {
  const { ugcRealismSkill, FEATURED_REFERENCE_VERSION } = require('../src/services/ugcStudioService');
  assert.ok(FEATURED_REFERENCE_VERSION >= 3);
  assert.match(ugcRealismSkill('CREATOR','AVATAR_EXPLAINER','PREMIUM'), /natural blinking/i);
  assert.match(ugcRealismSkill('CREATOR','AVATAR_EXPLAINER','PREMIUM'), /wardrobe/i);
  assert.match(ugcRealismSkill('PRODUCT','PRODUCT_SHOWCASE','STANDARD'), /exact product geometry/i);
  assert.match(ugcRealismSkill('PRODUCT','PRODUCT_SHOWCASE','STANDARD'), /physically plausible/i);
  assert.match(ugcRealismSkill('CREATOR','AVATAR_EXPLAINER','STANDARD'), /Do not imitate or resemble a named celebrity/i);
});

test('UGC editor treats rendered-video finishing controls as regeneration-impacting', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const editor = fs.readFileSync(path.join(root, 'frontend/src/components/ai-content-studio/UGCEditorPage.tsx'), 'utf8');
  const service = fs.readFileSync(path.join(root, 'src/services/ugcStudioService.js'), 'utf8');
  assert.match(editor, /musicMode !== ad\.musicMode/);
  assert.match(editor, /captionsEnabled !== ad\.captionsEnabled/);
  assert.match(service, /syncReadyAssetMetadata/);
  assert.match(service, /UPDATE "AgentAsset" SET "generationChoice"/);
  assert.match(editor, /invalidateQueries\(\{ queryKey: \['media-library'\] \}\)/);
});
