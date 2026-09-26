'use strict';

const crypto = require('crypto');
const prisma = require('../db/prisma');
const env = require('../config/env');
const ga4 = require('./googleAnalyticsService');
const gsc = require('./googleSearchConsoleService');
const growthContent = require('./growthContentService');
const seoMaintenance = require('./growthSeoMaintenanceService');
const authority = require('./growthAuthorityService');
const attribution = require('./growthAttributionService');
const stripeService = require('./stripeService');

const STATE_KEY = 'growth_optimization_state_v1';
const ACTION_TYPES = Object.freeze({
  REFRESH_CONTENT: 'REFRESH_CONTENT',
  OPTIMIZE_CTR_META: 'OPTIMIZE_CTR_META',
  CONSOLIDATE_CANNIBALIZATION: 'CONSOLIDATE_CANNIBALIZATION',
  IMPROVE_CRO: 'IMPROVE_CRO',
  ADD_INTERNAL_LINKS: 'ADD_INTERNAL_LINKS',
  FIX_TECHNICAL_SEO: 'FIX_TECHNICAL_SEO',
  REINFORCE_AI_VISIBILITY: 'REINFORCE_AI_VISIBILITY',
  REPURPOSE_SOCIAL: 'REPURPOSE_SOCIAL',
  SCALE_WINNING_SOURCE: 'SCALE_WINNING_SOURCE'
});

function nowIso() { return new Date().toISOString(); }
function safeJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}
function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}
function cleanPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '/';
  try {
    const url = new URL(raw, 'https://www.inxsocial.co.uk');
    return url.pathname || '/';
  } catch (_) {
    return raw.startsWith('/') ? raw.split('?')[0] : '/';
  }
}
function actionId(type, target, signal = '') {
  return crypto.createHash('sha1').update([type, target, signal].join('|')).digest('hex').slice(0, 18);
}
function pct(value) { return Math.round(Number(value || 0) * 1000) / 10; }
function ageDays(value) {
  const ms = Date.now() - new Date(value || 0).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86400000)) : 0;
}
function articleForPath(articles, path) {
  const clean = cleanPath(path);
  return articles.find(article => clean === '/blog/' + article.slug) || null;
}
function previousStatusMap(state) {
  return new Map((state?.actions || []).map(item => [item.id, item]));
}
function makeAction(input, previous) {
  const id = actionId(input.type, input.target || '', input.signal || '');
  const old = previous.get(id);
  return {
    id,
    type: input.type,
    target: input.target || '',
    articleId: input.articleId || null,
    title: input.title || input.type.replaceAll('_', ' '),
    score: clampScore(input.score),
    risk: input.risk || 'LOW',
    mode: input.mode || 'REVIEW',
    reason: input.reason || '',
    evidence: Array.isArray(input.evidence) ? input.evidence.slice(0, 8) : [],
    metrics: input.metrics || {},
    proposal: old?.proposal || null,
    status: old?.status && old.status !== 'SUPERSEDED' ? old.status : 'PROPOSED',
    note: old?.note || null,
    createdAt: old?.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

function detectCannibalisation(gscData, previous) {
  const grouped = new Map();
  for (const row of gscData?.queryPages || []) {
    const query = String(row.query || '').trim();
    if (!query || Number(row.impressions || 0) < 3) continue;
    if (!grouped.has(query)) grouped.set(query, []);
    grouped.get(query).push(row);
  }
  const actions = [];
  for (const [query, rows] of grouped.entries()) {
    const meaningful = rows
      .filter(row => Number(row.impressions || 0) >= 3)
      .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0));
    const distinct = [...new Set(meaningful.map(row => cleanPath(row.page)))];
    const impressions = meaningful.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
    if (distinct.length < 2 || impressions < 20) continue;
    actions.push(makeAction({
      type: ACTION_TYPES.CONSOLIDATE_CANNIBALIZATION,
      target: query,
      signal: distinct.join(','),
      title: 'Resolve competing pages for “' + query + '”',
      score: Math.min(92, 52 + Math.log10(impressions + 1) * 12 + distinct.length * 5),
      risk: 'HIGH',
      mode: 'REVIEW',
      reason: 'Multiple INXSocial URLs are receiving impressions for the same query. Consolidation, canonical or intent separation should be reviewed before changing URLs.',
      evidence: meaningful.slice(0, 5).map(row => cleanPath(row.page) + ': ' + Number(row.impressions || 0) + ' impressions, ' + pct(row.ctr) + '% CTR'),
      metrics: { query, pages: distinct, impressions }
    }, previous));
  }
  return actions;
}

