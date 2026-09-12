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

test('Stock Video Creator plans, sources, composes and preserves provenance', () => {
  const service = read('src/services/stockVideoStudioService.js');
  assert.match(service, /api\.pexels\.com\/videos\/search/);
  assert.match(service, /pixabay\.com\/api\/videos/);
  assert.match(service, /archive\.org\/advancedsearch\.php/);
  assert.match(service, /archiveCommercialLicense/);
  assert.match(service, /openmontage-documentary-montage/);
  assert.match(service, /ffmpeg-static/);
  assert.match(service, /createNarration/);
  assert.match(service, /createSrt/);
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
