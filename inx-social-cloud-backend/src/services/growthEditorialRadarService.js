'use strict';

const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const webResearch = require('./webResearchService');
const growthSites = require('./growthSiteService');
const siteIntelligence = require('./growthSiteIntelligenceService');
const seoSkills = require('./growthSeoSkillRegistry');

const SETTING_BASE = 'growth_editorial_radar_v1';
const MAX_CANDIDATES = 24;

function settingKey(siteId) {
  return growthSites.settingKey(SETTING_BASE, siteId);
}

function safeJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

async function readSetting(siteId) {
  const row = await prisma.appSetting.findUnique({ where: { key: settingKey(siteId) } });
  return row ? safeJson(row.value, null) : null;
}

async function writeSetting(siteId, value) {
  return prisma.appSetting.upsert({
    where: { key: settingKey(siteId) },
    create: {
      key: settingKey(siteId),
      value: JSON.stringify(value),
      description: 'Ranked editorial/trend opportunity radar for the managed Growth site.'
    },
    update: {
      value: JSON.stringify(value),
      description: 'Ranked editorial/trend opportunity radar for the managed Growth site.'
    }
  });
}

function schema() {
  const score = { type: 'integer', minimum: 0, maximum: 100 };
  const stringArray = maxItems => ({ type: 'array', maxItems, items: { type: 'string' } });
  return {
    type: 'object',
    additionalProperties: false,
    required: ['candidates'],
    properties: {
      candidates: {
        type: 'array',
        maxItems: MAX_CANDIDATES,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'topic','headlineAngle','category','intent','whyNow','audienceConnection','businessBridge',
            'demandEvidence','freshness','audienceOverlap','bridgeStrength','rankingFeasibility',
            'informationGain','geoCitationPotential','authorityRisk','keywords','sourceUrls'
          ],
          properties: {
            topic: { type: 'string' },
            headlineAngle: { type: 'string' },
            category: { type: 'string', enum: ['DIRECT','ADJACENT','AUDIENCE','TREND_BRIDGE'] },
            intent: { type: 'string', enum: ['informational','commercial','transactional','mixed'] },
            whyNow: { type: 'string' },
            audienceConnection: { type: 'string' },
            businessBridge: { type: 'string' },
            demandEvidence: score,
            freshness: score,
            audienceOverlap: score,
            bridgeStrength: score,
            rankingFeasibility: score,
            informationGain: score,
            geoCitationPotential: score,
            authorityRisk: score,
            keywords: stringArray(12),
            sourceUrls: stringArray(8)
          }
        }
      }
    }
  };
}

function responseSources(data) {
  return webResearch.extractResponseSources(data)
    .map(item => String(item.url || '').trim())
    .filter(Boolean);
}

function weightedScore(item) {
  const positive =
    Number(item.demandEvidence || 0) * 0.22 +
    Number(item.audienceOverlap || 0) * 0.18 +
    Number(item.bridgeStrength || 0) * 0.14 +
    Number(item.freshness || 0) * 0.15 +
    Number(item.rankingFeasibility || 0) * 0.10 +
    Number(item.informationGain || 0) * 0.11 +
    Number(item.geoCitationPotential || 0) * 0.10;
  const penalty = Number(item.authorityRisk || 0) * 0.18;
  return Math.max(0, Math.min(100, Math.round(positive - penalty)));
}

function opportunityId(siteId, topic) {
  return 'radar:' + crypto.createHash('sha256').update(String(siteId) + ':' + String(topic).toLowerCase()).digest('hex').slice(0, 18);
}

function sourceAllowed(url, allowed) {
  try {
    const candidate = new URL(url);
    const candidateKey = candidate.hostname.replace(/^www\./, '').toLowerCase() + candidate.pathname.replace(/\/$/, '');
    return allowed.some(value => {
      try {
        const source = new URL(value);
        const sourceKey = source.hostname.replace(/^www\./, '').toLowerCase() + source.pathname.replace(/\/$/, '');
        return sourceKey === candidateKey;
      } catch (_) { return false; }
    });
  } catch (_) {
    return false;
  }
}

