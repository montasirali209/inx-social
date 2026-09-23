const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.join(__dirname, '..');
const repoRoot = path.join(backendRoot, '..');
const readBackend = relative => fs.readFileSync(path.join(backendRoot, relative), 'utf8');
const readRepo = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

test('homepage entity graph cleanly separates company, brand, website and software', () => {
  const schema = JSON.parse(readRepo('landing-next/public/schema.json'));
  const graph = schema['@graph'];
  const organization = graph.find(item => item['@type'] === 'Organization');
  const brand = graph.find(item => item['@type'] === 'Brand');
  const website = graph.find(item => item['@type'] === 'WebSite');
  const webpage = graph.find(item => item['@type'] === 'WebPage');
  const software = graph.find(item => Array.isArray(item['@type']) && item['@type'].includes('SoftwareApplication'));
  assert.equal(organization['@id'], 'https://inaxx.co.uk/#organization');
  assert.equal(organization.name, 'INAXX LTD');
  assert.equal(organization.logo, undefined);
  assert.equal(brand['@id'], 'https://www.inxsocial.co.uk/#brand');
  assert.match(brand.logo, /inx-social-logo\.png$/);
  assert.equal(website.publisher['@id'], organization['@id']);
  assert.equal(software.brand['@id'], brand['@id']);
  assert.equal(software.publisher['@id'], organization['@id']);
  assert.equal(webpage.about['@id'], software['@id']);
  assert.equal(webpage.primaryImageOfPage.width, 1200);
  assert.equal(webpage.primaryImageOfPage.height, 630);
  assert.match(webpage.primaryImageOfPage.url, /inxsocial-social-preview-v3\.jpg$/);
  assert.equal(webpage.dateModified, '2026-09-23');
});

test('homepage targets social media management intent with search-snippet-safe metadata', () => {
  const landing = readBackend('public/landing.html');
  const title = landing.match(/<title>(.*?)<\/title>/)?.[1] || '';
  const description = landing.match(/<meta name="description" content="([^"]+)"/)?.[1] || '';
  assert.equal(title, 'Social Media Management Platform, Scheduler &amp; AI | INXSocial');
  assert.ok(title.replace(/&amp;/g, '&').length <= 60);
  assert.ok(description.length >= 140 && description.length <= 160);
  assert.match(description, /multi-platform publishing/i);
  assert.match(description, /AI campaigns/i);
});

test('feature SEO titles and descriptions are unique and bounded for SERP snippets', () => {
  const source = readRepo('landing-next/lib/seo-pages.ts');
  const matches = [...source.matchAll(/title:\s*"([^"]+)"[\s\S]{0,350}?metaDescription:\s*\n?\s*"([^"]+)"/g)];
  assert.equal(matches.length, 11);
  const titles = matches.map(match => match[1]);
  const descriptions = matches.map(match => match[2]);
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(new Set(descriptions).size, descriptions.length);
  for (const title of titles) assert.ok(title.length >= 35 && title.length <= 65, `Title length out of range: ${title.length} — ${title}`);
  for (const description of descriptions) assert.ok(description.length >= 120 && description.length <= 165, `Meta description length out of range: ${description.length} — ${description}`);
});

