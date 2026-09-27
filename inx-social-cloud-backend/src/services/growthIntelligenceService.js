const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const webResearch = require('./webResearchService');
const externalVisibility = require('./externalVisibilityService');
const growthSites = require('./growthSiteService');
const siteIntelligence = require('./growthSiteIntelligenceService');
const skills = require('./growthSeoSkillRegistry');

const SITE_ORIGIN = growthSites.DEFAULT_ORIGIN;
const AUDIT_SETTING_KEY = 'growth_intelligence_site_audit_v1';
const OPENAI_SETTING_KEY = 'growth_intelligence_openai_visibility_v1';
const REDDIT_SETTING_KEY = 'growth_intelligence_reddit_opportunities_v1';

const DEFAULT_PROMPTS = ['What are the best solutions in this category?'];

async function currentSiteContext(siteId = null) {
  const site = await growthSites.getSite(siteId);
  const intelligence = await siteIntelligence.latest(site?.id || siteId);
  const profile = intelligence?.profile || null;
  return {
    site,
    profile,
    brandName: profile?.brandName || site?.label || site?.hostname || 'the monitored brand',
    origin: site?.origin || SITE_ORIGIN,
    competitorCandidates: profile?.competitorCandidates || [],
    prompts: (profile?.visibilityPrompts || []).filter(Boolean)
  };
}

async function dynamicPrompts(siteId = null) {
  const context = await currentSiteContext(siteId);
  return context.prompts.length ? context.prompts : DEFAULT_PROMPTS;
}


const CRAWLERS = [
  { key: 'google', label: 'Googlebot', userAgent: 'Googlebot' },
  { key: 'openai', label: 'OpenAI search', userAgent: 'OAI-SearchBot' },
  { key: 'perplexity', label: 'Perplexity', userAgent: 'PerplexityBot' },
  { key: 'claude', label: 'Claude', userAgent: 'ClaudeBot' },
  { key: 'claudeSearch', label: 'Claude search', userAgent: 'Claude-SearchBot' }
];

function safeJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

async function readSetting(key) {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  return setting ? safeJson(setting.value, null) : null;
}

async function writeSetting(key, value, description) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value), description },
    update: { value: JSON.stringify(value), description }
  });
}

function providerStatus() {
  const external = externalVisibility.providerStatus();
  return {
    openai: {
      label: 'OpenAI web-search probe',
      configured: Boolean(env.webResearch?.apiKey && env.webResearch?.baseUrl && env.webResearch?.model),
      model: env.webResearch?.model || null,
      note: 'API web-search probe; it is not a guaranteed reproduction of consumer ChatGPT results.'
    },
    perplexity: external.perplexity,
    claude: external.claude,
    reddit: {
      label: 'Reddit opportunity discovery',
      configured: Boolean(env.webResearch?.apiKey && env.webResearch?.baseUrl && env.webResearch?.model),
      model: env.webResearch?.model || null,
      note: 'Uses live web search to discover public Reddit discussions; posting remains manual.'
    }
  };
}

function parseRobots(content) {
  const blocks = [];
  let agents = [];
  let rules = [];
  const flush = () => {
    if (agents.length) blocks.push({ agents: [...agents], rules: [...rules] });
    agents = [];
    rules = [];
  };
  for (const rawLine of String(content || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
    } else if (field === 'disallow' || field === 'allow') {
      rules.push({ type: field, value });
    }
  }
  flush();
  return blocks;
}

function crawlerAccess(robots, userAgent) {
  const blocks = parseRobots(robots);
  const agent = userAgent.toLowerCase();
  const applicable = blocks.filter(block => block.agents.includes(agent) || block.agents.includes('*'));
  const rootBlocked = applicable.some(block => block.rules.some(rule => rule.type === 'disallow' && rule.value === '/'));
  return {
    allowed: !rootBlocked,
    explicit: applicable.some(block => block.agents.includes(agent)),
    reason: rootBlocked ? 'robots.txt disallows the whole site' : 'No whole-site disallow found'
  };
}

function extractTag(html, regex) {
  const match = String(html || '').match(regex);
  return match?.[1]?.trim() || '';
}

