const prisma = require('../db/prisma');
const searchConsole = require('./googleSearchConsoleService');
const googleAnalytics = require('./googleAnalyticsService');

const OPPORTUNITY_SETTING_KEY = 'growth_intelligence_opportunities_v1';
const OPENAI_SETTING_KEY = 'growth_intelligence_openai_visibility_v1';
const PERPLEXITY_SETTING_KEY = 'growth_intelligence_perplexity_visibility_v1';
const CLAUDE_SETTING_KEY = 'growth_intelligence_claude_visibility_v1';
const AUDIT_SETTING_KEY = 'growth_intelligence_site_audit_v1';

const STOPWORDS = new Set([
  'the','a','an','and','or','for','to','of','in','on','with','is','are','what','which','how','best','good',
  'can','that','this','from','my','your','their','social','media','tool','tools','ai'
]);

function safeJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

async function readSetting(key) {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row ? safeJson(row.value, null) : null;
}

async function writeSetting(value) {
  return prisma.appSetting.upsert({
    where: { key: OPPORTUNITY_SETTING_KEY },
    create: {
      key: OPPORTUNITY_SETTING_KEY,
      value: JSON.stringify(value),
      description: 'Latest combined Growth Intelligence opportunities for INXSocial.'
    },
    update: {
      value: JSON.stringify(value),
      description: 'Latest combined Growth Intelligence opportunities for INXSocial.'
    }
  });
}

function tokens(value) {
  return [...new Set(
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .map(part => part.trim())
      .filter(part => part.length > 2 && !STOPWORDS.has(part))
  )];
}

function similarity(a, b) {
  const left = tokens(a);
  const right = new Set(tokens(b));
  if (!left.length || !right.size) return 0;
  const intersection = left.filter(item => right.has(item)).length;
  return intersection / Math.max(left.length, right.size);
}

function commercialIntent(query) {
  return /\b(best|alternative|alternatives|vs|versus|compare|comparison|pricing|price|software|platform|scheduler|management|agency|small business|buy|trial)\b/i.test(query);
}

function classifyIntent(query) {
  if (/\b(pricing|price|cost|trial|buy)\b/i.test(query)) return 'transactional';
  if (/\b(best|alternative|alternatives|vs|versus|compare|comparison|software|platform|scheduler|management)\b/i.test(query)) return 'commercial';
  return 'informational';
}

function cap(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function sourceDomain(url) {
  try { return new URL(String(url || '')).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { return ''; }
}

function visibilityEvidence(topic, scans) {
  const providers = [];
  for (const [provider, scan] of Object.entries(scans)) {
    if (!scan?.results?.length) continue;
    const matches = scan.results
      .filter(item => item?.ok && similarity(topic, item.prompt) >= 0.16)
      .sort((a, b) => similarity(topic, b.prompt) - similarity(topic, a.prompt));
    if (!matches.length) continue;
    const best = matches[0];
    providers.push({
      provider,
      prompt: best.prompt,
      mentioned: Boolean(best.inxSocialMentioned),
      cited: Boolean(best.inxSocialCited),
      competitors: Array.isArray(best.competitors) ? best.competitors : [],
      sources: Array.isArray(best.sources) ? best.sources : []
    });
  }
  return providers;
}

function queryPageFor(query, gsc) {
  return (gsc?.queryPages || [])
    .filter(row => String(row.query || '').toLowerCase() === String(query || '').toLowerCase())
    .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))[0] || null;
}

function actionFor({ query, position, page, aiEvidence }) {
  const intent = classifyIntent(query);
  const aiGap = aiEvidence.length && aiEvidence.every(item => !item.mentioned && !item.cited);
  if (page && position >= 4 && position <= 20) {
    return {
      type: 'IMPROVE_EXISTING_PAGE',
      label: 'Improve existing page',
      rationale: 'The query already has an indexed INXSocial page and is close enough to page one that improving relevance, CTR and authority is more efficient than creating a duplicate page.'
    };
  }
  if (commercialIntent(query) && (!page || position > 20)) {
    return {
      type: 'CREATE_COMMERCIAL_PAGE',
      label: 'Create commercial landing page',
      rationale: 'The query has buyer intent but INXSocial does not yet have a strong ranking page for it.'
    };
  }
  if (aiGap) {
    return {
      type: 'BUILD_AUTHORITY_CONTENT',
      label: 'Build authority content',
      rationale: 'AI-search probes do not currently mention or cite INXSocial for the closest buyer-intent prompt.'
    };
  }
  return {
    type: intent === 'informational' ? 'CREATE_GUIDE' : 'STRENGTHEN_TOPIC',
    label: intent === 'informational' ? 'Create or improve guide' : 'Strengthen topic coverage',
    rationale: 'The topic has measurable search or discovery demand and needs stronger first-party coverage.'
  };
}

