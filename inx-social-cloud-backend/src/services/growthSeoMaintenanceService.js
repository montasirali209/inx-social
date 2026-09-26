'use strict';

const axios = require('axios');
const prisma = require('../db/prisma');
const growthContent = require('./growthContentService');
const growthOpportunities = require('./growthOpportunityService');

const SITE_ORIGIN = 'https://www.inxsocial.co.uk';
const STATE_KEY = 'growth_seo_maintenance_state_v1';
const LINK_GRAPH_KEY = 'growth_seo_internal_link_graph_v1';
const DEFAULT_MAX_PAGES = 120;
const CRAWL_CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 12000;

const STATIC_SEEDS = [
  '/',
  '/blog',
  '/social-media-scheduler',
  '/bulk-social-media-scheduler',
  '/social-media-content-calendar',
  '/social-media-analytics',
  '/ai-social-media-tools',
  '/ai-social-media-campaign-generator',
  '/ai-social-media-post-generator',
  '/ai-carousel-post-generator',
  '/ai-video-post-generator',
  '/ai-ugc-ad-generator',
  '/pricing'
];

function nowIso() {
  return new Date().toISOString();
}

function safeJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

async function readSetting(key) {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row ? safeJson(row.value, null) : null;
}

async function writeSetting(key, value, description) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value), description },
    update: { value: JSON.stringify(value), description }
  });
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x2F;/gi, '/');
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = String(html || '').match(pattern);
    if (match && match[1]) return stripTags(match[1]);
  }
  return '';
}

function attr(tag, name) {
  const pattern = new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\\'([^\\']*)\\'|([^\\s>]+))', 'i');
  const match = String(tag || '').match(pattern);
  return decodeHtml((match && (match[1] || match[2] || match[3])) || '');
}

function canonicalPath(value) {
  try {
    const url = new URL(String(value || ''), SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN) return '';
    let path = url.pathname || '/';
    if (path !== '/') path = path.replace(/\/+$/, '');
    return path || '/';
  } catch (_) {
    return '';
  }
}

function isCrawlablePath(path) {
  const clean = canonicalPath(path);
  if (!clean) return false;
  if (/^\/(?:api|app|admin|portal|studio|assets)(?:\/|$)/i.test(clean)) return false;
  if (/\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|xml|txt|woff2?|mp4|webm|pdf)$/i.test(clean)) return false;
  return true;
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value || ''), SITE_ORIGIN);
    url.hash = '';
    if (url.origin !== SITE_ORIGIN) return '';
    if (!isCrawlablePath(url.pathname)) return '';
    url.search = '';
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch (_) {
    return '';
  }
}

