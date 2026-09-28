'use strict';

const crypto = require('node:crypto');
const axios = require('axios');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const env = require('../config/env');
const webResearch = require('./webResearchService');
const growthOpportunities = require('./growthOpportunityService');
const objectStorage = require('./mediaObjectStorageService');
const siteIntelligence = require('./growthSiteIntelligenceService');
const seoSkills = require('./growthSeoSkillRegistry');
const growthSites = require('./growthSiteService');

const ARTICLE_PREFIX = 'growth_content_article_v2:';
const SLUG_PREFIX = 'growth_content_slug_v2:';
const ENGINE_SETTING_KEY = 'growth_content_engine_v2';
const SEO_LINK_GRAPH_KEY = 'growth_seo_internal_link_graph_v1';
const LEGACY_IMPORT_SETTING_KEY = 'growth_content_legacy_babylove_import_v1';
const BABYLOVE_API_BASE = 'https://api.babylovegrowth.ai/api/integrations/v1';
const SITE_URL = growthSites.DEFAULT_ORIGIN;

const STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED'
});

function publicError(message, status = 400, code = null) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  if (code) error.code = code;
  return error;
}

function safeJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function parseStructuredJson(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const unfenced = raw.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '').trim();
  try { return JSON.parse(unfenced); } catch (_) {}
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(unfenced.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

function responseDiagnostics(raw) {
  return {
    status: raw?.status || null,
    incompleteReason: raw?.incomplete_details?.reason || null,
    outputTypes: (Array.isArray(raw?.output) ? raw.output : []).map(item => item?.type).filter(Boolean)
  };
}

function sanitizeImportedHtml(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
}

function versionedContentImageUrl(article) {
  const value = String(article?.featured_image_url || '');
  if (!value.startsWith('/content-media/')) return value || null;
  const stamp = new Date(article?.featured_image_storage?.generatedAt || article?.updated_at || Date.now()).getTime();
  const version = Number.isFinite(stamp) ? stamp : Date.now();
  const id = String(article?.id || '').trim();
  if (!id) return value.split('?')[0];
  // Rebuild the canonical route instead of appending to the stored URL.
  // Existing generated articles may already store a version segment.
  return '/content-media/' + encodeURIComponent(id) + '/' + version;
}

function absoluteSiteAsset(value) {
  const url = String(value || '').trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return SITE_URL + (url.startsWith('/') ? url : '/' + url);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'growth-guide';
}

function tagSlug(value) {
  return slugify(value).slice(0, 60);
}

function wordCount(markdown) {
  return String(markdown || '')
    .replace(/[#>*_\[\]()!~-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function headingCount(markdown) {
  return (String(markdown || '').match(/^##\s+/gm) || []).length;
}

function uniqueStrings(values, limit = 20, maxLength = 160) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const clean = normalizeSpace(value).slice(0, maxLength);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch (_) {
    return '';
  }
}

function safeInternalPath(value) {
  const clean = String(value || '').trim();
  return /^\/(?:[a-z0-9][a-z0-9/_-]*|)$/.test(clean) ? clean : '';
}

function approvedEditorialPromo(promo, markdown, links) {
  if (!promo?.enabled) return null;
  const url = safeInternalPath(promo.url);
  const requestedHeading = normalizeSpace(promo.before_heading);
  const headings = [...String(markdown || '').matchAll(/^##\s+(.+)$/gm)].map(match => normalizeSpace(match[1]));
  const matchedHeading = headings.slice(1).find(heading => heading.toLowerCase() === requestedHeading.toLowerCase());
  if (!url || !Array.isArray(links) || !links.some(link => link.url === url)
    || headings.length < 2 || !matchedHeading) return null;
  const title = normalizeSpace(promo.title).slice(0, 100);
  const description = normalizeSpace(promo.description).slice(0, 240);
  const label = normalizeSpace(promo.label).slice(0, 55);
  if (!title || !description || !label) return null;
  return { title, description, label, url, before_heading: matchedHeading };
}

function fallbackEditorialPromo(article, links) {
  if (!article || article.content_source === 'BABYLOVEGROWTH_IMPORTED') return null;
  const usableLinks = (Array.isArray(links) ? links : []).filter(link => safeInternalPath(link?.url));
  const headings = [...String(article.content_markdown || '').matchAll(/^##\s+(.+)$/gm)].map(match => normalizeSpace(match[1]));
  if (!usableLinks.length || headings.length < 2) return null;

  const link = usableLinks[0];
  const headingIndex = Math.min(headings.length - 1, Math.max(1, Math.floor(headings.length / 2)));
  const label = normalizeSpace(link.label || 'INXSocial tools').slice(0, 55);
  const description = normalizeSpace(
    link.description || ('Continue with ' + label + ' to put this workflow into practice from the same INXSocial workspace.')
  ).slice(0, 240);

  return {
    title: 'Put this into practice with INXSocial',
    description,
    label: ('Explore ' + label).slice(0, 55),
    url: safeInternalPath(link.url),
    before_heading: headings[headingIndex]
  };
}

function sourceDomain(value) {
  try {
    return new URL(String(value || '')).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function humanizePathSegment(value) {
  const clean = decodeURIComponent(String(value || ''))
    .replace(/\.[a-z0-9]{2,6}$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.replace(/\b\w/g, char => char.toUpperCase()) : '';
}

function professionalSourceTitle(source) {
  const url = safeExternalUrl(source?.url);
  if (!url) return '';
  const supplied = normalizeSpace(source?.title || '');
  const generic = !supplied
    || /^(?:research\s+source|source|web\s+source|search\s+result|untitled)$/i.test(supplied)
    || supplied === url;
  if (!generic) return supplied.slice(0, 240);

  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split('/').filter(Boolean).pop();
    const page = humanizePathSegment(segment);
    const domain = parsed.hostname.replace(/^www\./i, '');
    return (page ? page + ' — ' : '') + domain;
  } catch (_) {
    return url.slice(0, 240);
  }
}

function normalizeSources(values) {
  const seen = new Set();
  const result = [];
  for (const source of Array.isArray(values) ? values : []) {
    const url = safeExternalUrl(source?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push({
      id: 'S' + (result.length + 1),
      title: professionalSourceTitle({ ...source, url }),
      url,
      domain: sourceDomain(url)
    });
    if (result.length >= 12) break;
  }
  return result;
}

function sourceMatchKey(value) {
  try {
    const url = new URL(String(value || ''));
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    return (url.origin + pathname).toLowerCase();
  } catch (_) {
    return '';
  }
}

function bindResearchEvidence(brief, sources) {
  const byKey = new Map();
  for (const source of sources || []) {
    const key = sourceMatchKey(source.url);
    if (key) byKey.set(key, source);
  }

  const facts = (Array.isArray(brief?.facts) ? brief.facts : []).map(item => {
    const source = byKey.get(sourceMatchKey(item?.source_url));
    if (!source) return null;
    return {
      claim: normalizeSpace(item.claim).slice(0, 900),
      support: normalizeSpace(item.support).slice(0, 1200),
      source_ref: source.id,
      source_url: source.url
    };
  }).filter(item => item?.claim && item?.support && item?.source_ref);

  return {
    ...brief,
    facts,
    evidenceSourceRefs: [...new Set(facts.map(item => item.source_ref))]
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdown(value, sources = []) {
  let text = escapeHtml(value);
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const sourceMap = new Map((sources || []).map(source => [String(source.id || '').toUpperCase(), source]));
  text = text.replace(/\[(S\d{1,2})\]/gi, (match, id) => {
    const source = sourceMap.get(String(id).toUpperCase());
    if (!source) return match;
    const label = escapeHtml(String(source.id || id).replace(/^S/i, ''));
    const href = escapeHtml(source.url);
    return '<sup class="inx-inline-citation"><a href="' + href + '" target="_blank" rel="noopener noreferrer" aria-label="Source ' + label + '">[' + label + ']</a></sup>';
  });
  return text;
}

function markdownToSafeHtml(markdown, sources = []) {
  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  const html = [];
  let paragraph = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push('<p>' + inlineMarkdown(paragraph.join(' '), sources) + '</p>');
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    html.push(listType === 'ol' ? '</ol>' : '</ul>');
    listType = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    const ul = line.match(/^[-*]\s+(.+)/);
    const ol = line.match(/^\d+[.)]\s+(.+)/);

    if (h2 || h3) {
      flushParagraph();
      closeList();
      const tag = h2 ? 'h2' : 'h3';
      const value = h2 ? h2[1] : h3[1];
      html.push('<' + tag + '>' + inlineMarkdown(value, sources) + '</' + tag + '>');
      continue;
    }

    if (ul || ol) {
      flushParagraph();
      const nextType = ol ? 'ol' : 'ul';
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        html.push(nextType === 'ol' ? '<ol>' : '<ul>');
      }
      html.push('<li>' + inlineMarkdown((ol || ul)[1], sources) + '</li>');
      continue;
    }

    closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  return html.join('\n');
}

function linkTokens(value) {
  return [...new Set(String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .map(part => part.trim())
    .filter(part => part.length > 2 && !['the','and','for','with','from','your','this','that','into','about'].includes(part))
  )];
}

function relatedInternalLinks(topic, keywords = [], catalog = []) {
  const query = new Set(linkTokens([topic, ...keywords].join(' ')));
  return (catalog || [])
    .filter(item => item?.url && item?.label)
    .map(item => {
      const tokens = linkTokens([item.label, item.description, item.text].join(' '));
      const overlap = tokens.filter(token => query.has(token)).length;
      const commercialBoost = /pricing|product|service|feature|solution|compare|alternative|demo|trial/i.test(String(item.url || '')) ? 0.35 : 0;
      return { ...item, score: overlap + commercialBoost };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter((item, index, all) => all.findIndex(other => other.url === item.url) === index)
    .slice(0, 4)
    .map(item => ({
      label: normalizeSpace(item.label).slice(0, 140),
      url: safeInternalPath(item.url),
      description: normalizeSpace(item.description || '').slice(0, 260)
    }))
    .filter(item => item.label && item.url);
}

async function discoveredInternalLinks(topic, keywords = []) {
  const intelligence = await siteIntelligence.latest().catch(() => null);
  const pages = intelligence?.snapshot?.pages || [];
  const catalog = pages
    .filter(page => page.path && page.path !== '/' && Number(page.status || 200) === 200)
    .map(page => ({
      label: page.h1 || page.title || page.path,
      url: page.path,
      description: page.description || '',
      text: [page.title, page.h1, ...(page.headings || []).map(item => item.text)].filter(Boolean).join(' ')
    }));
  const matched = relatedInternalLinks(topic, keywords, catalog);
  if (matched.length >= 2) return matched;

  const fallback = pages
    .filter(page => page.path && page.path !== '/' && Number(page.status || 200) === 200)
    .sort((a, b) => {
      const aCommercial = /pricing|product|service|feature|solution|demo|trial/i.test(a.path) ? 1 : 0;
      const bCommercial = /pricing|product|service|feature|solution|demo|trial/i.test(b.path) ? 1 : 0;
      return bCommercial - aCommercial;
    })
    .slice(0, 4)
    .map(page => ({
      label: normalizeSpace(page.h1 || page.title || page.path).slice(0, 140),
      url: safeInternalPath(page.path),
      description: normalizeSpace(page.description || '').slice(0, 260)
    }))
    .filter(item => item.label && item.url);

  return [...matched, ...fallback]
    .filter((item, index, all) => all.findIndex(other => other.url === item.url) === index)
    .slice(0, 4);
}

function articleKey(id) {
  return ARTICLE_PREFIX + String(id);
}

function slugKey(slug) {
  return SLUG_PREFIX + slugify(slug);
}

async function readSetting(key) {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row ? safeJson(row.value, null) : null;
}

async function upsertSetting(key, value, description) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value), description },
    update: { value: JSON.stringify(value), description }
  });
}

async function deleteSetting(key) {
  return prisma.appSetting.delete({ where: { key } }).catch(() => null);
}

async function listAllArticles() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: ARTICLE_PREFIX } },
    orderBy: { updatedAt: 'desc' }
  });
  return rows.map(row => safeJson(row.value, null)).filter(Boolean);
}

async function getArticleById(id) {
  const article = await readSetting(articleKey(id));
  if (!article) throw publicError('Content article not found.', 404, 'CONTENT_NOT_FOUND');
  return article;
}

async function getArticleBySlug(slug, options = {}) {
  const alias = await readSetting(slugKey(slug));
  if (!alias?.id) return null;
  const article = await readSetting(articleKey(alias.id));
  if (!article) return null;
  if (options.publishedOnly && article.status !== STATUS.PUBLISHED) return null;
  return article;
}

async function ensureUniqueSlug(base, currentId = null) {
  const root = slugify(base);
  for (let index = 0; index < 50; index += 1) {
    const candidate = index ? root + '-' + (index + 1) : root;
    const alias = await readSetting(slugKey(candidate));
    if (!alias?.id || alias.id === currentId) return candidate;
  }
  return root + '-' + Date.now();
}

function researchSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['searchIntent', 'audience', 'primaryQuestion', 'summary', 'questions', 'facts', 'outline', 'contentAngles', 'decisionCriteria', 'entities'],
    properties: {
      searchIntent: { type: 'string' },
      audience: { type: 'string' },
      primaryQuestion: { type: 'string' },
      summary: { type: 'string' },
      questions: { type: 'array', minItems: 3, maxItems: 10, items: { type: 'string' } },
      facts: {
        type: 'array',
        minItems: 4,
        maxItems: 16,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['claim', 'support', 'source_url'],
          properties: {
            claim: { type: 'string' },
            support: { type: 'string' },
            source_url: { type: 'string' }
          }
        }
      },
      outline: { type: 'array', minItems: 5, maxItems: 12, items: { type: 'string' } },
      contentAngles: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string' } },
      decisionCriteria: { type: 'array', minItems: 2, maxItems: 8, items: { type: 'string' } },
      entities: { type: 'array', minItems: 2, maxItems: 16, items: { type: 'string' } }
    }
  };
}

function articleSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'excerpt', 'meta_description', 'keywords', 'quick_answer', 'key_takeaways', 'content_markdown', 'comparison', 'faq', 'featured_image_prompt', 'editorial_promo'],
    properties: {
      title: { type: 'string' },
      excerpt: { type: 'string' },
      meta_description: { type: 'string' },
      keywords: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'string' } },
      quick_answer: { type: 'string' },
      key_takeaways: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string' } },
      content_markdown: { type: 'string' },
      editorial_promo: {
        type: 'object',
        additionalProperties: false,
        required: ['enabled', 'title', 'description', 'label', 'url', 'before_heading'],
        properties: {
          enabled: { type: 'boolean' },
          title: { type: 'string' },
          description: { type: 'string' },
          label: { type: 'string' },
          url: { type: 'string' },
          before_heading: { type: 'string' }
        }
      },
      comparison: {
        type: 'array',
        minItems: 0,
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'best_for', 'strength', 'consideration', 'source_refs'],
          properties: {
            name: { type: 'string' },
            best_for: { type: 'string' },
            strength: { type: 'string' },
            consideration: { type: 'string' },
            source_refs: { type: 'array', minItems: 0, maxItems: 3, items: { type: 'string' } }
          }
        }
      },
      faq: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['question', 'answer'],
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' }
          }
        }
      },
      featured_image_prompt: { type: 'string' }
    }
  };
}

function openAiReady() {
  return Boolean(env.webResearch?.apiKey && env.webResearch?.baseUrl && env.webResearch?.model);
}

function contentWriterReady() {
  return Boolean(env.contentWriter?.apiKey && env.contentWriter?.baseUrl && env.contentWriter?.model);
}