function scoreSearchOpportunity(row, aiEvidence) {
  const impressions = Number(row.impressions || 0);
  const ctr = Number(row.ctr || 0);
  const position = Number(row.position || 0);
  const demand = Math.min(35, Math.log10(impressions + 1) * 12);
  const rankingGap = position >= 4 && position <= 30 ? Math.min(25, (31 - position) * 0.9) : position > 30 ? 8 : 2;
  const ctrGap = impressions >= 10 ? Math.min(15, Math.max(0, (0.08 - ctr) * 150)) : 0;
  const aiGap = aiEvidence.length
    ? Math.min(15, aiEvidence.filter(item => !item.mentioned).length * 4 + aiEvidence.filter(item => !item.cited).length * 2)
    : 0;
  const commercial = commercialIntent(row.query) ? 8 : 0;
  return Math.round(cap(demand + rankingGap + ctrGap + aiGap + commercial));
}

function aggregateVisibility(scans) {
  const competitorMap = new Map();
  const sourceMap = new Map();
  for (const [provider, scan] of Object.entries(scans)) {
    for (const result of scan?.results || []) {
      if (!result?.ok) continue;
      for (const competitor of result.competitors || []) {
        const key = String(competitor || '').trim();
        if (!key) continue;
        const row = competitorMap.get(key) || { name: key, mentions: 0, providers: new Set() };
        row.mentions += 1;
        row.providers.add(provider);
        competitorMap.set(key, row);
      }
      for (const source of result.sources || []) {
        const domain = sourceDomain(source.url);
        if (!domain) continue;
        const row = sourceMap.get(domain) || { domain, citations: 0, providers: new Set() };
        row.citations += 1;
        row.providers.add(provider);
        sourceMap.set(domain, row);
      }
    }
  }
  return {
    competitors: [...competitorMap.values()]
      .map(row => ({ name: row.name, mentions: row.mentions, providers: [...row.providers] }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 12),
    sourceDomains: [...sourceMap.values()]
      .map(row => ({ domain: row.domain, citations: row.citations, providers: [...row.providers] }))
      .sort((a, b) => b.citations - a.citations)
      .slice(0, 15)
  };
}

async function build(days = 28) {
  const periodDays = [7, 28, 90].includes(Number(days)) ? Number(days) : 28;
  const warnings = [];

  const [openai, perplexity, claude, audit] = await Promise.all([
    readSetting(OPENAI_SETTING_KEY),
    readSetting(PERPLEXITY_SETTING_KEY),
    readSetting(CLAUDE_SETTING_KEY),
    readSetting(AUDIT_SETTING_KEY)
  ]);

  let gsc = null;
  let ga4 = null;
  try { gsc = await searchConsole.performance(periodDays); } catch (error) {
    warnings.push({ source: 'searchConsole', message: String(error.publicMessage || error.message || 'Search Console unavailable').slice(0, 400) });
  }
  try { ga4 = await googleAnalytics.performance(periodDays); } catch (error) {
    warnings.push({ source: 'ga4', message: String(error.publicMessage || error.message || 'GA4 unavailable').slice(0, 400) });
  }

  const scans = { openai, perplexity, claude };
  const opportunities = [];

  for (const check of audit?.checks || []) {
    if (check.ok) continue;
    opportunities.push({
      id: 'technical:' + check.key,
      type: 'technical',
      topic: check.label,
      intent: 'technical',
      score: 98,
      search: null,
      analytics: null,
      ai: [],
      existingPage: null,
      action: {
        type: 'TECHNICAL_FIX',
        label: 'Fix technical discovery issue',
        rationale: check.detail || 'A technical discovery check is currently failing.'
      }
    });
  }

  for (const row of (gsc?.topQueries || []).slice(0, 40)) {
    if (Number(row.impressions || 0) < 3) continue;
    const ai = visibilityEvidence(row.query, scans);
    const queryPage = queryPageFor(row.query, gsc);
    const score = scoreSearchOpportunity(row, ai);
    opportunities.push({
      id: 'search:' + Buffer.from(String(row.query)).toString('base64url').slice(0, 60),
      type: 'search',
      topic: row.query,
      intent: classifyIntent(row.query),
      score,
      search: {
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        ctr: Number(row.ctr || 0),
        position: Number(row.position || 0)
      },
      analytics: null,
      ai,
      existingPage: queryPage?.page || null,
      action: actionFor({
        query: row.query,
        position: Number(row.position || 0),
        page: queryPage?.page || null,
        aiEvidence: ai
      })
    });
  }

  const promptMap = new Map();
  for (const [provider, scan] of Object.entries(scans)) {
    for (const result of scan?.results || []) {
      if (!result?.ok || !result.prompt) continue;
      const item = promptMap.get(result.prompt) || { prompt: result.prompt, providers: [] };
      item.providers.push({
        provider,
        mentioned: Boolean(result.inxSocialMentioned),
        cited: Boolean(result.inxSocialCited),
        competitors: result.competitors || [],
        sources: result.sources || []
      });
      promptMap.set(result.prompt, item);
    }
  }
  for (const item of promptMap.values()) {
    if (!item.providers.length) continue;
    if (item.providers.some(provider => provider.mentioned || provider.cited)) continue;
    const alreadyCovered = opportunities.some(opp => similarity(opp.topic, item.prompt) >= 0.28);
    if (alreadyCovered) continue;
    opportunities.push({
      id: 'ai:' + Buffer.from(String(item.prompt)).toString('base64url').slice(0, 60),
      type: 'ai_visibility',
      topic: item.prompt,
      intent: classifyIntent(item.prompt),
      score: commercialIntent(item.prompt) ? 78 : 68,
      search: null,
      analytics: null,
      ai: item.providers,
      existingPage: null,
      action: {
        type: 'BUILD_AUTHORITY_CONTENT',
        label: 'Build AI-search authority',
        rationale: 'INXSocial was neither mentioned nor cited by the providers scanned for this buyer-intent question.'
      }
    });
  }

  const sorted = opportunities
    .sort((a, b) => b.score - a.score)
    .slice(0, 35);

  const visibility = aggregateVisibility(scans);
  const summary = {
    total: sorted.length,
    critical: sorted.filter(item => item.score >= 85).length,
    high: sorted.filter(item => item.score >= 70 && item.score < 85).length,
    medium: sorted.filter(item => item.score >= 50 && item.score < 70).length,
    searchBacked: sorted.filter(item => item.search).length,
    aiVisibilityGaps: sorted.filter(item => item.type === 'ai_visibility' || item.ai?.some(signal => !signal.mentioned)).length,
    communitySupported: 0
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    periodDays,
    summary,
    dataStatus: {
      searchConsole: Boolean(gsc),
      ga4: Boolean(ga4),
      openai: Boolean(openai),
      perplexity: Boolean(perplexity),
      claude: Boolean(claude),
      technicalAudit: Boolean(audit)
    },
    analyticsSummary: ga4 ? {
      activeUsers: Number(ga4.summary?.activeUsers || 0),
      sessions: Number(ga4.summary?.sessions || 0),
      keyEvents: Number(ga4.summary?.keyEvents || 0),
      revenue: Number(ga4.summary?.totalRevenue || 0)
    } : null,
    competitors: visibility.competitors,
    sourceDomains: visibility.sourceDomains,
    warnings,
    opportunities: sorted
  };

  await writeSetting(payload);
  return payload;
}

async function latest() {
  return readSetting(OPPORTUNITY_SETTING_KEY);
}

module.exports = {
  OPPORTUNITY_SETTING_KEY,
  build,
  latest,
  similarity,
  classifyIntent,
  scoreSearchOpportunity
};
