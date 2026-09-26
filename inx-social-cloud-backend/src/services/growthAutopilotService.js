'use strict';

const prisma = require('../db/prisma');
const growthIntelligence = require('./growthIntelligenceService');
const externalVisibility = require('./externalVisibilityService');
const growthOpportunities = require('./growthOpportunityService');
const growthContent = require('./growthContentService');
const growthStrategy = require('./growthStrategyService');
const seoMaintenance = require('./growthSeoMaintenanceService');
const authority = require('./growthAuthorityService');
const optimization = require('./growthOptimizationService');

const CONFIG_KEY = 'growth_autopilot_config_v1';
const STATE_KEY = 'growth_autopilot_state_v1';
const POLL_MS = 5 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 45 * 1000;
const LEASE_MS = 45 * 60 * 1000;

const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  intelligenceEveryHours: 24,
  configVersion: 4,
  publishEveryHours: 24,
  authorityEveryHours: 6,
  authorityAutoEmail: true,
  optimizationEveryHours: 24,
  opportunityWindowDays: 28,
  visibilityPromptCount: 5,
  minQualityScore: 75,
  maxDraftAttempts: 2,
  autoGenerateImage: true,
  autoPublish: true,
  retryHours: 6
});

let timer = null;
let initialTimer = null;
let legacyImportTimer = null;
let seoStartupTimer = null;

function nowIso() {
  return new Date().toISOString();
}

function safeJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function addHours(base, hours) {
  return new Date(new Date(base).getTime() + Number(hours) * 60 * 60 * 1000).toISOString();
}