async function responsesRequest(payload, client = env.webResearch) {
  if (!client?.apiKey || !client?.baseUrl || !payload?.model) {
    throw publicError('OpenAI is not configured for the requested Content Engine stage.', 503, 'CONTENT_AI_NOT_CONFIGURED');
  }
  const response = await axios.post(client.baseUrl + '/responses', payload, {
    timeout: Math.max(60000, Number(env.webResearch.timeoutMs || 120000)),
    headers: {
      Authorization: 'Bearer ' + client.apiKey,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

async function structuredResponse(payload, schemaName, errorCode, client = env.webResearch) {
  const raws = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const request = {
      ...payload,
      max_output_tokens: attempt === 1 ? Number(payload.max_output_tokens || 4000) : Math.max(Number(payload.max_output_tokens || 4000) + 2000, 5500)
    };
    if (attempt > 1) {
      request.instructions = String(request.instructions || '') + ' This is a retry because the previous response could not be parsed. Return one complete JSON object only, with no markdown fences, commentary or trailing text.';
    }

    const raw = await responsesRequest(request, client);
    raws.push(raw);
    const parsed = parseStructuredJson(webResearch.extractResponseText(raw));
    if (parsed && typeof parsed === 'object') return { parsed, raw, raws, attempt };

    console.warn('[growth-content] structured response parse failed', {
      schemaName,
      attempt,
      ...responseDiagnostics(raw)
    });
  }

  throw publicError(
    'Content AI returned an invalid structured result after an automatic retry.',
    502,
    errorCode
  );
}

async function researchTopic(input, options = {}) {
  const topic = normalizeSpace(input.topic);
  const currentPage = safeExternalUrl(input.existingPage) || safeInternalPath(input.existingPage);
  const intelligence = await siteIntelligence.latest().catch(() => null);
  const profile = intelligence?.profile || null;
  const brandName = profile?.brandName || intelligence?.site?.hostname || 'the monitored website';
  const maxEvidenceAttempts = Math.max(1, Math.min(3, Number(options.maxEvidenceAttempts || 2)));
  const request = {
    model: env.webResearch.model,
    instructions: [
      seoSkills.expertOperatingInstructions(),
      'Act as the research desk for ' + brandName + '.',
      'Use current web search to build an evidence brief for a people-first, original article that would be useful even if search engines did not exist.',
      'Start with the search intent and the reader decision or task, then research the evidence needed to answer it completely.',
      'Prefer primary sources: official documentation, standards, regulator or government pages, and official product pages for claims about those products.',
      'Use reputable independent sources where they add context. Avoid scraped listicles, thin affiliate roundups, anonymous SEO pages and sources that merely repeat another source.',
      'For comparison topics, separate verified product facts from editorial judgement and identify the criteria a buyer should use.',
      'Look for practical caveats, limitations, trade-offs, current terminology and questions a serious buyer or operator would ask.',
      'Every item in facts must include source_url copied from a web result you actually opened or used. Never invent a source URL.',
      'Do not copy competitor wording and do not make unsupported numerical claims.',
      'Return JSON only in the requested schema.'
    ].join(' '),
    input: [
      'Topic: ' + topic,
      'Intent: ' + normalizeSpace(input.intent || 'commercial/informational'),
      'Recommended action: ' + normalizeSpace(input.action || ''),
      'Existing site page: ' + (currentPage || 'none'),
      'Research focus / editor feedback: ' + normalizeSpace(input.notes || ''),
      'Research market: ' + String((profile?.markets || [env.webResearch?.country || 'GB']).join(', ')) + '.',
      'DISCOVERED SITE PROFILE: ' + JSON.stringify(profile),
      'Do not invent pricing, customer counts, performance claims, integrations or capabilities. Website/product facts must agree with the discovered site profile or current first-party pages.'
    ].join('\n'),
    tools: [{
      type: 'web_search',
      external_web_access: true,
      user_location: { type: 'approximate', country: 'GB', timezone: 'Europe/London' }
    }],
    tool_choice: 'required',
    include: ['web_search_call.action.sources'],
    text: { format: { type: 'json_schema', name: 'inx_content_research', strict: true, schema: researchSchema() } },
    max_output_tokens: 3500
  };
  if (/^gpt-5(?:\.|-)/i.test(env.webResearch.model)) request.reasoning = { effort: 'low' };

  let lastFailure = 'CONTENT_RESEARCH_EMPTY';
  for (let evidenceAttempt = 1; evidenceAttempt <= maxEvidenceAttempts; evidenceAttempt += 1) {
    const attemptRequest = {
      ...request,
      instructions: request.instructions + (evidenceAttempt > 1
        ? ' Previous evidence retrieval was insufficient. Run a new search using narrower queries and primary/official sources. Do not repeat the same weak source set.'
        : ''),
      input: request.input + (evidenceAttempt > 1
        ? '\nEvidence retry ' + evidenceAttempt + ': find a different authoritative source set for the exact claims needed.'
        : '')
    };

    const result = await structuredResponse(attemptRequest, 'inx_content_research', 'CONTENT_RESEARCH_INVALID');
    const sources = normalizeSources(
      result.raws.flatMap(item => webResearch.extractResponseSources(item))
    );

    if (!sources.length) {
      lastFailure = 'CONTENT_RESEARCH_EMPTY';
      console.warn('[growth-content] evidence retrieval returned no verifiable sources', { topic, evidenceAttempt });
      continue;
    }

    const brief = bindResearchEvidence(result.parsed, sources);
    if (brief.facts.length < 3) {
      lastFailure = 'CONTENT_RESEARCH_EVIDENCE_WEAK';
      console.warn('[growth-content] evidence retrieval returned too few bound facts', {
        topic,
        evidenceAttempt,
        sources: sources.length,
        facts: brief.facts.length
      });
      continue;
    }

    return {
      brief,
      sources,
      model: env.webResearch.model,
      evidenceAttempts: evidenceAttempt
    };
  }

  if (lastFailure === 'CONTENT_RESEARCH_EVIDENCE_WEAK') {
    throw publicError(
      'Content research did not bind enough factual claims to verified web sources after immediate evidence retries.',
      502,
      lastFailure
    );
  }
  throw publicError(
    'Content research returned no verifiable web sources after immediate evidence retries.',
    502,
    lastFailure
  );
}

async function writeArticle(input, research) {
  if (!contentWriterReady()) {
    throw publicError('GPT-5.6 Sol article writer is not configured.', 503, 'CONTENT_WRITER_NOT_CONFIGURED');
  }
  const intelligence = await siteIntelligence.latest().catch(() => null);
  const profile = intelligence?.profile || null;
  const brandName = profile?.brandName || intelligence?.site?.hostname || 'the monitored website';
  const sourceList = research.sources.map(source => source.id + '. ' + source.title + ' [' + source.domain + '] — ' + source.url).join('\n');
  const internalLinks = await discoveredInternalLinks(input.topic, []);
  const linkList = internalLinks.map(link => link.label + ': ' + SITE_URL + link.url).join('\n');

  const request = {
    model: env.contentWriter.model,
    instructions: [
      seoSkills.writerInstructions(),
      'Act as the senior editorial writer for ' + brandName + '. Write like a specialist publication, not a generic SEO content generator.',
      'Create an original, useful article from the research brief and verified source pack. The reader should leave with a clear answer, decision framework and practical next step.',
      'Treat research_brief.facts as the evidence ledger: each fact has a source_ref already bound to a verified source. Prefer those facts for externally verifiable claims and cite the bound source_ref.',
      'Use British English and an expert but plain-spoken tone unless the discovered site evidence clearly requires another language or market style.',
      'Answer the primary question early. quick_answer should be a direct 45-90 word answer suitable for a human reader and a search snippet.',
      'key_takeaways must contain 3-6 specific, non-repetitive takeaways.',
      'Use the source IDs exactly as [S1], [S2] and so on after factual claims that depend on external evidence. Never invent a source ID.',
      'For comparison or best-tool queries, explain selection criteria and trade-offs. Populate comparison only when it genuinely helps; every product-specific comparison row should include relevant source_refs.',
      'Use Markdown with ## and ### headings, short paragraphs, bullet lists and numbered steps where useful. Write as much as the topic needs, typically 1300-2400 words, but never pad to a word count.',
      'Do not invent statistics, testimonials, customer results, prices, product capabilities or integrations. Do not copy competitor wording.',
      'Do not add a Sources heading; the application renders a verified source section separately.',
      'Do not put raw URLs or Markdown links inside the body. Internal recommendations are rendered separately.',
      'Avoid generic AI filler, keyword stuffing, exaggerated marketing language, repetitive conclusions and unsupported claims that the monitored brand is best.',
      'Return JSON only in the requested schema.'
    ].join(' '),
    input: [
      'Topic: ' + normalizeSpace(input.topic),
      'Intent: ' + normalizeSpace(input.intent || ''),
      'Recommended action: ' + normalizeSpace(input.action || ''),
      'Optional editor note: ' + normalizeSpace(input.notes || ''),
      ...(input.previousArticle ? [
        '',
        'PREVIOUS DRAFT TO REVISE',
        JSON.stringify({
          title: input.previousArticle.title,
          excerpt: input.previousArticle.excerpt,
          meta_description: input.previousArticle.meta_description,
          keywords: input.previousArticle.keywords || [],
          quick_answer: input.previousArticle.quick_answer || '',
          key_takeaways: input.previousArticle.key_takeaways || [],
          content_markdown: String(input.previousArticle.content_markdown || '').slice(0, 30000),
          editorial_promo: input.previousArticle.editorial_promo || null,
          comparison: input.previousArticle.comparison || [],
          faq: input.previousArticle.faq || [],
          previousQuality: input.previousArticle.quality || null
        })
      ] : []),
      '',
      'DISCOVERED SITE PROFILE',
      JSON.stringify(profile),
      '',
      'RESEARCH BRIEF',
      JSON.stringify(research.brief),
      '',
      'VERIFIED SOURCES',
      sourceList,
      '',
      'SITE INTERNAL LINKS AVAILABLE',
      linkList || 'No verified relevant site pages: set editorial_promo.enabled=false.'
    ].join('\n'),
    text: { format: { type: 'json_schema', name: 'inx_content_article', strict: true, schema: articleSchema() } },
    max_output_tokens: 7000
  };
  if (/^gpt-5(?:\.|-)/i.test(env.contentWriter.model)) {
    request.reasoning = { effort: env.contentWriter.reasoningEffort || 'high' };
  }

  const result = await structuredResponse(
    request,
    'inx_content_article',
    'CONTENT_DRAFT_INVALID',
    env.contentWriter
  );
  return result.parsed;
}

function qualityReview(article) {
  const issues = [];
  const titleLength = normalizeSpace(article.title).length;
  const metaLength = normalizeSpace(article.meta_description).length;
  const words = wordCount(article.content_markdown);
  const h2s = headingCount(article.content_markdown);
  const sources = normalizeSources(article.sources);
  const sourceCount = sources.length;
  const namedSourceCount = sources.filter(source => source.title && !/^research\s+source$/i.test(source.title)).length;
  const citationCount = (String(article.content_markdown || '').match(/\[S\d{1,2}\]/gi) || []).length;
  const keywordCount = Array.isArray(article.keywords) ? article.keywords.length : 0;
  const faqCount = Array.isArray(article.faq) ? article.faq.length : 0;
  const internalLinkCount = Array.isArray(article.internalLinks) ? article.internalLinks.length : 0;
  const quickAnswerLength = normalizeSpace(article.quick_answer).length;
  const takeawayCount = Array.isArray(article.key_takeaways) ? article.key_takeaways.length : 0;

  let score = 0;
  if (titleLength >= 30 && titleLength <= 68) score += 8; else issues.push('Title should be roughly 30–68 characters and describe the page clearly.');
  if (metaLength >= 110 && metaLength <= 165) score += 8; else issues.push('Meta description should be roughly 110–165 characters.');
  if (normalizeSpace(article.excerpt).length >= 80) score += 4; else issues.push('Excerpt is too short.');
  if (quickAnswerLength >= 80 && quickAnswerLength <= 650) score += 7; else issues.push('Add a concise direct answer near the top of the article.');
  if (takeawayCount >= 3) score += 5; else issues.push('Add at least three useful key takeaways.');
  if (words >= 1200) score += 14; else if (words >= 900) score += 9; else issues.push('Article needs more substantive body content.');
  if (sourceCount >= 5) score += 10; else if (sourceCount >= 3) score += 7; else issues.push('Article needs at least three verifiable sources.');
  if (sourceCount && namedSourceCount === sourceCount) score += 6; else issues.push('Every source needs a meaningful title or publisher label.');
  if (citationCount >= 5) score += 14; else if (citationCount >= 3) score += 9; else issues.push('Important factual claims need inline source citations.');
  if (keywordCount >= 3 && keywordCount <= 8) score += 4; else issues.push('Use 3–8 focused keywords.');
  if (faqCount >= 3) score += 7; else if (faqCount >= 2) score += 5; else issues.push('Add at least two useful FAQs.');
  if (internalLinkCount >= 3) score += 6; else if (internalLinkCount >= 2) score += 4; else issues.push('Add more relevant internal recommendations.');
  if (h2s >= 4) score += 5; else if (h2s >= 3) score += 3; else issues.push('Article structure needs more useful sections.');
  if (!/game[- ]changer|revolutioni[sz]e your|fast-paced digital landscape|in today'?s digital age/i.test(article.content_markdown || '')) score += 2;
  else issues.push('Remove generic AI-marketing filler.');

  return {
    score: Math.min(100, score),
    issues,
    metrics: {
      words,
      h2s,
      sourceCount,
      namedSourceCount,
      citationCount,
      keywordCount,
      faqCount,
      internalLinkCount,
      takeawayCount
    }
  };
}

function articleSchemaObjects(article) {
  const siteUrl = String(article.site?.origin || SITE_URL).replace(/\/+$/, '');
  const brandName = String(article.site?.brandName || 'Publisher').trim();
  const canonical = siteUrl + '/blog/' + article.slug;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.meta_description || article.excerpt,
    mainEntityOfPage: canonical,
    datePublished: article.published_at || undefined,
    dateModified: article.updated_at || article.created_at,
    author: { '@type': 'Organization', name: brandName + ' Editorial', url: siteUrl },
    publisher: { '@type': 'Organization', name: brandName, url: siteUrl },
    image: article.featured_image_url ? [absoluteSiteAsset(versionedContentImageUrl(article))] : undefined,
    keywords: (article.keywords || []).join(', '),
    inLanguage: 'en-GB',
    isAccessibleForFree: true,
    wordCount: wordCount(article.content_markdown),
    about: (article.keywords || []).slice(0, 8),
    citation: normalizeSources(article.sources).map(source => source.url)
  };

  const faqJsonLd = article.faq?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer }
    }))
  } : null;

  return { jsonLd, faqJsonLd };
}