function detectSearchActions(gscData, articles, previous) {
  const actions = [];
  for (const row of (gscData?.opportunities || []).slice(0, 20)) {
    const matching = (gscData.queryPages || [])
      .filter(item => item.query === row.query)
      .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))[0];
    const target = matching?.page || '';
    const article = articleForPath(articles, target);
    actions.push(makeAction({
      type: ACTION_TYPES.OPTIMIZE_CTR_META,
      target: cleanPath(target || '/'),
      articleId: article?.id || null,
      signal: row.query,
      title: 'Improve search CTR for “' + row.query + '”',
      score: Math.min(96, 55 + Math.log10(Number(row.impressions || 0) + 1) * 14 + Math.max(0, 12 - Number(row.position || 0))),
      risk: article ? 'MEDIUM' : 'HIGH',
      mode: article ? 'APPLY_ON_APPROVAL' : 'REVIEW',
      reason: 'This query has meaningful impressions but underperforms the expected click opportunity for its current position.',
      evidence: [
        Number(row.impressions || 0) + ' impressions',
        pct(row.ctr) + '% CTR',
        'Average position ' + Number(row.position || 0).toFixed(1)
      ],
      metrics: { query: row.query, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }
    }, previous));
  }

  const previousPages = new Map((gscData?.previousTopPages || []).map(row => [cleanPath(row.page), row]));
  for (const page of (gscData?.topPages || [])) {
    const path = cleanPath(page.page);
    const article = articleForPath(articles, path);
    if (!article) continue;
    const prior = previousPages.get(path);
    const oldEnough = ageDays(article.published_at || article.created_at) >= 45;
    const currentClicks = Number(page.clicks || 0);
    const previousClicks = Number(prior?.clicks || 0);
    const decayed = prior && previousClicks >= 5 && currentClicks <= previousClicks * 0.72;
    const underused = Number(page.impressions || 0) >= 50 && currentClicks <= 3;
    if (!oldEnough || (!decayed && !underused)) continue;
    actions.push(makeAction({
      type: ACTION_TYPES.REFRESH_CONTENT,
      target: path,
      articleId: article.id,
      signal: 'search-decay',
      title: 'Refresh ' + article.title,
      score: Math.min(95, 62 + (decayed ? 18 : 8) + Math.log10(Number(page.impressions || 0) + 1) * 5),
      risk: 'MEDIUM',
      mode: 'APPLY_ON_APPROVAL',
      reason: decayed
        ? 'This published article has lost search clicks versus the previous comparison window.'
        : 'This older article has search visibility but very few clicks, indicating stale or incomplete intent coverage.',
      evidence: [
        'Published ' + ageDays(article.published_at || article.created_at) + ' days ago',
        Number(page.impressions || 0) + ' current impressions',
        currentClicks + ' current clicks',
        prior ? previousClicks + ' previous-period clicks' : 'No previous-period page baseline'
      ],
      metrics: { currentClicks, previousClicks, impressions: page.impressions, ctr: page.ctr, position: page.position }
    }, previous));
  }
  return actions;
}

