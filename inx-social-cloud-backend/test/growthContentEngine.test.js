const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 2 Content Engine is self-hosted and BabyLoveGrowth is no longer a runtime dependency', () => {
  const packageJson = JSON.parse(read('../landing-next/package.json'));
  const client = read('../landing-next/app/blog/lib/blog-client.ts');
  const service = read('src/services/growthContentService.js');

  assert.equal(packageJson.dependencies?.['babylovegrowth-next-js-blog'], undefined);
  assert.doesNotMatch(client, /babylovegrowth/i);
  assert.match(client, /\/api\/growth-content/);
  assert.match(service, /babyLoveGrowthRequired: false/);
  assert.match(service, /INXSOCIAL_SELF_HOSTED/);
});

test('Content Engine enforces draft approval before publishing', () => {
  const service = read('src/services/growthContentService.js');
  const routes = read('src/routes/adminRoutes.js');

  assert.match(service, /DRAFT: 'DRAFT'/);
  assert.match(service, /APPROVED: 'APPROVED'/);
  assert.match(service, /PUBLISHED: 'PUBLISHED'/);
  assert.match(service, /Approve the article before publishing it/);
  assert.match(service, /Unpublish the article before editing it/);
  assert.match(service, /Unpublish the article before changing its featured image/);
  assert.match(routes, /content-engine\/drafts', requireSuperAdmin/);
  assert.match(routes, /articles\/:id\/approve', requireSuperAdmin/);
  assert.match(routes, /articles\/:id\/publish', requireSuperAdmin/);
});

test('Content Engine creates evidence-backed SEO content with quality controls', () => {
  const service = read('src/services/growthContentService.js');

  assert.match(service, /web_search/);
  assert.match(service, /VERIFIED SOURCES/);
  assert.match(service, /qualityReview/);
  assert.match(service, /meta_description/);
  assert.match(service, /FAQPage/);
  assert.match(service, /Article'/);
  assert.match(service, /relatedInternalLinks/);
  assert.match(service, /sourceCount/);
  assert.match(service, /wordCount/);
});

test('Published blog reads self-hosted content and renders evidence sections', () => {
  const articlePage = read('../landing-next/app/blog/[slug]/page.tsx');
  const sitemap = read('../landing-next/app/blog/sitemap.xml/route.ts');

  assert.match(articlePage, /Research sources/);
  assert.match(articlePage, /Frequently asked questions/);
  assert.match(articlePage, /Related INXSocial tools/);
  assert.match(articlePage, /article\.sources/);
  assert.match(articlePage, /article\.internalLinks/);
  assert.match(sitemap, /getSitemapEntries/);
});

test('Generated Content Engine images use generated-media storage and a crawlable public route', () => {
  const storage = read('src/services/mediaObjectStorageService.js');
  const service = read('src/services/growthContentService.js');
  const app = read('src/app.js');

  assert.match(storage, /'growth-content'/);
  assert.match(service, /featured_image_url: '\/content-media\//);
  assert.match(app, /app\.get\('\/content-media\/:id'/);
  assert.doesNotMatch(service, /featured_image_url: '\/api\/growth-content\/media\//);
});

test('Admin Content Engine exposes opportunity-to-draft editorial workflow', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');

  assert.match(html, /data-page="contentEngine"/);
  assert.match(html, /Opportunity → draft/);
  assert.match(html, /Manual override/);
  assert.match(html, /Content library/);
  assert.match(js, /loadContentEngine/);
  assert.match(js, /generateContentDraft/);
  assert.match(js, /runContentArticleAction\('approve'/);
  assert.match(js, /runContentArticleAction\('publish'/);
});
