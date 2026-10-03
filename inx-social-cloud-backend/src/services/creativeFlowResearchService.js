const axios = require('axios');

const MAX_RESEARCH_PAGES = 6;
const MIN_MEANINGFUL_TEXT = 900;
const MAX_AGGREGATE_TEXT = 36000;

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function htmlText(html) {
  return clean(
    decodeEntities(String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')),
    24000
  );
}

function attrValue(tag, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const source = String(tag || '');
  return clean(
    source.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]
      || source.match(new RegExp(`\\b${escaped}\\s*=\\s*([^\\s>]+)`, 'i'))?.[1],
    2000
  );
}

function metaValue(source, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return clean(
    String(source || '').match(new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)`, 'i'))?.[1]
      || String(source || '').match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["']`, 'i'))?.[1],
    800
  );
}

function normalizePublicCandidate(baseUrl, value) {
  try {
    const url = new URL(String(value || ''), baseUrl);
    const base = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== base.hostname) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch (_) {
    return null;
  }
}

function extractStructuredNames(source) {
  const names = [];
  for (const match of String(source || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const rows = Array.isArray(parsed) ? parsed : parsed?.['@graph'] ? parsed['@graph'] : [parsed];
      for (const row of Array.isArray(rows) ? rows : []) {
        const type = Array.isArray(row?.['@type']) ? row['@type'].join(' ') : String(row?.['@type'] || '');
        if (/Product|SoftwareApplication|WebApplication|Organization|Brand/i.test(type) && row?.name) names.push(clean(row.name, 160));
      }
    } catch (_) {
      // Invalid structured data is ignored; ordinary page evidence still applies.
    }
  }
  return [...new Set(names.filter(Boolean))].slice(0, 8);
}

function contextFromHtml(url, source) {
  const html = String(source || '');
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 240);
  const description = metaValue(html, 'description') || metaValue(html, 'og:description');
  const siteName = metaValue(html, 'og:site_name');
  const ogTitle = metaValue(html, 'og:title');
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => htmlText(match[1]))
    .filter(Boolean)
    .slice(0, 32);
  const links = [];
  for (const tag of html.match(/<a\b[^>]*>/gi) || []) {
    const href = attrValue(tag, 'href');
    const candidate = normalizePublicCandidate(url, href);
    if (candidate && !links.includes(candidate)) links.push(candidate);
    if (links.length >= 80) break;
  }
  return {
    url,
    title: ogTitle || title,
    description,
    siteName,
    headings,
    text: htmlText(html).slice(0, 18000),
    links,
    structuredNames: extractStructuredNames(html),
  };
}

function browserContentEndpoint() {
  const raw = String(process.env.BROWSER_RENDERER_BROWSER_URL || process.env.BROWSER_RENDERER_HEALTH_URL || '').trim();
  if (!raw) return '';
  try {
    const normalized = raw.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
    const parsed = new URL(normalized);
    parsed.pathname = '/content';
    parsed.hash = '';
    return parsed.toString();
  } catch (_) {
    return '';
  }
}

async function renderWebsite(url) {
  const endpoint = browserContentEndpoint();
  if (!endpoint) return null;
  try {
    const response = await axios.post(endpoint, {
      url,
      gotoOptions: { waitUntil: 'networkidle2', timeout: 18000 },
      waitForTimeout: 700,
    }, {
      timeout: 26000,
      maxContentLength: 5 * 1024 * 1024,
      maxBodyLength: 512 * 1024,
      headers: { 'Content-Type': 'application/json' },
    });
    const html = typeof response.data === 'string' ? response.data : String(response.data?.content || response.data?.html || '');
    if (!html || html.length < 80) return null;
    return { html, context: contextFromHtml(url, html) };
  } catch (error) {
    console.warn('[CREATIVE FLOW RESEARCH] browser render unavailable', { status: error?.response?.status || null, message: clean(error?.message, 220) });
    return null;
  }
}

function contextScore(context) {
  if (!context || context.error) return 0;
  const textLength = String(context.text || '').length;
  let score = 0;
  if (context.title) score += 10;
  if (context.siteName) score += 7;
  if (context.description) score += 10;
  if ((context.headings || []).length >= 2) score += 8;
  if ((context.headings || []).length >= 5) score += 5;
  if (textLength >= 500) score += 12;
  if (textLength >= 1500) score += 15;
  if (textLength >= 4500) score += 10;
  if ((context.brandReferences || []).length) score += 8;
  if ((context.structuredNames || []).length) score += 10;
  return Math.min(100, score);
}