function isDue(value) {
  if (!value) return true;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() <= Date.now();
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function normalizeConfig(value = {}) {
  return {
    enabled: value.enabled !== false,
    intelligenceEveryHours: clampNumber(value.intelligenceEveryHours, 24, 6, 168),
    configVersion: Math.max(4, Number(value.configVersion || 0)),
    publishEveryHours: clampNumber(value.publishEveryHours, 24, 24, 336),
    authorityEveryHours: clampNumber(value.authorityEveryHours, 6, 6, 48),
    authorityAutoEmail: value.authorityAutoEmail === true,
    optimizationEveryHours: clampNumber(value.optimizationEveryHours, 24, 12, 168),
    opportunityWindowDays: [7, 28, 90].includes(Number(value.opportunityWindowDays)) ? Number(value.opportunityWindowDays) : 28,
    visibilityPromptCount: clampNumber(value.visibilityPromptCount, 5, 1, 5),
    minQualityScore: clampNumber(value.minQualityScore, 75, 65, 95),
    maxDraftAttempts: clampNumber(value.maxDraftAttempts, 2, 1, 3),
    autoGenerateImage: value.autoGenerateImage !== false,
    autoPublish: value.autoPublish !== false,
    retryHours: clampNumber(value.retryHours, 6, 1, 24)
  };
}

function initialState() {
  const now = nowIso();
  return {
    running: false,
    leaseUntil: null,
    lastCycleStartedAt: null,
    lastCycleFinishedAt: null,
    lastIntelligenceAt: null,
    lastAuthorityAt: null,
    lastOptimizationAt: null,
    lastPublishedAt: null,
    nextIntelligenceAt: now,
    nextAuthorityAt: now,
    nextOptimizationAt: now,
    nextPublishAt: now,
    lastError: null,
    lastPublishedArticle: null,
    lastOpportunity: null,
    lastIntelligenceSummary: null,
    lastStrategy: null,
    recentEvents: [{
      at: now,
      type: 'AUTOPILOT_READY',
      level: 'info',
      message: 'Growth Autopilot initialised. Intelligence and publishing are scheduled automatically.'
    }]
  };
}

async function ensureSettings() {
  const configRow = await prisma.appSetting.findUnique({ where: { key: CONFIG_KEY } });
  const rawConfig = safeJson(configRow?.value, null);
  const needsV4Migration = !rawConfig || Number(rawConfig.configVersion || 0) < 4;
  const config = normalizeConfig({
    ...(rawConfig || DEFAULT_CONFIG),
    ...(needsV4Migration ? { configVersion: 4, publishEveryHours: 24, authorityEveryHours: 6, authorityAutoEmail: true, optimizationEveryHours: 24 } : {})
  });

  await prisma.appSetting.upsert({
    where: { key: CONFIG_KEY },
    create: {
      key: CONFIG_KEY,
      value: JSON.stringify(config),
      description: 'INXSocial Growth Autopilot schedule and publishing configuration.'
    },
    update: { value: JSON.stringify(config) }
  });

  const existingState = await prisma.appSetting.findUnique({ where: { key: STATE_KEY } });
  if (!existingState) {
    const state = initialState();
    await prisma.appSetting.create({
      data: {
        key: STATE_KEY,
        value: JSON.stringify(state),
        description: 'INXSocial Growth Autopilot runtime state and activity.'
      }
    });
  } else if (needsV4Migration) {
    const state = { ...initialState(), ...(safeJson(existingState.value, {}) || {}) };
    state.running = false;
    state.leaseUntil = null;
    state.nextIntelligenceAt = nowIso();
    state.nextAuthorityAt = nowIso();
    state.nextOptimizationAt = nowIso();
    state.nextPublishAt = nowIso();
    state.recentEvents = [{
      at: nowIso(),
      type: 'AUTOPILOT_UPGRADED',
      level: 'success',
      message: 'Growth Autopilot upgraded with final Phase 5 continuous optimisation and revenue feedback.'
    }, ...(state.recentEvents || [])].slice(0, 40);
    await prisma.appSetting.update({
      where: { key: STATE_KEY },
      data: { value: JSON.stringify(state) }
    });
  }
}

async function getConfig() {
  await ensureSettings();
  const row = await prisma.appSetting.findUnique({ where: { key: CONFIG_KEY } });
  return normalizeConfig(safeJson(row?.value, DEFAULT_CONFIG));
}

async function getState() {
  await ensureSettings();
  const row = await prisma.appSetting.findUnique({ where: { key: STATE_KEY } });
  return { ...initialState(), ...(safeJson(row?.value, {}) || {}) };
}

async function writeState(state) {
  const clean = {
    ...state,
    recentEvents: Array.isArray(state.recentEvents) ? state.recentEvents.slice(0, 40) : []
  };
  await prisma.appSetting.upsert({
    where: { key: STATE_KEY },
    create: {
      key: STATE_KEY,
      value: JSON.stringify(clean),
      description: 'INXSocial Growth Autopilot runtime state and activity.'
    },
    update: { value: JSON.stringify(clean) }
  });
  return clean;
}

async function mutateState(mutator) {
  const state = await getState();
  const next = await mutator({ ...state, recentEvents: [...(state.recentEvents || [])] }) || state;
  return writeState(next);
}

async function recordEvent(type, message, metadata = null, level = 'info') {
  const at = nowIso();
  const event = {
    at,
    type: String(type || 'EVENT').slice(0, 80),
    level: ['info', 'success', 'warning', 'error'].includes(level) ? level : 'info',
    message: String(message || '').slice(0, 600),
    metadata: metadata || null
  };
  await mutateState(state => {
    state.recentEvents = [event, ...(state.recentEvents || [])].slice(0, 40);
    if (level === 'error') state.lastError = { at, message: event.message };
    return state;
  });
  try {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'GROWTH_AUTOPILOT_' + event.type,
        entity: 'GrowthAutopilot',
        entityId: 'primary',
        metadata: JSON.stringify({ message: event.message, ...(metadata || {}) })
      }
    });
  } catch (error) {
    console.error('[growth-autopilot] audit log failed', { error: error?.message });
  }
  return event;
}