function detectConversionActions(gaData, articles, previous) {
  const actions = [];
  const landingRows = gaData?.landingPages || [];
  for (const row of landingRows) {
    const sessions = Number(row.sessions || 0);
    const keyEvents = Number(row.keyEvents || 0);
    const revenue = Number(row.totalRevenue || 0);
    const path = cleanPath(row.landingPagePlusQueryString);
    if (sessions >= 12 && (keyEvents / Math.max(1, sessions)) < 0.025) {
      actions.push(makeAction({
        type: ACTION_TYPES.IMPROVE_CRO,
        target: path,
        signal: 'low-conversion',
        title: 'Improve conversion on ' + path,
        score: Math.min(94, 50 + Math.log10(sessions + 1) * 15 + (keyEvents === 0 ? 12 : 0)),
        risk: 'HIGH',
        mode: 'REVIEW',
        reason: 'The page attracts visits but produces comparatively few GA4 key events. CTA, proof, offer clarity, pricing context or onboarding friction should be tested rather than guessed.',
        evidence: [sessions + ' sessions', keyEvents + ' key events', pct(keyEvents / Math.max(1, sessions)) + '% session-to-key-event rate'],
        metrics: { sessions, keyEvents, revenue }
      }, previous));
    }

    if ((revenue > 0 || keyEvents >= 3) && sessions >= 5) {
      const article = articleForPath(articles, path);
      actions.push(makeAction({
        type: ACTION_TYPES.REPURPOSE_SOCIAL,
        target: path,
        articleId: article?.id || null,
        signal: 'winner',
        title: 'Repurpose a proven page into social content',
        score: Math.min(90, 55 + Math.min(20, keyEvents * 3) + Math.min(15, revenue / 5)),
        risk: 'LOW',
        mode: 'DRAFT_ONLY',
        reason: 'This landing page is producing measurable downstream activity. Phase 5 should distribute the winning angle rather than only create new topics.',
        evidence: [sessions + ' sessions', keyEvents + ' key events', '£' + revenue.toFixed(2) + ' GA4 revenue'],
        metrics: { sessions, keyEvents, revenue }
      }, previous));
    }
  }
  return actions;
}

function detectSystemActions(seo, authorityState, attributionSummary, previous) {
  const actions = [];
  const severe = Number(seo?.summary?.critical || 0) + Number(seo?.summary?.high || 0);
  if (severe > 0) {
    actions.push(makeAction({
      type: ACTION_TYPES.FIX_TECHNICAL_SEO,
      target: 'site-wide',
      signal: 'phase3-open-severe',
      title: 'Resolve remaining critical/high technical SEO issues',
      score: Math.min(100, 78 + severe * 3),
      risk: 'MEDIUM',
      mode: 'PHASE3_AUTOPILOT',
      reason: 'Revenue optimisation should not outrank crawl/indexing failures. Phase 3 remains the execution engine for safe technical repairs.',
      evidence: [severe + ' critical/high issues', Number(seo?.summary?.totalIssues || 0) + ' total issues', Number(seo?.summary?.autoFixed || 0) + ' safe repairs already applied'],
      metrics: { severe, score: seo?.score || null }
    }, previous));
  }

  if (Number(seo?.summary?.internalLinkedArticles || 0) < 3) {
    actions.push(makeAction({
      type: ACTION_TYPES.ADD_INTERNAL_LINKS,
      target: 'blog',
      signal: 'link-graph-thin',
      title: 'Strengthen the internal article graph',
      score: 68,
      risk: 'LOW',
      mode: 'PHASE3_AUTOPILOT',
      reason: 'The article graph is still sparse. Phase 3 can safely rebuild contextual internal recommendations.',
      evidence: [
        Number(seo?.summary?.internalLinkedArticles || 0) + ' articles currently linked',
        Number(seo?.summary?.internalArticleLinks || 0) + ' article-to-article links'
      ]
    }, previous));
  }

  if (authorityState?.generatedAt && Number(authorityState?.stats?.aiCitations || 0) === 0) {
    actions.push(makeAction({
      type: ACTION_TYPES.REINFORCE_AI_VISIBILITY,
      target: 'ai-search',
      signal: 'no-ai-citations',
      title: 'Strengthen evidence for AI-search citation',
      score: 64,
      risk: 'MEDIUM',
      mode: 'REVIEW',
      reason: 'Authority discovery has not yet recorded an AI citation. Improve source-backed pages and entity clarity before creating more volume.',
      evidence: [
        Number(authorityState?.stats?.mentions || 0) + ' recorded mentions',
        Number(authorityState?.stats?.acquiredLinks || 0) + ' acquired links',
        '0 recorded AI citations'
      ]
    }, previous));
  }

  const winner = attributionSummary?.sources?.find(row => Number(row.purchases || 0) > 0);
  if (winner) {
    actions.push(makeAction({
      type: ACTION_TYPES.SCALE_WINNING_SOURCE,
      target: winner.source,
      signal: 'attributed-purchase',
      title: 'Scale the acquisition source already producing customers',
      score: Math.min(96, 70 + Number(winner.purchases || 0) * 5 + Number(winner.revenue || 0) / 10),
      risk: 'MEDIUM',
      mode: 'REVIEW',
      reason: 'First-touch attribution shows this source has produced paid conversion. Increase effort only while conversion quality remains healthy.',
      evidence: [
        Number(winner.signups || 0) + ' attributed sign-ups',
        Number(winner.trials || 0) + ' attributed trials',
        Number(winner.purchases || 0) + ' attributed purchases',
        '£' + Number(winner.revenue || 0).toFixed(2) + ' attributed checkout revenue'
      ],
      metrics: winner
    }, previous));
  }
  return actions;
}

function proposalSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['proposals'],
    properties: {
      proposals: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'summary', 'suggestedTitle', 'suggestedMeta', 'refreshBrief', 'croHypothesis', 'socialPosts'],
          properties: {
            id: { type: 'string' },
            summary: { type: 'string' },
            suggestedTitle: { type: 'string' },
            suggestedMeta: { type: 'string' },
            refreshBrief: { type: 'string' },
            croHypothesis: { type: 'string' },
            socialPosts: { type: 'array', maxItems: 4, items: { type: 'string' } }
          }
        }
      }
    }
  };
}

async function enrichWithSol(actions) {
  const candidates = actions.slice(0, 8);
  if (!candidates.length || !env.contentWriter?.apiKey) return actions;
  try {
    const result = await growthContent.structuredResponse({
      model: env.contentWriter.model,
      instructions: [
        'You are the optimisation editor for INXSocial Phase 5.',
        'Use only the measured evidence supplied. Do not invent traffic, revenue, rankings, customer results, product capabilities or competitor facts.',
        'For OPTIMIZE_CTR_META, propose a truthful title (30-68 chars) and meta description (110-165 chars) aligned to the query.',
        'For REFRESH_CONTENT, write a concise research/update brief rather than a replacement article.',
        'For IMPROVE_CRO, state one falsifiable page hypothesis; do not make unsupported promises.',
        'For REPURPOSE_SOCIAL, prepare useful platform-neutral social copy based on the winning page; no fake urgency or fabricated results.',
        'For high-risk consolidation or source-scaling actions, describe the safe next decision rather than pretending a change was made.',
        'Return JSON only.'
      ].join(' '),
      input: JSON.stringify(candidates.map(item => ({
        id: item.id,
        type: item.type,
        target: item.target,
        title: item.title,
        reason: item.reason,
        evidence: item.evidence,
        metrics: item.metrics
      }))),
      text: { format: { type: 'json_schema', name: 'inx_growth_phase5_proposals', strict: true, schema: proposalSchema() } },
      max_output_tokens: 3500,
      ...(/^gpt-5(?:\.|-)/i.test(env.contentWriter.model) ? { reasoning: { effort: env.contentWriter.reasoningEffort || 'high' } } : {})
    }, 'inx_growth_phase5_proposals', 'GROWTH_OPTIMIZATION_PROPOSAL_INVALID', env.contentWriter);
    const proposals = new Map((result.parsed?.proposals || []).map(item => [item.id, item]));
    return actions.map(item => proposals.has(item.id) ? { ...item, proposal: proposals.get(item.id) } : item);
  } catch (error) {
    console.warn('[growth-optimization] Sol proposal generation skipped', { error: error?.message || String(error) });
    return actions;
  }
}