function sitemapUrls(xml) {
  const urls = [];
  for (const match of String(xml || '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    const url = normalizeUrl(decodeHtml(match[1]));
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function pageLinks(html) {
  const links = [];
  for (const match of String(html || '').matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi)) {
    const raw = decodeHtml(match[1] || match[2] || match[3] || '');
    if (!raw || raw.startsWith('#') || /^(?:mailto|tel|javascript):/i.test(raw)) continue;
    const url = normalizeUrl(raw);
    if (url && !links.includes(url)) links.push(url);
  }
  return links;
}

function imageStats(html) {
  const tags = String(html || '').match(/<img\b[^>]*>/gi) || [];
  let missingAlt = 0;
  let emptyAlt = 0;
  for (const tag of tags) {
    if (!/\balt\s*=/i.test(tag)) missingAlt += 1;
    else if (!attr(tag, 'alt').trim()) emptyAlt += 1;
  }
  return { images: tags.length, missingAlt, emptyAlt };
}

function schemaStats(html) {
  const scripts = Array.from(String(html || '').matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  let invalid = 0;
  for (const script of scripts) {
    try { JSON.parse(script[1]); } catch (_) { invalid += 1; }
  }
  return { schemaBlocks: scripts.length, invalidSchemaBlocks: invalid };
}

function inspectHtml(url, html, status, redirectHops, contentType) {
  const title = firstMatch(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]);
  const description = firstMatch(html, [
    /<meta\b[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i,
    /<meta\b[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*>/i
  ]);
  const canonical = firstMatch(html, [
    /<link\b[^>]*rel\s*=\s*["'][^"']*\bcanonical\b[^"']*["'][^>]*href\s*=\s*["']([^"']*)["'][^>]*>/i,
    /<link\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*rel\s*=\s*["'][^"']*\bcanonical\b[^"']*["'][^>]*>/i
  ]);
  const robots = firstMatch(html, [
    /<meta\b[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i,
    /<meta\b[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']robots["'][^>]*>/i
  ]);
  const h1Matches = Array.from(String(html || '').matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi));
  const headings = Array.from(String(html || '').matchAll(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)).map(function(match) {
    return { level: Number(match[1].slice(1)), text: stripTags(match[2]).slice(0, 180) };
  });
  const images = imageStats(html);
  const schema = schemaStats(html);
  const links = pageLinks(html);
  const path = canonicalPath(url);

  return {
    url,
    path,
    status: Number(status || 0),
    contentType: contentType || '',
    redirectHops: Number(redirectHops || 0),
    title,
    description,
    canonical: canonical || '',
    canonicalPath: canonicalPath(canonical),
    robots,
    noindex: /\bnoindex\b/i.test(robots),
    h1Count: h1Matches.length,
    h1: h1Matches[0] ? stripTags(h1Matches[0][1]).slice(0, 240) : '',
    headings,
    links,
    images: images.images,
    missingAlt: images.missingAlt,
    emptyAlt: images.emptyAlt,
    schemaBlocks: schema.schemaBlocks,
    invalidSchemaBlocks: schema.invalidSchemaBlocks
  };
}

async function fetchManual(url) {
  let current = url;
  let redirectHops = 0;
  for (let step = 0; step <= 5; step += 1) {
    try {
      const response = await axios.get(current, {
        timeout: REQUEST_TIMEOUT_MS,
        maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024,
        validateStatus: function() { return true; },
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'INXSocial-SEO-Maintenance/1.0'
        }
      });
      const status = Number(response.status || 0);
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location && step < 5) {
        redirectHops += 1;
        current = new URL(response.headers.location, current).toString();
        continue;
      }
      const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');
      return {
        requestedUrl: url,
        finalUrl: current,
        status,
        redirectHops,
        contentType: String(response.headers['content-type'] || ''),
        body
      };
    } catch (error) {
      return {
        requestedUrl: url,
        finalUrl: current,
        status: 0,
        redirectHops,
        contentType: '',
        body: '',
        error: String(error.message || 'Request failed').slice(0, 300)
      };
    }
  }
  return { requestedUrl: url, finalUrl: current, status: 0, redirectHops, contentType: '', body: '', error: 'Too many redirects' };
}

async function fetchText(path, accept) {
  const url = new URL(path, SITE_ORIGIN).toString();
  try {
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      maxContentLength: 2 * 1024 * 1024,
      validateStatus: function() { return true; },
      headers: {
        Accept: accept || 'application/xml,text/xml,text/plain,*/*',
        'User-Agent': 'INXSocial-SEO-Maintenance/1.0'
      }
    });
    return { status: response.status, body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '') };
  } catch (error) {
    return { status: 0, body: '', error: String(error.message || 'Request failed').slice(0, 300) };
  }
}

function issue(code, severity, page, detail, options) {
  const settings = options || {};
  return {
    id: code + ':' + Buffer.from(String(page || detail || code)).toString('base64url').slice(0, 48),
    code,
    severity,
    page: page || null,
    detail: String(detail || '').slice(0, 700),
    autoFixable: Boolean(settings.autoFixable),
    action: settings.action || (settings.autoFixable ? 'AUTO_FIX' : 'REVIEW'),
    status: settings.status || (settings.autoFixable ? 'FIXED' : 'OPEN')
  };
}

