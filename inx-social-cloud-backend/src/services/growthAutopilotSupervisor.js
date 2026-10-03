'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const axios = require('axios');
const env = require('../config/env');
const webResearch = require('./webResearchService');
const autopilot = require('./growthAutopilotService');
const growthContent = require('./growthContentService');
const growthStrategy = require('./growthStrategyService');
const editorialRadar = require('./growthEditorialRadarService');
const authority = require('./growthAuthorityService');
const optimization = require('./growthOptimizationService');

const POLL_MS = 5 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;
const EDITORIAL_RETRY_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const cycleStorage = new AsyncLocalStorage();

const SAFE_AUTOPILOT_CONFIG = Object.freeze({
  aiModel: 'gpt-5.6-terra',
  aiReasoningEffort: 'medium',
  intelligenceEveryHours: 24,
  editorialRadarEveryHours: 24,
  hotTrendAutoEvaluate: false,
  maxArticlesPerLocalDay: 1,
  authorityEveryHours: 24,
  authorityAutoEmail: false,
  optimizationEveryHours: 24,
  visibilityPromptCount: 2,
  maxDraftAttempts: 2,
  editorialRetryMinutes: 30,
  retryHours: 6
});

let timer = null;
let initialTimer = null;
let patched = false;

const originals = {
  runCycle: autopilot.runCycle,
  createDraft: growthContent.createDraft,
  reviseDraft: growthContent.reviseDraft,
  generateFeaturedImage: growthContent.generateFeaturedImage,
  planDailyArticle: growthStrategy.planDailyArticle,
  plan: growthStrategy.plan,
  reviewDraft: growthStrategy.reviewDraft,
  radarRefresh: editorialRadar.refresh,
  authorityRun: authority.run,
  optimizationRun: optimization.run
};

function stoppedError(message = 'Growth Autopilot is stopped.') {
  const error = new Error(message);
  error.code = 'GROWTH_AUTOPILOT_STOPPED';
  error.publicMessage = message;
  return error;
}

function budgetError(stage, limit) {
  const error = new Error(`Growth Autopilot cost guard stopped additional ${stage} work in this cycle.`);
  error.code = 'GROWTH_AUTOPILOT_BUDGET_EXHAUSTED';
  error.publicMessage = `Growth Autopilot cost guard reached the ${stage} limit (${limit}) for this cycle.`;
  return error;
}

async function assertAutopilotActive() {
  const config = await autopilot.getConfig();
  if (config.enabled === false) throw stoppedError();
  return config;
}

async function consumeBudget(key, limit) {
  const context = cycleStorage.getStore();
  if (!context) return null;
  await assertAutopilotActive();
  context.counts[key] = Number(context.counts[key] || 0) + 1;
  if (context.counts[key] > limit) throw budgetError(key, limit);
  return context;
}

function parseJsonObject(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(unfenced); } catch (_) {}
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(unfenced.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

function criticSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['approve','score','searchIntentMatch','factualRisk','duplicationRisk','summary','issues','requiredFixes','disposition'],
    properties: {
      approve: { type: 'boolean' },
      score: { type: 'integer', minimum: 0, maximum: 100 },
      searchIntentMatch: { type: 'integer', minimum: 0, maximum: 100 },
      factualRisk: { type: 'string', enum: ['low','medium','high'] },
      duplicationRisk: { type: 'string', enum: ['low','medium','high'] },
      summary: { type: 'string' },
      issues: { type: 'array', maxItems: 8, items: { type: 'string' } },
      requiredFixes: { type: 'array', maxItems: 8, items: { type: 'string' } },
      disposition: { type: 'string', enum: ['APPROVE','REVISE','SWITCH_TOPIC'] }
    }
  };
}