function mergePrimary(raw, rendered) {
  if (!rendered) return raw;
  if (!raw || raw.error) return { ...rendered };
  const renderedText = String(rendered.text || '');
  const rawText = String(raw.text || '');
  return {
    ...raw,
    title: rendered.title || raw.title,
    description: rendered.description || raw.description,
    siteName: rendered.siteName || raw.siteName,
    headings: [...new Set([...(raw.headings || []), ...(rendered.headings || [])])].slice(0, 36),
    text: renderedText.length > rawText.length ? renderedText : rawText,
    links: rendered.links || [],
    structuredNames: rendered.structuredNames || [],
  };
}

function linkScore(value) {
  try {
    const path = new URL(value).pathname.toLowerCase();
    let score = 0;
    if (/\b(features?|product|platform|solutions?|use-cases?|pricing|about|how-it-works|capabilities|services?)\b/.test(path.replace(/[\/_-]+/g, ' '))) score += 80;
    if (/docs?|help|customers?|industries|integrations/.test(path)) score += 35;
    if (/blog|news|careers?|jobs?|privacy|terms|login|sign-?in|sign-?up|contact|support|legal|cookie/.test(path)) score -= 90;
    score -= Math.max(0, path.split('/').filter(Boolean).length - 2) * 8;
    return score;
  } catch (_) {
    return -100;
  }
}