async function claimLease() {
  await ensureSettings();
  try {
    return await prisma.$transaction(async tx => {
      const row = await tx.appSetting.findUnique({ where: { key: STATE_KEY } });
      const state = { ...initialState(), ...(safeJson(row?.value, {}) || {}) };
      const leaseActive = state.running && state.leaseUntil && new Date(state.leaseUntil).getTime() > Date.now();
      if (leaseActive) return false;
      state.running = true;
      state.leaseUntil = new Date(Date.now() + LEASE_MS).toISOString();
      state.lastCycleStartedAt = nowIso();
      await tx.appSetting.update({
        where: { key: STATE_KEY },
        data: { value: JSON.stringify(state) }
      });
      return true;
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error?.code === 'P2034') return false;
    throw error;
  }
}

async function releaseLease() {
  await mutateState(state => {
    state.running = false;
    state.leaseUntil = null;
    state.lastCycleFinishedAt = nowIso();
    return state;
  });
}

async function runIntelligence(config) {
  const summary = {
    siteAudit: false,
    openai: false,
    perplexity: false,
    claude: false,
    reddit: false,
    seoMaintenance: false,
    opportunities: 0,
    warnings: []
  };

  try {
    const audit = await growthIntelligence.runSiteAudit();
    summary.siteAudit = true;
    summary.siteScore = audit.score;
  } catch (error) {
    summary.warnings.push('Site audit: ' + String(error.publicMessage || error.message || 'failed'));
  }

  const providers = growthIntelligence.providerStatus();

  if (providers.openai?.configured) {
    try {
      const result = await growthIntelligence.runOpenAIVisibilityScan(config.visibilityPromptCount);
      summary.openai = true;
      summary.openaiMentionRate = result.mentionRate;
      summary.openaiCitationRate = result.citationRate;
    } catch (error) {
      summary.warnings.push('OpenAI visibility: ' + String(error.publicMessage || error.message || 'failed'));
    }
  }

  for (const provider of ['perplexity', 'claude']) {
    if (!providers[provider]?.configured) continue;
    try {
      const result = await externalVisibility.runScan(provider, growthIntelligence.DEFAULT_PROMPTS, config.visibilityPromptCount);
      summary[provider] = true;
      summary[provider + 'MentionRate'] = result.mentionRate;
      summary[provider + 'CitationRate'] = result.citationRate;
    } catch (error) {
      summary.warnings.push(provider + ' visibility: ' + String(error.publicMessage || error.message || 'failed'));
    }
  }

  if (providers.reddit?.configured) {
    try {
      const reddit = await growthIntelligence.discoverRedditOpportunities();
      summary.reddit = true;
      summary.redditOpportunities = reddit.threads?.length || 0;
    } catch (error) {
      summary.warnings.push('Reddit discovery: ' + String(error.publicMessage || error.message || 'failed'));
    }
  }

  try {
    const seo = await seoMaintenance.run({ maxPages: 120 });
    summary.seoMaintenance = true;
    summary.seoScore = seo.score;
    summary.seoPagesCrawled = seo.pagesCrawled;
    summary.seoIssues = seo.summary?.totalIssues || 0;
    summary.seoAutoFixed = seo.summary?.autoFixed || 0;
    summary.internalArticleLinks = seo.summary?.internalArticleLinks || 0;
  } catch (error) {
    summary.warnings.push('Phase 3 SEO maintenance: ' + String(error.publicMessage || error.message || 'failed'));
  }

  const opportunityMap = await growthOpportunities.build(config.opportunityWindowDays);
  summary.opportunities = opportunityMap.summary?.total || 0;
  summary.criticalOpportunities = opportunityMap.summary?.critical || 0;
  summary.highOpportunities = opportunityMap.summary?.high || 0;
  summary.opportunityWarnings = opportunityMap.warnings?.length || 0;

  await mutateState(state => {
    const completed = nowIso();
    state.lastIntelligenceAt = completed;
    state.nextIntelligenceAt = addHours(completed, config.intelligenceEveryHours);
    state.lastIntelligenceSummary = summary;
    state.lastError = null;
    return state;
  });

  await recordEvent(
    'INTELLIGENCE_REFRESHED',
    'Growth signals refreshed automatically: crawler audit, Phase 3 technical SEO maintenance, internal linking, available AI visibility providers, Reddit discovery and opportunity scoring.',
    summary,
    summary.warnings.length ? 'warning' : 'success'
  );

  return { opportunityMap, summary };
}

function contentEligibleOpportunity(opportunity) {
  if (!opportunity || opportunity.type === 'technical') return false;
  const action = String(opportunity.action?.type || '');
  if (['TECHNICAL_FIX', 'COMMUNITY_ENGAGEMENT', 'IMPROVE_EXISTING_PAGE'].includes(action)) return false;
  if (opportunity.existingPage && action !== 'BUILD_AUTHORITY_CONTENT') return false;
  return Number(opportunity.score || 0) >= 50;
}

async function chooseOpportunity(opportunityMap) {
  const articles = await growthContent.listArticles();
  const activeArticles = articles.filter(article => article.status !== growthContent.STATUS.ARCHIVED);
  const usedOpportunityIds = new Set(activeArticles.map(article => article.opportunity_id).filter(Boolean));

  const ranked = [...(opportunityMap?.opportunities || [])]
    .filter(contentEligibleOpportunity)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  for (const opportunity of ranked) {
    if (usedOpportunityIds.has(opportunity.id)) continue;
    const nearDuplicate = activeArticles.some(article =>
      growthOpportunities.similarity(opportunity.topic, article.title) >= 0.55
      || growthOpportunities.similarity(opportunity.topic, article.research_brief?.summary || '') >= 0.6
    );
    if (nearDuplicate) continue;
    return opportunity;
  }

  const fallbackPrompts = growthIntelligence.DEFAULT_PROMPTS;
  for (const prompt of fallbackPrompts) {
    const nearDuplicate = activeArticles.some(article => growthOpportunities.similarity(prompt, article.title) >= 0.55);
    if (!nearDuplicate) {
      return {
        id: null,
        topic: prompt,
        score: 60,
        type: 'autopilot_fallback',
        intent: 'commercial',
        action: {
          type: 'BUILD_AUTHORITY_CONTENT',
          label: 'Build AI-search authority',
          rationale: 'Autopilot fallback buyer-intent topic.'
        }
      };
    }
  }
  return null;
}

async function archiveLowQuality(article, threshold, attempt) {
  try {
    await growthContent.archiveArticle(article.id);
  } catch (_) {}
  await recordEvent(
    'DRAFT_REJECTED',
    'Autopilot rejected a generated draft because it did not meet the publishing quality threshold.',
    {
      articleId: article.id,
      title: article.title,
      score: article.quality?.score || 0,
      threshold,
      attempt
    },
    'warning'
  );
}

async function produceAndPublish(opportunity, config, strategy = null) {
  let lastArticle = null;

  for (let attempt = 1; attempt <= config.maxDraftAttempts; attempt += 1) {
    const draftInput = opportunity.id ? {
      opportunityId: opportunity.id,
      notes: 'Autopilot publication. Produce a substantive, evidence-led article that is useful without relying on promotional filler. The article must stand on its own for readers and AI search systems.' + (strategy?.executionBrief ? ' Strategist brief: ' + JSON.stringify(strategy.executionBrief) : '')
    } : {
      topic: opportunity.topic,
      intent: opportunity.intent || 'commercial',
      action: opportunity.action?.label || 'Build authority content',
      notes: 'Autopilot publication. Produce a substantive, evidence-led article that is useful without relying on promotional filler. The article must stand on its own for readers and AI search systems.' + (strategy?.executionBrief ? ' Strategist brief: ' + JSON.stringify(strategy.executionBrief) : '')
    };

    const draft = await growthContent.createDraft(draftInput);
    lastArticle = draft;
    const score = Number(draft.quality?.score || 0);

    await recordEvent(
      'DRAFT_GENERATED',
      'Autopilot researched current sources and generated a new article draft.',
      {
        articleId: draft.id,
        title: draft.title,
        qualityScore: score,
        opportunityId: opportunity.id,
        opportunityScore: opportunity.score,
        attempt
      },
      'info'
    );

    if (score < config.minQualityScore) {
      await archiveLowQuality(draft, config.minQualityScore, attempt);
      continue;
    }

    let critic = null;
    try {
      critic = await growthStrategy.reviewDraft({ article: draft, opportunity, strategy });
      await recordEvent(
        'AI_CRITIC_REVIEWED',
        critic.approve
          ? 'Independent AI critic approved the draft for the publishing pipeline.'
          : 'Independent AI critic rejected the draft before publishing.',
        {
          articleId: draft.id,
          criticScore: critic.score,
          searchIntentMatch: critic.searchIntentMatch,
          factualRisk: critic.factualRisk,
          duplicationRisk: critic.duplicationRisk,
          summary: critic.summary
        },
        critic.approve ? 'success' : 'warning'
      );
    } catch (error) {
      await recordEvent(
        'AI_CRITIC_UNAVAILABLE',
        'The independent AI critic could not return a valid review, so the article was not published.',
        { articleId: draft.id, error: String(error.message || error).slice(0, 400) },
        'warning'
      );
      await archiveLowQuality(draft, config.minQualityScore, attempt);
      continue;
    }

    if (!critic.approve || Number(critic.score || 0) < config.minQualityScore || critic.factualRisk === 'high' || critic.duplicationRisk === 'high') {
      await archiveLowQuality(draft, config.minQualityScore, attempt);
      continue;
    }

    let article = draft;
    if (config.autoGenerateImage) {
      try {
        article = await growthContent.generateFeaturedImage(article.id);
        await recordEvent(
          'IMAGE_GENERATED',
          'Autopilot generated and stored the article featured image.',
          { articleId: article.id, title: article.title },
          'success'
        );
      } catch (error) {
        await recordEvent(
          'IMAGE_SKIPPED',
          'Article passed quality checks but featured-image generation was unavailable; publishing continues without blocking the article.',
          { articleId: article.id, error: String(error.publicMessage || error.message || 'Image generation failed').slice(0, 400) },
          'warning'
        );
      }
    }

    article = await growthContent.approveArticle(article.id);

    if (config.autoPublish) {
      article = await growthContent.publishArticle(article.id);
      const publishedAt = article.published_at || nowIso();
      await mutateState(state => {
        state.lastPublishedAt = publishedAt;
        state.nextPublishAt = addHours(publishedAt, config.publishEveryHours);
        state.lastPublishedArticle = {
          id: article.id,
          slug: article.slug,
          title: article.title,
          url: '/blog/' + article.slug,
          qualityScore: article.quality?.score || 0,
          publishedAt
        };
        state.lastOpportunity = {
          id: opportunity.id,
          topic: opportunity.topic,
          score: opportunity.score,
          action: opportunity.action?.label || null
        };
        state.lastError = null;
        return state;
      });
      await recordEvent(
        'ARTICLE_PUBLISHED',
        'Autopilot published a researched article to the INXSocial blog.',
        {
          articleId: article.id,
          title: article.title,
          slug: article.slug,
          qualityScore: article.quality?.score || 0,
          opportunityScore: opportunity.score
        },
        'success'
      );
      return article;
    }

    await mutateState(state => {
      state.nextPublishAt = addHours(nowIso(), config.publishEveryHours);
      return state;
    });
    await recordEvent(
      'ARTICLE_APPROVED',
      'Autopilot produced and approved an article. Automatic publishing is disabled, so it remains approved.',
      { articleId: article.id, title: article.title, qualityScore: article.quality?.score || 0 },
      'success'
    );
    return article;
  }

  throw new Error(
    lastArticle
      ? 'Generated drafts did not meet the autopilot quality threshold.'
      : 'Autopilot could not generate an article.'
  );
}

async function runCycle(options = {}) {
  const config = await getConfig();
  if (!config.enabled && !options.force) return { skipped: true, reason: 'disabled' };

  const state = await getState();
  const intelligenceDue = options.force || isDue(state.nextIntelligenceAt);
  const authorityDue = options.force || isDue(state.nextAuthorityAt);
  const optimizationDue = options.force || isDue(state.nextOptimizationAt);
  const publishDue = options.force || isDue(state.nextPublishAt);
  if (!intelligenceDue && !authorityDue && !optimizationDue && !publishDue) return { skipped: true, reason: 'not_due' };

  const claimed = await claimLease();
  if (!claimed) return { skipped: true, reason: 'already_running' };

  try {
    await recordEvent(
      'CYCLE_STARTED',
      options.force ? 'Growth Autopilot cycle started manually.' : 'Scheduled Growth Autopilot cycle started.',
      { intelligenceDue, authorityDue, optimizationDue, publishDue },
      'info'
    );

    let opportunityMap = await growthOpportunities.latest().catch(() => null);
    if (intelligenceDue || publishDue || !opportunityMap) {
      const intelligence = await runIntelligence(config);
      opportunityMap = intelligence.opportunityMap;
    }


    if (authorityDue) {
      try {
        const authorityState = await authority.run({ autoEmail: config.authorityAutoEmail });
        const completed = nowIso();
        await mutateState(current => {
          current.lastAuthorityAt = completed;
          current.nextAuthorityAt = addHours(completed, config.authorityEveryHours);
          return current;
        });
        await recordEvent(
          'AUTHORITY_REFRESHED',
          'Phase 4 refreshed community, backlink, mention and outreach opportunities.',
          {
            prospects: authorityState.stats?.total || 0,
            communities: authorityState.stats?.communities || 0,
            backlinkProspects: authorityState.stats?.backlinkProspects || 0,
            drafts: authorityState.stats?.outreachDrafts || 0,
            nextAuthorityAt: addHours(completed, config.authorityEveryHours)
          },
          authorityState.warnings?.length ? 'warning' : 'success'
        );
      } catch (error) {
        const authorityRetryAt = addHours(nowIso(), config.retryHours);
        await mutateState(current => {
          current.nextAuthorityAt = authorityRetryAt;
          return current;
        });
        await recordEvent(
          'AUTHORITY_REFRESH_FAILED',
          'Phase 4 authority refresh failed and will retry automatically.',
          { error: String(error.message || error).slice(0, 400), retryAt: authorityRetryAt },
          'warning'
        );
      }
    }

    if (optimizationDue) {
      try {
        const optimizationState = await optimization.run({ days: 28 });
        const completed = nowIso();
        await mutateState(current => {
          current.lastOptimizationAt = completed;
          current.nextOptimizationAt = addHours(completed, config.optimizationEveryHours);
          return current;
        });
        await recordEvent(
          'OPTIMIZATION_REFRESHED',
          'Final Phase 5 measured search, conversion and revenue performance and rebuilt the optimisation queue.',
          {
            actions: optimizationState.stats?.totalActions || 0,
            highPriority: optimizationState.stats?.highPriority || 0,
            paidCustomers: optimizationState.revenue?.activePaidCustomers || 0,
            projectedMrrGbp: optimizationState.revenue?.projectedMrrGbp || 0,
            nextOptimizationAt: addHours(completed, config.optimizationEveryHours)
          },
          optimizationState.warnings?.length ? 'warning' : 'success'
        );
      } catch (error) {
        const optimizationRetryAt = addHours(nowIso(), config.retryHours);
        await mutateState(current => {
          current.nextOptimizationAt = optimizationRetryAt;
          return current;
        });
        await recordEvent(
          'OPTIMIZATION_REFRESH_FAILED',
          'Phase 5 optimisation refresh failed and will retry automatically.',
          { error: String(error.message || error).slice(0, 400), retryAt: optimizationRetryAt },
          'warning'
        );
      }
    }

    let publishedArticle = null;
    if (publishDue) {
      const articles = await growthContent.listArticles();
      let strategy = null;
      let opportunity = null;

      try {
        strategy = await growthStrategy.plan({ opportunityMap, articles });
        await mutateState(current => {
          current.lastStrategy = strategy;
          return current;
        });
        await recordEvent(
          'AI_STRATEGY_DECIDED',
          'AI Strategist selected the next growth action: ' + strategy.action + '.',
          {
            action: strategy.action,
            topic: strategy.topic,
            confidence: strategy.confidence,
            selectedOpportunityId: strategy.selectedOpportunityId,
            rationale: strategy.rationale
          },
          strategy.action === 'CREATE_ARTICLE' ? 'success' : 'info'
        );

        if (strategy.action === 'CREATE_ARTICLE' && strategy.publishRecommended) {
          opportunity = (opportunityMap?.opportunities || []).find(item => item.id === strategy.selectedOpportunityId) || null;
          if (!opportunity && strategy.topic) {
            opportunity = {
              id: null,
              topic: strategy.topic,
              score: 60,
              type: 'ai_strategy',
              intent: 'commercial',
              action: {
                type: 'BUILD_AUTHORITY_CONTENT',
                label: 'AI Strategist article',
                rationale: strategy.rationale
              }
            };
          }
        } else {
          const nextReview = addHours(nowIso(), config.publishEveryHours);
          await mutateState(current => {
            current.nextPublishAt = nextReview;
            return current;
          });
          await recordEvent(
            'STRATEGIC_ACTION_QUEUED',
            'AI Strategist decided that creating a new article is not the best action right now. Autopilot will re-evaluate on the next cycle.',
            {
              action: strategy.action,
              topic: strategy.topic,
              rationale: strategy.rationale,
              nextReviewAt: nextReview
            },
            'info'
          );
        }
      } catch (error) {
        await recordEvent(
          'AI_STRATEGIST_FALLBACK',
          'AI Strategist was unavailable, so Autopilot used the deterministic opportunity fallback instead of stopping.',
          { error: String(error.message || error).slice(0, 400) },
          'warning'
        );
        opportunity = growthStrategy.fallbackOpportunity(opportunityMap, articles) || await chooseOpportunity(opportunityMap);
      }

      if (opportunity) {
        publishedArticle = await produceAndPublish(opportunity, config, strategy);
      } else if (!strategy || (strategy.action === 'CREATE_ARTICLE' && strategy.publishRecommended)) {
        const nextRetry = addHours(nowIso(), config.retryHours);
        await mutateState(current => {
          current.nextPublishAt = nextRetry;
          return current;
        });
        await recordEvent(
          'NO_CONTENT_OPPORTUNITY',
          'Autopilot found no sufficiently distinct content opportunity. It will retry automatically.',
          { nextRetryAt: nextRetry },
          'warning'
        );
      }
    }

    await recordEvent(
      'CYCLE_COMPLETED',
      publishedArticle
        ? 'Autopilot cycle completed and published a new article.'
        : 'Autopilot cycle completed; growth intelligence is up to date.',
      publishedArticle ? { articleId: publishedArticle.id, slug: publishedArticle.slug } : null,
      'success'
    );

    return { skipped: false, publishedArticle };
  } catch (error) {
    const message = String(error.publicMessage || error.message || 'Growth Autopilot cycle failed').slice(0, 800);
    const retryAt = addHours(nowIso(), config.retryHours);
    await mutateState(current => {
      current.nextIntelligenceAt = isDue(current.nextIntelligenceAt) ? retryAt : current.nextIntelligenceAt;
      current.nextAuthorityAt = isDue(current.nextAuthorityAt) ? retryAt : current.nextAuthorityAt;
      current.nextOptimizationAt = isDue(current.nextOptimizationAt) ? retryAt : current.nextOptimizationAt;
      current.nextPublishAt = isDue(current.nextPublishAt) ? retryAt : current.nextPublishAt;
      current.lastError = { at: nowIso(), message };
      return current;
    });
    await recordEvent('CYCLE_FAILED', message, { retryAt }, 'error');
    console.error('[growth-autopilot] cycle failed', { error: message });
    return { skipped: false, error: message };
  } finally {
    await releaseLease();
  }
}

async function status() {
  const [config, state, contentOverview, opportunityMap, seoStatus, authorityStatus, optimizationStatus] = await Promise.all([
    getConfig(),
    getState(),
    growthContent.overview().catch(() => null),
    growthOpportunities.latest().catch(() => null),
    seoMaintenance.status().catch(() => null),
    authority.status().catch(() => null),
    optimization.status().catch(() => null)
  ]);

  return {
    generatedAt: nowIso(),
    config,
    state,
    content: contentOverview ? {
      counts: contentOverview.counts,
      engine: contentOverview.engine,
      latestArticles: (contentOverview.articles || []).slice(0, 5)
    } : null,
    seoMaintenance: seoStatus,
    authority: authorityStatus,
    optimization: optimizationStatus,
    opportunities: opportunityMap ? {
      summary: opportunityMap.summary,
      generatedAt: opportunityMap.generatedAt,
      top: (opportunityMap.opportunities || []).slice(0, 5).map(item => ({
        id: item.id,
        topic: item.topic,
        score: item.score,
        action: item.action?.label || null
      }))
    } : null
  };
}

async function updateConfig(patch = {}) {
  const current = await getConfig();
  const next = normalizeConfig({ ...current, ...patch });
  await prisma.appSetting.update({
    where: { key: CONFIG_KEY },
    data: { value: JSON.stringify(next) }
  });
  await recordEvent(
    next.enabled ? 'AUTOPILOT_ENABLED' : 'AUTOPILOT_PAUSED',
    next.enabled
      ? 'Growth Autopilot is enabled. Monitoring and publishing will continue on schedule.'
      : 'Growth Autopilot is paused. Scheduled monitoring and publishing are stopped.',
    { config: next },
    next.enabled ? 'success' : 'warning'
  );
  if (next.enabled) {
    await mutateState(state => {
      if (!state.nextIntelligenceAt) state.nextIntelligenceAt = nowIso();
      if (!state.nextAuthorityAt) state.nextAuthorityAt = nowIso();
      if (!state.nextOptimizationAt) state.nextOptimizationAt = nowIso();
      if (!state.nextPublishAt) state.nextPublishAt = nowIso();
      return state;
    });
  }
  return status();
}


async function ensurePhase3MaintenanceFresh(reason = 'startup') {
  try {
    const current = await seoMaintenance.status();
    const generatedAt = current?.generatedAt ? new Date(current.generatedAt).getTime() : 0;
    const fresh = Number.isFinite(generatedAt) && generatedAt > 0 && (Date.now() - generatedAt) < 20 * 60 * 1000;
    if (fresh) return current;

    const result = await seoMaintenance.run({ maxPages: 120 });
    console.info('[growth-autopilot] Phase 3 SEO maintenance refreshed', {
      trigger: reason,
      score: result.score,
      pagesCrawled: result.pagesCrawled,
      issues: result.summary?.totalIssues || 0,
      internalArticleLinks: result.summary?.internalArticleLinks || 0
    });
    return result;
  } catch (error) {
    console.warn('[growth-autopilot] Phase 3 startup maintenance failed without blocking runtime', {
      trigger: reason,
      error: error?.message || String(error)
    });
    return null;
  }
}

async function syncLegacyBlog(reason = 'scheduled') {
  try {
    const legacy = await growthContent.importLegacyBabyLoveArticles();
    if (!legacy.skipped || legacy.reason !== 'missing_key') {
      console.info('[growth-autopilot] legacy blog sync checked', {
        trigger: reason,
        imported: legacy.imported || 0,
        discovered: legacy.discovered || 0,
        skipped: Boolean(legacy.skipped),
        reason: legacy.reason || null
      });
    }
    return legacy;
  } catch (error) {
    console.warn('[growth-autopilot] legacy blog sync failed without blocking autopilot', {
      trigger: reason,
      status: error?.response?.status || null,
      error: error?.message || String(error)
    });
    return null;
  }
}

function startGrowthAutopilot() {
  if (timer || initialTimer) return;
  void ensureSettings().then(async () => {
    void syncLegacyBlog('startup');
    console.info('[growth-autopilot] runtime ready', {
      pollMinutes: POLL_MS / 60000,
      defaultPublishHours: DEFAULT_CONFIG.publishEveryHours,
      strategyModelReady: growthStrategy.ready()
    });
  }).catch(error => {
    console.error('[growth-autopilot] initialization failed', { error: error?.message || String(error) });
  });

  initialTimer = setTimeout(() => {
    initialTimer = null;
    void runCycle().catch(error => console.error('[growth-autopilot] first cycle failed', { error: error?.message }));
  }, FIRST_RUN_DELAY_MS);
  initialTimer.unref?.();

  seoStartupTimer = setTimeout(() => {
    seoStartupTimer = null;
    void ensurePhase3MaintenanceFresh('startup-safety-net');
  }, 2 * 60 * 1000);
  seoStartupTimer.unref?.();

  timer = setInterval(() => {
    void runCycle().catch(error => console.error('[growth-autopilot] scheduled cycle failed', { error: error?.message }));
  }, POLL_MS);
  timer.unref?.();

  legacyImportTimer = setInterval(() => {
    void syncLegacyBlog('hourly-retry');
  }, 60 * 60 * 1000);
  legacyImportTimer.unref?.();
}

function stopGrowthAutopilot() {
  if (initialTimer) clearTimeout(initialTimer);
  if (timer) clearInterval(timer);
  if (legacyImportTimer) clearInterval(legacyImportTimer);
  if (seoStartupTimer) clearTimeout(seoStartupTimer);
  initialTimer = null;
  timer = null;
  legacyImportTimer = null;
  seoStartupTimer = null;
}

module.exports = {
  CONFIG_KEY,
  STATE_KEY,
  DEFAULT_CONFIG,
  getConfig,
  getState,
  status,
  updateConfig,
  runCycle,
  startGrowthAutopilot,
  stopGrowthAutopilot,
  chooseOpportunity,
  contentEligibleOpportunity
};