async function optimizedReviewDraft(args = {}) {
  await consumeBudget('editorReviews', 2);

  const article = args.article || {};
  const opportunity = args.opportunity || null;
  const strategy = args.strategy || null;
  const model = String(args.model || 'gpt-5.6-terra').trim();
  const sources = (Array.isArray(article.sources) ? article.sources : []).slice(0, 8).map(source => ({
    id: source.id,
    title: source.title,
    url: source.url
  }));
  const facts = (Array.isArray(article.research_brief?.facts) ? article.research_brief.facts : []).slice(0, 12);
  const compactArticle = {
    title: article.title,
    metaDescription: article.meta_description,
    excerpt: article.excerpt,
    keywords: article.keywords || [],
    contentMarkdown: String(article.content_markdown || '').slice(0, 18000),
    faq: (article.faq || []).slice(0, 6),
    backendQuality: article.quality || null,
    verifiedSources: sources,
    verifiedFacts: facts
  };

  const payload = {
    model,
    instructions: [
      'Act as the senior editorial quality reviewer for INXSocial.',
      'Review only against the supplied article, verified sources, verified facts, topic and backend quality metrics.',
      'Do not browse the web and do not request external tools. The research stage already performed live evidence gathering.',
      'Approve only when the article matches search intent, is useful and original, reaches the stated quality standard, and factual claims are supported by the supplied evidence.',
      'If a claim lacks support, request that it be removed, softened or tied to an existing verified source rather than asking for another research round.',
      'Use SWITCH_TOPIC only for fundamental duplication/cannibalisation or topic-fit problems.',
      'Return JSON only.'
    ].join(' '),
    input: [
      'OPPORTUNITY: ' + JSON.stringify(opportunity ? {
        id: opportunity.id || null,
        topic: opportunity.topic || null,
        intent: opportunity.intent || null,
        score: opportunity.score || null
      } : null),
      'STRATEGY: ' + JSON.stringify(strategy ? {
        topic: strategy.topic || null,
        rationale: strategy.rationale || null,
        executionBrief: strategy.executionBrief || null
      } : null),
      'ARTICLE: ' + JSON.stringify(compactArticle)
    ].join('\n'),
    text: { format: { type: 'json_schema', name: 'inx_autopilot_compact_critic', strict: true, schema: criticSchema() } },
    max_output_tokens: 1800
  };
  if (/^gpt-5(?:\.|-)/i.test(model)) payload.reasoning = { effort: model === 'gpt-5.6-sol' ? 'medium' : 'low' };

  const response = await axios.post(env.contentWriter.baseUrl + '/responses', payload, {
    timeout: Math.max(60000, Number(env.webResearch.timeoutMs || 120000)),
    headers: {
      Authorization: 'Bearer ' + env.contentWriter.apiKey,
      'Content-Type': 'application/json'
    }
  });
  const parsed = parseJsonObject(webResearch.extractResponseText(response.data));
  if (!parsed) {
    const error = new Error('Growth Autopilot compact editorial review returned invalid JSON.');
    error.code = 'GROWTH_AUTOPILOT_REVIEW_INVALID';
    throw error;
  }
  const disposition = parsed.disposition || (parsed.approve ? 'APPROVE' : 'REVISE');
  return {
    ...parsed,
    approve: disposition === 'APPROVE' && parsed.approve !== false,
    disposition,
    model,
    reviewedAt: new Date().toISOString(),
    reviewMode: 'COMPACT_EXISTING_EVIDENCE'
  };
}

function installCostGuards() {
  if (patched) return;
  patched = true;

  growthStrategy.planDailyArticle = async (...args) => {
    if (!cycleStorage.getStore()) return originals.planDailyArticle(...args);
    await consumeBudget('strategyCalls', 1);
    return originals.planDailyArticle(...args);
  };
  growthStrategy.plan = async (...args) => {
    if (!cycleStorage.getStore()) return originals.plan(...args);
    await consumeBudget('strategyCalls', 1);
    return originals.plan(...args);
  };
  growthStrategy.reviewDraft = async (...args) => {
    if (!cycleStorage.getStore()) return originals.reviewDraft(...args);
    return optimizedReviewDraft(...args);
  };

  growthContent.createDraft = async (...args) => {
    if (!cycleStorage.getStore()) return originals.createDraft(...args);
    await consumeBudget('newDrafts', 1);
    return originals.createDraft(...args);
  };
  growthContent.reviseDraft = async (id, feedback, options = {}) => {
    if (!cycleStorage.getStore()) return originals.reviseDraft(id, feedback, options);
    await consumeBudget('revisions', 1);
    return originals.reviseDraft(id, feedback, {
      ...options,
      refreshResearch: false,
      suppressFreshResearch: true
    });
  };
  growthContent.generateFeaturedImage = async (...args) => {
    if (!cycleStorage.getStore()) return originals.generateFeaturedImage(...args);
    await consumeBudget('images', 1);
    return originals.generateFeaturedImage(...args);
  };

  editorialRadar.refresh = async (...args) => {
    if (!cycleStorage.getStore()) return originals.radarRefresh(...args);
    await consumeBudget('radarRefreshes', 1);
    return originals.radarRefresh(...args);
  };
  authority.run = async (...args) => {
    if (!cycleStorage.getStore()) return originals.authorityRun(...args);
    await consumeBudget('authorityRuns', 1);
    return originals.authorityRun(...args);
  };
  optimization.run = async (...args) => {
    if (!cycleStorage.getStore()) return originals.optimizationRun(...args);
    await consumeBudget('optimizationRuns', 1);
    return originals.optimizationRun(...args);
  };
}

