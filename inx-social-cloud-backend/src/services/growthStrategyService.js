'use strict';

const axios = require('axios');
const env = require('../config/env');
const webResearch = require('./webResearchService');
const growthOpportunities = require('./growthOpportunityService');

const ACTIONS = Object.freeze([
  'CREATE_ARTICLE',
  'UPDATE_ARTICLE',
  'IMPROVE_EXISTING_PAGE',
  'CREATE_LANDING_PAGE',
  'ADD_INTERNAL_LINKS',
  'FIX_TECHNICAL_SEO',
  'MONITOR'
]);

function ready() {
  return Boolean(env.webResearch?.apiKey && env.webResearch?.baseUrl && env.webResearch?.model);
}

function parseJsonObject(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const fence = String.fromCharCode(96, 96, 96);
  const clean = raw
    .replace(new RegExp('^' + fence + '(?:json)?\\s*', 'i'), '')
    .replace(new RegExp('\\s*' + fence + '$', 'i'), '')
    .trim();
  try { return JSON.parse(clean); } catch (_) {}
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

async function requestStructured(payload, name, schema) {
  if (!ready()) throw new Error('OpenAI strategy model is not configured.');

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const request = {
      ...payload,
      text: { format: { type: 'json_schema', name, strict: true, schema } },
      max_output_tokens: attempt === 1 ? 3500 : 5000
    };
    if (attempt > 1) {
      request.instructions = String(request.instructions || '') + ' Retry: return exactly one complete JSON object matching the schema, without markdown fences or commentary.';
    }
    if (/^gpt-5(?:\.|-)/i.test(env.webResearch.model)) request.reasoning = { effort: attempt === 1 ? 'medium' : 'low' };

    const response = await axios.post(env.webResearch.baseUrl + '/responses', request, {
      timeout: Math.max(60000, Number(env.webResearch.timeoutMs || 120000)),
      headers: {
        Authorization: 'Bearer ' + env.webResearch.apiKey,
        'Content-Type': 'application/json'
      }
    });

    const parsed = parseJsonObject(webResearch.extractResponseText(response.data));
    if (parsed && typeof parsed === 'object') return parsed;

    console.warn('[growth-strategist] structured response parse failed', {
      name,
      attempt,
      status: response.data?.status || null,
      incompleteReason: response.data?.incomplete_details?.reason || null
    });
  }

  throw new Error('AI strategist returned an invalid structured result after retry.');
}

function strategySchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'action',
      'selectedOpportunityId',
      'selectedArticleId',
      'topic',
      'confidence',
      'publishRecommended',
      'rationale',
      'evidence',
      'risks',
      'executionBrief'
    ],
    properties: {
      action: { type: 'string', enum: ACTIONS },
      selectedOpportunityId: { type: ['string', 'null'] },
      selectedArticleId: { type: ['string', 'null'] },
      topic: { type: 'string' },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
      publishRecommended: { type: 'boolean' },
      rationale: { type: 'string' },
      evidence: { type: 'array', maxItems: 8, items: { type: 'string' } },
      risks: { type: 'array', maxItems: 6, items: { type: 'string' } },
      executionBrief: {
        type: 'object',
        additionalProperties: false,
        required: ['audience', 'angle', 'mustCover', 'avoid'],
        properties: {
          audience: { type: 'string' },
          angle: { type: 'string' },
          mustCover: { type: 'array', maxItems: 10, items: { type: 'string' } },
          avoid: { type: 'array', maxItems: 8, items: { type: 'string' } }
        }
      }
    }
  };
}

function criticSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'approve',
      'score',
      'searchIntentMatch',
      'factualRisk',
      'duplicationRisk',
      'summary',
      'issues',
      'requiredFixes'
    ],
    properties: {
      approve: { type: 'boolean' },
      score: { type: 'integer', minimum: 0, maximum: 100 },
      searchIntentMatch: { type: 'integer', minimum: 0, maximum: 100 },
      factualRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
      duplicationRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
      summary: { type: 'string' },
      issues: { type: 'array', maxItems: 10, items: { type: 'string' } },
      requiredFixes: { type: 'array', maxItems: 10, items: { type: 'string' } }
    }
  };
}

function compactOpportunity(item) {
  return {
    id: item.id,
    type: item.type,
    topic: item.topic,
    intent: item.intent,
    score: Number(item.score || 0),
    existingPage: item.existingPage || null,
    recommendedAction: item.action?.type || null,
    recommendedActionLabel: item.action?.label || null,
    search: item.search || null,
    ai: (item.ai || []).map(signal => ({
      provider: signal.provider,
      mentioned: Boolean(signal.mentioned),
      cited: Boolean(signal.cited),
      competitors: (signal.competitors || []).slice(0, 5)
    })),
    redditMatches: Array.isArray(item.reddit) ? item.reddit.length : 0
  };
}

