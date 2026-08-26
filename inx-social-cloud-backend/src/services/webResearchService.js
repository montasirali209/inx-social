const axios = require('axios');
const env = require('../config/env');
const brain = require('./agentBrainService');
const managerIntelligence = require('./socialManagerIntelligence');

function refinementReady() {
  return Boolean(env.webResearch.enabled && env.webResearch.provider === 'openai' && env.webResearch.baseUrl && env.webResearch.apiKey && env.webResearch.model);
}

function status() {
  const retrievalConfigured = refinementReady();
  const analystConfigured = Boolean(env.ollama.baseUrl && env.ollama.model);
  return {
    enabled: env.webResearch.enabled,
    configured: Boolean(retrievalConfigured && analystConfigured),
    retrievalConfigured,
    analystConfigured,
    refinementEnabled: retrievalConfigured,
    refinementConfigured: retrievalConfigured,
    mode: 'OLLAMA_FIRST_OPENAI_WEB_REFINED'
  };
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function jsonObject(value) {
  const raw = String(value || '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { return null; }
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch (_) { return ''; }
}

function planContext(plan) {
  const strategy = parseJson(plan.strategyJson || '{}');
  const platforms = parseJson(plan.platformsJson || '[]', []);
  const settings = plan.researchSettings && typeof plan.researchSettings === 'object' ? plan.researchSettings : {};
  const pageDetails = (Array.isArray(strategy.pageTargets) ? strategy.pageTargets : []).map(page => ({
    name: String(page.name || '').trim(),
    username: String(page.username || '').trim(),
    category: String(page.category || '').trim()
  })).filter(page => page.name || page.username);
  const pages = pageDetails.map(page => page.name).filter(Boolean);
  const officialUrls = [...String(plan.prompt || '').matchAll(/https?:\/\/[^\s)\]}>,]+/gi)].map(match => safeUrl(match[0])).filter(Boolean).slice(0, 5);
  return {
    prompt: String(plan.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 1200),
    platforms: platforms.map(value => String(value)).filter(Boolean).slice(0, 5),
    pages: pages.slice(0, 10),
    pageDetails: pageDetails.slice(0, 10),
    officialUrls,
    country: env.webResearch.country || 'GB',
    language: env.webResearch.language || 'en',
    timezone: String(settings.timezone || 'Europe/London').trim().slice(0, 100),
    date: new Date().toISOString().slice(0, 10)
  };
}

function buildQueries(plan) {
  const context = planContext(plan);
  const pageIdentity = context.pageDetails.map(page => [page.name, page.username ? `@${page.username}` : '', page.category].filter(Boolean).join(' ')).join(' ');
  const subject = [pageIdentity, context.officialUrls.join(' '), context.prompt].filter(Boolean).join(' ').slice(0, 700);
  const platform = context.platforms.join(' ') || 'social media';
  const location = [context.country ? `country ${context.country}` : '', context.timezone ? `timezone ${context.timezone}` : ''].filter(Boolean).join(' ');
  return [
    `${subject} official website services products about brand facts ${context.date}`,
    `${subject} current target audience needs competitors alternatives positioning content gaps ${location}`,
    `${subject} current social search phrases hashtags content patterns engagement publishing times ${platform} ${location}`
  ].map(value => value.replace(/\s+/g, ' ').trim().slice(0, 1200)).filter(Boolean).slice(0, env.webResearch.maxQueries);
}

function deduplicateResults(results) {
  const seen = new Set();
  const output = [];
  for (const item of results.flat()) {
    const url = safeUrl(item?.url);
    if (!url) continue;
    const key = url.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ title: String(item?.title || 'Research source').replace(/\s+/g, ' ').trim().slice(0, 240), url });
    if (output.length >= env.webResearch.maxSources) break;
  }
  return output;
}

function extractResponseText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  const blocks = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (item?.type !== 'message') continue;
    for (const content of Array.isArray(item.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') blocks.push(content.text);
    }
  }
  return blocks.join('\n');
}