function retryCooldownActive(state, now = Date.now()) {
  const status = String(state?.lastDailyArticleAttemptStatus || '');
  if (status !== 'RETRY_SCHEDULED') return false;
  const last = state?.lastDailyArticleAttemptAt ? new Date(state.lastDailyArticleAttemptAt).getTime() : 0;
  return Number.isFinite(last) && last > 0 && (now - last) < EDITORIAL_RETRY_COOLDOWN_MS;
}

async function guardedRunCycle(options = {}) {
  const config = await autopilot.getConfig();
  if (config.enabled === false) return { skipped: true, reason: 'disabled' };

  if (!options.force) {
    const state = await autopilot.getState();
    if (retryCooldownActive(state)) {
      return {
        skipped: true,
        reason: 'editorial_retry_cooldown',
        retryAfter: new Date(new Date(state.lastDailyArticleAttemptAt).getTime() + EDITORIAL_RETRY_COOLDOWN_MS).toISOString()
      };
    }
    if (config.aiModel === 'gpt-5.6-sol') {
      await autopilot.updateConfig({ aiModel: 'gpt-5.6-terra', aiReasoningEffort: 'medium' });
    }
  }

  const context = {
    startedAt: new Date().toISOString(),
    manual: Boolean(options.force),
    counts: Object.create(null)
  };
  return cycleStorage.run(context, async () => originals.runCycle(options));
}

async function applySafeConfig() {
  const current = await autopilot.getConfig();
  const patch = {};
  for (const [key, value] of Object.entries(SAFE_AUTOPILOT_CONFIG)) {
    if (current[key] !== value) patch[key] = value;
  }
  if (Object.keys(patch).length) {
    await autopilot.updateConfig(patch);
    console.info('[growth-autopilot-supervisor] applied safe automatic cost configuration', patch);
  }
  return autopilot.getConfig();
}

function startGrowthAutopilotSupervisor() {
  if (timer || initialTimer) return;
  installCostGuards();
  autopilot.runCycle = guardedRunCycle;

  void applySafeConfig()
    .then(config => console.info('[growth-autopilot-supervisor] ready', {
      enabled: config.enabled !== false,
      model: config.aiModel,
      radarHours: config.editorialRadarEveryHours,
      authorityHours: config.authorityEveryHours,
      maxDraftAttempts: config.maxDraftAttempts,
      hotTrendAutoEvaluate: config.hotTrendAutoEvaluate
    }))
    .catch(error => console.error('[growth-autopilot-supervisor] safe-config initialization failed', { error: error?.message || String(error) }));

  initialTimer = setTimeout(() => {
    initialTimer = null;
    void guardedRunCycle().catch(error => console.error('[growth-autopilot-supervisor] first cycle failed', { error: error?.message || String(error) }));
  }, FIRST_RUN_DELAY_MS);
  initialTimer.unref?.();

  timer = setInterval(() => {
    void guardedRunCycle().catch(error => console.error('[growth-autopilot-supervisor] scheduled cycle failed', { error: error?.message || String(error) }));
  }, POLL_MS);
  timer.unref?.();
}

async function stopGrowthAutopilotSupervisor() {
  if (initialTimer) clearTimeout(initialTimer);
  if (timer) clearInterval(timer);
  initialTimer = null;
  timer = null;
  await autopilot.stopGrowthAutopilot();
}

installCostGuards();
autopilot.runCycle = guardedRunCycle;

module.exports = {
  startGrowthAutopilot: startGrowthAutopilotSupervisor,
  stopGrowthAutopilot: stopGrowthAutopilotSupervisor,
  guardedRunCycle,
  applySafeConfig,
  SAFE_AUTOPILOT_CONFIG
};