function mergePublicInternalLinks(article, dynamicLinks = []) {
  const base = Array.isArray(article.internalLinks) ? article.internalLinks : [];
  const combined = [...dynamicLinks, ...base];
  const seen = new Set();
  return combined
    .map(link => ({
      label: normalizeSpace(link?.label).slice(0, 140),
      url: safeInternalPath(link?.url),
      description: normalizeSpace(link?.description || '').slice(0, 260),
      kind: normalizeSpace(link?.kind || 'product').slice(0, 40)
    }))
    .filter(link => link.label && link.url && link.url !== '/blog/' + article.slug)
    .filter(link => {
      if (seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    })
    .slice(0, 7);
}

function publicArticle(article, dynamicLinks = []) {
  const schemas = articleSchemaObjects(article);
  const mergedInternalLinks = mergePublicInternalLinks(article, dynamicLinks);
  const editorialPromo = article.content_source === 'BABYLOVEGROWTH_IMPORTED'
    ? null
    : approvedEditorialPromo(article.editorial_promo, article.content_markdown, mergedInternalLinks)
      || fallbackEditorialPromo(article, mergedInternalLinks);
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    meta_description: article.meta_description,
    featured_image_url: versionedContentImageUrl(article),
    keywords: article.keywords || [],
    language: 'en-GB',
    published_at: article.published_at || null,
    created_at: article.created_at,
    updated_at: article.updated_at,
    content_markdown: article.content_markdown,
    content_html: article.content_html,
    editorial_promo: editorialPromo,
    quick_answer: article.quick_answer || article.excerpt || null,
    key_takeaways: Array.isArray(article.key_takeaways) ? article.key_takeaways : [],
    comparison: Array.isArray(article.comparison) ? article.comparison : [],
    sources: normalizeSources(article.sources),
    internalLinks: mergedInternalLinks,
    faq: article.faq || [],
    editorial: Number(article.generation?.editorialVersion || 0) >= 3 ? {
      method: 'AI-assisted editorial workflow with live web research and an independent AI quality review',
      sourceCount: normalizeSources(article.sources).length,
      updatedAt: article.updated_at || article.created_at
    } : null,
    jsonLd: article.imported_json_ld || schemas.jsonLd,
    faqJsonLd: article.imported_faq_json_ld || schemas.faqJsonLd
  };
}

