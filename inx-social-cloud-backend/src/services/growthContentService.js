'use strict';

const crypto = require('node:crypto');
const axios = require('axios');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const env = require('../config/env');
const webResearch = require('./webResearchService');
const growthOpportunities = require('./growthOpportunityService');
const runware = require('./runwareService');
const objectStorage = require('./mediaObjectStorageService');

const ARTICLE_PREFIX = 'growth_content_article_v2:';
const SLUG_PREFIX = 'growth_content_slug_v2:';
const ENGINE_SETTING_KEY = 'growth_content_engine_v2';
const LEGACY_IMPORT_SETTING_KEY = 'growth_content_legacy_babylove_import_v1';
const BABYLOVE_API_BASE = 'https://api.babylovegrowth.ai/api/integrations/v1';
const SITE_URL = 'https://www.inxsocial.co.uk';

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
  const clean = value.split('?')[0];
  const stamp = new Date(article?.featured_image_storage?.generatedAt || article?.updated_at || Date.now()).getTime();
  return clean + '/' + (Number.isFinite(stamp) ? stamp : Date.now());
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
    .slice(0, 90) || 'inxsocial-guide';
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

function relatedInternalLinks(topic, keywords = []) {
  const haystack = [topic, ...keywords].join(' ').toLowerCase();
  const catalog = [
    { test: /bulk|batch/, label: 'Bulk social media scheduler for campaigns', url: '/bulk-social-media-scheduler', description: 'Plan and schedule larger campaign batches from one workflow.' },
    { test: /calendar|planning|planner/, label: 'Social media content calendar & planner', url: '/social-media-content-calendar', description: 'Turn ideas into a structured publishing calendar across channels.' },
    { test: /analytic|measure|report|performance/, label: 'Social media analytics', url: '/social-media-analytics', description: 'Measure publishing performance and identify what to improve next.' },
    { test: /campaign/, label: 'AI social media campaign generator', url: '/ai-social-media-campaign-generator', description: 'Build coordinated campaign concepts, copy and media ideas faster.' },
    { test: /carousel/, label: 'AI carousel post generator', url: '/ai-carousel-post-generator', description: 'Create structured multi-slide social posts for educational or promotional content.' },
    { test: /video|reel/, label: 'AI video post generator', url: '/ai-video-post-generator', description: 'Generate short-form video concepts and assets for social campaigns.' },
    { test: /ugc|creator ad|advert/, label: 'AI UGC ad generator', url: '/ai-ugc-ad-generator', description: 'Produce creator-style ad concepts and UGC workflows for paid social.' },
    { test: /caption|post|copy/, label: 'AI social media post generator', url: '/ai-social-media-post-generator', description: 'Draft platform-ready post copy while keeping the publishing workflow connected.' },
    { test: /schedule|scheduler|buffer|hootsuite|later|publish/, label: 'AI social media post generator & scheduler', url: '/social-media-scheduler', description: 'Create, organise and schedule social content from a single workspace.' },
    { test: /ai|automation|content/, label: 'AI social media tools', url: '/ai-social-media-tools', description: 'Explore INXSocial tools for AI-assisted content creation and publishing.' },
    { test: /price|pricing|cost|plan/, label: 'INXSocial pricing', url: '/pricing', description: 'Compare available plans and the features included in each tier.' }
  ];

  const selected = [];
  for (const item of catalog) {
    if (!item.test.test(haystack)) continue;
    selected.push({ label: item.label, url: item.url, description: item.description });
    if (selected.length >= 4) break;
  }
  const fallback = [
    { label: 'AI social media tools', url: '/ai-social-media-tools', description: 'Explore AI-assisted content creation and publishing tools.' },
    { label: 'AI social media post generator & scheduler', url: '/social-media-scheduler', description: 'Create, organise and schedule content from one workflow.' },
    { label: 'INXSocial pricing', url: '/pricing', description: 'Compare plans and included features.' }
  ];
  for (const item of fallback) {
    if (!selected.some(existing => existing.url === item.url)) selected.push(item);
    if (selected.length >= 4) break;
  }
  return selected.slice(0, 4);
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
          required: ['claim', 'support'],
          properties: {
            claim: { type: 'string' },
            support: { type: 'string' }
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
    required: ['title', 'excerpt', 'meta_description', 'keywords', 'quick_answer', 'key_takeaways', 'content_markdown', 'comparison', 'faq', 'featured_image_prompt'],
    properties: {
      title: { type: 'string' },
      excerpt: { type: 'string' },
      meta_description: { type: 'string' },
      keywords: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'string' } },
      quick_answer: { type: 'string' },
      key_takeaways: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string' } },
      content_markdown: { type: 'string' },
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

async function responsesRequest(payload) {
  if (!openAiReady()) throw publicError('OpenAI web research is not configured for the Content Engine.', 503, 'CONTENT_AI_NOT_CONFIGURED');
  const response = await axios.post(env.webResearch.baseUrl + '/responses', payload, {
    timeout: Math.max(60000, Number(env.webResearch.timeoutMs || 120000)),
    headers: {
      Authorization: 'Bearer ' + env.webResearch.apiKey,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

async function structuredResponse(payload, schemaName, errorCode) {
  const raws = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const request = {
      ...payload,
      max_output_tokens: attempt === 1 ? Number(payload.max_output_tokens || 4000) : Math.max(Number(payload.max_output_tokens || 4000) + 2000, 5500)
    };
    if (attempt > 1) {
      request.instructions = String(request.instructions || '') + ' This is a retry because the previous response could not be parsed. Return one complete JSON object only, with no markdown fences, commentary or trailing text.';
    }

    const raw = await responsesRequest(request);
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

async function researchTopic(input) {
  const topic = normalizeSpace(input.topic);
  const currentPage = safeExternalUrl(input.existingPage) || safeInternalPath(input.existingPage);
  const request = {
    model: env.webResearch.model,
    instructions: [
      'You are the senior research desk for INXSocial.',
      'Use current web search to build an evidence brief for a people-first, original article that would be useful even if search engines did not exist.',
      'Start with the search intent and the reader decision or task, then research the evidence needed to answer it completely.',
      'Prefer primary sources: official documentation, standards, regulator or government pages, and official product pages for claims about those products.',
      'Use reputable independent sources where they add context. Avoid scraped listicles, thin affiliate roundups, anonymous SEO pages and sources that merely repeat another source.',
      'For comparison topics, separate verified product facts from editorial judgement and identify the criteria a buyer should use.',
      'Look for practical caveats, limitations, trade-offs, current terminology and questions a serious buyer or operator would ask.',
      'Do not copy competitor wording and do not make unsupported numerical claims.',
      'Return JSON only in the requested schema.'
    ].join(' '),
    input: [
      'Topic: ' + topic,
      'Intent: ' + normalizeSpace(input.intent || 'commercial/informational'),
      'Recommended action: ' + normalizeSpace(input.action || ''),
      'Existing INXSocial page: ' + (currentPage || 'none'),
      'Research market: United Kingdom, English language.',
      'INXSocial is a social-media workflow product for creating, scheduling, analysing and managing social content.',
      'Do not invent pricing, customer counts, performance claims, integrations or capabilities.'
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

  const result = await structuredResponse(request, 'inx_content_research', 'CONTENT_RESEARCH_INVALID');
  const raw = result.raw;
  const parsed = result.parsed;
  const sources = normalizeSources(
    result.raws.flatMap(item => webResearch.extractResponseSources(item))
  );

  if (!sources.length) throw publicError('Content research returned no verifiable web sources.', 502, 'CONTENT_RESEARCH_EMPTY');
  return { brief: parsed, sources, model: env.webResearch.model };
}

async function writeArticle(input, research) {
  const sourceList = research.sources.map(source => source.id + '. ' + source.title + ' [' + source.domain + '] — ' + source.url).join('\n');
  const internalLinks = relatedInternalLinks(input.topic, []);
  const linkList = internalLinks.map(link => link.label + ': ' + SITE_URL + link.url).join('\n');

  const request = {
    model: env.webResearch.model,
    instructions: [
      'You are the senior editorial writer for INXSocial. Write like a specialist publication, not a generic SEO content generator.',
      'Create an original, useful article from the research brief and verified source pack. The reader should leave with a clear answer, decision framework and practical next step.',
      'Use British English and an expert but plain-spoken tone.',
      'Answer the primary question early. quick_answer should be a direct 45-90 word answer suitable for a human reader and a search snippet.',
      'key_takeaways must contain 3-6 specific, non-repetitive takeaways.',
      'Use the source IDs exactly as [S1], [S2] and so on after factual claims that depend on external evidence. Do not cite common-sense advice. Never invent a source ID.',
      'For comparison or best-tool queries, explain selection criteria and trade-offs. Populate comparison only when it genuinely helps; every product-specific comparison row should include relevant source_refs.',
      'Use Markdown with ## and ### headings, short paragraphs, bullet lists and numbered steps where useful. Write as much as the topic needs, typically 1300-2400 words, but never pad to a word count.',
      'Include concrete examples, caveats, what to check before choosing, and a practical recommendation framework when relevant.',
      'Do not invent statistics, testimonials, customer results, prices, product capabilities or integrations. Do not copy competitor wording.',
      'Do not add a Sources heading; the application renders a verified source section separately.',
      'Do not put raw URLs or Markdown links inside the body. Internal recommendations are rendered separately.',
      'Avoid generic AI filler, keyword stuffing, exaggerated marketing language, repetitive conclusions and claims that INXSocial is best without evidence.',
      'Return JSON only in the requested schema.'
    ].join(' '),
    input: [
      'Topic: ' + normalizeSpace(input.topic),
      'Intent: ' + normalizeSpace(input.intent || ''),
      'Recommended action: ' + normalizeSpace(input.action || ''),
      'Optional editor note: ' + normalizeSpace(input.notes || ''),
      '',
      'RESEARCH BRIEF',
      JSON.stringify(research.brief),
      '',
      'VERIFIED SOURCES',
      sourceList,
      '',
      'INXSOCIAL INTERNAL LINKS AVAILABLE',
      linkList
    ].join('\n'),
    text: { format: { type: 'json_schema', name: 'inx_content_article', strict: true, schema: articleSchema() } },
    max_output_tokens: 7000
  };
  if (/^gpt-5(?:\.|-)/i.test(env.webResearch.model)) request.reasoning = { effort: 'low' };

  const result = await structuredResponse(request, 'inx_content_article', 'CONTENT_DRAFT_INVALID');
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
  const canonical = SITE_URL + '/blog/' + article.slug;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.meta_description || article.excerpt,
    mainEntityOfPage: canonical,
    datePublished: article.published_at || undefined,
    dateModified: article.updated_at || article.created_at,
    author: { '@type': 'Organization', name: 'INXSocial Editorial', url: SITE_URL + '/about' },
    publisher: { '@type': 'Organization', name: 'INXSocial', url: SITE_URL },
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

function publicArticle(article) {
  const schemas = articleSchemaObjects(article);
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
    quick_answer: article.quick_answer || article.excerpt || null,
    key_takeaways: Array.isArray(article.key_takeaways) ? article.key_takeaways : [],
    comparison: Array.isArray(article.comparison) ? article.comparison : [],
    sources: normalizeSources(article.sources),
    internalLinks: relatedInternalLinks(article.title, article.keywords),
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
  prepared.quality = qualityReview(prepared);

  await upsertSetting(articleKey(prepared.id), prepared, 'INXSocial self-hosted Growth Content Engine article.');
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
  const id = crypto.randomUUID();
  const slug = await ensureUniqueSlug(draft.title || topic);
  const createdAt = nowIso();
  const article = {
    id,
    slug,
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
    content_html: '',
    comparison: Array.isArray(draft.comparison) ? draft.comparison : [],
    faq: Array.isArray(draft.faq) ? draft.faq : [],
    sources: research.sources,
    internalLinks: relatedInternalLinks(topic, draft.keywords),
    featured_image_prompt: normalizeSpace(draft.featured_image_prompt).slice(0, 1200),
    featured_image_url: null,
    featured_image_storage: null,
    research_brief: research.brief,
    generation: {
      researchModel: research.model,
      writerModel: env.webResearch.model,
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
    faq: input.faq == null ? article.faq : input.faq,
    featured_image_prompt: input.featured_image_prompt == null ? article.featured_image_prompt : normalizeSpace(input.featured_image_prompt).slice(0, 1200)
  };

  if (next.status === STATUS.APPROVED) {
    next.status = STATUS.DRAFT;
    next.approved_at = null;
  }
  return saveArticle(next, previousSlug);
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
  if (!runware.isConfigured()) throw publicError('Runware image generation is not configured.', 503, 'CONTENT_IMAGE_NOT_CONFIGURED');
  if (!article.featured_image_prompt) throw publicError('This article has no featured-image prompt.', 409, 'CONTENT_IMAGE_PROMPT_REQUIRED');

  const generated = await runware.generateImages([
    article.featured_image_prompt + ' Editorial SaaS illustration, clean professional composition, no text, no logos, no fake UI labels, suitable for an INXSocial blog hero.'
  ], { aspectRatio: '16:9' });
  const image = generated.images?.[0];
  if (!image?.url) throw publicError('Image provider returned no usable image.', 502, 'CONTENT_IMAGE_EMPTY');

  const response = await axios.get(image.url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: 20 * 1024 * 1024
  });
  const webp = await sharp(Buffer.from(response.data)).resize(1264, 848, { fit: 'cover' }).webp({ quality: 88 }).toBuffer();
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
      model: image.model || generated.model || null,
      providerCostUsd: Number(generated.cost || image.cost || 0)
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
  return article ? publicArticle(article) : null;
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
    imageConfigured: runware.isConfigured() && objectStorage.isConfigured(),
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
  slugify,
  markdownToSafeHtml,
  qualityReview,
  overview,
  listArticles,
  getArticleById,
  getArticleBySlug,
  createDraft,
  updateArticle,
  approveArticle,
  publishArticle,
  unpublishArticle,
  archiveArticle,
  generateFeaturedImage,
  imageBuffer,
  publicArticles,
  publicArticleBySlug,
  publicSitemapEntries,
  importLegacyBabyLoveArticles,
  babyLoveGet,
  retryAfterMs,
  parseStructuredJson,
  structuredResponse,
  versionedContentImageUrl
};
