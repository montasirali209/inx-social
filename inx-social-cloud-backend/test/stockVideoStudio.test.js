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
  assert.match(service, /OPENMONTAGE_PIPELINE_FAILED/);
  assert.match(dockerfile, /github\.com\/calesthio\/OpenMontage\.git/);
  assert.match(dockerfile, /08e2151fa02de28a5d6a312b3d575692bf147ad7/);
  assert.match(worker, /registry\.get\("direct_clip_search"\)/);
  assert.match(worker, /registry\.get\("video_compose"\)/);
  assert.match(worker, /write_checkpoint/);
  assert.match(notice, /separately deployed/);
  assert.match(service, /provenance/);
  assert.match(service, /mediaLibrary\.publicAsset/);
});

test('Stock Video Creator UI resumes active jobs and hands completed video to Posts', () => {
  const component = read('frontend/src/components/ai-content-studio/StockVideoCreator.tsx');
  const videoStudio = read('frontend/src/components/ai-content-studio/VideoStudioModalV2.tsx');
  assert.match(component, /ACTIVE_JOB_KEY/);
  assert.match(component, /getGenerationStatus/);
  assert.match(component, /30.*remaining|remaining.*limit/);
  assert.match(component, /Post \/ Schedule/);
  assert.match(component, /Licensed-source provenance included/);
  assert.match(component, /Authorize the complete OpenMontage run/);
  assert.match(videoStudio, /Stock Video Creator/);
  assert.match(videoStudio, /StockVideoCreator/);
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