async function saveArticle(article, previousSlug = null) {
  const sources = normalizeSources(article.sources);
  const internalLinks = (Array.isArray(article.internalLinks) ? article.internalLinks : [])
    .map(link => ({
      label: normalizeSpace(link.label).slice(0, 120),
      url: safeInternalPath(link.url),
      description: normalizeSpace(link.description || '').slice(0, 260)
    }))
    .filter(link => link.label && link.url)
    .slice(0, 6);
  const keyTakeaways = uniqueStrings(article.key_takeaways, 6, 260);
  const comparison = (Array.isArray(article.comparison) ? article.comparison : []).slice(0, 8).map(item => ({
    name: normalizeSpace(item.name).slice(0, 120),
    best_for: normalizeSpace(item.best_for).slice(0, 220),
    strength: normalizeSpace(item.strength).slice(0, 320),
    consideration: normalizeSpace(item.consideration).slice(0, 320),
    source_refs: uniqueStrings(item.source_refs, 3, 8).filter(ref => /^S\d{1,2}$/i.test(ref))
  })).filter(item => item.name);

  const prepared = {
    ...article,
    updated_at: nowIso(),
    keywords: uniqueStrings(article.keywords, 8, 80),
    quick_answer: normalizeSpace(article.quick_answer || article.excerpt || '').slice(0, 900),
    key_takeaways: keyTakeaways,
    comparison,
    faq: (Array.isArray(article.faq) ? article.faq : []).slice(0, 6).map(item => ({
      question: normalizeSpace(item.question).slice(0, 220),
      answer: normalizeSpace(item.answer).slice(0, 900)
    })).filter(item => item.question && item.answer),
    sources,
    internalLinks
  };
  prepared.content_html = article.content_source === 'BABYLOVEGROWTH_IMPORTED' && article.content_html
    ? sanitizeImportedHtml(article.content_html)
    : markdownToSafeHtml(article.content_markdown, sources);
  prepared.editorial_promo = article.content_source === 'BABYLOVEGROWTH_IMPORTED'
    ? null
    : approvedEditorialPromo(article.editorial_promo, prepared.content_markdown, internalLinks);
  prepared.quality = qualityReview(prepared);

  await upsertSetting(articleKey(prepared.id), prepared, 'Self-hosted Growth Content Engine article.');
  await upsertSetting(slugKey(prepared.slug), { id: prepared.id }, 'Growth Content Engine article slug alias.');
  if (previousSlug && previousSlug !== prepared.slug) await deleteSetting(slugKey(previousSlug));
  return prepared;
}

async function createDraft(input) {
  const opportunityMap = await growthOpportunities.latest().catch(() => null);
  let opportunity = null;
  if (input.opportunityId) {
    opportunity = (opportunityMap?.opportunities || []).find(item => item.id === input.opportunityId) || null;
    if (!opportunity) throw publicError('The selected Growth Intelligence opportunity no longer exists.', 404, 'OPPORTUNITY_NOT_FOUND');
  }

  const topic = normalizeSpace(input.topic || opportunity?.topic);
  if (topic.length < 4) throw publicError('Choose an opportunity or provide a content topic.', 400, 'CONTENT_TOPIC_REQUIRED');

  const context = {
    topic,
    intent: normalizeSpace(input.intent || opportunity?.intent || 'informational'),
    action: normalizeSpace(input.action || opportunity?.action?.label || ''),
    existingPage: input.existingPage || opportunity?.existingPage || '',
    notes: input.notes || ''
  };

  const research = await researchTopic(context);
  const draft = await writeArticle(context, research);
  const intelligence = await siteIntelligence.latest().catch(() => null);
  const id = crypto.randomUUID();
  const slug = await ensureUniqueSlug(draft.title || topic);
  const createdAt = nowIso();
  const article = {
    id,
    slug,
    site: {
      id: intelligence?.site?.id || null,
      origin: intelligence?.site?.origin || SITE_URL,
      brandName: intelligence?.profile?.brandName || intelligence?.site?.hostname || 'Publisher'
    },
    status: STATUS.DRAFT,
    opportunity_id: opportunity?.id || null,
    opportunity_score: opportunity?.score || null,
    opportunity_type: opportunity?.type || null,
    intent: context.intent,
    recommended_action: context.action || null,
    title: normalizeSpace(draft.title).slice(0, 180),
    excerpt: normalizeSpace(draft.excerpt).slice(0, 500),
    meta_description: normalizeSpace(draft.meta_description).slice(0, 300),
    keywords: uniqueStrings(draft.keywords, 8, 80),
    quick_answer: normalizeSpace(draft.quick_answer).slice(0, 900),
    key_takeaways: uniqueStrings(draft.key_takeaways, 6, 260),
    content_markdown: String(draft.content_markdown || '').trim(),
    editorial_promo: draft.editorial_promo,
    content_html: '',
    comparison: Array.isArray(draft.comparison) ? draft.comparison : [],
    faq: Array.isArray(draft.faq) ? draft.faq : [],
    sources: research.sources,
    internalLinks: await discoveredInternalLinks(topic, []),
    featured_image_prompt: normalizeSpace(draft.featured_image_prompt).slice(0, 1200),
    featured_image_url: null,
    featured_image_storage: null,
    research_brief: research.brief,
    generation: {
      researchModel: research.model,
      writerModel: env.contentWriter.model,
      writerReasoningEffort: env.contentWriter.reasoningEffort || 'high',
      editorialVersion: 3,
      generatedAt: createdAt
    },
    created_at: createdAt,
    updated_at: createdAt,
    approved_at: null,
    published_at: null,
    archived_at: null
  };

  return saveArticle(article);
}