function duplicateIssues(pages, field, code, label) {
  const groups = new Map();
  for (const page of pages) {
    const value = String(page[field] || '').trim().toLowerCase();
    if (!value) continue;
    const group = groups.get(value) || [];
    group.push(page);
    groups.set(value, group);
  }
  const issues = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const page of group) {
      issues.push(issue(code, 'medium', page.path, label + ' is duplicated across: ' + group.map(function(item) { return item.path; }).join(', ')));
    }
  }
  return issues;
}

function classifyPageIssues(page, sitemapSet) {
  const issues = [];
  if (!page.status || page.status >= 400) {
    issues.push(issue('PAGE_UNAVAILABLE', 'critical', page.path, 'Page returned HTTP ' + (page.status || 'error') + '.'));
    return issues;
  }
  if (page.redirectHops > 1) issues.push(issue('REDIRECT_CHAIN', 'medium', page.path, page.redirectHops + ' redirects were required before the page resolved.'));
  if (page.noindex && sitemapSet.has(page.url)) issues.push(issue('NOINDEX_IN_SITEMAP', 'high', page.path, 'The URL is in a sitemap but declares noindex.'));
  if (!page.title) issues.push(issue('MISSING_TITLE', 'high', page.path, 'No HTML title was found.'));
  else if (page.title.length < 20 || page.title.length > 70) issues.push(issue('TITLE_LENGTH', 'low', page.path, 'Title length is ' + page.title.length + ' characters.'));
  if (!page.description) issues.push(issue('MISSING_META_DESCRIPTION', 'medium', page.path, 'No meta description was found.'));
  else if (page.description.length < 70 || page.description.length > 180) issues.push(issue('META_DESCRIPTION_LENGTH', 'low', page.path, 'Meta description length is ' + page.description.length + ' characters.'));
  if (!page.canonical) issues.push(issue('MISSING_CANONICAL', 'high', page.path, 'No canonical link was found.'));
  else if (page.canonicalPath && page.canonicalPath !== page.path) issues.push(issue('CANONICAL_MISMATCH', 'medium', page.path, 'Canonical points to ' + page.canonicalPath + '.'));
  if (page.h1Count !== 1) issues.push(issue('H1_COUNT', page.h1Count ? 'medium' : 'high', page.path, 'Expected one H1; found ' + page.h1Count + '.'));
  if (page.invalidSchemaBlocks) issues.push(issue('INVALID_JSON_LD', 'high', page.path, page.invalidSchemaBlocks + ' JSON-LD block(s) could not be parsed.'));
  if (page.missingAlt) issues.push(issue('MISSING_IMAGE_ALT', 'low', page.path, page.missingAlt + ' image(s) have no alt attribute.'));
  return issues;
}

function internalLinkIssues(pages, sitemapSet) {
  const issues = [];
  const pathSet = new Set(pages.map(function(page) { return page.path; }));
  const pageByUrl = new Map(pages.map(function(page) { return [page.url, page]; }));
  const inbound = new Map(pages.map(function(page) { return [page.path, 0]; }));

  for (const page of pages) {
    for (const link of page.links || []) {
      const target = pageByUrl.get(link);
      const targetPath = canonicalPath(link);
      if (targetPath && pathSet.has(targetPath)) inbound.set(targetPath, Number(inbound.get(targetPath) || 0) + 1);
      if (target && (!target.status || target.status >= 400)) {
        issues.push(issue('BROKEN_INTERNAL_LINK', 'high', page.path, page.path + ' links to ' + (targetPath || link) + ', which returned HTTP ' + (target.status || 'error') + '.'));
      }
    }
  }

  for (const page of pages) {
    if (page.path === '/') continue;
    if (sitemapSet.has(page.url) && Number(inbound.get(page.path) || 0) === 0) {
      issues.push(issue('ORPHAN_PAGE', 'high', page.path, 'The sitemap contains this page but no crawled page links to it.'));
    }
    if (!sitemapSet.has(page.url) && page.status === 200 && !page.noindex) {
      issues.push(issue('URL_MISSING_FROM_SITEMAP', 'medium', page.path, 'This crawlable internal page was discovered through links but is not present in the sitemap.'));
    }
  }
  return { issues, inbound };
}

