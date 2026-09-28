'use strict';

const { randomUUID } = require('crypto');
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
const PROCESS_LEASE_OWNER = randomUUID();

const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  intelligenceEveryHours: 24,
  configVersion: 10,
  publishEveryHours: 24,
  editorialRadarEveryHours: 6,
  hotTrendAutoEvaluate: true,
  dailyArticleTarget: 1,
  maxArticlesPerLocalDay: 2,
  dailyPublishTimeLocal: '07:30',
  publishTimeZone: 'Europe/London',
  authorityEveryHours: 6,
  authorityAutoEmail: true,
  optimizationEveryHours: 24,
  opportunityWindowDays: 28,
  visibilityPromptCount: 5,
  minQualityScore: 90,
  maxDraftAttempts: 3,
  autoGenerateImage: true,
  autoPublish: true,
  editorialRetryMinutes: 10,
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

function addMinutes(base, minutes) {
  return new Date(new Date(base).getTime() + Number(minutes) * 60 * 1000).toISOString();
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
    configVersion: Math.max(10, Number(value.configVersion || 0)),
    publishEveryHours: clampNumber(value.publishEveryHours, 24, 24, 336),
    editorialRadarEveryHours: clampNumber(value.editorialRadarEveryHours, 6, 3, 24),
    hotTrendAutoEvaluate: value.hotTrendAutoEvaluate !== false,
    dailyArticleTarget: clampNumber(value.dailyArticleTarget, 1, 1, 1),
    maxArticlesPerLocalDay: clampNumber(value.maxArticlesPerLocalDay, 2, 1, 3),
    dailyPublishTimeLocal: normalizeTimeOfDay(value.dailyPublishTimeLocal, '07:30'),
    publishTimeZone: normalizeTimeZone(value.publishTimeZone, 'Europe/London'),
    authorityEveryHours: clampNumber(value.authorityEveryHours, 6, 6, 48),
    authorityAutoEmail: value.authorityAutoEmail === true,
    optimizationEveryHours: clampNumber(value.optimizationEveryHours, 24, 12, 168),
    opportunityWindowDays: [7, 28, 90].includes(Number(value.opportunityWindowDays)) ? Number(value.opportunityWindowDays) : 28,
    visibilityPromptCount: clampNumber(value.visibilityPromptCount, 5, 1, 5),
    minQualityScore: clampNumber(value.minQualityScore, 90, 65, 95),
    maxDraftAttempts: clampNumber(value.maxDraftAttempts, 3, 1, 3),
    autoGenerateImage: value.autoGenerateImage !== false,
    autoPublish: value.autoPublish !== false,
    editorialRetryMinutes: clampNumber(value.editorialRetryMinutes, 10, 5, 30),
    retryHours: clampNumber(value.retryHours, 6, 1, 24)
  };
}