function normalizeCandidate(site, raw, allowedSources) {
  const topic = String(raw.topic || '').replace(/\s+/g, ' ').trim().slice(0, 260);
  if (!topic) return null;
  const category = ['DIRECT','ADJACENT','AUDIENCE','TREND_BRIDGE'].includes(raw.category) ? raw.category : 'ADJACENT';
  const item = {
    id: opportunityId(site.id, topic),
    topic,
    headlineAngle: String(raw.headlineAngle || topic).replace(/\s+/g, ' ').trim().slice(0, 300),
    category,
    intent: ['informational','commercial','transactional','mixed'].includes(raw.intent) ? raw.intent : 'informational',
    whyNow: String(raw.whyNow || '').replace(/\s+/g, ' ').trim().slice(0, 700),
    audienceConnection: String(raw.audienceConnection || '').replace(/\s+/g, ' ').trim().slice(0, 700),
    businessBridge: String(raw.businessBridge || '').replace(/\s+/g, ' ').trim().slice(0, 700),
    demandEvidence: Math.max(0, Math.min(100, Number(raw.demandEvidence || 0))),
    freshness: Math.max(0, Math.min(100, Number(raw.freshness || 0))),
    audienceOverlap: Math.max(0, Math.min(100, Number(raw.audienceOverlap || 0))),
    bridgeStrength: Math.max(0, Math.min(100, Number(raw.bridgeStrength || 0))),
    rankingFeasibility: Math.max(0, Math.min(100, Number(raw.rankingFeasibility || 0))),
    informationGain: Math.max(0, Math.min(100, Number(raw.informationGain || 0))),
    geoCitationPotential: Math.max(0, Math.min(100, Number(raw.geoCitationPotential || 0))),
    authorityRisk: Math.max(0, Math.min(100, Number(raw.authorityRisk || 0))),
    keywords: [...new Set((raw.keywords || []).map(value => String(value).trim()).filter(Boolean))].slice(0, 12),
    sourceUrls: [...new Set((raw.sourceUrls || []).map(value => String(value).trim()).filter(value => sourceAllowed(value, allowedSources)))].slice(0, 8)
  };
  item.score = weightedScore(item);
  item.hot = (
    item.score >= 82 &&
    item.freshness >= 72 &&
    item.demandEvidence >= 65 &&
    item.audienceOverlap >= 60 &&
    item.bridgeStrength >= 40 &&
    item.authorityRisk <= 35 &&
    item.sourceUrls.length > 0
  );
  return item;
}