async function reviseDraft(id, feedback = {}, options = {}) {
  const article = await getArticleById(id);
  if (article.status !== STATUS.DRAFT) {
    throw publicError('Only a draft article can be revised by the editorial optimisation loop.', 409, 'CONTENT_DRAFT_REQUIRED');
  }

  const requiredFixes = uniqueStrings(feedback.requiredFixes || [], 10, 500);
  const issues = uniqueStrings(feedback.issues || [], 10, 500);
  const backendIssues = uniqueStrings(options.backendIssues || article.quality?.issues || [], 12, 500);
  const editorNote = [
    'This is an editorial revision, not a new unrelated draft.',
    'Preserve the useful parts of the existing article while fixing every actionable issue.',
    feedback.summary ? 'Senior editor summary: ' + normalizeSpace(feedback.summary) : '',
    requiredFixes.length ? 'Required fixes: ' + requiredFixes.join(' | ') : '',
    issues.length ? 'Review issues: ' + issues.join(' | ') : '',
    backendIssues.length ? 'Backend quality issues: ' + backendIssues.join(' | ') : '',
    'Target a final backend quality score of at least 90/100 without padding, keyword stuffing or unsupported claims.'
  ].filter(Boolean).join(' ');

  const context = {
    topic: article.title,
    intent: article.intent || 'informational',
    action: article.recommended_action || 'Improve the article until it is publication-ready.',
    existingPage: '',
    notes: editorNote,
    previousArticle: article
  };

  const needsFreshResearch = options.suppressFreshResearch === true
    ? false
    : options.refreshResearch === true
      || feedback.factualRisk === 'high'
      || requiredFixes.concat(issues).some(item => /source|citation|evidence|fact|claim|current|verify/i.test(item));

  const existingSources = normalizeSources(article.sources || []);
  const existingResearch = {
    brief: article.research_brief || {},
    sources: existingSources,
    model: article.generation?.researchModel || env.webResearch.model,
    fallbackUsed: false,
    fallbackReason: null
  };

  let research = existingResearch;
  if (needsFreshResearch) {
    try {
      // A repair is latency-sensitive: make one focused evidence attempt, then
      // preserve the verified source pack already attached to the draft.
      research = await researchTopic(context, { maxEvidenceAttempts: 1 });
    } catch (error) {
      if (existingSources.length >= 3) {
        context.notes = [
          context.notes,
          'Fresh evidence retrieval was temporarily unavailable. Keep claims that are supported by the existing verified sources, remove or soften any claim that cannot be supported, and do not invent replacement evidence.'
        ].filter(Boolean).join(' ');
        research = {
          ...existingResearch,
          fallbackUsed: true,
          fallbackReason: String(error.code || error.message || 'research_unavailable').slice(0, 160)
        };
        console.warn('[growth-content] revision is using the existing verified source pack after fresh research failed', {
          articleId: article.id,
          error: String(error.code || error.message || error).slice(0, 200),
          sourceCount: existingSources.length
        });
      } else {
        throw error;
      }
    }
  }

  if (!research.sources.length) {
    research = await researchTopic(context, { maxEvidenceAttempts: 2 });
  }

  const revised = await writeArticle(context, research);
  const previousSlug = article.slug;
  const nextSlug = slugify(revised.title || article.title) === article.slug
    ? article.slug
    : await ensureUniqueSlug(revised.title || article.title, article.id);
  const revisionNumber = Number(article.generation?.revisionNumber || 0) + 1;

  return saveArticle({
    ...article,
    slug: nextSlug,
    title: normalizeSpace(revised.title).slice(0, 180),
    excerpt: normalizeSpace(revised.excerpt).slice(0, 500),
    meta_description: normalizeSpace(revised.meta_description).slice(0, 300),
    keywords: uniqueStrings(revised.keywords, 8, 80),
    quick_answer: normalizeSpace(revised.quick_answer).slice(0, 900),
    key_takeaways: uniqueStrings(revised.key_takeaways, 6, 260),
    content_markdown: String(revised.content_markdown || '').trim(),
    editorial_promo: revised.editorial_promo,
    content_html: '',
    comparison: Array.isArray(revised.comparison) ? revised.comparison : [],
    faq: Array.isArray(revised.faq) ? revised.faq : [],
    sources: research.sources,
    internalLinks: await discoveredInternalLinks(article.title, []),
    featured_image_prompt: normalizeSpace(revised.featured_image_prompt).slice(0, 1200),
    research_brief: research.brief,
    generation: {
      ...(article.generation || {}),
      researchModel: research.model,
      writerModel: env.contentWriter.model,
      writerReasoningEffort: env.contentWriter.reasoningEffort || 'high',
      editorialVersion: 4,
      revisionNumber,
      revisedAt: nowIso(),
      researchFallbackUsed: Boolean(research.fallbackUsed),
      researchFallbackReason: research.fallbackReason || null,
      lastEditorSummary: normalizeSpace(feedback.summary || '').slice(0, 1200),
      lastRequiredFixes: requiredFixes
    }
  }, previousSlug);
}

async function updateArticle(id, input) {
  const article = await getArticleById(id);
  if (article.status === STATUS.ARCHIVED) throw publicError('Archived content cannot be edited.', 409, 'CONTENT_ARCHIVED');
  if (article.status === STATUS.PUBLISHED) throw publicError('Unpublish the article before editing it.', 409, 'CONTENT_UNPUBLISH_REQUIRED');

  const previousSlug = article.slug;
  let slug = article.slug;
  if (input.slug && slugify(input.slug) !== article.slug) slug = await ensureUniqueSlug(input.slug, article.id);

  const next = {
    ...article,
    slug,
    title: input.title == null ? article.title : normalizeSpace(input.title).slice(0, 180),
    excerpt: input.excerpt == null ? article.excerpt : normalizeSpace(input.excerpt).slice(0, 500),
    meta_description: input.meta_description == null ? article.meta_description : normalizeSpace(input.meta_description).slice(0, 300),
    keywords: input.keywords == null ? article.keywords : uniqueStrings(input.keywords, 8, 80),
    content_markdown: input.content_markdown == null ? article.content_markdown : String(input.content_markdown).trim(),
    editorial_promo: input.content_markdown == null ? article.editorial_promo : null,
    faq: input.faq == null ? article.faq : input.faq,
    featured_image_prompt: input.featured_image_prompt == null ? article.featured_image_prompt : normalizeSpace(input.featured_image_prompt).slice(0, 1200)
  };

  if (next.status === STATUS.APPROVED) {
    next.status = STATUS.DRAFT;
    next.approved_at = null;
  }
  return saveArticle(next, previousSlug);
}

async function optimizePublishedMetadata(id, input = {}) {
  const article = await getArticleById(id);
  if (article.status !== STATUS.PUBLISHED) {
    throw publicError('Only a published article can be optimised in place.', 409, 'CONTENT_PUBLISHED_REQUIRED');
  }

  const next = {
    ...article,
    title: input.title == null ? article.title : normalizeSpace(input.title).slice(0, 180),
    meta_description: input.meta_description == null ? article.meta_description : normalizeSpace(input.meta_description).slice(0, 300),
    generation: {
      ...(article.generation || {}),
      optimizationVersion: 1,
      optimizedAt: nowIso(),
      optimizationReason: normalizeSpace(input.reason || 'Measured CTR optimisation').slice(0, 500)
    }
  };
  const quality = qualityReview(next);
  if (quality.score < 65) {
    throw publicError('The proposed metadata would reduce the article below the publishing quality threshold.', 409, 'CONTENT_OPTIMIZATION_QUALITY_LOW');
  }
  return saveArticle({ ...next, quality });
}

