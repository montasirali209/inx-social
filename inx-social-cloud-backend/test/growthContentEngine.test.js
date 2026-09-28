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
  assert.doesNotMatch(service, /Unpublish the article before changing its featured image/);
  assert.match(service, /const previousStorage = article\.featured_image_storage/);
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
  assert.match(service, /BlogPosting'/);
  assert.match(service, /relatedInternalLinks/);
  assert.match(service, /sourceCount/);
  assert.match(service, /wordCount/);
});

test('SEO featured images are generated through OpenAI only', () => {
  const service = read('src/services/growthContentService.js');
  const imagePath = service.slice(service.indexOf('async function generateFeaturedImage('), service.indexOf('async function imageBuffer('));
  assert.match(imagePath, /api\.openai\.com\/v1\/images\/generations/);
  assert.match(imagePath, /env\.openaiImage\.apiKey/);
  assert.match(imagePath, /imageProvider: 'openai'/);
  assert.doesNotMatch(service, /runware\.generateImages|require\('\.\/runwareService'\)/);
});

test('editorial conversion skill accepts only a relevant verified page and real section', () => {
  const skills = require('../src/services/growthSeoSkillRegistry');
  const { approvedEditorialPromo } = require('../src/services/growthContentService');
  const markdown = '## Answer\nHelpful context.\n## Next steps\nMore detail.\n';
  const links = [{ url: '/seo/bulk-social-media-scheduler' }];
  const promo = {
    enabled: true, title: 'Schedule the posts', description: 'Prepare a batch of posts.',
    label: 'Explore scheduler', url: links[0].url, before_heading: 'Next steps'
  };
  assert.ok(skills.SKILLS.some(skill => skill.key === 'EDITORIAL_CONVERSION'));
  assert.deepEqual(approvedEditorialPromo(promo, markdown, links), {
    title: promo.title, description: promo.description, label: promo.label,
    url: promo.url, before_heading: promo.before_heading
  });
  assert.equal(approvedEditorialPromo({ ...promo, url: '/unverified-page' }, markdown, links), null);
  assert.equal(approvedEditorialPromo({ ...promo, before_heading: 'Missing heading' }, markdown, links), null);
  assert.equal(approvedEditorialPromo({ ...promo, before_heading: 'Answer' }, markdown, links), null);
  assert.equal(approvedEditorialPromo({ ...promo, enabled: false }, markdown, links), null);
});

test('self-hosted articles keep a contextual INXSocial conversion card as a safe fallback', () => {
  const service = read('src/services/growthContentService.js');
  const page = read('../landing-next/app/blog/[slug]/page.tsx');

  assert.match(service, /function fallbackEditorialPromo/);
  assert.match(service, /Put this into practice with INXSocial/);
  assert.match(service, /approvedEditorialPromo\(article\.editorial_promo/);
  assert.match(service, /fallbackEditorialPromo\(article, mergedInternalLinks\)/);
  assert.match(service, /article\.content_source === 'BABYLOVEGROWTH_IMPORTED'/);
  assert.match(page, /inx-blog-inline-promo/);
  assert.match(page, /Suggested next step/);
});

test('Content Engine can revise the same draft from senior-editor feedback', () => {
  const service = read('src/services/growthContentService.js');
  const skills = read('src/services/growthSeoSkillRegistry.js');

  assert.match(service, /async function reviseDraft/);
  assert.match(service, /PREVIOUS DRAFT TO REVISE/);
  assert.match(service, /Required fixes:/);
  assert.match(service, /previousArticle: article/);
  assert.match(service, /revisionNumber/);
  assert.match(skills, /Target a backend editorial quality score of at least 90\/100/);
});

test('Published blog reads self-hosted content and renders evidence sections', () => {
  const articlePage = read('../landing-next/app/blog/[slug]/page.tsx');
  const sitemap = read('../landing-next/app/blog/sitemap.xml/route.ts');

  assert.match(articlePage, /Research sources/);
  assert.match(articlePage, /Frequently asked questions/);
  assert.match(articlePage, /Recommended INXSocial tools|Useful INXSocial tools for the next step/);
  assert.match(articlePage, /article\.sources/);
  assert.match(articlePage, /article\.internalLinks/);
  assert.match(sitemap, /getSitemapEntries/);
});

test('Generated Content Engine images use generated-media storage and one canonical public version route', () => {
  const storage = read('src/services/mediaObjectStorageService.js');
  const service = read('src/services/growthContentService.js');
  const app = read('src/app.js');

  assert.match(storage, /'growth-content'/);
  assert.match(service, /featured_image_url: '\/content-media\//);
  assert.match(service, /return '\/content-media\/' \+ encodeURIComponent\(id\) \+ '\/' \+ version/);
  assert.match(app, /app\.get\('\/content-media\/:id'/);
  assert.doesNotMatch(service, /return clean \+ '\/'/);
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