async function fetchPage(path, accept = 'text/html', origin = SITE_ORIGIN) {
  const url = new URL(path, growthSites.normaliseOrigin(origin)).toString();
  const started = Date.now();
  try {
    const response = await axios.get(url, {
      timeout: 9000,
      maxRedirects: 5,
      headers: {
        Accept: accept,
        'User-Agent': 'INXSocial-GrowthAudit/1.0'
      },
      validateStatus: () => true
    });
    return {
      url,
      status: response.status,
      durationMs: Date.now() - started,
      contentType: String(response.headers['content-type'] || ''),
      body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data || {})
    };
  } catch (error) {
    return {
      url,
      status: 0,
      durationMs: Date.now() - started,
      contentType: '',
      body: '',
      error: String(error.message || 'Request failed').slice(0, 300)
    };
  }
}

async function runSiteAudit(siteInput = null) {
  const site = siteInput?.origin ? siteInput : await growthSites.getSite(siteInput?.id || siteInput || null);
  const origin = site?.origin || SITE_ORIGIN;
  const [robots, sitemap, blogSitemap, home] = await Promise.all([
    fetchPage('/robots.txt', 'text/plain', origin),
    fetchPage('/sitemap.xml', 'application/xml,text/xml,*/*', origin),
    fetchPage('/blog/sitemap.xml', 'application/xml,text/xml,*/*', origin),
    fetchPage('/', 'text/html', origin)
  ]);

  const sitemapUrls = [];
  for (const match of String(sitemap.body || '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    try {
      const url = new URL(String(match[1] || '').trim(), origin);
      if (url.origin !== origin) continue;
      if (/\.(?:xml|txt|png|jpe?g|gif|webp|svg|ico|css|js|map|woff2?|mp4|webm|pdf)$/i.test(url.pathname)) continue;
      if (!sitemapUrls.includes(url.toString())) sitemapUrls.push(url.toString());
    } catch (_) {}
  }

  const sampleUrls = [origin + '/', ...sitemapUrls.filter(url => url !== origin + '/').slice(0, 4)];
  const sampled = await Promise.all(sampleUrls.map(url => url === origin + '/' ? Promise.resolve(home) : fetchPage(url, 'text/html', origin)));
  const robotsText = robots.body || '';
  const crawlers = CRAWLERS.map(item => ({ ...item, ...crawlerAccess(robotsText, item.userAgent) }));
  const pages = sampled.map(page => {
    const html = page.body || '';
    const canonical = extractTag(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)
      || extractTag(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
    const robotsMeta = extractTag(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const title = extractTag(html, /<title[^>]*>([^<]+)<\/title>/i);
    const description = extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    return {
      url: page.url,
      status: page.status,
      durationMs: page.durationMs,
      canonical,
      title,
      descriptionPresent: Boolean(description),
      indexable: !/noindex/i.test(robotsMeta),
      error: page.error || null
    };
  });

  const checks = [
    { key: 'robots', label: 'robots.txt', ok: robots.status === 200, detail: robots.status ? `HTTP ${robots.status}` : robots.error || 'Unavailable' },
    { key: 'sitemap', label: 'Main sitemap', ok: sitemap.status === 200 && /<urlset|<sitemapindex/i.test(sitemap.body), detail: `HTTP ${sitemap.status || 'error'}` },
    { key: 'homeCanonical', label: 'Homepage canonical', ok: Boolean(pages[0]?.canonical), detail: pages[0]?.canonical || 'Missing canonical' }
  ];
  if (blogSitemap.status === 200) {
    checks.push({ key: 'blogSitemap', label: 'Blog sitemap', ok: /<urlset|<sitemapindex/i.test(blogSitemap.body), detail: 'HTTP 200' });
  }

  const scoreInputs = [
    ...checks.map(item => item.ok),
    ...crawlers.map(item => item.allowed),
    ...pages.map(item => item.status === 200 && item.indexable && Boolean(item.title))
  ];
  const score = Math.round((scoreInputs.filter(Boolean).length / Math.max(1, scoreInputs.length)) * 100);

  const result = {
    generatedAt: new Date().toISOString(),
    siteId: site?.id || null,
    origin,
    score,
    checks,
    crawlers,
    pages
  };
  await writeSetting(AUDIT_SETTING_KEY, result, 'Latest Growth Intelligence crawl and indexability audit for the active site.');
  return result;
}

function visibilitySchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['brandMentioned', 'brandCited', 'competitors', 'answerSummary'],
    properties: {
      brandMentioned: { type: 'boolean' },
      brandCited: { type: 'boolean' },
      competitors: { type: 'array', maxItems: 8, items: { type: 'string' } },
      answerSummary: { type: 'string' }
    }
  };
}