async function refreshPublishedArticle(id, notes = '') {
  const article = await getArticleById(id);
  if (article.status !== STATUS.PUBLISHED) {
    throw publicError('Only a published article can be refreshed in place.', 409, 'CONTENT_PUBLISHED_REQUIRED');
  }

  const context = {
    topic: article.title,
    intent: article.intent || 'informational',
    action: 'Refresh an existing published article because measured search or conversion evidence indicates decay or an opportunity to improve it.',
    existingPage: SITE_URL + '/blog/' + article.slug,
    notes: [
      'Preserve the page search intent and URL. Refresh stale information rather than creating a duplicate page.',
      'Keep useful existing concepts when still accurate. Strengthen the answer with current verified sources and practical detail.',
      normalizeSpace(notes || '')
    ].filter(Boolean).join(' ')
  };

  const research = await researchTopic(context);
  const draft = await writeArticle(context, research);
  const candidate = {
    ...article,
    title: normalizeSpace(draft.title || article.title).slice(0, 180),
    excerpt: normalizeSpace(draft.excerpt || article.excerpt).slice(0, 500),
    meta_description: normalizeSpace(draft.meta_description || article.meta_description).slice(0, 300),
    keywords: uniqueStrings(draft.keywords?.length ? draft.keywords : article.keywords, 8, 80),
    quick_answer: normalizeSpace(draft.quick_answer || article.quick_answer || article.excerpt).slice(0, 900),
    key_takeaways: uniqueStrings(draft.key_takeaways, 6, 260),
    content_markdown: String(draft.content_markdown || article.content_markdown || '').trim(),
    // Published refreshes do not pass the independent draft editor; hold the promotion.
    editorial_promo: null,
    comparison: Array.isArray(draft.comparison) ? draft.comparison : article.comparison,
    faq: Array.isArray(draft.faq) ? draft.faq : article.faq,
    sources: research.sources,
    internalLinks: await discoveredInternalLinks(article.title, draft.keywords || article.keywords),
    featured_image_prompt: normalizeSpace(draft.featured_image_prompt || article.featured_image_prompt).slice(0, 1200),
    research_brief: research.brief,
    generation: {
      ...(article.generation || {}),
      researchModel: research.model,
      writerModel: env.contentWriter.model,
      writerReasoningEffort: env.contentWriter.reasoningEffort || 'high',
      editorialVersion: 3,
      optimizationVersion: 1,
      refreshedAt: nowIso()
    },
    status: STATUS.PUBLISHED,
    published_at: article.published_at || nowIso(),
    archived_at: null
  };
  const quality = qualityReview(candidate);
  if (quality.score < 75) {
    throw publicError('The refreshed article did not meet the Phase 5 quality threshold, so the live page was left unchanged.', 409, 'CONTENT_REFRESH_QUALITY_LOW');
  }
  return saveArticle({ ...candidate, quality });
}

async function approveArticle(id) {
  const article = await getArticleById(id);
  const reviewed = { ...article, quality: qualityReview(article) };
  if (reviewed.quality.score < 65) {
    throw publicError('Quality score must be at least 65 before approval. Resolve the listed review issues first.', 409, 'CONTENT_QUALITY_LOW');
  }
  reviewed.status = STATUS.APPROVED;
  reviewed.approved_at = nowIso();
  return saveArticle(reviewed);
}

async function publishArticle(id) {
  const article = await getArticleById(id);
  if (article.status !== STATUS.APPROVED) {
    throw publicError('Approve the article before publishing it.', 409, 'CONTENT_APPROVAL_REQUIRED');
  }
  const quality = qualityReview(article);
  if (quality.score < 65) throw publicError('Article quality fell below the publishing threshold.', 409, 'CONTENT_QUALITY_LOW');
  return saveArticle({
    ...article,
    status: STATUS.PUBLISHED,
    quality,
    published_at: article.published_at || nowIso()
  });
}

async function unpublishArticle(id) {
  const article = await getArticleById(id);
  if (article.status !== STATUS.PUBLISHED) return article;
  return saveArticle({ ...article, status: STATUS.APPROVED });
}

async function archiveArticle(id) {
  const article = await getArticleById(id);
  return saveArticle({
    ...article,
    status: STATUS.ARCHIVED,
    archived_at: nowIso()
  });
}

async function generateFeaturedImage(id) {
  const article = await getArticleById(id);
  if (article.status === STATUS.PUBLISHED) throw publicError('Unpublish the article before changing its featured image.', 409, 'CONTENT_UNPUBLISH_REQUIRED');
  if (!env.openaiImage.apiKey) throw publicError('OpenAI image generation is not configured.', 503, 'CONTENT_IMAGE_NOT_CONFIGURED');
  if (!article.featured_image_prompt) throw publicError('This article has no featured-image prompt.', 409, 'CONTENT_IMAGE_PROMPT_REQUIRED');
  const model = env.openaiImage.model;
  if (!/^gpt-image-(?:1(?:\.5|-mini)?|2(?:\.5-(?:flare|sunburst))?)$/.test(model)) {
    throw publicError('Configure an OpenAI GPT Image model for SEO images.', 503, 'CONTENT_IMAGE_MODEL_INVALID');
  }
  const prompt = article.featured_image_prompt + ' Editorial illustration, clean professional composition, no text, letters, numbers, logos, watermarks, interface panels or fake UI labels. Do not draw a headline into the image. Suitable for the ' + String(article.site?.brandName || 'site') + ' blog hero.';
  const response = await axios.post('https://api.openai.com/v1/images/generations', {
    model,
    prompt,
    size: '1536x1024',
    quality: 'medium',
    output_format: 'png',
    n: 1
  }, {
    timeout: env.openaiImage.timeoutMs,
    headers: { Authorization: 'Bearer ' + env.openaiImage.apiKey, 'Content-Type': 'application/json' },
    maxContentLength: 24 * 1024 * 1024
  });
  const encoded = response.data?.data?.[0]?.b64_json;
  if (!encoded) throw publicError('OpenAI returned no usable image.', 502, 'CONTENT_IMAGE_EMPTY');
  const generatedImage = Buffer.from(encoded, 'base64');
  if (!generatedImage.length || generatedImage.length > 20 * 1024 * 1024) throw publicError('OpenAI returned an invalid image.', 502, 'CONTENT_IMAGE_INVALID');
  const webp = await sharp(generatedImage).resize(1264, 848, { fit: 'cover' }).webp({ quality: 88 }).toBuffer();
  const stored = await objectStorage.persistBuffer({
    userId: 'growth-content',
    data: webp,
    mimeType: 'image/webp',
    originalName: article.slug + '.webp',
    prefix: 'growth-content'
  });
  const generatedAt = nowIso();
  const previousStorage = article.featured_image_storage || null;
  const saved = await saveArticle({
    ...article,
    featured_image_url: '/content-media/' + encodeURIComponent(article.id) + '/' + Date.parse(generatedAt),
    featured_image_storage: {
      provider: stored.storageProvider,
      key: stored.storageKey,
      mimeType: 'image/webp',
      generatedAt,
      model,
      imageProvider: 'openai'
    }
  });
  if (previousStorage?.key && previousStorage.key !== stored.storageKey) {
    await objectStorage.deleteObject(previousStorage.key, previousStorage.provider || null).catch(() => {});
  }
  return saved;
}

async function imageBuffer(id) {
  const article = await getArticleById(id);
  const storage = article.featured_image_storage;
  if (!storage?.key) throw publicError('Featured image not found.', 404, 'CONTENT_IMAGE_NOT_FOUND');
  const data = await objectStorage.getBuffer(storage.key, null, storage.provider || null);
  return { data, mimeType: storage.mimeType || 'image/webp', generatedAt: storage.generatedAt || article.updated_at };
}

async function listArticles(options = {}) {
  const articles = await listAllArticles();
  return articles
    .filter(article => !options.publishedOnly || article.status === STATUS.PUBLISHED)
    .filter(article => !options.status || article.status === options.status)
    .sort((a, b) => new Date(b.published_at || b.updated_at || 0) - new Date(a.published_at || a.updated_at || 0));
}

async function publicArticles(options = {}) {
  let articles = await listArticles({ publishedOnly: true });
  if (options.tag) {
    const requested = tagSlug(options.tag);
    articles = articles.filter(article => (article.keywords || []).some(keyword => tagSlug(keyword) === requested));
  }
  return articles.map(article => {
    const item = publicArticle(article);
    delete item.content_html;
    delete item.content_markdown;
    delete item.sources;
    delete item.internalLinks;
    delete item.faq;
    delete item.jsonLd;
    delete item.faqJsonLd;
    return item;
  });
}

async function publicArticleBySlug(slug) {
  const article = await getArticleBySlug(slug, { publishedOnly: true });
  if (!article) return null;
  const graph = await readSetting(SEO_LINK_GRAPH_KEY).catch(() => null);
  const dynamicLinks = Array.isArray(graph?.graph?.[article.id]) ? graph.graph[article.id] : [];
  return publicArticle(article, dynamicLinks);
}