function extractResponseSources(data) {
  const sources = [];
  const add = item => {
    const candidate = item?.url_citation || item;
    const url = safeUrl(candidate?.url);
    if (url) sources.push({ title: String(candidate?.title || 'Research source'), url });
  };
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const source of Array.isArray(item?.action?.sources) ? item.action.sources : []) add(source);
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      for (const annotation of Array.isArray(content?.annotations) ? content.annotations : []) {
        if (annotation?.type === 'url_citation' || annotation?.url_citation) add(annotation);
      }
    }
  }
  for (const source of Array.isArray(data?.sources) ? data.sources : []) add(source);
  return deduplicateResults(sources);
}

function normalizeDraft(parsed, fallbackQueries) {
  if (!parsed || typeof parsed !== 'object') throw new Error('The Ollama first analysis was not valid JSON.');
  const content = String(parsed.content || '').trim().slice(0, 8000);
  if (!content) throw new Error('The Ollama first analysis was empty.');
  const queries = (Array.isArray(parsed.researchQueries) ? parsed.researchQueries : fallbackQueries)
    .map(value => String(value).replace(/\s+/g, ' ').trim().slice(0, 400)).filter(Boolean).slice(0, env.webResearch.maxQueries);
  return {
    summary: String(parsed.summary || content).replace(/\s+/g, ' ').trim().slice(0, 600),
    content,
    researchQueries: queries.length ? queries : fallbackQueries,
    uncertainties: (Array.isArray(parsed.uncertainties) ? parsed.uncertainties : []).map(value => String(value).trim().slice(0, 400)).filter(Boolean).slice(0, 8)
  };
}

function normalizeAnalysis(parsed, sources) {
  if (!parsed || typeof parsed !== 'object') throw new Error('The refined research analysis was not valid JSON.');
  const content = String(parsed.content || '').trim().slice(0, 10000);
  const summary = String(parsed.summary || content).replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!content || !summary) throw new Error('The refined research analysis was empty.');
  return {
    content,
    summary,
    recommendations: (Array.isArray(parsed.recommendations) ? parsed.recommendations : []).map(value => String(value).trim().slice(0, 400)).filter(Boolean).slice(0, 8),
    cautions: (Array.isArray(parsed.cautions) ? parsed.cautions : []).map(value => String(value).trim().slice(0, 400)).filter(Boolean).slice(0, 8),
    reusableLearning: String(parsed.reusableLearning || '').replace(/\s+/g, ' ').trim().slice(0, 2000),
    sources: deduplicateResults(sources)
  };
}

const FINAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'content', 'recommendations', 'cautions', 'reusableLearning'],
  properties: {
    summary: { type: 'string' },
    content: { type: 'string' },
    recommendations: { type: 'array', maxItems: 8, items: { type: 'string' } },
    cautions: { type: 'array', maxItems: 8, items: { type: 'string' } },
    reusableLearning: { type: 'string' }
  }
};

async function ollamaFirstDraft(plan, http) {
  if (!env.ollama.baseUrl) throw Object.assign(new Error('Ollama is required for the first analysis.'), { code: 'OLLAMA_NOT_CONFIGURED' });
  const context = planContext(plan);
  const fallbackQueries = buildQueries(plan);
  const response = await http.post(`${env.ollama.baseUrl}/api/chat`, {
    model: env.ollama.model,
    stream: false,
    think: true,
    keep_alive: '10m',
    format: 'json',
    messages: [
      { role: 'system', content: `You are the private INX Social strategist. Produce the first analysis before any paid AI is used. ${managerIntelligence.playbookForTask('WEB_RESEARCH').join(' ')} Identify what is known from the mission, form initial content and audience hypotheses, identify uncertainties that require current evidence, and propose focused web-search queries. Do not claim that current research has been completed. Return JSON only with summary string, content string, researchQueries array (maximum 3), and uncertainties array.` },
      { role: 'user', content: `Today: ${context.date}\nMission: ${context.prompt}\nPlatforms: ${context.platforms.join(', ') || 'facebook'}\nConnected Pages: ${context.pages.join(', ') || 'none named'}\nPage details: ${JSON.stringify(context.pageDetails)}\nCustomer-supplied official URLs: ${context.officialUrls.join(', ') || 'none'}\nCountry: ${context.country}\nCustomer timezone: ${context.timezone}\nStarter queries: ${fallbackQueries.join(' | ')}` }
    ],
    options: { temperature: 0.2, num_ctx: env.ollama.complexContext }
  }, { timeout: env.ollama.timeoutMs, headers: brain.ollamaHeaders() });
  return normalizeDraft(jsonObject(response.data?.message?.content), fallbackQueries);
}

