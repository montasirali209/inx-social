const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('public AI video showcase exposes live marketing-safe catalogue data', () => {
  const app = read('src/app.js');
  const registry = read('src/services/videoModelRegistryService.js');
  const showcaseBlock = registry.match(/async function publicShowcase[\s\S]*?(?=function validateRepresentativeModels)/)?.[0] || '';

  assert.match(app, /\/api\/public\/video-models/);
  assert.match(app, /videoModelRegistry\.publicShowcase/);
  assert.match(app, /stale-while-revalidate=1800/);
  assert.match(showcaseBlock, /generationReady/);
  assert.match(showcaseBlock, /releasedAt/);
  assert.match(showcaseBlock, /modeCounts/);
  assert.match(showcaseBlock, /creatorCount/);
  assert.doesNotMatch(showcaseBlock, /providerCostUsd|pricingOverview|rawCapabilities/);
});

test('homepage server-renders live model count and latest model cards', () => {
  const page = read('../landing-next/app/page.tsx');
  const body = read('../landing-next/public/landing-body.html');
  const helper = read('../landing-next/lib/video-model-showcase.ts');
  const layout = read('../landing-next/app/layout.tsx');

  assert.match(page, /getVideoModelShowcase/);
  assert.match(page, /homepageModelShowcaseMarkup/);
  assert.match(page, /VIDEO_MODEL_COUNT_LABEL/);
  assert.match(body, /VIDEO_MODEL_SHOWCASE/);
  assert.match(body, /AI creation \+ multi-model Video Studio \+ social publishing/);
  assert.match(helper, /One studio\. \$\{escapeHtml\(label\)\} <span class="approved-video-nowrap">generation-ready<\/span> AI video models/);
  assert.match(helper, /approved-video-nowrap/);
  assert.match(helper, /Math\.floor\(safe \/ 10\) \* 10/);
  assert.match(layout, /AI Content, Video Studio & Social Publishing/);
  assert.doesNotMatch(body, /70\+ generation-ready models/);
});

test('AI video model directory is indexable, in sitemap and backed by a static fallback', () => {
  const page = read('../landing-next/app/ai-video-models/page.tsx');
  const config = read('../landing-next/next.config.ts');
  const sitemap = read('public/sitemap.xml');
  const fallback = read('public/ai-video-models.html');
  const app = read('src/app.js');

  assert.match(page, /AI Video Models & Multi-Model AI Video Studio/);
  assert.match(page, /getVideoModelShowcase\(100\)/);
  assert.match(page, /Latest generation-ready AI video models/);
  assert.match(page, /AI Recommended or Choose Model/);
  assert.match(page, /ItemList/);
  assert.match(sitemap, /\/ai-video-models/);
  assert.match(fallback, /multi-model AI Video Studio/i);
  assert.match(config, /source: "\/ai-video-models\.html"/);
  assert.match(app, /\['\/ai-video-models', '\/#ai'\]/);
});

test('SEO copy positions INXSocial as AI creation plus publishing and uses current credits', () => {
  const seo = read('../landing-next/lib/seo-pages.ts');
  const schema = read('../landing-next/public/schema.json');
  const pricing = read('public/pricing.html');

  assert.match(seo, /Multi-Model AI Video Studio & Generator/);
  assert.match(seo, /AI content creation and social publishing|multi-model AI Video Studio/);
  assert.match(seo, /Creator includes 300 monthly AI credits, Pro 900, Business 2,000 and Agency 4,000/);
  assert.doesNotMatch(seo, /Fast or Manual|150 monthly AI credits|Business 1,200|Agency 2,500/);
  assert.match(schema, /AI content creation and social publishing/);
  assert.match(schema, /Live multi-model AI Video Studio/);
  assert.match(pricing, /Multi-model AI Video Studio/);
});

test('Video Studio model picker surfaces release-aware Latest discovery without changing UGC routing', () => {
  const picker = read('frontend/src/components/ai-content-studio/VideoModelPicker.tsx');
  const api = read('frontend/src/lib/ai-next-studio-api.ts');
  const router = read('frontend/src/components/ai-content-studio/GenerationModalRouter.tsx');

  assert.match(api, /releasedAt\?: string \| null/);
  assert.match(picker, /type Category = 'latest'/);
  assert.match(picker, /label: 'Latest'/);
  assert.match(picker, /isRecentModel/);
  assert.match(picker, />New</);
  assert.match(router, /return <GenerationModal \{\.\.\.props\} \/>/);
});