async function plan({ opportunityMap, articles }) {
  const opportunities = (opportunityMap?.opportunities || []).slice(0, 10).map(compactOpportunity);
  const existingArticles = (articles || [])
    .filter(article => article.status !== 'ARCHIVED')
    .slice(0, 25)
    .map(article => ({
      id: article.id,
      slug: article.slug,
      status: article.status,
      title: article.title,
      opportunityId: article.opportunity_id || null,
      publishedAt: article.published_at || null,
      qualityScore: article.quality?.score || 0
    }));

  const payload = {
    model: env.webResearch.model,
    instructions: [
      'You are the strategic decision layer for INXSocial Growth Autopilot.',
      'Choose the single most useful next action from measured evidence, not from novelty or a timer.',
      'The backend has already collected Search Console demand, GA4 context, AI-search visibility, Reddit evidence, technical checks and existing content.',
      'Avoid keyword cannibalisation and duplicate articles.',
      'Prefer improving an existing page when it already ranks and matches intent.',
      'Choose CREATE_ARTICLE only when a distinct article is genuinely justified.',
      'Choose MONITOR when evidence is weak or no new page should be created.',
      'Do not invent traffic, conversion, competitor or product facts.',
      'Do not provide hidden chain-of-thought. Give only a concise decision rationale and explicit evidence bullets.'
    ].join(' '),
    input: [
      'Current date: ' + new Date().toISOString().slice(0, 10),
      'Goal: grow qualified organic and AI-search discovery for INXSocial without publishing low-value content.',
      '',
      'OPPORTUNITY MAP',
      JSON.stringify({
        generatedAt: opportunityMap?.generatedAt || null,
        summary: opportunityMap?.summary || null,
        analyticsSummary: opportunityMap?.analyticsSummary || null,
        competitors: (opportunityMap?.competitors || []).slice(0, 12),
        sourceDomains: (opportunityMap?.sourceDomains || []).slice(0, 12),
        opportunities
      }),
      '',
      'EXISTING INXSOCIAL ARTICLES',
      JSON.stringify(existingArticles)
    ].join('\n')
  };

  const decision = await requestStructured(payload, 'inx_growth_strategy', strategySchema());
  if (!ACTIONS.includes(decision.action)) throw new Error('AI strategist returned an unsupported action.');

  if (decision.selectedOpportunityId && !opportunities.some(item => item.id === decision.selectedOpportunityId)) {
    decision.selectedOpportunityId = null;
  }
  if (decision.selectedArticleId && !existingArticles.some(item => item.id === decision.selectedArticleId)) {
    decision.selectedArticleId = null;
  }

  return {
    ...decision,
    model: env.webResearch.model,
    decidedAt: new Date().toISOString()
  };
}

async function reviewDraft({ article, opportunity, strategy }) {
  const compactArticle = {
    id: article.id,
    title: article.title,
    metaDescription: article.meta_description,
    excerpt: article.excerpt,
    keywords: article.keywords || [],
    contentMarkdown: String(article.content_markdown || '').slice(0, 30000),
    faq: article.faq || [],
    sources: article.sources || [],
    internalLinks: article.internalLinks || [],
    researchBrief: article.research_brief || null,
    backendQuality: article.quality || null
  };

  const context = {
    opportunity: opportunity ? compactOpportunity(opportunity) : null,
    strategy: strategy ? {
      action: strategy.action,
      topic: strategy.topic,
      rationale: strategy.rationale,
      executionBrief: strategy.executionBrief
    } : null
  };

  const payload = {
    model: env.webResearch.model,
    instructions: [
      'You are the independent editorial critic for INXSocial Growth Autopilot.',
      'Review the draft separately from the writer.',
      'Reject unsupported factual or numerical claims, mismatched search intent, thin content, excessive promotion, duplication, misleading competitor claims, or weak source grounding.',
      'Use the supplied research brief and source list as the primary evidence boundary. Use web search when necessary to independently verify a consequential factual or product claim before approving it.',
      'Check that inline [S#] citations correspond to the supplied source list and that claims are not stronger than their evidence.',
      'Do not reward verbosity by itself.',
      'Approve only when the article is useful enough to publish on a real company website.',
      'Do not provide private chain-of-thought; return concise review findings only.'
    ].join(' '),
    input: [
      'CONTEXT',
      JSON.stringify(context),
      '',
      'ARTICLE TO REVIEW',
      JSON.stringify(compactArticle)
    ].join('\n'),
    tools: [{
      type: 'web_search',
      external_web_access: true,
      user_location: { type: 'approximate', country: 'GB', timezone: 'Europe/London' }
    }],
    tool_choice: 'auto'
  };

  return {
    ...(await requestStructured(payload, 'inx_content_critic', criticSchema())),
    model: env.webResearch.model,
    reviewedAt: new Date().toISOString()
  };
}

function fallbackOpportunity(opportunityMap, articles = []) {
  const active = (articles || []).filter(article => article.status !== 'ARCHIVED');
  const candidates = [...(opportunityMap?.opportunities || [])]
    .filter(item => item && item.type !== 'technical')
    .filter(item => !['TECHNICAL_FIX', 'COMMUNITY_ENGAGEMENT', 'IMPROVE_EXISTING_PAGE'].includes(String(item.action?.type || '')))
    .filter(item => Number(item.score || 0) >= 50)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  return candidates.find(item => !active.some(article =>
    article.opportunity_id === item.id
    || growthOpportunities.similarity(item.topic, article.title) >= 0.55
  )) || null;
}

module.exports = {
  ACTIONS,
  ready,
  plan,
  reviewDraft,
  fallbackOpportunity,
  parseJsonObject
};