async function readState() {
  const row = await prisma.appSetting.findUnique({ where: { key: STATE_KEY } });
  return safeJson(row?.value, null);
}

async function writeState(state) {
  await prisma.appSetting.upsert({
    where: { key: STATE_KEY },
    create: {
      key: STATE_KEY,
      value: JSON.stringify(state),
      description: 'Phase 5 continuous optimisation, attribution and revenue feedback state.'
    },
    update: { value: JSON.stringify(state) }
  });
  return state;
}

async function run(options = {}) {
  const previousState = await readState();
  const previous = previousStatusMap(previousState);
  const warnings = [];

  const [articles, seo, authorityState, attributionSummary] = await Promise.all([
    growthContent.listArticles({ publishedOnly: true }).catch(error => {
      warnings.push('Content: ' + (error.message || error)); return [];
    }),
    seoMaintenance.status().catch(error => {
      warnings.push('SEO: ' + (error.message || error)); return null;
    }),
    authority.status().catch(error => {
      warnings.push('Authority: ' + (error.message || error)); return null;
    }),
    attribution.summary(options.days || 28).catch(error => {
      warnings.push('Attribution: ' + (error.message || error)); return null;
    })
  ]);

  let gscData = null;
  let gaData = null;
  try { gscData = await gsc.performance(28); } catch (error) { warnings.push('Search Console: ' + String(error.publicMessage || error.message || error)); }
  try { gaData = await ga4.performance(28); } catch (error) { warnings.push('GA4: ' + String(error.publicMessage || error.message || error)); }

  let actions = [
    ...detectSearchActions(gscData, articles, previous),
    ...detectCannibalisation(gscData, previous),
    ...detectConversionActions(gaData, articles, previous),
    ...detectSystemActions(seo, authorityState, attributionSummary, previous)
  ];

  actions = actions
    .sort((a, b) => b.score - a.score)
    .filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
    .slice(0, 30);

  actions = await enrichWithSol(actions);

  const activeIds = new Set(actions.map(item => item.id));
  const superseded = (previousState?.actions || [])
    .filter(item => !activeIds.has(item.id) && !['DISMISSED', 'APPLIED', 'DONE'].includes(item.status))
    .map(item => ({ ...item, status: 'SUPERSEDED', updatedAt: nowIso() }))
    .slice(0, 20);

  const stats = {
    totalActions: actions.length,
    highPriority: actions.filter(item => item.score >= 75).length,
    reviewRequired: actions.filter(item => ['HIGH', 'MEDIUM'].includes(item.risk) && item.mode === 'REVIEW').length,
    contentRefreshes: actions.filter(item => item.type === ACTION_TYPES.REFRESH_CONTENT).length,
    ctrOpportunities: actions.filter(item => item.type === ACTION_TYPES.OPTIMIZE_CTR_META).length,
    cannibalisation: actions.filter(item => item.type === ACTION_TYPES.CONSOLIDATE_CANNIBALIZATION).length,
    croOpportunities: actions.filter(item => item.type === ACTION_TYPES.IMPROVE_CRO).length,
    repurposeOpportunities: actions.filter(item => item.type === ACTION_TYPES.REPURPOSE_SOCIAL).length
  };

  const state = {
    generatedAt: nowIso(),
    periodDays: 28,
    provider: {
      searchConsole: Boolean(gscData),
      ga4: Boolean(gaData),
      attribution: Boolean(attributionSummary),
      sol: Boolean(env.contentWriter?.apiKey),
      stripeRevenue: stripeService.isConfigured()
    },
    stats,
    funnel: attributionSummary?.funnel || null,
    revenue: attributionSummary?.revenue || null,
    sources: attributionSummary?.sources?.slice(0, 12) || [],
    search: gscData ? {
      summary: gscData.summary,
      comparison: gscData.comparison,
      topQueries: (gscData.topQueries || []).slice(0, 10)
    } : null,
    analytics: gaData ? {
      summary: gaData.summary,
      comparison: gaData.comparison,
      funnel: gaData.funnel,
      acquisitionSources: (gaData.acquisitionSources || []).slice(0, 10)
    } : null,
    actions: [...actions, ...superseded],
    warnings: warnings.map(item => String(item).slice(0, 500)).slice(0, 12)
  };
  await writeState(state);
  return state;
}

