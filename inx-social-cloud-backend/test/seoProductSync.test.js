'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.join(__dirname, '..');
const repoRoot = path.join(backendRoot, '..');
const readBackend = relative => fs.readFileSync(path.join(backendRoot, relative), 'utf8');
const readRepo = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const slugs = [
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
];

function seoMeta(slug) {
  const source = readRepo('landing-next/lib/seo-pages.ts');
  const marker = slug === 'pricing' ? '  pricing: {' : `  "${slug}": {`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${slug} must exist in the Next SEO source of truth`);
  const head = source.slice(start, start + 900);
  const title = head.match(/title:\s*"([^"]+)"/)?.[1];
  const description = head.match(/metaDescription:\s*\n?\s*"([^"]+)"/)?.[1];
  assert.ok(title, `${slug} needs a title`);
  assert.ok(description, `${slug} needs a meta description`);
  return { title, description };
}

function htmlTextTitle(source) {
  return source.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replaceAll('&amp;', '&').trim();
}

test('static marketing fallbacks mirror canonical Next metadata and clean URLs', () => {
  for (const slug of slugs) {
    const source = readBackend(`public/${slug}.html`);
    const expected = seoMeta(slug);
    const description = source.match(/<meta name="description" content="([^"]+)"/i)?.[1];
    const canonical = source.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];

    assert.equal(htmlTextTitle(source), expected.title, `${slug} title drifted from Next SEO`);
    assert.equal(description, expected.description, `${slug} description drifted from Next SEO`);
    assert.equal(canonical, `https://www.inxsocial.co.uk/${slug}`, `${slug} canonical must use the clean route`);

    for (const retired of [...slugs, 'ai-video-models']) {
      assert.equal(source.includes(`/${retired}.html`), false, `${slug} still internally links to retired /${retired}.html`);
      assert.equal(source.includes(`https://www.inxsocial.co.uk/${retired}.html`), false, `${slug} still declares a retired absolute SEO URL`);
    }
  }
});

test('UGC static fallback describes the current persistent UGC Studio without touching runtime implementation', () => {
  const source = readBackend('public/ai-ugc-ad-generator.html');
  assert.match(source, /reusable AI creators/i);
  assert.match(source, /up to eight uploaded product references/i);
  assert.match(source, /1, 5, 10, 15 or 20 variations/i);
  assert.match(source, /15, 20 or 30-second video lengths/i);
  assert.match(source, /Background rendering/i);
  assert.match(source, /Post-generation editor/i);
  assert.doesNotMatch(source, /UGC Ad Post sits alongside/i);
});

test('product sync remains represented across homepage, schema, sitemap and llms', () => {
  const landing = readRepo('landing-next/public/landing-body.html');
  const schema = JSON.parse(readRepo('landing-next/public/schema.json'));
  const sitemap = readBackend('public/sitemap.xml');
  const llms = readBackend('public/llms.txt');

  for (const route of [
    '/ai-social-media-campaign-generator',
    '/ai-video-post-generator',
    '/ai-ugc-ad-generator',
    '/bulk-social-media-scheduler'
  ]) {
    assert.equal(landing.includes(`href="${route}"`), true, `homepage should link to ${route}`);
    assert.equal(sitemap.includes(`https://www.inxsocial.co.uk${route}`), true, `sitemap should include ${route}`);
    assert.equal(llms.includes(`https://www.inxsocial.co.uk${route}`), true, `llms.txt should include ${route}`);
  }

  const software = schema['@graph'].find(item => Array.isArray(item['@type']) && item['@type'].includes('SoftwareApplication'));
  assert.ok(software);
  const features = software.featureList.join('\n');
  assert.match(features, /AI social media campaign generation/);
  assert.match(features, /Live multi-model AI Video Studio/);
  assert.match(features, /UGC Studio with reusable AI creators/);
  assert.match(features, /Bulk social media scheduling/);
});

test('Next keeps one canonical acquisition route per synchronized product workflow', () => {
  const nextConfig = readRepo('landing-next/next.config.ts');
  for (const slug of slugs) {
    assert.equal(nextConfig.includes(`"${slug}"`), true, `${slug} must remain a canonical Next route`);
  }
  assert.match(nextConfig, /source: `\/\$\{slug\}\.html`/);
  assert.match(nextConfig, /permanent: true/);
});
