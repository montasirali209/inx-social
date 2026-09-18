const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('public landing has canonical metadata, social previews and structured software data', () => {
  const landing = read('public/landing.html');
  assert.match(landing, /<link rel="canonical" href="https:\/\/www\.inxsocial\.co\.uk\/">/);
  assert.match(landing, /property="og:title"/);
  assert.match(landing, /name="twitter:card" content="summary_large_image"/);
  const jsonLd = landing.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(jsonLd, 'The public landing must include JSON-LD structured data.');
  const structuredData = JSON.parse(jsonLd[1]);
  const graph = Array.isArray(structuredData['@graph']) ? structuredData['@graph'] : [structuredData];
  const software = graph.find(item => {
    const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
    return types.includes('SoftwareApplication');
  });
  assert.ok(software, 'The JSON-LD graph must describe INX Social as a SoftwareApplication.');
  assert.equal(software.url, 'https://www.inxsocial.co.uk/');
  assert.equal(software.applicationSubCategory, 'Social Media Management');
  assert.ok(Array.isArray(software.offers) && software.offers.length > 0, 'The SoftwareApplication must expose its public offers.');
  assert.ok(software.offers.every(offer => offer.priceCurrency === 'GBP'), 'Every structured public offer must use GBP.');
  assert.match(landing, /All-in-One Social Media Management/);
  assert.match(landing, /AI Content Studio/);
});

test('served homepage contains crawlable links to the public SEO landing pages', () => {
  const landing = read('public/landing.html');
  for (const href of [
    '/social-media-scheduler.html',
    '/bulk-social-media-scheduler.html',
    '/social-media-content-calendar.html',
    '/ai-social-media-tools.html',
    '/social-media-analytics.html',
    '/pricing.html'
  ]) {
    assert.equal(landing.includes(`href="${href}"`), true, `${href} is missing from homepage SEO navigation`);
  }
});

test('robots exposes public/noindexable documents while blocking API and admin crawl paths', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /Disallow: \/studio\//);
  assert.doesNotMatch(robots, /Disallow: \/portal\//);
  assert.doesNotMatch(robots, /Disallow: \/app\//);
  assert.match(robots, /Sitemap: https:\/\/www\.inxsocial\.co\.uk\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/www\.inxsocial\.co\.uk\/privacy\.html/);
  assert.match(sitemap, /https:\/\/www\.inxsocial\.co\.uk\/bulk-social-media-scheduler\.html/);
  assert.match(sitemap, /https:\/\/www\.inxsocial\.co\.uk\/social-media-content-calendar\.html/);
  assert.doesNotMatch(sitemap, /\/studio\//);
  assert.doesNotMatch(sitemap, /\/portal\//);
  assert.doesNotMatch(sitemap, /\/app\//);
});

test('bulk scheduler landing page has unique canonical metadata and structured FAQ content', () => {
  const page = read('public/bulk-social-media-scheduler.html');
  assert.match(page, /<title>Bulk Social Media Scheduler for Multiple Accounts \| INXSocial<\/title>/);
  assert.match(page, /<link rel="canonical" href="https:\/\/www\.inxsocial\.co\.uk\/bulk-social-media-scheduler\.html">/);
  assert.match(page, /"@type":"FAQPage"/);
  assert.match(page, /bulk schedule social media posts/i);
  assert.match(page, /href="\/social-media-scheduler\.html"/);
});

test('content calendar landing page has unique canonical metadata and structured FAQ content', () => {
  const page = read('public/social-media-content-calendar.html');
  assert.match(page, /<title>Social Media Content Calendar & Publishing Planner \| INXSocial<\/title>/);
  assert.match(page, /<link rel="canonical" href="https:\/\/www\.inxsocial\.co\.uk\/social-media-content-calendar\.html">/);
  assert.match(page, /"@type":"FAQPage"/);
  assert.match(page, /visual content calendar/i);
  assert.match(page, /href="\/bulk-social-media-scheduler\.html"/);
});