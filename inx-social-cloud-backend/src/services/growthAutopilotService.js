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
const growthSites = require('./growthSiteService');
const siteIntelligence = require('./growthSiteIntelligenceService');
const editorialRadar = require('./growthEditorialRadarService');

const CONFIG_KEY = 'growth_autopilot_config_v1';
const STATE_KEY = 'growth_autopilot_state_v1';
const POLL_MS = 5 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 45 * 1000;
const LEASE_MS = 45 * 60 * 1000;

const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  intelligenceEveryHours: 24,
  configVersion: 6,
  publishEveryHours: 24,
  editorialRadarEveryHours: 6,
  hotTrendAutoEvaluate: true,
  maxArticlesPerLocalDay: 2,
  dailyPublishTimeLocal: '07:30',
  publishTimeZone: 'Europe/London',
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

function normalizeTimeOfDay(value, fallback = '07:30') {
  const text = String(value || '').trim();
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

function normalizeTimeZone(value, fallback = 'Europe/London') {
  const text = String(value || '').trim() || fallback;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: text }).format(new Date());
    return text;
  } catch (_) {
    return fallback;
  }
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const out = {};
  for (const part of parts) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return out;
}

function localDateKey(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return String(p.year).padStart(4, '0') + '-' + String(p.month).padStart(2, '0') + '-' + String(p.day).padStart(2, '0');
}

function localMinutes(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return Number(p.hour || 0) * 60 + Number(p.minute || 0);
}

function addCalendarDays(year, month, day, days) {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function zonedLocalToUtcIso(parts, timeZone) {
  const desiredPseudoUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  let guess = desiredPseudoUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = zonedParts(new Date(guess), timeZone);
    const observedPseudoUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second || 0,
      0
    );
    const delta = desiredPseudoUtc - observedPseudoUtc;
    if (Math.abs(delta) < 1000) break;
    guess += delta;
  }
  return new Date(guess).toISOString();
}

function scheduledPublishIsoForLocalDate(year, month, day, config) {
  const [hour, minute] = normalizeTimeOfDay(config.dailyPublishTimeLocal).split(':').map(Number);
  const timeZone = normalizeTimeZone(config.publishTimeZone);
  return zonedLocalToUtcIso({ year, month, day, hour, minute }, timeZone);
}

function nextDailyPublishIso(reference, config, alwaysNextDay = false) {
  const date = reference instanceof Date ? reference : new Date(reference || Date.now());
  const timeZone = normalizeTimeZone(config.publishTimeZone);
  const p = zonedParts(date, timeZone);
  const [hour, minute] = normalizeTimeOfDay(config.dailyPublishTimeLocal).split(':').map(Number);
  const targetMinutes = hour * 60 + minute;
  const currentMinutes = Number(p.hour || 0) * 60 + Number(p.minute || 0);
  const daysToAdd = alwaysNextDay || currentMinutes >= targetMinutes ? 1 : 0;
  const target = addCalendarDays(p.year, p.month, p.day, daysToAdd);
  return scheduledPublishIsoForLocalDate(target.year, target.month, target.day, config);
}

function dailyPublishDue(state, config, reference = new Date()) {
  const timeZone = normalizeTimeZone(config.publishTimeZone);
  const localDay = localDateKey(reference, timeZone);
  if (state.lastPublishDecisionDateLocal === localDay) return false;

  const [hour, minute] = normalizeTimeOfDay(config.dailyPublishTimeLocal).split(':').map(Number);
  if (localMinutes(reference, timeZone) < hour * 60 + minute) return false;

  return !state.nextPublishAt || isDue(state.nextPublishAt);
}

function markDailyPublishDecision(state, config, reference = new Date()) {
  const timeZone = normalizeTimeZone(config.publishTimeZone);
  state.lastPublishDecisionDateLocal = localDateKey(reference, timeZone);
  state.nextPublishAt = nextDailyPublishIso(reference, config, true);
  return state;
}

function isDue(value) {
  if (!value) return true;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() <= Date.now();
}