function initialState() {
  const now = nowIso();
  return {
    running: false,
    leaseUntil: null,
    leaseOwner: null,
    lastCycleStartedAt: null,
    lastCycleFinishedAt: null,
    lastIntelligenceAt: null,
    lastAuthorityAt: null,
    lastOptimizationAt: null,
    lastEditorialRadarAt: null,
    lastPublishedAt: null,
    lastPublishDecisionDateLocal: null,
    lastDailyArticleAttemptAt: null,
    lastDailyArticleAttemptStatus: null,
    editorialRuntime: {
      status: 'IDLE',
      articleId: null,
      title: null,
      pass: null,
      retryAt: null,
      updatedAt: now,
      message: 'Waiting for the next editorial run.'
    },
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
  const needsV7Migration = !rawConfig || Number(rawConfig.configVersion || 0) < 7;
  const needsV8Migration = !rawConfig || Number(rawConfig.configVersion || 0) < 8;
  const needsV9Migration = !rawConfig || Number(rawConfig.configVersion || 0) < 9;
  const needsV10Migration = !rawConfig || Number(rawConfig.configVersion || 0) < 10;
  const config = normalizeConfig({
    ...(rawConfig || DEFAULT_CONFIG),
    ...(needsV4Migration ? { authorityEveryHours: 6, authorityAutoEmail: true, optimizationEveryHours: 24 } : {}),
    ...(needsV5Migration ? { dailyPublishTimeLocal: '07:30', publishTimeZone: 'Europe/London' } : {}),
    ...(needsV6Migration ? { configVersion: 6, editorialRadarEveryHours: 6, hotTrendAutoEvaluate: true, maxArticlesPerLocalDay: 2 } : {}),
    ...(needsV7Migration ? { configVersion: 7, minQualityScore: 90, maxDraftAttempts: 3 } : {}),
    ...(needsV8Migration ? { configVersion: 8, dailyArticleTarget: 1 } : {}),
    ...(needsV9Migration ? { configVersion: 9 } : {}),
    ...(needsV10Migration ? { configVersion: 10, editorialRetryMinutes: 10 } : {})
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
  } else if (needsV4Migration || needsV5Migration || needsV6Migration || needsV7Migration || needsV8Migration || needsV9Migration || needsV10Migration) {
    const state = { ...initialState(), ...(safeJson(existingState.value, {}) || {}) };
    state.running = false;
    state.leaseUntil = null;
    state.leaseOwner = null;
    state.nextIntelligenceAt = nowIso();
    state.nextAuthorityAt = nowIso();
    state.nextOptimizationAt = nowIso();
    state.nextEditorialRadarAt = nowIso();
    state.lastPublishDecisionDateLocal = (needsV8Migration || needsV9Migration || needsV10Migration) ? null : state.lastPublishDecisionDateLocal;
    state.nextPublishAt = (needsV8Migration || needsV9Migration || needsV10Migration) ? nowIso() : nextDailyPublishIso(new Date(), config);
    if (needsV10Migration) {
      state.lastDailyArticleAttemptStatus = 'RECOVERY_DUE';
      state.editorialRuntime = {
        ...(state.editorialRuntime || {}),
        status: 'RECOVERY_DUE',
        retryAt: nowIso(),
        updatedAt: nowIso(),
        message: 'Immediate editorial recovery enabled; resume any interrupted draft before selecting a new topic.'
      };
    }
    state.recentEvents = [{
      at: nowIso(),
      type: 'AUTOPILOT_UPGRADED',
      level: 'success',
      message: needsV10Migration
        ? 'Growth Autopilot upgraded with immediate in-process editorial repair, 10-minute outage recovery and interrupted-draft resume.'
        : needsV9Migration
        ? 'Growth Autopilot upgraded with deployment-safe lease ownership and immediate recovery of interrupted editorial cycles.'
        : needsV8Migration
        ? 'Growth Autopilot upgraded to a mandatory daily editorial lane with live trend discovery and same-day retries.'
        : needsV7Migration
        ? 'Growth Autopilot upgraded to a 90+ senior-editorial repair workflow.'
        : needsV6Migration
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

function editorialRuntimeForEvent(event, current = {}) {
  const meta = event.metadata || {};
  let status = null;
  if (event.type === 'AI_STRATEGY_DECIDED' && meta.action === 'CREATE_ARTICLE') status = 'RESEARCHING';
  if (event.type === 'EDITORIAL_DRAFT_RECOVERY_SELECTED') status = 'RESUMING';
  if (event.type === 'EDITORIAL_DRAFT_RESUMED') status = 'REVIEWING';
  if (event.type === 'DRAFT_GENERATED') status = 'REVIEWING';
  if (event.type === 'EDITORIAL_REVISION_REQUESTED') status = 'REPAIRING';
  if (event.type === 'EDITORIAL_REPAIR_STARTED') status = 'REPAIRING';
  if (event.type === 'EDITORIAL_REPAIR_RETRY') status = 'REPAIRING';
  if (event.type === 'ARTICLE_REVISED') status = 'REVIEWING';
  if (event.type === 'EDITORIAL_REVIEW_PASSED') status = 'FINAL_CHECK';
  if (event.type === 'IMAGE_GENERATED' || event.type === 'IMAGE_SKIPPED') status = 'PUBLISHING';
  if (event.type === 'ARTICLE_PUBLISHED') status = 'PUBLISHED';
  if (event.type === 'DAILY_ARTICLE_TARGET_ALREADY_MET') status = 'IDLE';
  if (['DAILY_ARTICLE_SELECTION_RETRY','EDITORIAL_PIPELINE_DEFERRED','NO_CONTENT_OPPORTUNITY','EDITORIAL_REVIEW_BLOCKED','EDITORIAL_REPAIR_BLOCKED'].includes(event.type)) status = 'RETRY_SCHEDULED';
  if (event.type === 'CYCLE_FAILED' && meta.editorialRetryAt) status = 'RETRY_SCHEDULED';
  if (!status) return null;
  return {
    ...current,
    status,
    articleId: meta.articleId ?? current.articleId ?? null,
    title: meta.title ?? current.title ?? null,
    pass: meta.pass ?? current.pass ?? null,
    retryAt: meta.nextRetryAt || meta.editorialRetryAt || (status === 'PUBLISHED' || status === 'IDLE' ? null : current.retryAt || null),
    updatedAt: event.at,
    message: event.message
  };
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
    const editorialRuntime = editorialRuntimeForEvent(event, state.editorialRuntime || {});
    if (editorialRuntime) state.editorialRuntime = editorialRuntime;
    return state;
  });
  console.info('[growth-autopilot:event]', {
    type: event.type,
    level: event.level,
    message: event.message,
    metadata: event.metadata
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
      state.leaseOwner = PROCESS_LEASE_OWNER;
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
  let released = false;
  await mutateState(state => {
    if (!state.running || state.leaseOwner !== PROCESS_LEASE_OWNER) return state;
    state.running = false;
    state.leaseUntil = null;
    state.leaseOwner = null;
    state.lastCycleFinishedAt = nowIso();
    released = true;
    return state;
  });
  return released;
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

  return null;
}

async function archiveEditorialDraft(article, reason, metadata = {}) {
  try {
    await growthContent.archiveArticle(article.id);
  } catch (_) {}
  await recordEvent(
    'EDITORIAL_DRAFT_DEFERRED',
    reason,
    {
      articleId: article.id,
      title: article.title,
      qualityScore: article.quality?.score || 0,
      ...(metadata || {})
    },
    'warning'
  );
}

function editorialCandidateQueue(opportunityMap, articles, preferred = null, limit = 3) {
  const active = (articles || []).filter(article => article.status !== growthContent.STATUS.ARCHIVED);
  const queue = [];

  const add = candidate => {
    if (!candidate || !contentEligibleOpportunity(candidate)) return;
    if (queue.some(item =>
      (candidate.id && item.id === candidate.id)
      || growthOpportunities.similarity(candidate.topic, item.topic) >= 0.72
    )) return;
    const duplicatesExisting = active.some(article =>
      (candidate.id && article.opportunity_id === candidate.id)
      || growthOpportunities.similarity(candidate.topic, article.title) >= 0.58
      || growthOpportunities.similarity(candidate.topic, article.research_brief?.summary || '') >= 0.64
    );
    if (duplicatesExisting) return;
    queue.push(candidate);
  };

  add(preferred);
  [...(opportunityMap?.opportunities || [])]
    .filter(contentEligibleOpportunity)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .forEach(add);

  return queue.slice(0, Math.max(1, limit));
}

function criticRequiresFreshResearch(critic, backendIssues = []) {
  if (critic?.factualRisk === 'high') return true;
  return [...(critic?.requiredFixes || []), ...(critic?.issues || []), ...(backendIssues || [])]
    .some(item => /source|citation|evidence|fact|claim|verify|current|outdated|accuracy/i.test(String(item || '')));
}

async function reviewDraftWithImmediateRetry(article, opportunity, strategy, pass) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await growthStrategy.reviewDraft({ article, opportunity, strategy, siteProfile: strategy?.siteProfile || null });
    } catch (error) {
      lastError = error;
      await recordEvent(
        'EDITORIAL_EDITOR_RETRY',
        'Senior-editor request failed temporarily; retrying immediately without parking the article.',
        {
          articleId: article.id,
          title: article.title,
          pass,
          attempt,
          error: String(error.publicMessage || error.message || error).slice(0, 400)
        },
        'warning'
      );
    }
  }
  throw lastError || new Error('Senior editorial review failed.');
}

async function produceAndPublish(opportunity, config, strategy = null, decisionMode = 'daily', existingArticle = null) {
  const draftInput = opportunity.id ? {
    opportunityId: opportunity.id,
    notes: 'Autopilot publication. Produce a senior-editorial, evidence-led article that is useful without promotional filler. Target at least 90/100 backend editorial quality on the first pass. The article must stand on its own for readers and AI search systems.' + (opportunity.radar ? ' Editorial radar evidence: ' + JSON.stringify(opportunity.radar) : '') + (strategy?.executionBrief ? ' Strategist brief: ' + JSON.stringify(strategy.executionBrief) : '')
  } : {
    topic: opportunity.topic,
    intent: opportunity.intent || 'commercial',
    action: opportunity.action?.label || 'Build authority content',
    notes: 'Autopilot publication. Produce a senior-editorial, evidence-led article that is useful without promotional filler. Target at least 90/100 backend editorial quality on the first pass. The article must stand on its own for readers and AI search systems.' + (opportunity.radar ? ' Editorial radar evidence: ' + JSON.stringify(opportunity.radar) : '') + (strategy?.executionBrief ? ' Strategist brief: ' + JSON.stringify(strategy.executionBrief) : '')
  };

  let article = existingArticle || await growthContent.createDraft(draftInput);

  await recordEvent(
    existingArticle ? 'EDITORIAL_DRAFT_RESUMED' : 'DRAFT_GENERATED',
    existingArticle
      ? 'Autopilot resumed the interrupted draft immediately instead of creating another article.'
      : 'Senior SEO writer researched the selected topic and produced the first publication draft.',
    {
      articleId: article.id,
      title: article.title,
      qualityScore: Number(article.quality?.score || 0),
      qualityTarget: config.minQualityScore,
      opportunityId: opportunity.id,
      opportunityScore: opportunity.score,
      pass: Number(article.generation?.revisionNumber || 0) + 1
    },
    'info'
  );

  for (let pass = 1; pass <= config.maxDraftAttempts; pass += 1) {
    const backendScore = Number(article.quality?.score || 0);
    let critic = null;

    try {
      critic = await reviewDraftWithImmediateRetry(article, opportunity, strategy, pass);
    } catch (error) {
      await recordEvent(
        'EDITORIAL_REVIEW_BLOCKED',
        'Senior-editor provider remained unavailable after immediate retries. The draft is preserved for a short automatic retry.',
        {
          articleId: article.id,
          title: article.title,
          pass,
          error: String(error.publicMessage || error.message || error).slice(0, 400)
        },
        'warning'
      );
      throw error;
    }

    const disposition = critic.disposition || (critic.approve ? 'APPROVE' : 'REVISE');
    const publishReady = disposition === 'APPROVE'
      && critic.approve
      && backendScore >= config.minQualityScore
      && Number(critic.score || 0) >= config.minQualityScore
      && critic.factualRisk !== 'high'
      && critic.duplicationRisk !== 'high';

    await recordEvent(
      publishReady ? 'EDITORIAL_REVIEW_PASSED' : disposition === 'SWITCH_TOPIC' ? 'EDITORIAL_TOPIC_UNSUITABLE' : 'EDITORIAL_REVISION_REQUESTED',
      publishReady
        ? 'Senior editorial review confirmed the article is publication-ready.'
        : disposition === 'SWITCH_TOPIC'
          ? 'Senior editor found a fundamental topic-level issue, so Autopilot will move to another qualified topic.'
          : 'Senior editor requested targeted improvements; Sol is applying the fixes immediately in the same production run.',
      {
        articleId: article.id,
        title: article.title,
        pass,
        backendQualityScore: backendScore,
        criticScore: critic.score,
        qualityTarget: config.minQualityScore,
        searchIntentMatch: critic.searchIntentMatch,
        factualRisk: critic.factualRisk,
        duplicationRisk: critic.duplicationRisk,
        disposition,
        summary: critic.summary,
        issues: critic.issues || [],
        requiredFixes: critic.requiredFixes || []
      },
      publishReady ? 'success' : 'warning'
    );

    if (publishReady) {
      if (config.autoGenerateImage) {
        try {
          article = await growthContent.generateFeaturedImage(article.id);
          await recordEvent(
            'IMAGE_GENERATED',
            'Autopilot generated and stored the article featured image.',
            { articleId: article.id, title: article.title, pass },
            'success'
          );
        } catch (error) {
          await recordEvent(
            'IMAGE_SKIPPED',
            'Article passed editorial review but featured-image generation was unavailable; publishing continues without blocking the article.',
            { articleId: article.id, title: article.title, pass, error: String(error.publicMessage || error.message || 'Image generation failed').slice(0, 400) },
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
          state.lastDailyArticleAttemptStatus = 'PUBLISHED';
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
          'Autopilot published a researched, senior-editor-reviewed article to the INXSocial blog.',
          {
            articleId: article.id,
            title: article.title,
            slug: article.slug,
            qualityScore: article.quality?.score || 0,
            criticScore: critic.score,
            opportunityScore: opportunity.score,
            pass
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
        'Autopilot produced and approved a 90+ editorial article. Automatic publishing is disabled, so it remains approved.',
        { articleId: article.id, title: article.title, qualityScore: article.quality?.score || 0, criticScore: critic.score, pass },
        'success'
      );
      return article;
    }

    if (disposition === 'SWITCH_TOPIC' || critic.duplicationRisk === 'high') {
      await archiveEditorialDraft(
        article,
        'This topic/angle was deferred because the senior editor identified a fundamental duplication, cannibalisation or topic-fit problem.',
        {
          pass,
          disposition,
          criticScore: critic.score,
          summary: critic.summary,
          requiredFixes: critic.requiredFixes || []
        }
      );
      return null;
    }

    if (pass >= config.maxDraftAttempts) {
      await archiveEditorialDraft(
        article,
        'The article did not reach the 90+ publication standard after immediate targeted editorial revisions, so Autopilot will try another qualified topic now instead of publishing weak content.',
        {
          pass,
          criticScore: critic.score,
          summary: critic.summary,
          requiredFixes: critic.requiredFixes || []
        }
      );
      return null;
    }

    await recordEvent(
      'EDITORIAL_REPAIR_STARTED',
      'Sol started the requested repair immediately; normal editorial quality fixes never wait for another scheduler cycle.',
      {
        articleId: article.id,
        title: article.title,
        pass,
        criticScore: critic.score,
        fixes: critic.requiredFixes || []
      },
      'info'
    );

    try {
      article = await growthContent.reviseDraft(article.id, critic, {
        backendIssues: article.quality?.issues || [],
        refreshResearch: criticRequiresFreshResearch(critic, article.quality?.issues || [])
      });
    } catch (error) {
      await recordEvent(
        'EDITORIAL_REPAIR_RETRY',
        'The first repair attempt hit a temporary research/writer failure; retrying immediately with the draft’s existing verified evidence.',
        {
          articleId: article.id,
          title: article.title,
          pass,
          error: String(error.publicMessage || error.message || error).slice(0, 400)
        },
        'warning'
      );
      try {
        article = await growthContent.reviseDraft(article.id, critic, {
          backendIssues: article.quality?.issues || [],
          refreshResearch: false,
          suppressFreshResearch: true
        });
      } catch (retryError) {
        await recordEvent(
          'EDITORIAL_REPAIR_BLOCKED',
          'Immediate repair retries were exhausted. The draft is preserved and will resume automatically after a short provider-recovery delay.',
          {
            articleId: article.id,
            title: article.title,
            pass,
            error: String(retryError.publicMessage || retryError.message || retryError).slice(0, 400)
          },
          'warning'
        );
        throw retryError;
      }
    }

    await recordEvent(
      'ARTICLE_REVISED',
      'Sol revised the existing article using the senior editor’s exact fixes and is sending it straight back for final review.',
      {
        articleId: article.id,
        title: article.title,
        pass: pass + 1,
        qualityScore: Number(article.quality?.score || 0),
        qualityTarget: config.minQualityScore,
        researchFallbackUsed: Boolean(article.generation?.researchFallbackUsed),
        fixesApplied: critic.requiredFixes || []
      },
      'info'
    );
  }

  return null;
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
    if (!opportunityMap || (intelligenceDue && !publishDue)) {
      const intelligence = await runIntelligence(config);
      opportunityMap = intelligence.opportunityMap;
    }


    let radarState = await editorialRadar.latest().catch(() => null);
    if (radarDue && !publishDue) {
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

    if (authorityDue && !publishDue) {
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

    if (optimizationDue && !publishDue) {
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
    let contentDecisionDue = publishDue || hotTrendDue;
    const decisionMode = options.force ? 'manual' : hotTrendDue ? 'hot' : 'daily';

    let publishedArticle = null;
    if (contentDecisionDue && decisionMode === 'daily' && publishedToday >= config.dailyArticleTarget) {
      await mutateState(current => {
        markDailyPublishDecision(current, config, new Date());
        current.lastDailyArticleAttemptStatus = 'TARGET_ALREADY_MET';
        return current;
      });
      await recordEvent(
        'DAILY_ARTICLE_TARGET_ALREADY_MET',
        'Today\'s daily article target is already satisfied; the normal editorial lane will resume tomorrow.',
        { publishedToday, dailyArticleTarget: config.dailyArticleTarget },
        'success'
      );
      contentDecisionDue = false;
    }

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

      const dailyArticleLane = decisionMode !== 'hot';
      const recentEditorialEvent = dailyArticleLane
        ? (decisionState.recentEvents || []).find(event =>
            event?.metadata?.articleId
            && ['EDITORIAL_REVISION_REQUESTED','EDITORIAL_REPAIR_STARTED','EDITORIAL_REPAIR_RETRY','ARTICLE_REVISED','DRAFT_GENERATED','EDITORIAL_REVIEW_BLOCKED','EDITORIAL_REPAIR_BLOCKED'].includes(event.type)
          )
        : null;
      const recoverableDraft = recentEditorialEvent
        ? articles.find(article => article.id === recentEditorialEvent.metadata.articleId && article.status === growthContent.STATUS.DRAFT) || null
        : null;

      if (recoverableDraft) {
        opportunity = (opportunityMap?.opportunities || []).find(item => item.id === recoverableDraft.opportunity_id) || {
          id: recoverableDraft.opportunity_id || null,
          topic: recoverableDraft.title,
          score: Number(recoverableDraft.opportunity_score || 70),
          type: recoverableDraft.opportunity_type || 'editorial_recovery',
          intent: recoverableDraft.intent || 'informational',
          action: {
            type: 'BUILD_AUTHORITY_CONTENT',
            label: recoverableDraft.recommended_action || 'Resume interrupted article',
            rationale: 'Resume the existing editorial draft before selecting another topic.'
          }
        };
        strategy = {
          action: 'CREATE_ARTICLE',
          publishRecommended: true,
          selectedOpportunityId: recoverableDraft.opportunity_id || null,
          topic: recoverableDraft.title,
          confidence: 100,
          rationale: 'An interrupted Autopilot draft exists and must be completed before starting another daily article.',
          evidence: [],
          risks: [],
          executionBrief: { audience: '', angle: 'Resume the existing draft', mustCover: [], avoid: [] },
          recoveryMode: true
        };
        await mutateState(current => {
          current.lastStrategy = strategy;
          current.lastDailyArticleAttemptAt = nowIso();
          current.lastDailyArticleAttemptStatus = 'RESUMING_DRAFT';
          return current;
        });
        await recordEvent(
          'EDITORIAL_DRAFT_RECOVERY_SELECTED',
          'Autopilot found an interrupted draft and will resume it immediately before selecting a new topic.',
          {
            articleId: recoverableDraft.id,
            title: recoverableDraft.title,
            opportunityId: recoverableDraft.opportunity_id || null,
            qualityScore: Number(recoverableDraft.quality?.score || 0)
          },
          'success'
        );
      } else {
        try {
          strategy = dailyArticleLane
            ? await growthStrategy.planDailyArticle({
              opportunityMap,
              articles,
              siteProfile: opportunityMap?.siteProfile || null,
              minOpportunityScore: 70
            })
            : await growthStrategy.plan({ opportunityMap, articles, siteProfile: opportunityMap?.siteProfile || null });
          await mutateState(current => {
            current.lastStrategy = strategy;
            if (dailyArticleLane) {
              current.lastDailyArticleAttemptAt = nowIso();
              current.lastDailyArticleAttemptStatus = 'TOPIC_SELECTED';
            }
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
              rationale: strategy.rationale,
              discoveryMode: strategy.discoveryMode || null,
              qualifiedBacklogCount: strategy.qualifiedBacklogCount ?? null
            },
            strategy.action === 'CREATE_ARTICLE' ? 'success' : 'info'
          );

          if (strategy.action === 'CREATE_ARTICLE' && strategy.publishRecommended) {
            opportunity = (opportunityMap?.opportunities || []).find(item => item.id === strategy.selectedOpportunityId) || null;
            if (!opportunity && strategy.topic) {
              opportunity = {
                id: null,
                topic: strategy.topic,
                score: decisionMode === 'hot' ? 60 : 70,
                type: strategy.discoveryMode === 'LIVE_TREND_DISCOVERY' ? 'ai_trend_discovery' : 'ai_strategy',
                intent: 'commercial',
                action: {
                  type: 'BUILD_AUTHORITY_CONTENT',
                  label: 'AI Strategist article',
                  rationale: strategy.rationale
                }
              };
            }
          } else if (decisionMode === 'hot') {
            await recordEvent(
              'STRATEGIC_ACTION_QUEUED',
              'AI Strategist reviewed the fresh opportunity and decided it does not justify an additional article.',
              {
                action: strategy.action,
                topic: strategy.topic,
                rationale: strategy.rationale,
                nextReviewAt: decisionState.nextPublishAt || null
              },
              'info'
            );
          } else {
            const nextRetry = addMinutes(nowIso(), config.editorialRetryMinutes);
            await mutateState(current => {
              current.nextPublishAt = nextRetry;
              current.lastDailyArticleAttemptStatus = 'RETRY_SCHEDULED';
              return current;
            });
            await recordEvent(
              'DAILY_ARTICLE_SELECTION_RETRY',
              'The dedicated daily article lane did not return a usable article decision, so it will retry shortly instead of consuming today’s publishing slot.',
              {
                action: strategy.action,
                topic: strategy.topic,
                rationale: strategy.rationale,
                nextRetryAt: nextRetry
              },
              'warning'
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
      }

      if (opportunity) {
        const attemptedTopics = [];

        if (recoverableDraft) {
          attemptedTopics.push(recoverableDraft.title);
          publishedArticle = await produceAndPublish(opportunity, config, strategy, decisionMode, recoverableDraft);
        }

        if (!publishedArticle) {
          const candidateArticles = recoverableDraft
            ? articles.filter(article => article.id !== recoverableDraft.id)
            : articles;
          const candidates = editorialCandidateQueue(
            opportunityMap,
            candidateArticles,
            recoverableDraft ? null : opportunity,
            5
          );

          for (let topicIndex = 0; topicIndex < candidates.length && !publishedArticle; topicIndex += 1) {
            const candidate = candidates[topicIndex];
            if (topicIndex > 0 || recoverableDraft) {
              await recordEvent(
                'EDITORIAL_NEXT_TOPIC_SELECTED',
                recoverableDraft && topicIndex === 0
                  ? 'The recovered draft could not clear the publication standard, so Autopilot moved immediately to the next qualified topic.'
                  : 'The previous article could not reach publication standard, so the strategist moved immediately to the next qualified topic.',
                {
                  previousTopic: attemptedTopics[attemptedTopics.length - 1] || null,
                  nextTopic: candidate.topic,
                  nextOpportunityId: candidate.id || null,
                  nextOpportunityScore: candidate.score || null
                },
                'info'
              );
            }
            attemptedTopics.push(candidate.topic);
            try {
              publishedArticle = await produceAndPublish(candidate, config, strategy, decisionMode);
            } catch (error) {
              if (['CONTENT_RESEARCH_EMPTY','CONTENT_RESEARCH_EVIDENCE_WEAK','CONTENT_DRAFT_INVALID'].includes(String(error.code || ''))) {
                await recordEvent(
                  'EDITORIAL_TOPIC_ATTEMPT_FAILED',
                  'This topic could not build a reliable evidence-backed draft after immediate retries, so Autopilot is trying the next qualified topic now.',
                  {
                    topic: candidate.topic,
                    opportunityId: candidate.id || null,
                    error: String(error.publicMessage || error.message || error).slice(0, 400)
                  },
                  'warning'
                );
                continue;
              }
              throw error;
            }
          }
        }

        if (!publishedArticle && decisionMode !== 'hot') {
          const nextRetry = addMinutes(nowIso(), config.editorialRetryMinutes);
          await mutateState(current => {
            current.nextPublishAt = nextRetry;
            current.lastDailyArticleAttemptStatus = 'RETRY_SCHEDULED';
            return current;
          });
          await recordEvent(
            'EDITORIAL_PIPELINE_DEFERRED',
            'Autopilot exhausted the strongest qualified topics without a 90+ publishable article. It will retry after a short provider/evidence recovery window, not hours later.',
            { attemptedTopics, nextRetryAt: nextRetry },
            'warning'
          );
        }
      } else if (!strategy || (strategy.action === 'CREATE_ARTICLE' && strategy.publishRecommended)) {
        const nextRetry = decisionMode === 'hot' ? null : addMinutes(nowIso(), config.editorialRetryMinutes);
        if (nextRetry) {
          await mutateState(current => {
            current.nextPublishAt = nextRetry;
            current.lastDailyArticleAttemptStatus = 'RETRY_SCHEDULED';
            return current;
          });
        }
        await recordEvent(
          'NO_CONTENT_OPPORTUNITY',
          decisionMode === 'hot'
            ? 'The fresh opportunity did not produce a sufficiently distinct publishable article. The normal editorial schedule remains unchanged.'
            : 'Autopilot found no sufficiently distinct content opportunity. It will retry shortly with fresh discovery.',
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
    const editorialRetryAt = publishDue ? addMinutes(nowIso(), config.editorialRetryMinutes) : null;
    await mutateState(current => {
      current.nextIntelligenceAt = isDue(current.nextIntelligenceAt) ? retryAt : current.nextIntelligenceAt;
      current.nextAuthorityAt = isDue(current.nextAuthorityAt) ? retryAt : current.nextAuthorityAt;
      current.nextOptimizationAt = isDue(current.nextOptimizationAt) ? retryAt : current.nextOptimizationAt;
      current.nextEditorialRadarAt = isDue(current.nextEditorialRadarAt) ? retryAt : current.nextEditorialRadarAt;
      current.nextPublishAt = editorialRetryAt || (isDue(current.nextPublishAt) ? retryAt : current.nextPublishAt);
      if (editorialRetryAt) current.lastDailyArticleAttemptStatus = 'RETRY_SCHEDULED';
      current.lastError = { at: nowIso(), message };
      return current;
    });
    await recordEvent(
      'CYCLE_FAILED',
      message,
      { retryAt, editorialRetryAt },
      'error'
    );
    console.error('[growth-autopilot] cycle failed', { error: message, editorialRetryAt });
    return { skipped: false, error: message };
  } finally {
    await releaseLease();
  }
}

async function status() {
  const [config, state, contentOverview, opportunityMap, radarStatus, seoStatus, authorityStatus, optimizationStatus] = await Promise.all([
    getConfig(),
    getState(),
    growthContent.overview().catch(() => null),
    growthOpportunities.latest().catch(() => null),
    editorialRadar.latest().catch(() => null),
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
    editorialRadar: radarStatus ? {
      generatedAt: radarStatus.generatedAt,
      summary: radarStatus.summary,
      top: (radarStatus.candidates || []).slice(0, 6).map(item => ({
        id: item.id,
        topic: item.topic,
        category: item.category,
        score: item.score,
        freshness: item.freshness,
        hot: Boolean(item.hot)
      }))
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
      if (!state.nextEditorialRadarAt) state.nextEditorialRadarAt = nowIso();
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

async function stopGrowthAutopilot() {
  if (initialTimer) clearTimeout(initialTimer);
  if (timer) clearInterval(timer);
  if (legacyImportTimer) clearInterval(legacyImportTimer);
  if (seoStartupTimer) clearTimeout(seoStartupTimer);
  initialTimer = null;
  timer = null;
  legacyImportTimer = null;
  seoStartupTimer = null;

  try {
    const released = await releaseLease();
    if (released) {
      console.info('[growth-autopilot] released owned lease during shutdown', {
        leaseOwner: PROCESS_LEASE_OWNER
      });
    }
  } catch (error) {
    console.warn('[growth-autopilot] shutdown lease release failed', {
      error: error?.message || String(error)
    });
  }
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