test('canonical acquisition pages stay indexable if the Next landing service is unavailable', () => {
  const app = readBackend('src/app.js');
  assert.match(app, /buildSeoFallbackDocuments/);
  assert.match(app, /legacy-seo-fallback/);
  assert.match(app, /canonical static fallback/);
  assert.doesNotMatch(app, /res\.redirect\(302, SEO_MARKETING_ROUTES/);
  assert.match(app, /res\.redirect\(308,/);
});

test('duplicate Railway host is noindex while canonical host handling remains explicit', () => {
  const app = readBackend('src/app.js');
  assert.match(app, /CANONICAL_BROWSER_HOST = 'www\.inxsocial\.co\.uk'/);
  assert.match(app, /MIGRATION_BROWSER_HOSTS/);
  assert.match(app, /host\.endsWith\('\.up\.railway\.app'\)/);
  assert.match(app, /X-Robots-Tag', 'noindex, nofollow, noarchive'/);
});

test('homepage passes contextual authority into every live AI acquisition page', () => {
  const landing = readBackend('public/landing.html');
  for (const route of [
    '/ai-social-media-campaign-generator',
    '/ai-social-media-post-generator',
    '/ai-carousel-post-generator',
    '/ai-video-post-generator',
    '/ai-ugc-ad-generator'
  ]) assert.equal(landing.includes(`class="ai-feature-link" href="${route}"`), true, route);
});

test('feature pages carry complete entities, breadcrumbs, image data and expanded headings', () => {
  const page = readRepo('landing-next/app/seo/[slug]/page.tsx');
  assert.match(page, /"@type": "Organization"/);
  assert.match(page, /"@type": "Brand"/);
  assert.match(page, /"@type": "WebSite"/);
  assert.match(page, /"@type": \["SoftwareApplication", "WebApplication"\]/);
  assert.match(page, /primaryImageOfPage/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /FAQPage/);
  assert.match(page, /INTRO_HEADINGS/);
  assert.match(page, /HERO_IMAGE_ALTS/);
  assert.doesNotMatch(page, /<h2>\{page\.h1\}<\/h2>/);
});

test('sitemap exposes only canonical acquisition URLs with current modification dates', () => {
  const sitemap = readBackend('public/sitemap.xml');
  assert.equal((sitemap.match(/<url>/g) || []).length, 12);
  assert.match(sitemap, /<loc>https:\/\/www\.inxsocial\.co\.uk\/ai-social-media-campaign-generator<\/loc>\s*<lastmod>2026-09-23<\/lastmod>/);
  assert.ok((sitemap.match(/<lastmod>2026-09-23<\/lastmod>/g) || []).length >= 7);
  assert.doesNotMatch(sitemap, /\.html<\/loc>/);
  assert.doesNotMatch(sitemap, /social\.inaxx\.co\.uk|up\.railway\.app/);
});


test('all AI Content Studio SEO pages use one valid real workspace screenshot', () => {
  const page = readRepo('landing-next/app/seo/[slug]/page.tsx');
  const aiRoutes = [
    'ai-social-media-tools',
    'ai-social-media-campaign-generator',
    'ai-social-media-post-generator',
    'ai-carousel-post-generator',
    'ai-video-post-generator',
    'ai-ugc-ad-generator'
  ];

  for (const route of aiRoutes) {
    assert.match(page, new RegExp(`"${route}"`));
  }
  assert.match(page, /const AI_CONTENT_STUDIO_SLUGS = new Set/);
  assert.match(page, /src: "\/assets\/ai-content-studio-seo\.webp"/);
  assert.match(page, /width: 800/);
  assert.match(page, /height: 563/);
  assert.match(page, /Actual AI Content Studio workspace/);

  for (const route of aiRoutes) {
    const fallback = readBackend(`public/${route}.html`);
    assert.match(fallback, /<img src="\/assets\/ai-content-studio-seo\.webp" width="800" height="563"/);
  }

  const binaryPaths = [
    path.join(repoRoot, 'landing-next/public/assets/ai-content-studio-seo.webp'),
    path.join(backendRoot, 'public/assets/ai-content-studio-seo.webp')
  ];
  for (const binaryPath of binaryPaths) {
    const asset = fs.readFileSync(binaryPath);
    assert.ok(asset.length > 15000, 'AI Content Studio screenshot should be a non-trivial binary asset');
    assert.equal(asset.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(asset.subarray(8, 12).toString('ascii'), 'WEBP');
  }
});
test('marketing headers use one wordmark scale and keep mobile actions right-aligned', () => {
  const seoCss = readRepo('landing-next/app/seo/[slug]/seo-page.module.css');
  const landingCss = readRepo('landing-next/styles/landing-redesign.css');
  const fallbackCss = readBackend('public/seo-pages.css');

  assert.match(seoCss, /\.brand img\{[\s\S]*?width:168px;[\s\S]*?height:56px;[\s\S]*?object-fit:cover/);
  assert.match(seoCss, /@media\(max-width:680px\)[\s\S]*?\.brand img\{width:150px;height:52px;object-fit:cover/);
  assert.match(landingCss, /@media\(max-width:860px\)[\s\S]*?\.nav-actions\{margin-left:auto\}/);
  assert.match(fallbackCss, /\.seo-page \.brand img\{width:168px;height:56px;object-fit:cover/);
  assert.match(fallbackCss, /@media\(max-width:760px\)\{\.seo-page \.brand img\{width:150px;height:52px/);
});

test('every canonical acquisition route has a static 200 fallback document', () => {
  for (const route of [
    'social-media-scheduler',
    'bulk-social-media-scheduler',
    'social-media-content-calendar',
    'social-media-analytics',
    'ai-social-media-tools',
    'ai-social-media-campaign-generator',
    'ai-social-media-post-generator',
    'ai-carousel-post-generator',
    'ai-video-post-generator',
    'ai-ugc-ad-generator',
    'pricing'
  ]) {
    const filePath = path.join(backendRoot, 'public', route + '.html');
    assert.equal(fs.existsSync(filePath), true, route + ' should have a static fallback');
    const source = fs.readFileSync(filePath, 'utf8');
    assert.match(source, /<meta name="robots" content="index,follow/);
  }
});
