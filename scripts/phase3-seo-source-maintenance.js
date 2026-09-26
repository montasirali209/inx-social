'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apply = process.argv.includes('--apply');
const check = process.argv.includes('--check') || !apply;

const files = {
  seoPages: path.join(root, 'landing-next', 'lib', 'seo-pages.ts'),
  backendRobots: path.join(root, 'inx-social-cloud-backend', 'public', 'robots.txt'),
  landingRobots: path.join(root, 'landing-next', 'public', 'robots.txt'),
  backendSitemap: path.join(root, 'inx-social-cloud-backend', 'public', 'sitemap.xml'),
  nextSitemap: path.join(root, 'landing-next', 'app', 'sitemap.ts')
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeIfChanged(file, next) {
  const current = read(file);
  if (current === next) return false;
  if (apply) fs.writeFileSync(file, next);
  return true;
}

function extractSeoSlugs(source) {
  const slugs = [];
  for (const match of source.matchAll(/\bslug:\s*"([^"]+)"/g)) {
    const slug = String(match[1] || '').trim();
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs.sort();
}

function expectedRobots() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    'Sitemap: https://www.inxsocial.co.uk/sitemap.xml',
    'Sitemap: https://www.inxsocial.co.uk/blog/sitemap.xml',
    ''
  ].join('\n');
}

function existingLastmods(source) {
  const map = new Map();
  for (const match of String(source || '').matchAll(/<url>\s*<loc>https:\/\/www\.inxsocial\.co\.uk([^<]*)<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>\s*<\/url>/g)) {
    map.set(match[1] || '/', match[2]);
  }
  return map;
}

function expectedSitemap(slugs, currentSource) {
  const urls = ['/', ...slugs.map(slug => '/' + slug), '/blog'];
  const lastmods = existingLastmods(currentSource);
  const today = new Date().toISOString().slice(0, 10);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(url => [
      '  <url>',
      '    <loc>https://www.inxsocial.co.uk' + url + '</loc>',
      '    <lastmod>' + (lastmods.get(url) || today) + '</lastmod>',
      '  </url>'
    ].join('\n')),
    '</urlset>',
    ''
  ].join('\n');
}

function auditSeoDefinitions(source, slugs) {
  const issues = [];
  if (!slugs.length) issues.push('No SEO page slugs were found.');

  for (const slug of slugs) {
    const key = '"' + slug + '": {';
    const start = source.indexOf(key);
    if (start < 0) {
      issues.push('SEO page object missing for ' + slug);
      continue;
    }
    const nextStart = source.indexOf('\n  "', start + key.length);
    const block = source.slice(start, nextStart > start ? nextStart : source.indexOf('\n};', start));
    for (const field of ['title:', 'metaDescription:', 'h1:', 'related:']) {
      if (!block.includes(field)) issues.push(slug + ' is missing ' + field.replace(':', ''));
    }
  }

  const nextSitemap = read(files.nextSitemap);
  if (!/seoPageSlugs/.test(nextSitemap)) issues.push('Next.js sitemap is not driven by seoPageSlugs.');
  return issues;
}

function main() {
  const seoSource = read(files.seoPages);
  const slugs = extractSeoSlugs(seoSource);
  const structuralIssues = auditSeoDefinitions(seoSource, slugs);
  const robots = expectedRobots();
  const sitemap = expectedSitemap(slugs, read(files.backendSitemap));

  const changed = [];
  if (writeIfChanged(files.backendRobots, robots)) changed.push(path.relative(root, files.backendRobots));
  if (writeIfChanged(files.landingRobots, robots)) changed.push(path.relative(root, files.landingRobots));
  if (writeIfChanged(files.backendSitemap, sitemap)) changed.push(path.relative(root, files.backendSitemap));

  const result = {
    ok: structuralIssues.length === 0 && (!check || changed.length === 0),
    mode: apply ? 'apply' : 'check',
    seoPages: slugs.length,
    changed,
    structuralIssues
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  if (structuralIssues.length) process.exit(2);
  if (check && changed.length) process.exit(1);
}

main();
