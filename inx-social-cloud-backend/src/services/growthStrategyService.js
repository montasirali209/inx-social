'use strict';

const axios = require('axios');
const env = require('../config/env');
const webResearch = require('./webResearchService');
const growthOpportunities = require('./growthOpportunityService');
const siteIntelligence = require('./growthSiteIntelligenceService');
const seoSkills = require('./growthSeoSkillRegistry');

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
  return Boolean(env.contentWriter?.apiKey && env.contentWriter?.baseUrl && env.contentWriter?.model);
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

async function requestStructured(payload, name, schema, options = {}) {
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
    if (/^gpt-5(?:\.|-)/i.test(String(request.model || ''))) {
      request.reasoning = {
        effort: attempt === 1
          ? (options.reasoningEffort || env.contentWriter.reasoningEffort || 'high')
          : 'medium'
      };
    }

    const response = await axios.post(env.contentWriter.baseUrl + '/responses', request, {
      timeout: Math.max(60000, Number(env.webResearch.timeoutMs || 120000)),
      headers: {
        Authorization: 'Bearer ' + env.contentWriter.apiKey,
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

function dailyArticleSchema() {
  const schema = strategySchema();
  schema.properties.action = { type: 'string', enum: ['CREATE_ARTICLE'] };
  schema.properties.publishRecommended = { type: 'boolean', enum: [true] };
  return schema;
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
      'requiredFixes',
      'disposition'
    ],
    properties: {
      approve: { type: 'boolean' },
      score: { type: 'integer', minimum: 0, maximum: 100 },
      searchIntentMatch: { type: 'integer', minimum: 0, maximum: 100 },
      factualRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
      duplicationRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
      summary: { type: 'string' },
      issues: { type: 'array', maxItems: 10, items: { type: 'string' } },
      requiredFixes: { type: 'array', maxItems: 10, items: { type: 'string' } },
      disposition: { type: 'string', enum: ['APPROVE', 'REVISE', 'SWITCH_TOPIC'] }
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
    radar: item.radar ? {
      category: item.radar.category,
      headlineAngle: item.radar.headlineAngle,
      whyNow: item.radar.whyNow,
      audienceConnection: item.radar.audienceConnection,
      businessBridge: item.radar.businessBridge,
      demandEvidence: item.radar.demandEvidence,
      freshness: item.radar.freshness,
      audienceOverlap: item.radar.audienceOverlap,
      bridgeStrength: item.radar.bridgeStrength,
      informationGain: item.radar.informationGain,
      geoCitationPotential: item.radar.geoCitationPotential,
      authorityRisk: item.radar.authorityRisk,
      hot: Boolean(item.radar.hot),
      sourceUrls: (item.radar.sourceUrls || []).slice(0, 6)
    } : null,
    ai: (item.ai || []).map(signal => ({
      provider: signal.provider,
      mentioned: Boolean(signal.mentioned),
      cited: Boolean(signal.cited),
      competitors: (signal.competitors || []).slice(0, 5)
    }))
  };
}

async function plan({ opportunityMap, articles, siteProfile = null, model = env.contentWriter.model, reasoningEffort = env.contentWriter.reasoningEffort }) {
  const intelligence = siteProfile ? null : await siteIntelligence.latest().catch(() => null);
  const profile = siteProfile || intelligence?.profile || null;
  const site = intelligence?.site || null;
  const brandName = profile?.brandName || site?.label || site?.hostname || 'the monitored website';

  const opportunities = (opportunityMap?.opportunities || []).slice(0, 30).map(compactOpportunity);
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
    model,
    instructions: seoSkills.strategyInstructions(),
    input: [
      'Current date: ' + new Date().toISOString().slice(0, 10),
      'Goal: grow qualified organic, answer-engine and AI-search discovery for ' + brandName + ' by selecting the strongest useful editorial action, without publishing low-value content.',
      '',
      'DISCOVERED SITE PROFILE',
      JSON.stringify(profile),
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
      'EDITORIAL SELECTION RULES',
      'Think like a senior SEO editorial strategist managing a large long-term topic universe. Do not treat the current top opportunity as the only possible article.',
      'Use the discovered business profile, audience needs, product capabilities, live opportunity evidence and existing content to choose a distinct high-value topic/angle.',
      'If the supplied opportunity backlog does not contain the best article, you may propose a new strongly relevant topic in topic with selectedOpportunityId=null, provided it clearly fits the discovered business and does not duplicate existing content.',
      '',
      'EXISTING SITE ARTICLES',
      JSON.stringify(existingArticles)
    ].join('\n')
  };

  const decision = await requestStructured(payload, 'inx_growth_strategy', strategySchema(), { reasoningEffort });
  if (!ACTIONS.includes(decision.action)) throw new Error('AI strategist returned an unsupported action.');

  if (decision.selectedOpportunityId && !opportunities.some(item => item.id === decision.selectedOpportunityId)) {
    decision.selectedOpportunityId = null;
  }
  if (decision.selectedArticleId && !existingArticles.some(item => item.id === decision.selectedArticleId)) {
    decision.selectedArticleId = null;
  }

  return {
    ...decision,
    model,
    decidedAt: new Date().toISOString()
  };
}


function editorialCandidate(item) {
  if (!item || item.type === 'technical') return false;
  const action = String(item.action?.type || '');
  if (['TECHNICAL_FIX', 'COMMUNITY_ENGAGEMENT', 'IMPROVE_EXISTING_PAGE'].includes(action)) return false;
  if (item.existingPage && action !== 'BUILD_AUTHORITY_CONTENT') return false;
  return true;
}

async function planDailyArticle({ opportunityMap, articles, siteProfile = null, minOpportunityScore = 70, model = env.contentWriter.model, reasoningEffort = env.contentWriter.reasoningEffort }) {
  const intelligence = siteProfile ? null : await siteIntelligence.latest().catch(() => null);
  const profile = siteProfile || intelligence?.profile || null;
  const site = intelligence?.site || null;
  const brandName = profile?.brandName || site?.label || site?.hostname || 'the monitored website';

  const opportunities = (opportunityMap?.opportunities || []).slice(0, 35).map(compactOpportunity);
  const existingArticles = (articles || [])
    .filter(article => article.status !== 'ARCHIVED')
    .slice(0, 40)
    .map(article => ({
      id: article.id,
      slug: article.slug,
      status: article.status,
      title: article.title,
      opportunityId: article.opportunity_id || null,
      publishedAt: article.published_at || null,
      qualityScore: article.quality?.score || 0
    }));

  const strongBacklog = (opportunityMap?.opportunities || [])
    .filter(editorialCandidate)
    .filter(item => Number(item.score || 0) >= Number(minOpportunityScore || 70));
  const freshDiscoveryRequired = strongBacklog.length === 0;

  const payload = {
    model,
    instructions: [
      seoSkills.strategyInstructions(),
      'DAILY ARTICLE LANE:',
      'This is the dedicated daily editorial publication lane. You must return action=CREATE_ARTICLE and publishRecommended=true.',
      'Your job is to choose or discover the strongest useful article topic for today. Other SEO actions are handled by separate automation lanes and must not consume the daily article slot.',
      'Do not copy, closely paraphrase, or spin another publisher article. Use trends and sources only as research signals, then create a distinct original INXSocial angle with genuine information gain.',
      freshDiscoveryRequired
        ? 'The current qualified backlog is weak. Use live web search now to discover a current or trending topic that is materially relevant to this site, its audience, creator/social-media workflows, AI/content tooling, or an adjacent problem with a credible business bridge. If no timely trend is strong enough, choose a valuable current evergreen angle supported by fresh evidence.'
        : 'The backlog contains qualified opportunities. Prefer the strongest distinct opportunity unless live context in the supplied evidence makes a different closely related angle materially better.',
      'Avoid duplicate search intent, keyword cannibalisation, thin trend summaries, unrelated newsjacking and invented demand claims.'
    ].join('\n'),
    input: [
      'CURRENT DATE: ' + new Date().toISOString(),
      'SITE/BRAND: ' + brandName,
      '',
      'DISCOVERED SITE PROFILE',
      JSON.stringify(profile),
      '',
      'QUALIFIED BACKLOG THRESHOLD: ' + Number(minOpportunityScore || 70),
      'QUALIFIED BACKLOG COUNT: ' + strongBacklog.length,
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
      'EXISTING SITE ARTICLES — DO NOT DUPLICATE THEIR PRIMARY INTENT',
      JSON.stringify(existingArticles),
      '',
      'Return one publication-worthy topic and execution brief. If you discover a better fresh topic that is not in the opportunity map, set selectedOpportunityId=null and put the new topic in topic.'
    ].join('\n')
  };

  if (freshDiscoveryRequired) {
    payload.tools = [{
      type: 'web_search',
      external_web_access: true,
      user_location: { type: 'approximate', country: 'GB', timezone: 'Europe/London' }
    }];
    payload.tool_choice = 'required';
    payload.include = ['web_search_call.action.sources'];
  }

  const decision = await requestStructured(payload, 'inx_daily_article_strategy', dailyArticleSchema(), { reasoningEffort });
  if (decision.action !== 'CREATE_ARTICLE' || decision.publishRecommended !== true) {
    throw new Error('Daily article strategist did not return a publishable article decision.');
  }

  if (decision.selectedOpportunityId && !opportunities.some(item => item.id === decision.selectedOpportunityId)) {
    decision.selectedOpportunityId = null;
  }
  if (decision.selectedArticleId && !existingArticles.some(item => item.id === decision.selectedArticleId)) {
    decision.selectedArticleId = null;
  }

  return {
    ...decision,
    discoveryMode: freshDiscoveryRequired ? 'LIVE_TREND_DISCOVERY' : 'QUALIFIED_BACKLOG',
    qualifiedBacklogCount: strongBacklog.length,
    minimumOpportunityScore: Number(minOpportunityScore || 70),
    model,
    decidedAt: new Date().toISOString()
  };
}

async function reviewDraft({ article, opportunity, strategy, siteProfile = null, model = env.contentWriter.model, reasoningEffort = env.contentWriter.reasoningEffort }) {
  const compactArticle = {
    id: article.id,
    title: article.title,
    metaDescription: article.meta_description,
    excerpt: article.excerpt,
    keywords: article.keywords || [],
    contentMarkdown: String(article.content_markdown || '').slice(0, 30000),
    editorialPromo: article.editorial_promo || null,
    faq: article.faq || [],
    sources: article.sources || [],
    internalLinks: article.internalLinks || [],
    researchBrief: article.research_brief || null,
    backendQuality: article.quality || null
  };

  const intelligence = siteProfile ? null : await siteIntelligence.latest().catch(() => null);
  const profile = siteProfile || intelligence?.profile || null;

  const context = {
    siteProfile: profile,
    opportunity: opportunity ? compactOpportunity(opportunity) : null,
    strategy: strategy ? {
      action: strategy.action,
      topic: strategy.topic,
      rationale: strategy.rationale,
      executionBrief: strategy.executionBrief
    } : null
  };

  const payload = {
    model,
    instructions: seoSkills.criticInstructions(),
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

  const review = await requestStructured(payload, 'inx_content_critic', criticSchema(), { reasoningEffort });
  const disposition = review.disposition || (review.approve ? 'APPROVE' : 'REVISE');
  return {
    ...review,
    approve: disposition === 'APPROVE' && review.approve !== false,
    disposition,
    model,
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
  planDailyArticle,
  reviewDraft,
  fallbackOpportunity,
  parseJsonObject
};