async function publicSitemapEntries() {
  const articles = await listArticles({ publishedOnly: true });
  return articles.map(article => ({
    slug: article.slug,
    published_at: article.published_at,
    updated_at: article.updated_at,
    created_at: article.created_at
  }));
}


function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryAfterMs(error, attempt) {
  const raw = error?.response?.headers?.['retry-after'];
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(120000, Math.max(1000, seconds * 1000));
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return Math.min(120000, Math.max(1000, date.getTime() - Date.now()));
  }
  const fallback = [5000, 15000, 30000, 60000][Math.max(0, Math.min(3, attempt - 1))];
  return fallback;
}

async function babyLoveGet(path, options = {}) {
  const apiKey = String(process.env.BABYLOVEGROWTH_BLOG_API_KEY || '').trim();
  if (!apiKey) throw Object.assign(new Error('BabyLoveGrowth API key is not configured.'), { code: 'BABYLOVE_KEY_MISSING' });

  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await axios.get(BABYLOVE_API_BASE + path, {
        params: options.params || undefined,
        headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
        timeout: 30000
      });
    } catch (error) {
      lastError = error;
      const status = Number(error?.response?.status || 0);
      const retryable = status === 429 || status >= 500 || status === 0;
      if (!retryable || attempt >= 4) throw error;
      const delayMs = retryAfterMs(error, attempt);
      console.warn('[growth-content] BabyLoveGrowth import request will retry', {
        path,
        status: status || null,
        attempt,
        delayMs
      });
      await wait(delayMs);
    }
  }
  throw lastError || new Error('BabyLoveGrowth import request failed.');
}

async function importLegacyBabyLoveArticles(options = {}) {
  const apiKey = String(process.env.BABYLOVEGROWTH_BLOG_API_KEY || '').trim();
  if (!apiKey) return { configured: false, imported: 0, skipped: true, reason: 'missing_key' };

  const previous = await readSetting(LEGACY_IMPORT_SETTING_KEY);
  const maxAgeMs = 12 * 60 * 60 * 1000;
  if (!options.force && previous?.completedAt && Date.now() - new Date(previous.completedAt).getTime() < maxAgeMs) {
    return { configured: true, imported: Number(previous.imported || 0), skipped: true, reason: 'recently_synced' };
  }

  let offset = 0;
  const limit = 50;
  let imported = 0;
  let discovered = 0;

  while (offset < 500) {
    const response = await babyLoveGet('/articles', { params: { limit, offset } });
    const batch = Array.isArray(response.data) ? response.data : [];
    if (!batch.length) break;
    discovered += batch.length;

    for (const summary of batch) {
      const legacyId = summary?.id;
      if (legacyId == null) continue;
      await wait(1200);
      const detailResponse = await babyLoveGet('/articles/' + encodeURIComponent(String(legacyId)));
      const detail = detailResponse.data || {};
      const slug = slugify(detail.slug || summary.slug || detail.title || summary.title || ('legacy-' + legacyId));
      const id = 'blg-' + String(legacyId);
      const existing = await getArticleBySlug(slug, { publishedOnly: false }).catch(() => null);
      if (existing && existing.content_source !== 'BABYLOVEGROWTH_IMPORTED') continue;

      const createdAt = detail.created_at || summary.created_at || nowIso();
      const article = {
        id,
        slug,
        status: STATUS.PUBLISHED,
        content_source: 'BABYLOVEGROWTH_IMPORTED',
        title: normalizeSpace(detail.title || summary.title || slug).slice(0, 180),
        excerpt: normalizeSpace(detail.excerpt || summary.excerpt || detail.meta_description || summary.meta_description || '').slice(0, 500),
        meta_description: normalizeSpace(detail.meta_description || summary.meta_description || '').slice(0, 300),
        keywords: uniqueStrings(detail.keywords || summary.keywords || [detail.seedKeyword || summary.seedKeyword].filter(Boolean), 8, 80),
        content_markdown: String(detail.content_markdown || '').trim(),
        content_html: sanitizeImportedHtml(detail.content_html || ''),
        faq: [],
        sources: [],
        internalLinks: [],
        featured_image_prompt: '',
        featured_image_url: safeExternalUrl(detail.hero_image_url || summary.hero_image_url) || null,
        featured_image_storage: null,
        imported_json_ld: detail.jsonLd || null,
        imported_faq_json_ld: detail.faqJsonLd || null,
        research_brief: null,
        generation: {
          importedFrom: 'BabyLoveGrowth',
          legacyId: String(legacyId),
          importedAt: nowIso()
        },
        created_at: createdAt,
        updated_at: detail.updated_at || createdAt,
        approved_at: createdAt,
        published_at: detail.published_at || createdAt,
        archived_at: null
      };

      await saveArticle(article, existing?.slug || null);
      imported += 1;
    }

    if (batch.length < limit) break;
    offset += limit;
  }

  const result = {
    completedAt: nowIso(),
    imported,
    discovered,
    source: 'BabyLoveGrowth API',
    selfHosted: true
  };
  await upsertSetting(
    LEGACY_IMPORT_SETTING_KEY,
    result,
    'One-time/periodic migration status for legacy BabyLoveGrowth articles copied into INXSocial storage.'
  );
  console.info('[growth-content] legacy BabyLoveGrowth articles synced into self-hosted storage', result);
  return { configured: true, ...result, skipped: false };
}

async function overview() {
  const articles = await listAllArticles();
  const counts = Object.values(STATUS).reduce((acc, status) => {
    acc[status] = articles.filter(article => article.status === status).length;
    return acc;
  }, {});

  const latestOpportunity = await growthOpportunities.latest().catch(() => null);
  const opportunityOptions = (latestOpportunity?.opportunities || []).slice(0, 25).map(item => ({
    id: item.id,
    topic: item.topic,
    score: item.score,
    intent: item.intent,
    action: item.action?.label || null,
    existingPage: item.existingPage || null
  }));

  const engine = {
    aiConfigured: openAiReady(),
    imageConfigured: Boolean(env.openaiImage.apiKey) && objectStorage.isConfigured(),
    model: env.webResearch?.model || null,
    source: 'INXSOCIAL_SELF_HOSTED',
    publishingMode: 'AUTOPILOT_QUALITY_GATE',
    babyLoveGrowthRequired: false
  };
  await upsertSetting(ENGINE_SETTING_KEY, { ...engine, checkedAt: nowIso() }, 'Growth Content Engine operational status.');

  return {
    generatedAt: nowIso(),
    engine,
    counts,
    opportunityOptions,
    articles: articles.slice(0, 50).map(article => ({
      id: article.id,
      slug: article.slug,
      status: article.status,
      title: article.title,
      excerpt: article.excerpt,
      quality: article.quality || qualityReview(article),
      opportunity_score: article.opportunity_score,
      featured_image_url: article.featured_image_url || null,
      created_at: article.created_at,
      updated_at: article.updated_at,
      published_at: article.published_at
    }))
  };
}

module.exports = {
  STATUS,
  ARTICLE_PREFIX,
  ENGINE_SETTING_KEY,
  SEO_LINK_GRAPH_KEY,
  slugify,
  markdownToSafeHtml,
  approvedEditorialPromo,
  qualityReview,
  overview,
  listArticles,
  getArticleById,
  getArticleBySlug,
  createDraft,
  reviseDraft,
  updateArticle,
  optimizePublishedMetadata,
  refreshPublishedArticle,
  approveArticle,
  publishArticle,
  unpublishArticle,
  archiveArticle,
  generateFeaturedImage,
  imageBuffer,
  publicArticles,
  publicArticleBySlug,
  publicSitemapEntries,
  mergePublicInternalLinks,
  importLegacyBabyLoveArticles,
  babyLoveGet,
  retryAfterMs,
  parseStructuredJson,
  structuredResponse,
  versionedContentImageUrl
};
