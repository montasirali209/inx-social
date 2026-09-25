const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const retiredMarketingRoutes = [
  '/social-media-scheduler.html',
  '/bulk-social-media-scheduler.html',
  '/social-media-content-calendar.html',
  '/social-media-analytics.html',
  '/ai-social-media-tools.html',
  '/pricing.html',
  '/free-social-media-tools.html',
  '/social-media-caption-generator.html'
];

test('public landing has canonical metadata, social previews and structured software data', () => {
  const landing = read('public/landing.html');

  assert.match(landing, /<link rel="canonical" href="https:\/\/www\.inxsocial\.co\.uk\/">/);
  assert.match(landing, /property="og:title"/);
  assert.match(landing, /name="twitter:card" content="summary_large_image"/);
  assert.equal(landing.includes('>\\n  <meta property="og:image:width"'), false);

  const jsonLd = landing.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(jsonLd, 'The public landing must include JSON-LD structured data.');

  const structuredData = JSON.parse(jsonLd[1]);
  const graph = Array.isArray(structuredData['@graph']) ? structuredData['@graph'] : [structuredData];
  const software = graph.find(item => {
    const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
    return types.includes('SoftwareApplication');
  });

  assert.ok(software);
  assert.equal(software.url, 'https://www.inxsocial.co.uk/');
  assert.equal(software.applicationSubCategory, 'Social Media Management');
  assert.ok(Array.isArray(software.offers) && software.offers.length > 0);
  assert.ok(software.offers.every(offer => offer.priceCurrency === 'GBP'));
  assert.ok(software.offers.every(offer => offer.url === 'https://www.inxsocial.co.uk/pricing'));
});

test('homepage navigation keeps core anchors and adds clean search-intent links', () => {
  const landing = read('public/landing.html');

  for (const href of ['#capabilities','#workflow','#platforms','#ai','#pricing']) {
    assert.equal(landing.includes(`href="${href}"`), true, `${href} should remain linked from the homepage navigation`);
  }

  for (const href of [
    '/social-media-scheduler',
    '/bulk-social-media-scheduler',
    '/social-media-content-calendar',
    '/social-media-analytics',
    '/ai-social-media-tools',
    '/pricing'
  ]) {
    assert.equal(landing.includes(`href="${href}"`), true, `${href} should be linked from the canonical homepage`);
  }

  assert.doesNotMatch(landing, />Free tools</);
  for (const route of retiredMarketingRoutes) {
    assert.equal(landing.includes(`href="${route}"`), false, `${route} must not be linked as a duplicate html page`);
  }
});

test('robots and sitemap expose the canonical public marketing page cluster', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');

  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/www\.inxsocial\.co\.uk\/sitemap\.xml/);
  assert.match(robots, /Sitemap: https:\/\/www\.inxsocial\.co\.uk\/blog\/sitemap\.xml/);
  assert.equal((sitemap.match(/<url>/g) || []).length, 13);
  assert.match(sitemap, /<loc>https:\/\/www\.inxsocial\.co\.uk\/<\/loc>/);
  assert.match(sitemap, /https:\/\/www\.inxsocial\.co\.uk\/social-media-scheduler/);
  assert.match(sitemap, /https:\/\/www\.inxsocial\.co\.uk\/ai-social-media-campaign-generator/);
  assert.match(sitemap, /https:\/\/www\.inxsocial\.co\.uk\/pricing/);
  assert.match(sitemap, /https:\/\/www\.inxsocial\.co\.uk\/blog/);

  for (const route of retiredMarketingRoutes) {
    assert.equal(sitemap.includes(route), false, `${route} must not appear in the canonical sitemap`);
  }
});

test('legacy marketing URLs retain permanent redirects to clean canonical pages', () => {
  const app = read('src/app.js');

  for (const route of retiredMarketingRoutes) {
    assert.equal(app.includes(`'${route}'`), true, `${route} should be preserved as a redirect`);
  }

  assert.match(app, /LEGACY_MARKETING_REDIRECTS/);
  assert.match(app, /res\.redirect\(301,/);
  assert.match(app, /'\/social-media-scheduler\.html': '\/social-media-scheduler'/);
  assert.match(app, /'\/pricing\.html': '\/pricing'/);
});
