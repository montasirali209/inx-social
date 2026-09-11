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
  assert.match(service, /name: 'P-Video'/);
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
