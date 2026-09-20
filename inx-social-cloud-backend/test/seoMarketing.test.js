const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.join(__dirname, '..');
const repoRoot = path.join(backendRoot, '..');
const readBackend = relative => fs.readFileSync(path.join(backendRoot, relative), 'utf8');
const readRepo = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const canonicalRoutes = [
  'social-media-scheduler',
  'bulk-social-media-scheduler',
  'social-media-content-calendar',
  'social-media-analytics',
  'ai-social-media-tools',
  'ai-social-media-post-generator',
  'ai-carousel-post-generator',
  'ai-video-post-generator',
  'ai-ugc-ad-generator',
  'pricing'
];

test('homepage exposes complete canonical SEO metadata', () => {
  const landing = readBackend('public/landing.html');

  assert.match(landing, /<title>Social Media Scheduler &amp; AI Content Studio \| INXSocial<\/title>/);
  assert.match(landing, /<link rel="canonical" href="https:\/\/www\.inxsocial\.co\.uk\/">/);
  assert.match(landing, /<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">/);
  assert.match(landing, /og:image:type" content="image\/webp"/);
  assert.match(landing, /og:image:width" content="1200"/);
  assert.match(landing, /og:image:height" content="675"/);
  assert.match(landing, /rel="preload" as="image" href="\/assets\/landing-dashboard-20260919\.webp"/);
  assert.match(landing, /"@type":\["SoftwareApplication","WebApplication"\]/);
  assert.doesNotMatch(landing, /"url":"https:\/\/www\.inxsocial\.co\.uk\/#pricing"/);
});

test('homepage internally links to high-intent marketing pages', () => {
  const landing = readBackend('public/landing.html');

  for (const route of [
    'social-media-scheduler',
    'bulk-social-media-scheduler',
    'social-media-content-calendar',
    'social-media-analytics',
    'ai-social-media-tools',
    'pricing'
  ]) {
    assert.equal(landing.includes('href="/' + route + '"'), true, route + ' should be internally linked');
  }
});

test('production sitemap contains canonical routes and no legacy html URLs', () => {
  const sitemap = readBackend('public/sitemap.xml');

  assert.match(sitemap, /<loc>https:\/\/www\.inxsocial\.co\.uk\/<\/loc>/);
  for (const route of canonicalRoutes) {
    assert.equal(
      sitemap.includes('<loc>https://www.inxsocial.co.uk/' + route + '</loc>'),
      true,
      route + ' should be in sitemap'
    );
  }
  assert.doesNotMatch(sitemap, /\.html<\/loc>/);
  assert.doesNotMatch(sitemap, /social\.inaxx\.co\.uk/);
});

test('robots advertises the canonical sitemap without blocking public marketing pages', () => {
  const robots = readBackend('public/robots.txt');

  assert.match(robots, /Sitemap: https:\/\/www\.inxsocial\.co\.uk\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /Disallow: \/social-media-scheduler/);
});

test('production gateway serves canonical SEO routes through Next and permanently redirects legacy URLs', () => {
  const app = readBackend('src/app.js');

  assert.match(app, /SEO_MARKETING_ROUTES = new Map/);
  assert.match(app, /X-INX-Landing', 'next-seo'/);
  for (const route of canonicalRoutes) {
    assert.equal(app.includes("['/" + route + "'"), true, route + ' should be proxied');
  }

  assert.match(app, /'\/social-media-scheduler\.html': '\/social-media-scheduler'/);
  assert.match(app, /'\/bulk-social-media-scheduler\.html': '\/bulk-social-media-scheduler'/);
  assert.match(app, /'\/pricing\.html': '\/pricing'/);
  assert.match(app, /'\/ai-ugc-ad-generator\.html': '\/ai-ugc-ad-generator'/);
});

test('Next marketing layer has unique page content, metadata and duplicate-index protection', () => {
  const seoData = readRepo('landing-next/lib/seo-pages.ts');
  const seoPage = readRepo('landing-next/app/seo/[slug]/page.tsx');
  const nextConfig = readRepo('landing-next/next.config.ts');
  const nextRobots = readRepo('landing-next/public/robots.txt');
  const layout = readRepo('landing-next/app/layout.tsx');

  for (const route of canonicalRoutes) {
    assert.equal(seoData.includes('"' + route + '"'), true, route + ' needs page data');
    assert.equal(nextConfig.includes(route), true, route + ' needs a public rewrite');
  }

  assert.match(seoPage, /generateMetadata/);
  assert.match(seoPage, /BreadcrumbList/);
  assert.match(seoPage, /FAQPage/);
  assert.match(seoPage, /fetchPriority="high"/);
  assert.match(nextRobots, /Disallow: \//);
  assert.match(layout, /Social Media Scheduler & AI Content Studio \| INXSocial/);
  assert.match(layout, /landing-dashboard-20260919\.webp/);
  assert.doesNotMatch(layout, /inx-social-dashboard\.jpg/);
});


test('canonical SEO pages retain resilient 200 fallbacks and deep internal links', () => {
  const app = readBackend('src/app.js');
  const landing = readBackend('public/landing.html');
  const seoPage = readRepo('landing-next/app/seo/[slug]/page.tsx');

  assert.match(app, /buildSeoFallbackDocuments/);
  assert.match(app, /legacy-seo-fallback/);
  assert.doesNotMatch(app, /res\.redirect\(302, SEO_MARKETING_ROUTES/);
  assert.match(app, /res\.redirect\(308,/);

  for (const href of [
    '/ai-social-media-post-generator',
    '/ai-carousel-post-generator',
    '/ai-video-post-generator',
    '/ai-ugc-ad-generator'
  ]) {
    assert.equal(landing.includes(`href="${href}"`), true, `${href} should receive a contextual homepage link`);
  }

  for (const entity of ['Organization','Brand','WebSite','SoftwareApplication','BreadcrumbList','FAQPage']) {
    assert.equal(seoPage.includes(`"@type": "${entity}"`) || seoPage.includes(`"@type": ["SoftwareApplication", "WebApplication"]`), true, `${entity} should be represented in SEO page schema`);
  }

  assert.match(seoPage, /primaryImageOfPage/);
  assert.match(seoPage, /INTRO_HEADINGS/);
  assert.match(seoPage, /HERO_IMAGE_ALTS/);
});