async function openAIProbe(prompt, context = {}) {
  if (!providerStatus().openai.configured) {
    const error = new Error('OpenAI web-search visibility probe is not configured.');
    error.status = 503;
    throw error;
  }

  const brandName = String(context.brandName || 'the monitored brand');
  const origin = context.origin || SITE_ORIGIN;
  const response = await axios.post(`${env.webResearch.baseUrl}/responses`, {
    model: env.webResearch.model,
    instructions: [
      'Use live web search and answer the buyer question neutrally based on current public evidence.',
      'Do not favour or force the monitored brand into the answer.',
      'The monitored brand is: ' + brandName + '.',
      'Return whether that brand was organically mentioned or cited and list the main competing products/brands that appeared.',
      'Do not invent a competitor or citation.'
    ].join(' '),
    input: prompt,
    tools: [{ type: 'web_search' }],
    tool_choice: 'required',
    include: ['web_search_call.action.sources'],
    text: { format: { type: 'json_schema', name: 'growth_visibility', strict: true, schema: visibilitySchema() } }
  }, {
    timeout: Math.max(30000, Number(env.webResearch.timeoutMs || 45000)),
    headers: {
      Authorization: `Bearer ${env.webResearch.apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const raw = webResearch.extractResponseText(response.data);
  const parsed = safeJson(raw, {});
  const sources = webResearch.extractResponseSources(response.data);
  const cited = externalVisibility.sourceMentionsSite(sources, origin);
  const mentioned = Boolean(parsed.brandMentioned) || externalVisibility.brandMentioned(raw, brandName);
  return {
    prompt,
    brandMentioned: mentioned,
    brandCited: Boolean(parsed.brandCited) || cited,
    inxSocialMentioned: mentioned,
    inxSocialCited: Boolean(parsed.brandCited) || cited,
    competitors: Array.isArray(parsed.competitors) ? parsed.competitors.map(value => String(value).slice(0, 100)).slice(0, 8) : [],
    answerSummary: String(parsed.answerSummary || '').slice(0, 1200),
    sources: sources.slice(0, 12)
  };
}

async function runOpenAIVisibilityScan(limit = 5, suppliedContext = null) {
  const context = suppliedContext || await currentSiteContext();
  const prompts = (context.prompts?.length ? context.prompts : await dynamicPrompts(context.site?.id)).slice(0, Math.max(1, Math.min(5, Number(limit || 5))));
  const results = [];
  for (const prompt of prompts) {
    try {
      results.push({ ...(await openAIProbe(prompt, context)), ok: true });
    } catch (error) {
      results.push({ prompt, ok: false, error: String(error.publicMessage || error.message || 'Probe failed').slice(0, 300) });
    }
  }
  const successful = results.filter(item => item.ok);
  const mentioned = successful.filter(item => item.brandMentioned ?? item.inxSocialMentioned).length;
  const cited = successful.filter(item => item.brandCited ?? item.inxSocialCited).length;
  const payload = {
    provider: 'openai_web_search_api',
    siteId: context.site?.id || null,
    origin: context.origin,
    brandName: context.brandName,
    generatedAt: new Date().toISOString(),
    promptsRun: results.length,
    successfulPrompts: successful.length,
    mentionRate: successful.length ? mentioned / successful.length : 0,
    citationRate: successful.length ? cited / successful.length : 0,
    disclaimer: 'This is an OpenAI API web-search probe, not an exact reproduction or ranking of consumer ChatGPT search results.',
    results
  };
  await writeSetting(OPENAI_SETTING_KEY, payload, 'Latest OpenAI web-search visibility probe results for the active Growth site.');
  return payload;
}

function redditSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['threads'],
    properties: {
      threads: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'url', 'subreddit', 'relevance', 'reason'],
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            subreddit: { type: 'string' },
            relevance: { type: 'integer', minimum: 0, maximum: 100 },
            reason: { type: 'string' }
          }
        }
      }
    }
  };
}

function safeRedditUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && /(^|\.)reddit\.com$/i.test(url.hostname) ? url.toString() : '';
  } catch (_) { return ''; }
}

async function discoverRedditOpportunities(suppliedContext = null) {
  if (!providerStatus().reddit.configured) {
    const error = new Error('Live web search is not configured for Reddit opportunity discovery.');
    error.status = 503;
    throw error;
  }

  const context = suppliedContext || await currentSiteContext();
  const profile = context.profile || {};
  const query = [
    'Find recent public Reddit discussions where a genuinely useful expert reply could help people whose problem overlaps with this website.',
    'Website category: ' + String(profile.primaryCategory || 'unknown') + '.',
    'Products/services: ' + JSON.stringify([...(profile.products || []).map(item => item.name), ...(profile.services || [])].slice(0, 16)) + '.',
    'Audiences: ' + JSON.stringify((profile.audiences || []).slice(0, 10)) + '.',
    'Search themes: ' + JSON.stringify((profile.searchThemes || []).slice(0, 16)) + '.',
    'Only include real reddit.com discussion URLs found through live web search. Do not invent threads. Do not draft or post replies.'
  ].join(' ');

  const response = await axios.post(`${env.webResearch.baseUrl}/responses`, {
    model: env.webResearch.model,
    instructions: 'Use live web search. Return only relevant public Reddit discussions. Prefer recent buyer-intent or problem-solving threads. Never invent a URL.',
    input: query,
    tools: [{ type: 'web_search' }],
    tool_choice: 'required',
    include: ['web_search_call.action.sources'],
    text: { format: { type: 'json_schema', name: 'growth_reddit_opportunities', strict: true, schema: redditSchema() } }
  }, {
    timeout: Math.max(30000, Number(env.webResearch.timeoutMs || 45000)),
    headers: {
      Authorization: `Bearer ${env.webResearch.apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const parsed = safeJson(webResearch.extractResponseText(response.data), { threads: [] });
  const threads = (Array.isArray(parsed.threads) ? parsed.threads : [])
    .map(item => ({
      title: String(item.title || '').trim().slice(0, 240),
      url: safeRedditUrl(item.url),
      subreddit: String(item.subreddit || '').trim().slice(0, 120),
      relevance: Math.max(0, Math.min(100, Number(item.relevance || 0))),
      reason: String(item.reason || '').trim().slice(0, 500)
    }))
    .filter(item => item.title && item.url)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 10);

  const payload = {
    siteId: context.site?.id || null,
    origin: context.origin,
    generatedAt: new Date().toISOString(),
    mode: 'manual_engagement_only',
    threads
  };
  await writeSetting(REDDIT_SETTING_KEY, payload, 'Latest public Reddit opportunities discovered for manual engagement by the active Growth site.');
  return payload;
}

async function overview() {
  const [audit, openaiVisibility, reddit, gscConnection, externalLatest, intelligence] = await Promise.all([
    readSetting(AUDIT_SETTING_KEY),
    readSetting(OPENAI_SETTING_KEY),
    readSetting(REDDIT_SETTING_KEY),
    prisma.searchConsoleConnection.findUnique({
      where: { id: 'primary' },
      select: { status: true, selectedSiteUrl: true, lastSyncedAt: true, lastError: true }
    }),
    externalVisibility.latest(),
    siteIntelligence.latest()
  ]);
  return {
    generatedAt: new Date().toISOString(),
    providers: providerStatus(),
    searchConsole: {
      connected: Boolean(gscConnection?.selectedSiteUrl),
      status: gscConnection?.status || 'NOT_CONNECTED',
      siteUrl: gscConnection?.selectedSiteUrl || null,
      lastSyncedAt: gscConnection?.lastSyncedAt || null,
      lastError: gscConnection?.lastError || null
    },
    site: intelligence?.site || null,
    profile: intelligence?.profile || null,
    skills: { version: skills.VERSION },
    prompts: intelligence?.profile?.visibilityPrompts?.length ? intelligence.profile.visibilityPrompts : DEFAULT_PROMPTS,
    latest: { audit, openaiVisibility, ...externalLatest, reddit }
  };
}

module.exports = {
  DEFAULT_PROMPTS,
  dynamicPrompts,
  currentSiteContext,
  providerStatus,
  overview,
  runSiteAudit,
  runOpenAIVisibilityScan,
  discoverRedditOpportunities
};
