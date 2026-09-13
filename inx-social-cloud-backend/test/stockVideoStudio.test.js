const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const stockVideo = require('../src/services/stockVideoStudioService');

test('Stock Video Creator is an isolated Plus workflow with a separate monthly allowance', () => {
  const service = read('src/services/stockVideoStudioService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiStudioNextController.js');
  assert.match(service, /STOCK_VIDEO_MONTHLY_LIMIT \|\| 30/);
  assert.match(service, /contentType\"=\$2/);
  assert.match(service, /'stock_video'/);
  assert.match(service, /credits\.getEntitlement/);
  assert.match(routes, /\/stock-video\/access/);
  assert.match(routes, /\/generate\/stock-video/);
  assert.match(controller, /res\.status\(202\)/);
});

test('Stock Video Creator delegates to the isolated real OpenMontage runtime and preserves provenance', () => {
  const service = read('src/services/stockVideoStudioService.js');
  const worker = read('../openmontage-worker/main.py');
  const dockerfile = read('../openmontage-worker/Dockerfile');
  const notice = read('../OPENMONTAGE-NOTICE.md');
  assert.match(service, /openMontageUrl.*\/jobs/);
  assert.match(service, /STOCK_VIDEO_PIPELINE_FAILED/);
  assert.match(dockerfile, /github\.com\/calesthio\/OpenMontage\.git/);
  assert.match(dockerfile, /08e2151fa02de28a5d6a312b3d575692bf147ad7/);
  assert.match(worker, /registry\.get\("direct_clip_search"\)/);
  assert.match(worker, /registry\.get\("video_compose"\)/);
  assert.match(worker, /registry\.get\("audio_mixer"\)/);
  assert.match(worker, /registry\.get\("color_grade"\)/);
  assert.match(worker, /def render_safety_gate/);
  assert.match(worker, /registry\.get\("remotion_caption_burn"\)/);
  assert.match(worker, /PROFESSIONAL_VIDEO_SOURCES = \("pexels", "pixabay_video"\)/);
  assert.match(worker, /professional_query/);
  assert.match(worker, /\+cinematic \+4k/);
  assert.match(worker, /pre_compose_gate/);
  assert.match(worker, /render_safety_gate/);
  assert.match(worker, /current_us_hashtags/);
  assert.match(worker, /words_per_page": 4/);
  assert.match(worker, /for attempt in range\(2\)/);
  assert.match(worker, /def scene_srt/);
  assert.match(worker, /def fit_narration/);
  assert.match(worker, /def clip_relevance/);
  assert.match(worker, /write_checkpoint/);
  assert.match(notice, /separately deployed/);
  assert.match(service, /provenance/);
  assert.match(service, /mediaLibrary\.publicAsset/);
  assert.match(service, /result\.renderer \|\| 'remotion'/);
});

test('OpenMontage worker ships a fourteen-stage standalone professional workflow', () => {
  const manifest = read('../openmontage-worker/pipeline_defs/inx-stock-montage.yaml');
  const registry = read('../openmontage-worker/overrides/stock_sources_init.py');
  const dockerfile = read('../openmontage-worker/Dockerfile');
  const stages = [...manifest.matchAll(/^  - name: ([a-z_]+)$/gm)].map(match => match[1]);
  assert.deepEqual(stages, [
    'idea', 'script', 'scene_plan', 'stock_retrieval', 'music', 'tts', 'asset_ready',
    'pre_compose_validation', 'edit', 'audio_mix', 'assembly', 'color_grade',
    'caption_credits', 'final_qa'
  ]);
  assert.match(registry, /_SOURCE_CLASSES = \(PexelsSource, PixabayVideoSource\)/);
  assert.doesNotMatch(registry, /WikimediaSource|ArchiveOrgSource|NasaSource/);
  assert.match(dockerfile, /remotion-composer && npm ci/);
  assert.doesNotMatch(dockerfile, /npm ci --omit=optional/);
  assert.match(dockerfile, /apt-get install[^\n]*chromium/);
  assert.match(dockerfile, /REMOTION_BROWSER_EXECUTABLE=\/usr\/bin\/chromium/);
  assert.match(dockerfile, /overrides\/remotion\.config\.ts/);
  assert.match(dockerfile, /stock_sources\/__init__\.py/);
});

test('Stock Video Creator UI resumes active jobs and hands completed video to Posts', () => {
  const component = read('frontend/src/components/ai-content-studio/StockVideoCreator.tsx');
  const videoStudio = read('frontend/src/components/ai-content-studio/VideoStudioModalV2.tsx');
  assert.match(component, /ACTIVE_JOB_KEY/);
  assert.match(component, /getGenerationStatus/);
  assert.match(component, /30.*remaining|remaining.*limit/);
  assert.match(component, /Post \/ Schedule/);
  assert.match(component, /Licensed-source provenance included/);
  assert.match(component, /Licensed footage sources/);
  assert.match(component, /sourceGroups/);
  assert.match(component, /Create stock video/);
  assert.doesNotMatch(component, /Real OpenMontage runtime|OpenMontage connected|Loading allowance|Create with OpenMontage/);
  assert.match(component, /disabled=\{working \|\| noRemaining \|\| prompt\.trim\(\)\.length < 2\}/);
  assert.match(videoStudio, /Stock Video Creator/);
  assert.match(videoStudio, /StockVideoCreator/);
  assert.doesNotMatch(videoStudio, /OpenMontage writes/);
});

test('script checkpoints normalize required duration before every schema validation', () => {
  const worker = read('../openmontage-worker/main.py');
  assert.match(worker, /def normalize_script_payload/);
  assert.match(worker, /normalized\.setdefault\("version", "1\.0"\)/);
  assert.match(worker, /normalized\.setdefault\("title", "Untitled video"\)/);
  assert.match(worker, /normalized\["total_duration_seconds"\] = duration/);
  assert.match(worker, /\(job\.get\("request"\) or \{\}\)\.get\("duration"\)/);
  assert.match(worker, /"normalization_applied": applied/);
  assert.match(worker, /"selected_ui_duration": selected_ui_duration/);
  assert.match(worker, /"normalized_script_payload": normalized/);
});

test('Stock video plans are normalised to a safe social-video envelope', () => {
  const plan = stockVideo.normalizePlan({
    title: 'Test', narration: 'First sentence. Second sentence.',
    scenes: [
      { searchQuery: 'city morning', seconds: 1 },
      { searchQuery: 'people walking', seconds: 20 },
      { searchQuery: 'sunrise skyline', seconds: 5 },
    ],
  }, { prompt: 'A city story', duration: 30 });
  assert.equal(plan.scenes.length, 3);
  assert.ok(plan.scenes.every(scene => scene.seconds >= 2));
  assert.equal(stockVideo.dimensions('9:16', '720p').height, 1280);
  assert.match(stockVideo.createSrt(plan.narration, 30), /00:00:00,000 -->/);
});