function publishedLocalDay(article, timeZone) {
  const value = article?.published_at || article?.publishedAt || null;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : localDateKey(date, timeZone);
}

async function publishedCountToday(config, articles = null, reference = new Date()) {
  const list = Array.isArray(articles) ? articles : await growthContent.listArticles();
  const today = localDateKey(reference, config.publishTimeZone);
  return list.filter(article => String(article.status || '').toUpperCase() === 'PUBLISHED' && publishedLocalDay(article, config.publishTimeZone) === today).length;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function normalizeConfig(value = {}) {
  return {
    enabled: value.enabled !== false,
    intelligenceEveryHours: clampNumber(value.intelligenceEveryHours, 24, 6, 168),
    configVersion: Math.max(6, Number(value.configVersion || 0)),
    publishEveryHours: clampNumber(value.publishEveryHours, 24, 24, 336),
    editorialRadarEveryHours: clampNumber(value.editorialRadarEveryHours, 6, 3, 24),
    hotTrendAutoEvaluate: value.hotTrendAutoEvaluate !== false,
    maxArticlesPerLocalDay: clampNumber(value.maxArticlesPerLocalDay, 2, 1, 3),
    dailyPublishTimeLocal: normalizeTimeOfDay(value.dailyPublishTimeLocal, '07:30'),
    publishTimeZone: normalizeTimeZone(value.publishTimeZone, 'Europe/London'),
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
    lastEditorialRadarAt: null,
    lastPublishedAt: null,
    lastPublishDecisionDateLocal: null,
    nextIntelligenceAt: now,
    nextAuthorityAt: now,
    nextOptimizationAt: now,
    nextEditorialRadarAt: now,
    nextPublishAt: now,
    lastError: null,
    lastPublishedArticle: null,
    lastOpportunity: null,
    lastIntelligenceSummary: null,
    lastEditorialRadarSummary: null,
    lastHotTrendOpportunityId: null,
    lastHotTrendEvaluatedAt: null,
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
  const needsV5Migration = !rawConfig || Number(rawConfig.configVersion || 0) < 5;
  const needsV6Migration = !rawConfig || Number(rawConfig.configVersion || 0) < 6;
  const config = normalizeConfig({
    ...(rawConfig || DEFAULT_CONFIG),
    ...(needsV4Migration ? { authorityEveryHours: 6, authorityAutoEmail: true, optimizationEveryHours: 24 } : {}),
    ...(needsV5Migration ? { dailyPublishTimeLocal: '07:30', publishTimeZone: 'Europe/London' } : {}),
    ...(needsV6Migration ? { configVersion: 6, editorialRadarEveryHours: 6, hotTrendAutoEvaluate: true, maxArticlesPerLocalDay: 2 } : {})
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
  } else if (needsV4Migration || needsV5Migration || needsV6Migration) {
    const state = { ...initialState(), ...(safeJson(existingState.value, {}) || {}) };
    state.running = false;
    state.leaseUntil = null;
    state.nextIntelligenceAt = nowIso();
    state.nextAuthorityAt = nowIso();
    state.nextOptimizationAt = nowIso();
    state.nextEditorialRadarAt = nowIso();
    state.lastPublishDecisionDateLocal = null;
    state.nextPublishAt = nextDailyPublishIso(new Date(), config);
    state.recentEvents = [{
      at: nowIso(),
      type: 'AUTOPILOT_UPGRADED',
      level: 'success',
      message: needsV6Migration
        ? 'Growth Autopilot upgraded with proactive editorial/trend opportunity radar.'
        : needsV5Migration
          ? 'Growth Autopilot upgraded to a fixed daily UK morning content-decision window.'
          : 'Growth Autopilot upgraded with final Phase 5 continuous optimisation and revenue feedback.'
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
    siteIntelligence: false,
    openai: false,
    perplexity: false,
    claude: false,
    seoMaintenance: false,
    opportunities: 0,
    warnings: []
  };

  let siteContext = null;
  let seo = null;
  try {
    const site = await growthSites.ensureDefaultSite();
    seo = await seoMaintenance.run({ origin: site.origin, maxPages: 120 });
    summary.seoMaintenance = true;
    summary.seoScore = seo.score;
    summary.seoPagesCrawled = seo.pagesCrawled;
    summary.seoIssues = seo.summary?.totalIssues || 0;
    summary.seoAutoFixed = seo.summary?.autoFixed || 0;
    summary.internalArticleLinks = seo.summary?.internalArticleLinks || 0;

    siteContext = await siteIntelligence.refresh({ site, crawl: seo });
    summary.siteIntelligence = true;
    summary.siteId = site.id;
    summary.siteOrigin = site.origin;
    summary.siteProfileConfidence = siteContext.profile?.confidence || 0;
    summary.siteChanges = {
      added: siteContext.changes?.added?.length || 0,
      removed: siteContext.changes?.removed?.length || 0,
      changed: siteContext.changes?.changed?.length || 0
    };
    summary.visibilityPrompts = siteContext.profile?.visibilityPrompts?.length || 0;
    summary.discoveredCompetitors = siteContext.profile?.competitorCandidates?.length || 0;
  } catch (error) {
    summary.warnings.push('Site intelligence: ' + String(error.publicMessage || error.message || 'failed'));
  }

  try {
    const audit = await growthIntelligence.runSiteAudit(siteContext?.site || null);
    summary.siteAudit = true;
    summary.siteScore = audit.score;
  } catch (error) {
    summary.warnings.push('Site audit: ' + String(error.publicMessage || error.message || 'failed'));
  }

  const providers = growthIntelligence.providerStatus();
  const profile = siteContext?.profile || null;
  const prompts = (profile?.visibilityPrompts?.length ? profile.visibilityPrompts : await growthIntelligence.dynamicPrompts(siteContext?.site?.id))
    .slice(0, Math.max(1, config.visibilityPromptCount));
  const visibilityContext = {
    site: siteContext?.site || null,
    profile,
    brandName: profile?.brandName || siteContext?.site?.hostname || 'the monitored brand',
    origin: siteContext?.site?.origin || growthSites.DEFAULT_ORIGIN,
    competitorCandidates: profile?.competitorCandidates || [],
    prompts
  };

  if (providers.openai?.configured) {
    try {
      const result = await growthIntelligence.runOpenAIVisibilityScan(config.visibilityPromptCount, visibilityContext);
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
      const result = await externalVisibility.runScan(provider, prompts, config.visibilityPromptCount, visibilityContext);
      summary[provider] = true;
      summary[provider + 'MentionRate'] = result.mentionRate;
      summary[provider + 'CitationRate'] = result.citationRate;
    } catch (error) {
      summary.warnings.push(provider + ' visibility: ' + String(error.publicMessage || error.message || 'failed'));
    }
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
    state.lastSiteProfile = profile ? {
      siteId: siteContext?.site?.id || null,
      brandName: profile.brandName || null,
      primaryCategory: profile.primaryCategory || null,
      confidence: profile.confidence || 0,
      generatedAt: new Date().toISOString()
    } : null;
    state.lastError = null;
    return state;
  });

  await recordEvent(
    'INTELLIGENCE_REFRESHED',
    'Growth signals refreshed automatically: live-site discovery, semantic change detection, technical SEO, AI visibility, first-party performance and opportunity scoring.',
    summary,
    summary.warnings.length ? 'warning' : 'success'
  );

  return { opportunityMap, summary, siteContext };
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

  const fallbackPrompts = await growthIntelligence.dynamicPrompts();
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

async function produceAndPublish(opportunity, config, strategy = null, decisionMode = 'daily') {
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
      critic = await growthStrategy.reviewDraft({ article: draft, opportunity, strategy, siteProfile: strategy?.siteProfile || null });
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
        if (decisionMode !== 'hot') markDailyPublishDecision(state, config, new Date(publishedAt));
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
      if (decisionMode !== 'hot') markDailyPublishDecision(state, config, new Date());
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
  const radarDue = options.force || isDue(state.nextEditorialRadarAt);
  const publishDue = options.force || dailyPublishDue(state, config);
  if (!intelligenceDue && !authorityDue && !optimizationDue && !radarDue && !publishDue) return { skipped: true, reason: 'not_due' };

  const claimed = await claimLease();
  if (!claimed) return { skipped: true, reason: 'already_running' };

  try {
    await recordEvent(
      'CYCLE_STARTED',
      options.force ? 'Growth Autopilot cycle started manually.' : 'Scheduled Growth Autopilot cycle started.',
      { intelligenceDue, authorityDue, optimizationDue, radarDue, publishDue },
      'info'
    );

    let opportunityMap = await growthOpportunities.latest().catch(() => null);
    if (intelligenceDue || publishDue || !opportunityMap) {
      const intelligence = await runIntelligence(config);
      opportunityMap = intelligence.opportunityMap;
    }


    let radarState = await editorialRadar.latest().catch(() => null);
    if (radarDue) {
      try {
        let intelligence = await siteIntelligence.latest().catch(() => null);
        if (!intelligence?.profile) {
          const refreshed = await runIntelligence(config);
          opportunityMap = refreshed.opportunityMap;
          intelligence = refreshed.siteContext ? {
            site: refreshed.siteContext.site,
            profile: refreshed.siteContext.profile,
            changes: refreshed.siteContext.changes,
            snapshot: refreshed.siteContext.snapshot
          } : await siteIntelligence.latest().catch(() => null);
        }
        const articles = await growthContent.listArticles();
        radarState = await editorialRadar.refresh({ intelligence, existingArticles: articles });
        const completed = nowIso();
        await mutateState(current => {
          current.lastEditorialRadarAt = completed;
          current.nextEditorialRadarAt = addHours(completed, config.editorialRadarEveryHours);
          current.lastEditorialRadarSummary = radarState.summary || null;
          return current;
        });
        opportunityMap = await growthOpportunities.build(config.opportunityWindowDays);
        await recordEvent(
          'EDITORIAL_RADAR_REFRESHED',
          'Editorial radar proactively researched direct, adjacent, audience-interest and timely trend opportunities.',
          {
            ...(radarState.summary || {}),
            nextEditorialRadarAt: addHours(completed, config.editorialRadarEveryHours)
          },
          radarState.summary?.hot ? 'success' : 'info'
        );
      } catch (error) {
        const retryAt = addHours(nowIso(), config.retryHours);
        await mutateState(current => {
          current.nextEditorialRadarAt = retryAt;
          return current;
        });
        await recordEvent(
          'EDITORIAL_RADAR_FAILED',
          'Editorial opportunity radar failed and will retry automatically.',
          { error: String(error.publicMessage || error.message || error).slice(0, 500), retryAt },
          'warning'
        );
      }
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

    const decisionState = await getState();
    const hotCandidate = editorialRadar.hottest(radarState);
    const articlesForDecision = await growthContent.listArticles();
    const publishedToday = await publishedCountToday(config, articlesForDecision);
    const morningDecisionMade = decisionState.lastPublishDecisionDateLocal === localDateKey(new Date(), config.publishTimeZone);
    const hotTrendDue = Boolean(
      !options.force &&
      !publishDue &&
      config.hotTrendAutoEvaluate &&
      hotCandidate &&
      morningDecisionMade &&
      hotCandidate.id !== decisionState.lastHotTrendOpportunityId &&
      publishedToday < config.maxArticlesPerLocalDay
    );
    const contentDecisionDue = publishDue || hotTrendDue;
    const decisionMode = options.force ? 'manual' : hotTrendDue ? 'hot' : 'daily';

    let publishedArticle = null;
    if (contentDecisionDue) {
      const articles = articlesForDecision;
      let strategy = null;
      let opportunity = null;

      if (hotTrendDue) {
        await mutateState(current => {
          current.lastHotTrendOpportunityId = hotCandidate.id;
          current.lastHotTrendEvaluatedAt = nowIso();
          return current;
        });
        await recordEvent(
          'HOT_TREND_EVALUATION_STARTED',
          'A high-confidence fresh editorial opportunity triggered an extra strategy evaluation outside the normal morning window.',
          {
            opportunityId: hotCandidate.id,
            topic: hotCandidate.topic,
            score: hotCandidate.score,
            freshness: hotCandidate.freshness,
            publishedToday
          },
          'info'
        );
      }

      try {
        strategy = await growthStrategy.plan({ opportunityMap, articles, siteProfile: opportunityMap?.siteProfile || null });
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
          let nextReview = decisionState.nextPublishAt || null;
          if (decisionMode !== 'hot') {
            await mutateState(current => {
              markDailyPublishDecision(current, config, new Date());
              nextReview = current.nextPublishAt;
              return current;
            });
          }
          await recordEvent(
            'STRATEGIC_ACTION_QUEUED',
            decisionMode === 'hot'
              ? 'AI Strategist reviewed the fresh opportunity and decided it does not justify an additional article.'
              : 'AI Strategist decided that creating a new article is not the best action right now. Autopilot will re-evaluate on the next scheduled decision.',
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
        publishedArticle = await produceAndPublish(opportunity, config, strategy, decisionMode);
      } else if (!strategy || (strategy.action === 'CREATE_ARTICLE' && strategy.publishRecommended)) {
        const nextRetry = decisionMode === 'hot' ? null : addHours(nowIso(), config.retryHours);
        if (nextRetry) {
          await mutateState(current => {
            current.nextPublishAt = nextRetry;
            return current;
          });
        }
        await recordEvent(
          'NO_CONTENT_OPPORTUNITY',
          decisionMode === 'hot'
            ? 'The fresh opportunity did not produce a sufficiently distinct publishable article. The normal editorial schedule remains unchanged.'
            : 'Autopilot found no sufficiently distinct content opportunity. It will retry automatically.',
          nextRetry ? { nextRetryAt: nextRetry } : { opportunityId: hotCandidate?.id || null },
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

    return { skipped: false, publishedArticle, radar: radarState?.summary || null, hotTrendEvaluated: hotTrendDue };
  } catch (error) {
    const message = String(error.publicMessage || error.message || 'Growth Autopilot cycle failed').slice(0, 800);
    const retryAt = addHours(nowIso(), config.retryHours);
    await mutateState(current => {
      current.nextIntelligenceAt = isDue(current.nextIntelligenceAt) ? retryAt : current.nextIntelligenceAt;
      current.nextAuthorityAt = isDue(current.nextAuthorityAt) ? retryAt : current.nextAuthorityAt;
      current.nextOptimizationAt = isDue(current.nextOptimizationAt) ? retryAt : current.nextOptimizationAt;
      current.nextEditorialRadarAt = isDue(current.nextEditorialRadarAt) ? retryAt : current.nextEditorialRadarAt;
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
  const scheduleChanged =
    current.dailyPublishTimeLocal !== next.dailyPublishTimeLocal
    || current.publishTimeZone !== next.publishTimeZone;
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
      if (scheduleChanged) {
        const now = new Date();
        const alreadyDecidedToday = state.lastPublishDecisionDateLocal === localDateKey(now, next.publishTimeZone);
        state.nextPublishAt = nextDailyPublishIso(now, next, alreadyDecidedToday);
      } else if (!state.nextPublishAt) {
        state.nextPublishAt = nextDailyPublishIso(new Date(), next);
      }
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
    const config = await getConfig();
    console.info('[growth-autopilot] runtime ready', {
      pollMinutes: POLL_MS / 60000,
      dailyPublishTimeLocal: config.dailyPublishTimeLocal,
      publishTimeZone: config.publishTimeZone,
      nextPublishAt: (await getState()).nextPublishAt,
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
  contentEligibleOpportunity,
  normalizeTimeOfDay,
  normalizeTimeZone,
  localDateKey,
  nextDailyPublishIso,
  dailyPublishDue,
  markDailyPublishDecision
};