function scoreIssues(issues) {
  const weights = { critical: 18, high: 8, medium: 3, low: 1 };
  const penalty = issues.filter(function(item) { return item.status !== 'FIXED'; }).reduce(function(sum, item) {
    return sum + (weights[item.severity] || 1);
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function articleText(article) {
  return [
    article.title,
    article.excerpt,
    ...(article.keywords || []),
    (article.research_brief && article.research_brief.summary) || ''
  ].filter(Boolean).join(' ');
}

async function rebuildInternalLinkGraph() {
  const published = await growthContent.listArticles({ publishedOnly: true });
  const graph = {};
  let linkedPages = 0;
  let totalLinks = 0;

  for (const article of published) {
    const candidates = published
      .filter(function(other) { return other.id !== article.id; })
      .map(function(other) {
        return { article: other, score: growthOpportunities.similarity(articleText(article), articleText(other)) };
      })
      .filter(function(item) { return item.score >= 0.08; })
      .sort(function(a, b) {
        return b.score - a.score || new Date(b.article.published_at || 0) - new Date(a.article.published_at || 0);
      })
      .slice(0, 3)
      .map(function(item) {
        return {
          label: item.article.title,
          url: '/blog/' + item.article.slug,
          description: String(item.article.excerpt || '').slice(0, 220),
          kind: 'article',
          score: Number(item.score.toFixed(3))
        };
      });

    graph[article.id] = candidates;
    if (candidates.length) linkedPages += 1;
    totalLinks += candidates.length;
  }

  const payload = {
    generatedAt: nowIso(),
    articleCount: published.length,
    linkedPages,
    totalLinks,
    graph
  };
  await writeSetting(LINK_GRAPH_KEY, payload, 'Automatic bidirectional blog internal-link graph for Phase 3 SEO Maintenance.');
  return payload;
}

async function crawlSite(options) {
  const settings = options || {};
  const maxPages = Math.max(20, Math.min(200, Number(settings.maxPages || DEFAULT_MAX_PAGES)));
  const results = await Promise.all([
    fetchText('/sitemap.xml'),
    fetchText('/blog/sitemap.xml'),
    fetchText('/robots.txt', 'text/plain,*/*')
  ]);
  const mainSitemap = results[0];
  const blogSitemap = results[1];
  const robots = results[2];

  const sitemapDiscovered = sitemapUrls(mainSitemap.body)
    .concat(sitemapUrls(blogSitemap.body))
    .concat(STATIC_SEEDS.map(function(path) { return new URL(path, SITE_ORIGIN).toString(); }));
  const sitemapUrlsUnique = Array.from(new Set(sitemapDiscovered.map(normalizeUrl).filter(Boolean)));
  const sitemapSet = new Set(sitemapUrlsUnique);
  const queue = sitemapUrlsUnique.slice();
  const queued = new Set(queue);
  const pages = [];
  const errors = [];

  async function worker() {
    while (pages.length < maxPages) {
      const url = queue.shift();
      if (!url) return;
      const result = await fetchManual(url);
      if (result.error) errors.push({ url, error: result.error });
      const contentType = result.contentType || '';
      const isHtml = /text\/html|application\/xhtml/i.test(contentType) || /^\s*<!doctype html|^\s*<html/i.test(result.body);
      const page = isHtml
        ? inspectHtml(url, result.body, result.status, result.redirectHops, contentType)
        : {
            url,
            path: canonicalPath(url),
            status: result.status,
            contentType,
            redirectHops: result.redirectHops,
            title: '',
            description: '',
            canonical: '',
            canonicalPath: '',
            robots: '',
            noindex: false,
            h1Count: 0,
            h1: '',
            headings: [],
            links: [],
            images: 0,
            missingAlt: 0,
            emptyAlt: 0,
            schemaBlocks: 0,
            invalidSchemaBlocks: 0
          };
      pages.push(page);

      if (isHtml) {
        for (const link of page.links) {
          if (queued.size >= maxPages * 2) break;
          if (!queued.has(link)) {
            queued.add(link);
            queue.push(link);
          }
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CRAWL_CONCURRENCY }, function() { return worker(); }));

  return {
    pages: pages.slice(0, maxPages),
    sitemapSet,
    sitemap: {
      mainStatus: mainSitemap.status,
      blogStatus: blogSitemap.status,
      robotsStatus: robots.status,
      urls: sitemapUrlsUnique,
      robotsText: robots.body || ''
    },
    errors
  };
}

async function run(options) {
  const startedAt = nowIso();
  const crawl = await crawlSite(options);
  const linkGraph = await rebuildInternalLinkGraph();
  const issues = [];

  if (crawl.sitemap.robotsStatus !== 200) issues.push(issue('ROBOTS_UNAVAILABLE', 'critical', '/robots.txt', 'robots.txt returned HTTP ' + (crawl.sitemap.robotsStatus || 'error') + '.'));
  if (crawl.sitemap.mainStatus !== 200) issues.push(issue('MAIN_SITEMAP_UNAVAILABLE', 'critical', '/sitemap.xml', 'Main sitemap returned HTTP ' + (crawl.sitemap.mainStatus || 'error') + '.'));
  if (crawl.sitemap.blogStatus !== 200) issues.push(issue('BLOG_SITEMAP_UNAVAILABLE', 'high', '/blog/sitemap.xml', 'Blog sitemap returned HTTP ' + (crawl.sitemap.blogStatus || 'error') + '.'));
  if (/User-agent:\s*\*[\s\S]{0,300}Disallow:\s*\/(?:\s|$)/i.test(crawl.sitemap.robotsText)) {
    issues.push(issue('ROBOTS_BLOCKS_SITE', 'critical', '/robots.txt', 'robots.txt contains a whole-site disallow for the default crawler.'));
  }

  for (const page of crawl.pages) issues.push(...classifyPageIssues(page, crawl.sitemapSet));
  issues.push(...duplicateIssues(crawl.pages.filter(function(page) { return page.status === 200; }), 'title', 'DUPLICATE_TITLE', 'Page title'));
  issues.push(...duplicateIssues(crawl.pages.filter(function(page) { return page.status === 200; }), 'description', 'DUPLICATE_META_DESCRIPTION', 'Meta description'));
  const linkAudit = internalLinkIssues(crawl.pages, crawl.sitemapSet);
  issues.push(...linkAudit.issues);

  const autoRepairs = [{
    code: 'BLOG_INTERNAL_LINK_GRAPH',
    status: 'APPLIED',
    detail: 'Rebuilt related-article links for ' + linkGraph.linkedPages + '/' + linkGraph.articleCount + ' published articles (' + linkGraph.totalLinks + ' article-to-article links).',
    appliedAt: nowIso()
  }];

  const openIssues = issues.filter(function(item) { return item.status !== 'FIXED'; });
  const severityCount = ['critical', 'high', 'medium', 'low'].reduce(function(acc, severity) {
    acc[severity] = openIssues.filter(function(item) { return item.severity === severity; }).length;
    return acc;
  }, {});

  const state = {
    phase: 3,
    generatedAt: nowIso(),
    startedAt,
    score: scoreIssues(openIssues),
    pagesCrawled: crawl.pages.length,
    sitemapUrls: crawl.sitemap.urls.length,
    healthyPages: crawl.pages.filter(function(page) {
      return page.status === 200 && !openIssues.some(function(item) {
        return item.page === page.path && ['critical', 'high'].includes(item.severity);
      });
    }).length,
    summary: {
      totalIssues: openIssues.length,
      critical: severityCount.critical,
      high: severityCount.high,
      medium: severityCount.medium,
      low: severityCount.low,
      autoFixed: autoRepairs.length,
      pendingReview: openIssues.length,
      brokenInternalLinks: openIssues.filter(function(item) { return item.code === 'BROKEN_INTERNAL_LINK'; }).length,
      orphanPages: openIssues.filter(function(item) { return item.code === 'ORPHAN_PAGE'; }).length,
      missingMetadata: openIssues.filter(function(item) { return ['MISSING_TITLE', 'MISSING_META_DESCRIPTION', 'MISSING_CANONICAL'].includes(item.code); }).length,
      schemaIssues: openIssues.filter(function(item) { return item.code === 'INVALID_JSON_LD'; }).length,
      missingAlt: openIssues.filter(function(item) { return item.code === 'MISSING_IMAGE_ALT'; }).length,
      internalLinkedArticles: linkGraph.linkedPages,
      internalArticleLinks: linkGraph.totalLinks
    },
    autoRepairs,
    issues: openIssues.slice(0, 120),
    crawlErrors: crawl.errors.slice(0, 20),
    pages: crawl.pages.slice(0, 160).map(function(page) {
      return {
        path: page.path,
        status: page.status,
        title: page.title,
        canonicalPath: page.canonicalPath,
        h1Count: page.h1Count,
        internalLinks: page.links.length,
        schemaBlocks: page.schemaBlocks,
        missingAlt: page.missingAlt
      };
    })
  };

  await writeSetting(STATE_KEY, state, 'Latest Phase 3 Technical SEO + Internal Linking Autopilot audit.');
  try {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'GROWTH_PHASE3_SEO_MAINTENANCE',
        entity: 'GrowthSeoMaintenance',
        entityId: 'primary',
        metadata: JSON.stringify({
          score: state.score,
          pagesCrawled: state.pagesCrawled,
          issues: state.summary.totalIssues,
          autoFixed: state.summary.autoFixed,
          internalArticleLinks: state.summary.internalArticleLinks
        })
      }
    });
  } catch (error) {
    console.warn('[growth-seo-maintenance] audit log write failed', { error: error && error.message });
  }

  console.info('[growth-seo-maintenance] audit complete', {
    score: state.score,
    pagesCrawled: state.pagesCrawled,
    issues: state.summary.totalIssues,
    autoFixed: state.summary.autoFixed,
    internalArticleLinks: state.summary.internalArticleLinks
  });
  return state;
}

async function status() {
  return (await readSetting(STATE_KEY)) || {
    phase: 3,
    generatedAt: null,
    score: null,
    pagesCrawled: 0,
    sitemapUrls: 0,
    healthyPages: 0,
    summary: {
      totalIssues: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      autoFixed: 0,
      pendingReview: 0,
      brokenInternalLinks: 0,
      orphanPages: 0,
      missingMetadata: 0,
      schemaIssues: 0,
      missingAlt: 0,
      internalLinkedArticles: 0,
      internalArticleLinks: 0
    },
    autoRepairs: [],
    issues: [],
    pages: []
  };
}

async function linkGraph() {
  return (await readSetting(LINK_GRAPH_KEY)) || { generatedAt: null, articleCount: 0, linkedPages: 0, totalLinks: 0, graph: {} };
}

module.exports = {
  SITE_ORIGIN,
  STATE_KEY,
  LINK_GRAPH_KEY,
  STATIC_SEEDS,
  canonicalPath,
  normalizeUrl,
  sitemapUrls,
  inspectHtml,
  classifyPageIssues,
  scoreIssues,
  rebuildInternalLinkGraph,
  crawlSite,
  run,
  status,
  linkGraph
};