async function openAIResearchRefinement(plan, ollamaDraft, http) {
  if (!refinementReady()) throw Object.assign(new Error('OpenAI live-web refinement is not configured.'), { code: 'WEB_RESEARCH_NOT_CONFIGURED' });
  const context = planContext(plan);
  const request = {
    model: env.webResearch.model,
    instructions: `You are the evidence-checking senior social-media strategist for INX Social. ${managerIntelligence.playbookForTask('WEB_RESEARCH').join(' ')} Use live web search to check and refine the supplied Ollama-first draft. Verify the official website or authoritative Page facts before making product claims. Use competitor evidence only to identify audience expectations and positioning gaps; never copy competitor wording or creative. Preserve useful reasoning, remove unsupported assumptions, and return practical organic-content guidance grounded in current public evidence. Never invent statistics, competitors, keywords, trends, dates or performance claims. The reusableLearning field must describe only a durable improvement learned by comparing the Ollama draft with the researched result; exclude current facts, brand claims, competitor names, dates, statistics and hidden chain-of-thought.`,
    input: `Today: ${context.date}\nMission: ${context.prompt}\nPlatforms: ${context.platforms.join(', ') || 'facebook'}\nConnected Pages: ${context.pages.join(', ') || 'none named'}\nPage details: ${JSON.stringify(context.pageDetails)}\nCustomer-supplied official URLs: ${context.officialUrls.join(', ') || 'none'}\nResearch country: ${context.country}\nCustomer timezone: ${context.timezone}\n\nOLLAMA FIRST DRAFT\n${JSON.stringify(ollamaDraft)}\n\nOLLAMA RESEARCH QUERIES\n${ollamaDraft.researchQueries.join('\n')}`,
    tools: [{ type: 'web_search', external_web_access: true, user_location: { type: 'approximate', country: context.country, timezone: context.timezone } }],
    tool_choice: 'required',
    include: ['web_search_call.action.sources'],
    text: { format: { type: 'json_schema', name: 'inx_social_research', strict: true, schema: FINAL_SCHEMA } }
  };
  if (/^gpt-5(?:\.|-)/i.test(env.webResearch.model)) request.reasoning = { effort: 'low' };
  const response = await http.post(`${env.webResearch.baseUrl}/responses`, request, {
    timeout: env.webResearch.timeoutMs,
    headers: { Authorization: `Bearer ${env.webResearch.apiKey}`, 'Content-Type': 'application/json' }
  });
  const sources = extractResponseSources(response.data);
  if (!sources.length) throw Object.assign(new Error('OpenAI web research returned no source citations.'), { code: 'WEB_RESEARCH_EMPTY' });
  return normalizeAnalysis(jsonObject(extractResponseText(response.data)), sources);
}

async function researchMission(plan, dependencies = {}) {
  if (!status().configured) throw Object.assign(new Error('Ollama-first analysis and OpenAI live-web refinement must both be configured.'), { code: 'WEB_RESEARCH_NOT_CONFIGURED' });
  const http = dependencies.http || axios;
  const ollamaDraft = await ollamaFirstDraft(plan, http);
  const analysis = await openAIResearchRefinement(plan, ollamaDraft, http);
  return {
    ...analysis,
    ollamaDraftSummary: ollamaDraft.summary,
    researchAvailable: true,
    refinementUsed: true,
    refinementWarning: null,
    researchedAt: new Date().toISOString()
  };
}

module.exports = {
  status, refinementReady, planContext, buildQueries, deduplicateResults,
  extractResponseText, extractResponseSources, normalizeDraft, normalizeAnalysis,
  ollamaFirstDraft, openAIResearchRefinement, researchMission
};
