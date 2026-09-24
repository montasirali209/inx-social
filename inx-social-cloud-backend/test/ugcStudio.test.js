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
  playbackDurations,
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

test('15-second Hailuo ads reserve provider-safe footage but only use 15 seconds of spoken playback', () => {
  assert.deepEqual(playbackDurations(15, [10, 6]), [10, 5]);
  assert.deepEqual(playbackDurations(20, [10, 10]), [10, 10]);
  assert.deepEqual(playbackDurations(30, [10, 10, 10]), [10, 10, 10]);
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
  assert.ok(narratorSpeed('one two three four five six seven eight nine ten', 5) >= 1);
  assert.equal(narratorSpeed('short natural line', 10), 1);
});

test('UGC captions emit valid SRT timestamp rows', () => {
  const srt = captionsForScenes([{ duration: 5, script: 'one two three four five six' }]);
  assert.match(srt, /00:00:00,000 --> 00:00:05,000/);
  assert.doesNotMatch(srt, /00:00:00,000\n--> /);
});


test('UGC website analysis accepts bare domains and tries both apex and www safely', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const service = fs.readFileSync(path.join(root, 'src/services/ugcStudioService.js'), 'utf8');
  const wizard = fs.readFileSync(path.join(root, 'frontend/src/components/ai-content-studio/UGCWizardModal.tsx'), 'utf8');
  const { brandUrlCandidates } = require('../src/services/ugcStudioService');

  assert.deepEqual(brandUrlCandidates('inxsocial.co.uk'), ['https://inxsocial.co.uk/', 'https://www.inxsocial.co.uk/']);
  assert.deepEqual(brandUrlCandidates('www.inxsocial.co.uk'), ['https://www.inxsocial.co.uk/', 'https://inxsocial.co.uk/']);
  assert.match(service, /for \(const candidate of candidates\)/);
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


test('UGC live progress exposes real generation stages instead of completion-only progress', () => {
  const { generationStagePayload } = require('../src/services/ugcStudioService');
  const rendering = generationStagePayload(
    { status: 'RENDERING', updatedAt: new Date() },
    [{ status: 'READY' }, { status: 'RENDERING' }, { status: 'QUEUED' }],
    { status: 'PROCESSING', progress: 47, responseJson: JSON.stringify({ stage: 'LIP_SYNC', sceneSequence: 2, sceneTotal: 3 }), updatedAt: new Date() },
  );
  assert.equal(rendering.progress, 47);
  assert.equal(rendering.stage, 'LIP_SYNC');
  assert.equal(rendering.stageLabel, 'Lip-syncing creator');
  assert.equal(rendering.readyScenes, 1);
  assert.equal(rendering.sceneCount, 3);
  assert.match(rendering.stageDetail, /scene 2 of 3/i);

  const ready = generationStagePayload({ status: 'READY' }, [{ status: 'READY' }], { progress: 88, responseJson: '{}' });
  assert.equal(ready.progress, 100);
  assert.equal(ready.stage, 'READY');
});

test('UGC runtime renders two scenes concurrently while keeping one ad active globally', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const service = fs.readFileSync(path.join(root, 'src/services/ugcStudioService.js'), 'utf8');
  assert.match(service, /await runLimited\(scenes, 2,/);
  assert.match(service, /const adId = await claimNextAd\(\)/);
  assert.doesNotMatch(service, /for \(let i=0; i<2; i\+=1\)[\s\S]{0,180}claimNextAd/);
  assert.match(service, /UGCCampaign[\s\S]{0,180}RENDERING/);
});

test('UGC wizard and home workspace display live progress stages', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const wizard = fs.readFileSync(path.join(root, 'frontend/src/components/ai-content-studio/UGCWizardModal.tsx'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx'), 'utf8');

  assert.match(wizard, /activeAd\?\.stageLabel/);
  assert.match(wizard, /ad\.progress/);
  assert.match(home, /campaignProgress/);
  assert.match(home, /activeAd\?\.stageLabel/);
});


test('UGC runtime continuously recovers renders whose worker heartbeat is lost', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const service = fs.readFileSync(path.join(root, 'src/services/ugcStudioService.js'), 'utf8');
  const { UGC_RENDER_STALE_MS } = require('../src/services/ugcStudioService');

  assert.equal(UGC_RENDER_STALE_MS, 5 * 60 * 1000);
  assert.match(service, /recoverStaleUGCRenders\(false\)/);
  assert.match(service, /recoverStaleUGCRenders\(true\)/);
  assert.match(service, /lost worker heartbeat/);
  assert.match(service, /RETURNING "id"/);
});


test('UGC pacing prevents slow-motion creator direction and trims each scene before final assembly', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const service = fs.readFileSync(path.join(root, 'src/services/ugcStudioService.js'), 'utf8');
  const skills = fs.readFileSync(path.join(root, 'src/services/ugcSkillEngine.js'), 'utf8');

  assert.match(service, /Never use slow motion/);
  assert.match(service, /ordinary 1x speed/);
  assert.match(service, /spokenWindow/);
  assert.match(service, /const finalDurations = playbackDurations/);
  assert.match(service, /String\(finalDuration\)/);
  assert.match(skills, /SPEECH_FINISHES_BEFORE_CUT/);
  assert.match(skills, /preventFinalWordCutoff: true/);
});

test('UGC editor route self-recovers stale chunks and generated videos use the custom player', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const preload = fs.readFileSync(path.join(root, 'frontend/src/route-preload.ts'), 'utf8');
  const router = fs.readFileSync(path.join(root, 'frontend/src/router.tsx'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx'), 'utf8');
  const editor = fs.readFileSync(path.join(root, 'frontend/src/components/ai-content-studio/UGCEditorPage.tsx'), 'utf8');
  const player = fs.readFileSync(path.join(root, 'frontend/src/components/ai-content-studio/UGCVideoPlayer.tsx'), 'utf8');

  assert.match(preload, /Failed to fetch dynamically imported module/);
  assert.match(preload, /window\.location\.reload\(\)/);
  assert.match(router, /errorElement: <AppRouteError/);
  assert.match(home, /loadUGCEditor\(\)/);
  assert.match(home, /UGCVideoLightbox/);
  assert.match(editor, /UGCVideoPlayer/);
  assert.match(player, /requestFullscreen/);
  assert.doesNotMatch(player, /controls\s/);
});
