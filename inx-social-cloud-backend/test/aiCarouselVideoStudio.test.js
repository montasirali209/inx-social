const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Carousel uses conversational source analysis, direct GPT image rendering and animated controls', () => {
  const router = read('frontend/src/components/ai-content-studio/GenerationModalRouter.tsx');
  const carousel = read('frontend/src/components/ai-content-studio/CarouselChatModalV2.tsx');
  const service = read('src/services/carouselStudioService.js');
  const select = read('frontend/src/components/ai-content-studio/StudioSelect.tsx');
  assert.match(router, /CarouselChatModal/);
  assert.match(carousel, /sendPostStudioMessage/);
  assert.match(carousel, /Source analysis complete/);
  assert.match(carousel, /Generate carousel/);
  assert.match(carousel, /StudioSelect/);
  assert.match(select, /hover:-translate-y-0\.5/);
  assert.match(service, /OPENAI_REASONING_MODEL/);
  assert.match(service, /images\/generations/);
  assert.match(service, /images\/edits/);
  assert.match(service, /slides <= 5 \? 10 : slides <= 8 \? 15 : 20/);
});

test('Carousel can be refined after generation without replacing the current version before approval', () => {
  const carousel = read('frontend/src/components/ai-content-studio/CarouselChatModalV2.tsx');
  assert.match(carousel, /Refine generated carousel/);
  assert.match(carousel, /Refine slide \{activeSlide \+ 1\}/);
  assert.match(carousel, /Current slide/);
  assert.match(carousel, /Shorter copy/);
  assert.match(carousel, /More premium/);
  assert.match(carousel, /Improve CTA/);
  assert.match(carousel, /Apply refinement · \$\{cost\} credits/);
  assert.match(carousel, /current carousel stays unchanged until you apply this refinement/i);
  assert.match(carousel, /regenerates the full carousel for \{cost\} credits/);
  assert.match(carousel, /supportingCopy: brief\.supportingCopy/);
  assert.match(carousel, /caption: brief\.caption/);
  assert.match(carousel, /hashtags: brief\.hashtags/);
});