function parseStructured(data) {
  const raw = webResearch.extractResponseText(data);
  try { return JSON.parse(raw); } catch (_) {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

async function refresh(options = {}) {
  const intelligence = options.intelligence || await siteIntelligence.latest(options.siteId);
  const site = options.site || intelligence?.site || await growthSites.getSite(options.siteId);
  const profile = options.profile || intelligence?.profile || null;
  if (!site) throw new Error('Managed Growth site was not found.');
  if (!profile) throw new Error('Site intelligence is required before editorial radar discovery.');
  if (!env.webResearch?.apiKey || !env.webResearch?.baseUrl || !env.webResearch?.model) {
    throw new Error('Live web research is not configured for editorial opportunity discovery.');
  }

  const previous = await readSetting(site.id);
  const existingArticles = Array.isArray(options.existingArticles) ? options.existingArticles : [];
  const request = {
    model: env.webResearch.model,
    instructions: [
      seoSkills.expertOperatingInstructions(),
      'EDITORIAL OPPORTUNITY RADAR TASK:',
      'Act as a proactive newsroom, SEO strategist and demand researcher. Do not wait for Search Console to reveal an opportunity after the fact.',
      'Use live web search to discover current and emerging topics that could earn qualified discovery for the supplied website.',
      'Search four opportunity classes: DIRECT product/service demand; ADJACENT problems and workflows; AUDIENCE interests that the intended customers genuinely care about; and TREND_BRIDGE stories/news where there is a credible audience, problem or entity connection to the business.',
      'Do not force relevance. A trend is acceptable only when audienceConnection and businessBridge explain a useful, non-deceptive reason this website should cover it.',
      'Do not chase unrelated celebrity, scandal or general-news traffic merely because it is popular. A celebrity/creator/technology story is acceptable when the story materially intersects the discovered audience, AI/content/marketing workflow, creator economy, product category or another evidenced site theme.',
      'Prefer topics with current demand, freshness, clear information gain and realistic ability to produce a better answer than generic summaries.',
      'Do not fabricate search volume. demandEvidence is a reasoned 0-100 evidence score based on current search/news/community/market signals you actually find.',
      'authorityRisk measures risk of topical dilution, forced relevance, weak expertise or reputational mismatch. High risk should materially reduce priority.',
      'Return sourceUrls only from live web-search evidence you actually used.'
    ].join('\n'),
    input: [
      'CURRENT DATE: ' + new Date().toISOString(),
      'SITE: ' + JSON.stringify({ id: site.id, origin: site.origin, hostname: site.hostname }),
      'DISCOVERED SITE PROFILE: ' + JSON.stringify(profile),
      'RECENT SEMANTIC SITE CHANGES: ' + JSON.stringify(intelligence?.changes || []),
      'EXISTING/PREVIOUS RADAR: ' + JSON.stringify((previous?.candidates || []).slice(0, 16)),
      'EXISTING ARTICLES TO AVOID DUPLICATING: ' + JSON.stringify(existingArticles.slice(0, 40).map(article => ({
        title: article.title,
        status: article.status,
        publishedAt: article.published_at || null
      }))),
      'Find up to 20 high-value opportunities. It is acceptable to return fewer if evidence is weak.'
    ].join('\n\n'),
    tools: [{ type: 'web_search', external_web_access: true }],
    tool_choice: 'required',
    include: ['web_search_call.action.sources'],
    text: { format: { type: 'json_schema', name: 'growth_editorial_radar', strict: true, schema: schema() } },
    max_output_tokens: 7000
  };
  if (/^gpt-5(?:\.|-)/i.test(env.webResearch.model)) request.reasoning = { effort: 'medium' };

  const response = await axios.post(env.webResearch.baseUrl + '/responses', request, {
    timeout: Math.max(90000, Number(env.webResearch.timeoutMs || 120000)),
    headers: { Authorization: 'Bearer ' + env.webResearch.apiKey, 'Content-Type': 'application/json' }
  });

  const parsed = parseStructured(response.data);
  if (!parsed?.candidates) throw new Error('Editorial radar returned an invalid structured result.');
  const allowedSources = responseSources(response.data);
  const candidates = parsed.candidates
    .map(item => normalizeCandidate(site, item, allowedSources))
    .filter(Boolean)
    .filter(item => item.sourceUrls.length > 0)
    .filter(item => item.audienceOverlap >= 35 && item.bridgeStrength >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  const payload = {
    version: 1,
    siteId: site.id,
    origin: site.origin,
    generatedAt: new Date().toISOString(),
    skillVersion: seoSkills.VERSION,
    summary: {
      total: candidates.length,
      hot: candidates.filter(item => item.hot).length,
      direct: candidates.filter(item => item.category === 'DIRECT').length,
      adjacent: candidates.filter(item => item.category === 'ADJACENT').length,
      audience: candidates.filter(item => item.category === 'AUDIENCE').length,
      trendBridge: candidates.filter(item => item.category === 'TREND_BRIDGE').length
    },
    candidates
  };
  await writeSetting(site.id, payload);

  try {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'GROWTH_EDITORIAL_RADAR_REFRESHED',
        entity: 'GrowthSite',
        entityId: site.id,
        metadata: JSON.stringify(payload.summary)
      }
    });
  } catch (_) {}

  return payload;
}

async function latest(siteId = null) {
  const site = await growthSites.getSite(siteId);
  if (!site) return null;
  return readSetting(site.id);
}

function hottest(payload) {
  return (payload?.candidates || []).find(item => item.hot) || null;
}

module.exports = {
  SETTING_BASE,
  weightedScore,
  normalizeCandidate,
  refresh,
  latest,
  hottest
};
