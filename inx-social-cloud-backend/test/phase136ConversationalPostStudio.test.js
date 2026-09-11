const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Image Post opens the conversational Studio instead of the legacy form', () => {
  const router = read('frontend/src/components/ai-content-studio/GenerationModalRouter.tsx');
  const studio = read('frontend/src/components/ai-content-studio/ImagePostChatModal.tsx');
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');

  assert.match(router, /type === 'image_post'/);
  assert.match(router, /ImagePostChatModal/);
  assert.match(router, /GenerationModal/);
  assert.match(page, /GenerationModalRouter/);
  assert.match(studio, /Build the post with AI/);
  assert.match(studio, /Add URL/);
  assert.match(studio, /Upload reference image/);
  assert.match(studio, /Optional controls/);
  assert.match(studio, /AI chooses sensible defaults/);
  assert.match(studio, /Generate final post · 5 credits/);
  assert.doesNotMatch(studio, /Content goal|Visual style|Number of variants|Generate hashtags|Generate alt text/);
});

test('Post Studio chat is OpenAI-routed, scope constrained and cost bounded', () => {
  const service = read('src/services/aiPostStudioService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');

  assert.match(service, /OPENAI_CHAT_MODEL \|\| 'gpt-5\.6-luna'/);
  assert.match(service, /OPENAI_REASONING_MODEL \|\| process\.env\.OPENAI_MODEL \|\| 'gpt-5\.6-terra'/);
  assert.match(service, /reasoning_effort: 'none'/);
  assert.match(service, /You are not a general-purpose chatbot/);
  assert.match(service, /If the user asks about an unrelated subject/);
  assert.match(service, /MAX_MESSAGES = 18/);
  assert.match(service, /MAX_REFERENCES = 4/);
  assert.match(service, /MAX_URLS = 2/);
  assert.match(routes, /\/assistant\/message/);
  assert.doesNotMatch(service, /runware/);
});

test('Final Image Post render uses direct GPT Image with five-credit accounting', () => {
  const service = read('src/services/aiPostStudioService.js');
  const routes = read('src/routes/aiContentStudioRoutes.js');

  assert.match(service, /IMAGE_CREDITS = 5/);
  assert.match(service, /env\.openaiImage\.model \|\| 'gpt-image-2'/);
  assert.match(service, /\/images\/generations/);
  assert.match(service, /\/images\/edits/);
  assert.match(service, /form\.append\('image\[\]'/);
  assert.doesNotMatch(service, /input_fidelity/);
  assert.match(service, /quality: 'medium'/);
  assert.match(service, /credits\.reserve/);
  assert.match(service, /credits\.complete/);
  assert.match(service, /credits\.refund/);
  assert.match(routes, /\/generate\/conversational-image-post/);
});

test('GPT Image 2 receives exact social aspect-ratio sizes and URL analysis blocks private targets', () => {
  const service = read('src/services/aiPostStudioService.js');

  assert.match(service, /'1:1'\) return '1024x1024'/);
  assert.match(service, /'9:16'\) return '864x1536'/);
  assert.match(service, /'16:9'\) return '1536x864'/);
  assert.match(service, /return '1024x1280'/);
  assert.match(service, /dns\.lookup/);
  assert.match(service, /privateHost/);
  assert.match(service, /maxRedirects: 0/);
});