test('Video Studio keeps the model decision simple with AI Recommended, Fast and Manual routes', () => {
  const router = read('frontend/src/components/ai-content-studio/GenerationModalRouter.tsx');
  const video = read('frontend/src/components/ai-content-studio/VideoStudioModalV2.tsx');
  const service = read('src/services/videoStudioService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  assert.match(router, /VideoStudioModal/);
  assert.match(video, /AI Recommended/);
  assert.match(video, /title="Fast"/);
  assert.match(video, /Manual model/);
  assert.match(video, /recommendVideoModel/);
  assert.match(video, /estimateVideoCredits/);
  assert.match(video, /Generate video · \{credits\} credits/);
  assert.match(video, /StudioSelect/);
  assert.match(service, /name: 'P-Video-2'/);
  assert.match(service, /name: 'MiniMax H3 Fast'/);
  assert.match(service, /name: 'Kling VIDEO 3\.0'/);
  assert.match(service, /name: 'Wan 3\.0'/);
  assert.match(service, /name: 'LTX-2\.5 Pro'/);
  assert.match(service, /name: 'Runway Gen-4\.5'/);
  assert.match(service, /name: 'Seedance 2\.5'/);
  assert.match(service, /async function recommendModel/);
  assert.match(service, /function estimateCredits/);
  assert.match(routes, /\/video\/recommend/);
  assert.match(routes, /\/video\/estimate/);
  assert.match(routes, /\/generate\/video-studio/);
});

test('Video Studio uses P-Video-2 as the economical 720p route with conservative credit estimates', () => {
  const service = read('src/services/videoStudioService.js');
  const environment = read('src/config/env.js');
  const example = read('.env.example');
  assert.match(environment, /videoEconomyModel: modelName\(process\.env\.RUNWARE_VIDEO_ECONOMY_MODEL, 'prunaai:p-video@2'\)/);
  assert.match(example, /RUNWARE_VIDEO_ECONOMY_MODEL=prunaai:p-video@2/);
  assert.match(service, /env\.runware\.videoEconomyModel \|\| 'prunaai:p-video@2'/);
  assert.match(service, /rates: \{ '720p': 0\.026 \}, draftRates: \{ '720p': 0\.016 \}/);
  assert.match(service, /pVideo2 = \{ '16:9': \[1280, 704\], '9:16': \[704, 1280\], '1:1': \[960, 960\] \}/);
  assert.match(service, /positivePrompt: clean\(input\.prompt, profile\.id === 'pvideo' \? 2048/);
  assert.match(service, /task\.fps = 24/);
  assert.match(service, /task\.settings = \{ audio, draft: Boolean\(input\.draft\), promptUpsampling: true \}/);
});

test('Wan Video Studio sends current schema fields and preserves safe provider diagnostics', () => {
  const service = read('src/services/videoStudioService.js');
  const runware = read('src/services/runwareService.js');
  assert.doesNotMatch(service, /promptExtend/);
  assert.match(service, /Wan 3\.0 produces native audio from the prompt/);
  assert.match(service, /\[AI VIDEO GENERATION FAILED\]/);
  assert.match(runware, /\[RUNWARE REQUEST REJECTED\]/);
  assert.match(runware, /!\['positivePrompt', 'messages', 'inputs'\]\.includes\(key\)/);
  assert.match(service, /browserReadyMp4/);
  assert.match(service, /-movflags', '\+faststart'/);
});

test('Short Video opens an animated creator choice and both video routes use persistent background jobs', () => {
  const video = read('frontend/src/components/ai-content-studio/VideoStudioModalV2.tsx');
  const stock = read('frontend/src/components/ai-content-studio/StockVideoCreator.tsx');
  const rail = read('frontend/src/components/ai-content-studio/VideoProductionRail.tsx');
  const notifications = read('frontend/src/components/layout/NotificationCenter.tsx');
  const controller = read('src/controllers/aiStudioNextController.js');
  const service = read('src/services/videoStudioService.js');
  assert.match(video, /How would you like to create it\?/);
  assert.match(video, /AI Generated Video/);
  assert.match(video, /Open Stock Video Creator/);
  assert.match(video, /ACTIVE_AI_VIDEO_JOB_KEY/);
  assert.match(stock, /VideoProductionRail/);
  assert.match(rail, /Generated media/);
  assert.match(rail, /Your Generated Videos/);
  assert.match(rail, /getVideoProductions\(36\)/);
  assert.match(rail, /item\.status === 'completed'/);
  assert.match(stock, /kind="stock"/);
  assert.match(video, /kind="generative"/);
  assert.doesNotMatch(rail, /Your video queue|Media preparing/);
  assert.match(notifications, /Video rendering in background/);
  assert.match(notifications, /generation=\$\{encodeURIComponent/);
  assert.match(controller, /generateVideo[\s\S]*res\.status\(202\)/);
  assert.match(service, /setImmediate\(\(\) => \{ void runVideoGeneration/);
});

test('AI video completion polling survives temporary rate limits and avoids cached status', () => {
  const video = read('frontend/src/components/ai-content-studio/VideoStudioModalV2.tsx');
  const api = read('frontend/src/lib/ai-content-studio-api.ts');
  const app = read('src/app.js');
  assert.match(video, /caught\.status === 429 \? 5000/);
  assert.match(video, /Keep polling with a bounded backoff/);
  assert.match(api, /cache: 'no-store'/);
  assert.match(app, /skip: req => \['GET', 'HEAD', 'OPTIONS'\]\.includes\(req\.method\)/);
});

test('Image Post retains professional animated styling for any remaining native dropdowns', () => {
  const router = read('frontend/src/components/ai-content-studio/GenerationModalRouter.tsx');
  const styles = read('frontend/src/components/ai-content-studio/studio-controls.css');
  assert.match(router, /studio-controls\.css/);
  assert.match(styles, /select\[class\*="border-border-soft"\]/);
  assert.match(styles, /translateY\(-1px\)/);
});

test('UGC remains on the existing generator while Carousel and Video receive dedicated studios', () => {
  const router = read('frontend/src/components/ai-content-studio/GenerationModalRouter.tsx');
  assert.match(router, /type === 'image_post'/);
  assert.match(router, /contentType === 'carousel_post'/);
  assert.match(router, /contentType === 'short_video'/);
  assert.match(router, /return <GenerationModal \{\.\.\.props\} \/>/);
});
