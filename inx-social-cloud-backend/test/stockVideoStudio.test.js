const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));
const stockVideo = require('../src/services/stockVideoStudioService');

test('Stock Video Creator uses the shared AI credit wallet with duration and resolution pricing', () => {
  const service = read('src/services/stockVideoStudioService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiStudioNextController.js');
  assert.doesNotMatch(service, /STOCK_VIDEO_MONTHLY_LIMIT/);
  assert.match(service, /function estimateCredits/);
  assert.match(service, /duration <= 15 \? 20 : duration <= 30 \? 30 : duration <= 45 \? 40 : 50/);
  assert.match(service, /resolutionMultiplier.*1080p.*1\.25/);
  assert.match(service, /credits\.reserve\(userId, generationId, amount\)/);
  assert.match(service, /credits\.complete\(userId, generationId, chargedCredits\)/);
  assert.match(service, /credits\.refund\(userId, generationId/);
  assert.match(routes, /\/stock-video\/access/);
  assert.match(routes, /\/generate\/stock-video/);
  assert.match(controller, /res\.status\(202\)/);
  assert.equal(stockVideo.estimateCredits({ duration: 15, resolution: '720p' }), 20);
  assert.equal(stockVideo.estimateCredits({ duration: 30, resolution: '720p' }), 30);
  assert.equal(stockVideo.estimateCredits({ duration: 60, resolution: '1080p' }), 63);
});

test('Stock Video Creator delegates to the full isolated OpenMontage service and persists the finished video', () => {
  const service = read('src/services/stockVideoStudioService.js');
  const bridge = read('../openmontage-worker/full_bridge.py');
  const compatibility = read('../openmontage-worker/compat_bridge.py');
  const stockProfile = read('../openmontage-worker/stock_compat_entry.py');
  const dockerfile = read('../openmontage-worker/Dockerfile');
  const notice = read('../OPENMONTAGE-NOTICE.md');

  assert.match(service, /axios\.post\(`\$\{workerUrl\}\/jobs`/);
  assert.match(service, /axios\.get\(`\$\{workerUrl\}\/jobs\/\$\{encodeURIComponent\(workerJobId\)\}`/);
  assert.match(service, /\/output`/);
  assert.match(service, /STOCK_VIDEO_PIPELINE_FAILED/);
  assert.match(service, /provenance/);
  assert.match(service, /mediaLibrary\.publicAsset/);

  assert.match(dockerfile, /github\.com\/calesthio\/OpenMontage\.git/);
  assert.match(dockerfile, /08e2151fa02de28a5d6a312b3d575692bf147ad7/);
  assert.match(dockerfile, /uvicorn stock_compat_entry:app/);
  assert.match(stockProfile, /STOCK_PIPELINE = "documentary-montage"/);
  assert.match(stockProfile, /operation='burn_subtitles'/);
  assert.match(stockProfile, /font_size": 18/);
  assert.match(stockProfile, /"alignment": 2/);
  assert.match(stockProfile, /real word-level start\/end timestamps/);
  assert.match(stockProfile, /never estimate caption timing/);
  assert.match(stockProfile, /reject\/rebuild any output with early, late, stale or missing subtitle words/);
  assert.match(stockProfile, /never use remotion_caption_burn/);
  assert.match(bridge, /@app\.post\("\/jobs"/);
  assert.match(bridge, /@app\.get\("\/jobs\/\{job_id\}"/);
  assert.match(bridge, /@app\.get\("\/jobs\/\{job_id\}\/output"/);
  assert.match(bridge, /_project_artifacts/);
  assert.match(bridge, /reviewed final MP4/);
  assert.match(compatibility, /fullIntegration/);
  assert.match(notice, /separately deployed/);
});

test('full OpenMontage worker discovers native pipelines tools skills providers and stock sources', () => {
  const bridge = read('../openmontage-worker/full_bridge.py');
  const compatibility = read('../openmontage-worker/compat_bridge.py');
  const dockerfile = read('../openmontage-worker/Dockerfile');

  assert.match(bridge, /pipeline_defs/);
  assert.match(bridge, /from tools\.tool_registry import registry/);
  assert.match(bridge, /registry\.discover\(\)/);
  assert.match(bridge, /registry\.provider_menu_summary\(\)/);
  assert.match(bridge, /registry\.provider_menu\(\)/);
  assert.match(bridge, /from tools\.video\.stock_sources import source_catalog, source_summary/);
  assert.match(bridge, /skillsCount/);
  assert.match(bridge, /providerSummary/);
  assert.match(bridge, /stockSources/);
  assert.match(compatibility, /pipelineCatalog/);
  assert.match(compatibility, /professionalSources/);
  assert.match(compatibility, /return "auto"/);
  assert.match(dockerfile, /remotion-composer && npm ci/);
  assert.match(dockerfile, /hyperframes --version/);
  assert.match(dockerfile, /piper-tts/);
  assert.match(dockerfile, /chromium/);
  assert.match(dockerfile, /REMOTION_BROWSER_EXECUTABLE=\/usr\/bin\/chromium/);
});

test('reduced worker restrictions are removed instead of shadowing native OpenMontage behavior', () => {
  const dockerfile = read('../openmontage-worker/Dockerfile');
  const bridge = read('../openmontage-worker/full_bridge.py');

  assert.equal(exists('../openmontage-worker/main.py'), false);
  assert.equal(exists('../openmontage-worker/app_entry.py'), false);
  assert.equal(exists('../openmontage-worker/resilient_entry.py'), false);
  assert.equal(exists('../openmontage-worker/pipeline_defs/inx-stock-montage.yaml'), false);
  assert.equal(exists('../openmontage-worker/overrides/stock_sources_init.py'), false);
  assert.equal(exists('../openmontage-worker/overrides/remotion.config.ts'), false);
  assert.doesNotMatch(dockerfile, /COPY overrides|COPY pipeline_defs/);
  assert.doesNotMatch(bridge, /PROFESSIONAL_VIDEO_SOURCES/);
  assert.match(bridge, /"stockSourceOverride": False/);
  assert.match(bridge, /"toolRegistryOverride": False/);
  assert.match(bridge, /"skillOverride": False/);
  assert.match(bridge, /"pipelineOverride": False/);
});

test('full worker requires a reviewed final video and retains production artifacts', () => {
  const bridge = read('../openmontage-worker/full_bridge.py');
  assert.match(bridge, /projects\/\{slug\}\/renders\/final\.mp4/);
  assert.match(bridge, /if not output: raise RuntimeError/);
  assert.match(bridge, /artifacts = _project_artifacts/);
  assert.match(bridge, /"artifactCount": len\(artifacts\)/);
  assert.match(bridge, /"upstreamModified": False/);
  assert.match(bridge, /"renderer": "openmontage-native"/);
  assert.match(bridge, /Preserve provenance, checkpoints, decision logs, costs and review artifacts/);
});

test('Stock Video Creator recovers durable jobs across SaaS and worker restarts', () => {
  const service = read('src/services/stockVideoStudioService.js');
  const server = read('src/server.js');
  const bridge = read('../openmontage-worker/full_bridge.py');

  assert.match(service, /recoverStockVideoJobs/);
  assert.match(service, /"taskUuid"/);
  assert.match(service, /STOCK_VIDEO_WORKER_INTERRUPTED/);
  assert.match(service, /worker state was unavailable; restarting saved production/);
  assert.match(service, /worker lost active state; restarting saved production/);
  assert.match(service, /const MAX_CONCURRENT_JOBS = \(\) => \{/);
  assert.match(service, /STOCK_VIDEO_MAX_CONCURRENT_JOBS/);
  assert.match(service, /workerUrls\(\)\.length/);
  assert.match(service, /workerUrl: clean\(workerUrl, 500\)/);
  assert.match(service, /response\.workerUrl/);
  assert.match(service, /INTERVAL '15 seconds'/);
  assert.doesNotMatch(service, /SET "status"='FAILED'.*STOCK_VIDEO_WORKER_INTERRUPTED/);
  assert.match(server, /startStockVideoRuntime\(\)/);
  assert.match(bridge, /_discard_interrupted_state/);
  assert.match(bridge, /stock_video_stage_complete/);
});

test('Stock Video Creator UI resumes active jobs and hands completed video to Posts', () => {
  const component = read('frontend/src/components/ai-content-studio/StockVideoCreator.tsx');
  const videoStudio = read('frontend/src/components/ai-content-studio/VideoStudioModalV2.tsx');
  const productionRail = read('frontend/src/components/ai-content-studio/VideoProductionRail.tsx');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const service = read('src/services/aiContentStudioService.js');
  assert.match(component, /ACTIVE_JOB_KEY/);
  assert.match(component, /getGenerationStatus/);
  assert.match(component, /credits available/);
  assert.match(component, /selectedCost/);
  assert.match(component, /shared AI credit wallet/);
  assert.match(component, /Post \/ Schedule/);
  assert.match(component, /Licensed-source provenance included/);
  assert.match(component, /Licensed footage sources/);
  assert.match(component, /sourceGroups/);
  assert.match(component, /Create stock video · \$\{selectedCost\} credits/);
  assert.doesNotMatch(component, /Real OpenMontage runtime|OpenMontage connected|Loading allowance|Create with OpenMontage/);
  assert.match(component, /disabled=\{working \|\| noRemaining \|\| prompt\.trim\(\)\.length < 2\}/);
  assert.match(videoStudio, /Stock Video Creator/);
  assert.match(videoStudio, /StockVideoCreator/);
  assert.doesNotMatch(videoStudio, /OpenMontage writes/);
  assert.match(productionRail, /Remove video from queue/);
  assert.match(productionRail, /item\.error/);
  assert.match(component, /Dismiss error/);
  assert.match(productionRail, /2xl:w-\[216px\]/);
  assert.match(productionRail, /2xl:min-w-0/);
  assert.match(routes, /router\.delete\('\/generations\/:id'/);
  assert.match(service, /"hiddenAt" IS NULL/);
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