async function status() {
  return (await readState()) || {
    generatedAt: null,
    periodDays: 28,
    provider: { searchConsole: false, ga4: false, attribution: true, sol: Boolean(env.contentWriter?.apiKey), stripeRevenue: stripeService.isConfigured() },
    stats: { totalActions: 0, highPriority: 0, reviewRequired: 0, contentRefreshes: 0, ctrOpportunities: 0, cannibalisation: 0, croOpportunities: 0, repurposeOpportunities: 0 },
    funnel: null,
    revenue: null,
    sources: [],
    actions: [],
    warnings: []
  };
}

async function updateAction(id, action, note = '') {
  const state = await status();
  const item = (state.actions || []).find(entry => entry.id === id);
  if (!item) {
    const error = new Error('Phase 5 optimisation action not found.');
    error.status = 404;
    throw error;
  }

  if (action === 'dismiss') {
    item.status = 'DISMISSED';
  } else if (action === 'approve') {
    item.status = item.mode === 'DRAFT_ONLY' ? 'READY_TO_PUBLISH' : 'APPROVED';
  } else if (action === 'done') {
    item.status = 'DONE';
  } else if (action === 'apply') {
    if (item.type === ACTION_TYPES.OPTIMIZE_CTR_META && item.articleId) {
      if (!item.proposal?.suggestedTitle || !item.proposal?.suggestedMeta) {
        throw Object.assign(new Error('No Sol metadata proposal is available for this action yet.'), { status: 409 });
      }
      const article = await growthContent.optimizePublishedMetadata(item.articleId, {
        title: item.proposal.suggestedTitle,
        meta_description: item.proposal.suggestedMeta,
        reason: item.reason
      });
      item.status = 'APPLIED';
      item.note = 'Live metadata updated for /blog/' + article.slug + '.';
    } else if (item.type === ACTION_TYPES.REFRESH_CONTENT && item.articleId) {
      const article = await growthContent.refreshPublishedArticle(item.articleId, item.proposal?.refreshBrief || item.reason);
      item.status = 'APPLIED';
      item.note = 'Published article refreshed in place with current web research: /blog/' + article.slug + '.';
    } else if ([ACTION_TYPES.ADD_INTERNAL_LINKS, ACTION_TYPES.FIX_TECHNICAL_SEO].includes(item.type)) {
      await seoMaintenance.run({ maxPages: 120 });
      item.status = 'APPLIED';
      item.note = 'Phase 3 technical/internal-link maintenance executed from the Phase 5 feedback loop.';
    } else if (item.type === ACTION_TYPES.REPURPOSE_SOCIAL) {
      item.status = 'READY_TO_PUBLISH';
      item.note = 'Social drafts are prepared; distribution remains approval/account-context gated.';
    } else {
      item.status = 'APPROVED';
      item.note = 'Approved for governed implementation. High-risk URL, pricing, conversion and consolidation changes are never silently auto-applied.';
    }
  } else {
    throw Object.assign(new Error('Unsupported optimisation action.'), { status: 400 });
  }

  if (note) item.note = String(note).trim().slice(0, 600);
  item.updatedAt = nowIso();
  await writeState({ ...state, actions: state.actions.map(entry => entry.id === item.id ? item : entry) });
  return status();
}

module.exports = {
  STATE_KEY,
  ACTION_TYPES,
  run,
  status,
  updateAction,
  detectCannibalisation,
  detectSearchActions,
  detectConversionActions
};
