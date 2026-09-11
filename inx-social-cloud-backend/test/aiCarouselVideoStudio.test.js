const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Carousel uses the conversational source-analysis Studio and direct GPT image rendering', () => {
  const router = read('frontend/src/components/ai-content-studio/GenerationModalRouter.tsx');
  const carousel = read('frontend/src/components/ai-content-studio/CarouselChatModal.tsx');
  const service = read('src/services/carouselStudioService.js');
  assert.match(router, /CarouselChatModal/);
  assert.match(carousel, /sendPostStudioMessage/);
  assert.match(carousel, /Source analysis complete/);
  assert.match(carousel, /Generate carousel/);
  assert.match(service, /OPENAI_REASONING_MODEL/);
  assert.match(service, /images\/generations/);
  assert.match(service, /images\/edits/);
  assert.match(service, /slides <= 5 \? 10 : slides <= 8 \? 15 : 20/);
});

test('Video Studio exposes model-driven controls and backend-authoritative dynamic credits', () => {
  const router = read('frontend/src/components/ai-content-studio/GenerationModalRouter.tsx');
  const video = read('frontend/src/components/ai-content-studio/VideoStudioModal.tsx');
  const service = read('src/services/videoStudioService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');
  assert.match(router, /VideoStudioModal/);
  assert.match(video, /Choose the generation engine/);
  assert.match(video, /estimateVideoCredits/);
  assert.match(video, /Generate video · \$\{credits\} credits/);
  assert.match(video, /Draft preview/);
  assert.match(service, /name: 'P-Video'/);
  assert.match(service, /name: 'Wan 3\.0'/);
  assert.match(service, /function estimateCredits/);
  assert.match(routes, /\/video\/estimate/);
  assert.match(routes, /\/generate\/video-studio/);
});

test('UGC remains on the existing generator while Carousel and Video receive dedicated studios', () => {
  const router = read('frontend/src/components/ai-content-studio/GenerationModalRouter.tsx');
  assert.match(router, /contentType === 'image_post'/);
  assert.match(router, /contentType === 'carousel_post'/);
  assert.match(router, /contentType === 'short_video'/);
  assert.match(router, /return <GenerationModal \{\.\.\.props\} \/>/);
});