function candidateUrls(primaryUrl, renderedLinks = []) {
  const base = new URL(primaryUrl);
  const common = ['/features', '/product', '/platform', '/solutions', '/pricing', '/about'];
  const rows = [
    ...renderedLinks.map((url) => normalizePublicCandidate(primaryUrl, url)),
    ...common.map((path) => normalizePublicCandidate(primaryUrl, new URL(path, base.origin).toString())),
  ].filter(Boolean);
  return [...new Set(rows)]
    .filter((url) => url !== primaryUrl)
    .map((url) => ({ url, score: linkScore(url) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESEARCH_PAGES - 1)
    .map((item) => item.url);
}

function canonicalName(context) {
  const structured = (context?.structuredNames || []).find((value) => value && value.length <= 100);
  if (structured) return structured;
  if (context?.siteName && context.siteName.length <= 100) return clean(context.siteName, 100);
  const title = clean(context?.title, 180);
  if (title) {
    const first = title.split(/\s(?:[-–—|•:]|·)\s/)[0].trim();
    if (first && first.length <= 100) return first;
  }
  try {
    const label = new URL(context?.url || '').hostname.replace(/^www\./, '').split('.')[0];
    return label ? label.replace(/[-_]+/g, ' ') : '';
  } catch (_) {
    return '';
  }
}

function evidenceSummary(pages, browserRendered) {
  const readable = pages.filter((page) => !page.error && String(page.text || '').length >= 250);
  const totalText = readable.reduce((sum, page) => sum + String(page.text || '').length, 0);
  let score = 0;
  if (readable.length) score += 25;
  if (readable.length >= 2) score += 20;
  if (readable.length >= 4) score += 15;
  if (totalText >= 2500) score += 15;
  if (totalText >= 9000) score += 10;
  if (readable.some((page) => page.description || (page.headings || []).length >= 3)) score += 8;
  if (browserRendered) score += 7;
  score = Math.min(100, score);
  return {
    evidenceScore: score,
    evidenceConfidence: score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low',
    sourceCoverage: readable.length,
    totalText,
  };
}

async function researchWebsite(value, baseFetchUrlContext) {
  const primaryRaw = await baseFetchUrlContext(value);
  if (!primaryRaw || primaryRaw.error) {
    return {
      context: primaryRaw,
      pages: primaryRaw ? [primaryRaw] : [],
      canonicalName: '',
      evidenceScore: 0,
      evidenceConfidence: 'low',
      sourceCoverage: 0,
      researchMode: 'fast-fetch-failed',
    };
  }

  const rawScore = contextScore(primaryRaw);
  const shouldRender = rawScore < 62 || String(primaryRaw.text || '').length < MIN_MEANINGFUL_TEXT;
  const renderedResult = shouldRender || browserContentEndpoint() ? await renderWebsite(primaryRaw.url || value) : null;
  const primary = mergePrimary(primaryRaw, renderedResult?.context || null);
  const candidates = candidateUrls(primary.url || value, renderedResult?.context?.links || []);
  const extraResults = await Promise.all(candidates.map(async (url) => {
    try { return await baseFetchUrlContext(url); } catch (_) { return null; }
  }));
  const extras = extraResults.filter((item) => item && !item.error && String(item.text || '').length >= 250);
  const pages = [primary, ...extras].slice(0, MAX_RESEARCH_PAGES);
  const summary = evidenceSummary(pages, Boolean(renderedResult));
  const aggregatedText = pages
    .map((page, index) => `PAGE ${index + 1}: ${page.title || page.url}\nURL: ${page.url}\n${page.description ? `Description: ${page.description}\n` : ''}${(page.headings || []).length ? `Headings: ${(page.headings || []).join(' | ')}\n` : ''}${page.text || ''}`)
    .join('\n\n---\n\n')
    .slice(0, MAX_AGGREGATE_TEXT);
  const references = [];
  const colors = [];
  for (const page of pages) {
    for (const item of page.brandReferences || []) {
      if (item?.url && !references.some((existing) => existing.url === item.url)) references.push(item);
    }
    for (const color of page.brandColors || []) if (color && !colors.includes(color)) colors.push(color);
  }
  const context = {
    ...primary,
    text: aggregatedText || primary.text,
    headings: [...new Set(pages.flatMap((page) => page.headings || []))].slice(0, 48),
    brandReferences: references.slice(0, 16),
    brandColors: colors.slice(0, 6),
    structuredNames: [...new Set(pages.flatMap((page) => page.structuredNames || []))].slice(0, 8),
    research: {
      ...summary,
      browserRendered: Boolean(renderedResult),
      pages: pages.map((page) => ({ url: page.url, title: page.title || page.url, ok: !page.error })),
    },
  };

  return {
    context,
    pages,
    canonicalName: canonicalName(context),
    ...summary,
    researchMode: renderedResult ? 'browser-assisted-crawl' : pages.length > 1 ? 'multi-page-crawl' : 'fast-fetch',
  };
}

function validateAnalysisIdentity(analysis, research) {
  const output = { ...(analysis || {}) };
  const trustedName = clean(research?.canonicalName, 100);
  const modelName = clean(output.productName, 100);
  const normalize = (value) => clean(value, 100).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const trustedTokens = new Set(normalize(trustedName).split(/\s+/).filter((token) => token.length > 2));
  const modelTokens = normalize(modelName).split(/\s+/).filter((token) => token.length > 2);
  const overlaps = modelTokens.some((token) => trustedTokens.has(token));
  const obviouslyWeak = modelName.replace(/[^a-z0-9]/gi, '').length < 4;
  if (trustedName && (!modelName || obviouslyWeak || (trustedTokens.size && modelTokens.length && !overlaps))) {
    output.productName = trustedName;
  }
  output.evidenceScore = Number(research?.evidenceScore || 0);
  output.evidenceConfidence = research?.evidenceConfidence || 'low';
  output.sourceCoverage = Number(research?.sourceCoverage || 0);
  output.researchMode = research?.researchMode || 'fast-fetch';
  const researchPages = Array.isArray(research?.pages) ? research.pages : [];
  const references = (output.sources || []).filter((item) => item?.type === 'reference');
  if (researchPages.length) {
    output.sources = [
      ...researchPages.map((page) => ({ type: 'url', label: clean(page.title || page.url, 300), ok: page.ok !== false })),
      ...references,
    ].slice(0, 12);
  }
  if (output.evidenceConfidence === 'low') {
    const caution = 'Website evidence coverage is limited. Avoid treating unverified product details as facts until more sources are available.';
    output.cautions = [...new Set([...(output.cautions || []), caution])].slice(0, 10);
  }
  return output;
}

module.exports = {
  researchWebsite,
  validateAnalysisIdentity,
  contextScore,
  contextFromHtml,
};
