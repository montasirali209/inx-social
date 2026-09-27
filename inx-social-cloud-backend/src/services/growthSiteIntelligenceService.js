'use strict';

const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const webResearch = require('./webResearchService');
const growthSites = require('./growthSiteService');
const skills = require('./growthSeoSkillRegistry');

const PROFILE_KEY = 'growth_site_profile_v1';
const SNAPSHOT_KEY = 'growth_site_snapshot_v1';
const MAX_PROFILE_PAGES = 48;

function safeJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function readSetting(key) {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row ? safeJson(row.value, null) : null;
}

async function writeSetting(key, value, description) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value), description },
    update: { value: JSON.stringify(value), description }
  });
}

function profileKey(siteId) {
  return growthSites.settingKey(PROFILE_KEY, siteId);
}

function snapshotKey(siteId) {
  return growthSites.settingKey(SNAPSHOT_KEY, siteId);
}

function pageEvidence(page) {
  return {
    path: page.path,
    status: Number(page.status || 0),
    title: String(page.title || '').slice(0, 220),
    description: String(page.description || '').slice(0, 420),
    h1: String(page.h1 || '').slice(0, 260),
    headings: (page.headings || []).slice(0, 20).map(item => ({ level: item.level, text: String(item.text || '').slice(0, 180) })),
    text: String(page.textSample || '').slice(0, 6000),
    canonicalPath: page.canonicalPath || null,
    internalLinks: Number(page.internalLinks || page.links?.length || 0)
  };
}

function pagePriority(page) {
  const path = String(page.path || '');
  let score = path === '/' ? 100 : 0;
  if (/pricing|product|service|feature|solution|use-case|about|contact|demo|trial|signup|register|compare|alternative/i.test(path)) score += 45;
  if (/blog|guide|resource|learn|help|docs/i.test(path)) score += 12;
  if (page.h1) score += 8;
  if (page.description) score += 5;
  score += Math.min(20, String(page.textSample || '').length / 300);
  return score;
}

function compactPages(pages) {
  return (pages || [])
    .filter(page => Number(page.status || 0) === 200)
    .sort((a, b) => pagePriority(b) - pagePriority(a))
    .slice(0, MAX_PROFILE_PAGES)
    .map(pageEvidence);
}

function snapshotFromCrawl(site, crawl) {
  const pages = compactPages(crawl?.pages || []);
  const pageHashes = {};
  for (const page of pages) {
    pageHashes[page.path] = hash({
      title: page.title,
      description: page.description,
      h1: page.h1,
      headings: page.headings,
      text: page.text
    });
  }
  const payload = {
    version: 1,
    siteId: site.id,
    origin: site.origin,
    capturedAt: new Date().toISOString(),
    pages,
    pageHashes
  };
  payload.fingerprint = hash({ origin: site.origin, pageHashes });
  return payload;
}

function diffSnapshots(previous, current) {
  if (!previous) {
    return {
      firstCrawl: true,
      added: Object.keys(current.pageHashes),
      removed: [],
      changed: [],
      material: true
    };
  }
  const previousKeys = new Set(Object.keys(previous.pageHashes || {}));
  const currentKeys = new Set(Object.keys(current.pageHashes || {}));
  const added = [...currentKeys].filter(key => !previousKeys.has(key));
  const removed = [...previousKeys].filter(key => !currentKeys.has(key));
  const changed = [...currentKeys].filter(key => previousKeys.has(key) && previous.pageHashes[key] !== current.pageHashes[key]);
  return {
    firstCrawl: false,
    added,
    removed,
    changed,
    material: added.length > 0 || removed.length > 0 || changed.length > 0
  };
}

function profileSchema() {
  const stringArray = maxItems => ({ type: 'array', maxItems, items: { type: 'string' } });
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'brandName','summary','primaryCategory','businessModel','audiences','markets','products','services',
      'differentiators','conversionGoals','entities','searchThemes','commercialIntents','informationalIntents',
      'competitorCandidates','visibilityPrompts','semanticChanges','confidence'
    ],
    properties: {
      brandName: { type: 'string' },
      summary: { type: 'string' },
      primaryCategory: { type: 'string' },
      businessModel: { type: 'string' },
      audiences: stringArray(12),
      markets: stringArray(10),
      products: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name','description','url','capabilities'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            url: { type: ['string','null'] },
            capabilities: stringArray(16)
          }
        }
      },
      services: stringArray(20),
      differentiators: stringArray(16),
      conversionGoals: stringArray(12),
      entities: stringArray(24),
      searchThemes: stringArray(24),
      commercialIntents: stringArray(20),
      informationalIntents: stringArray(20),
      competitorCandidates: {
        type: 'array',
        maxItems: 18,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name','domain','relationship','reason'],
          properties: {
            name: { type: 'string' },
            domain: { type: ['string','null'] },
            relationship: { type: 'string', enum: ['direct','substitute','publisher','marketplace','adjacent'] },
            reason: { type: 'string' }
          }
        }
      },
      visibilityPrompts: stringArray(20),
      semanticChanges: stringArray(20),
      confidence: { type: 'integer', minimum: 0, maximum: 100 }
    }
  };
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

function fallbackProfile(site, snapshot, changes) {
  const home = snapshot.pages.find(page => page.path === '/') || snapshot.pages[0] || {};
  const titles = snapshot.pages.map(page => page.title || page.h1).filter(Boolean);
  const themes = [...new Set(titles.flatMap(value => String(value).split(/[|–—:\-]/).map(part => part.trim())).filter(part => part.length >= 4))].slice(0, 18);
  const brandName = String(home.title || new URL(site.origin).hostname).split(/[|–—-]/)[0].trim();
  const prompts = themes.slice(0, 8).map(theme => 'What are the best solutions for ' + theme.replace(/[?.!]+$/,'').toLowerCase() + '?');
  return {
    brandName,
    summary: String(home.description || home.h1 || 'Website profile generated from crawl evidence.').slice(0, 800),
    primaryCategory: themes[0] || 'Unknown',
    businessModel: 'Unknown',
    audiences: [],
    markets: [],
    products: [],
    services: [],
    differentiators: [],
    conversionGoals: [],
    entities: themes,
    searchThemes: themes,
    commercialIntents: themes.slice(0, 8).map(theme => 'best ' + theme.toLowerCase()),
    informationalIntents: themes.slice(0, 8).map(theme => 'how to use ' + theme.toLowerCase()),
    competitorCandidates: [],
    visibilityPrompts: prompts.length ? prompts : ['What are the best solutions in this category?'],
    semanticChanges: [
      ...(changes.added || []).map(path => 'New page discovered: ' + path),
      ...(changes.removed || []).map(path => 'Page removed: ' + path),
      ...(changes.changed || []).map(path => 'Page meaning or content changed: ' + path)
    ].slice(0, 20),
    confidence: 35
  };
}

async function analyse(site, snapshot, previousProfile, changes) {
  if (!env.webResearch?.apiKey || !env.webResearch?.baseUrl || !env.webResearch?.model) {
    return fallbackProfile(site, snapshot, changes);
  }

  const request = {
    model: env.webResearch.model,
    instructions: skills.siteAnalysisInstructions(),
    input: [
      'SITE',
      JSON.stringify({ id: site.id, origin: site.origin, hostname: site.hostname }),
      '',
      'CURRENT CRAWL EVIDENCE',
      JSON.stringify(snapshot.pages),
      '',
      'CRAWL CHANGE SUMMARY',
      JSON.stringify(changes),
      '',
      'PREVIOUS SITE PROFILE',
      JSON.stringify(previousProfile || null),
      '',
      'Rules specific to this analysis:',
      '- Product/service facts, prices and capabilities must be grounded in CURRENT CRAWL EVIDENCE.',
      '- Live web search may be used to identify market terminology, competitors, substitutes, publishers and external demand context, but must not override first-party product facts.',
      '- visibilityPrompts must be realistic buyer/user questions derived from the discovered business. Normally omit the target brand name so visibility tests are unbiased.',
      '- competitorCandidates must be discovered from current market evidence, not from any preset competitor list.',
      '- semanticChanges should describe material business/search changes, not cosmetic text edits.'
    ].join('\n'),
    tools: [{ type: 'web_search', external_web_access: true }],
    tool_choice: 'auto',
    include: ['web_search_call.action.sources'],
    text: { format: { type: 'json_schema', name: 'growth_site_intelligence', strict: true, schema: profileSchema() } },
    max_output_tokens: 6500
  };
  if (/^gpt-5(?:\.|-)/i.test(env.webResearch.model)) request.reasoning = { effort: 'medium' };

  const response = await axios.post(env.webResearch.baseUrl + '/responses', request, {
    timeout: Math.max(90000, Number(env.webResearch.timeoutMs || 120000)),
    headers: { Authorization: 'Bearer ' + env.webResearch.apiKey, 'Content-Type': 'application/json' }
  });
  const parsed = parseStructured(response.data);
  if (!parsed) throw new Error('Site intelligence model returned an invalid structured profile.');
  return parsed;
}

async function refresh(options = {}) {
  const site = options.site || await growthSites.getSite(options.siteId);
  if (!site) throw new Error('Growth site was not found.');

  const previousSnapshot = await readSetting(snapshotKey(site.id));
  const previousProfile = await readSetting(profileKey(site.id));
  let crawl = options.crawl || null;
  if (!crawl) {
    // Lazy import prevents a circular startup chain:
    // site intelligence -> SEO maintenance -> content/opportunity -> site intelligence.
    const seoMaintenance = require('./growthSeoMaintenanceService');
    crawl = await seoMaintenance.crawlSite({ origin: site.origin, maxPages: options.maxPages || 120 });
  }
  const snapshot = snapshotFromCrawl(site, crawl);
  const changes = diffSnapshots(previousSnapshot, snapshot);

  if (!changes.material && previousProfile && options.force !== true) {
    return {
      site,
      profile: previousProfile.profile || previousProfile,
      snapshot,
      changes,
      reused: true
    };
  }

  let profile;
  try {
    profile = await analyse(site, snapshot, previousProfile?.profile || previousProfile, changes);
  } catch (error) {
    console.warn('[growth-site-intelligence] AI analysis failed; using evidence-only fallback', { error: error?.message || String(error) });
    profile = fallbackProfile(site, snapshot, changes);
  }

  const payload = {
    version: 1,
    skillVersion: skills.VERSION,
    siteId: site.id,
    origin: site.origin,
    generatedAt: new Date().toISOString(),
    profile,
    changes,
    fingerprint: snapshot.fingerprint
  };

  await Promise.all([
    writeSetting(snapshotKey(site.id), snapshot, 'Latest semantic crawl snapshot for the Growth SEO/GEO engine.'),
    writeSetting(profileKey(site.id), payload, 'Discovered business/site profile for the Growth SEO/GEO engine.')
  ]);

  try {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'GROWTH_SITE_INTELLIGENCE_REFRESHED',
        entity: 'GrowthSite',
        entityId: site.id,
        metadata: JSON.stringify({
          origin: site.origin,
          skillVersion: skills.VERSION,
          confidence: profile.confidence,
          addedPages: changes.added.length,
          removedPages: changes.removed.length,
          changedPages: changes.changed.length,
          visibilityPrompts: profile.visibilityPrompts?.length || 0,
          competitors: profile.competitorCandidates?.length || 0
        })
      }
    });
  } catch (_) {}

  return { site, profile, snapshot, changes, reused: false };
}

async function latest(siteId = null) {
  const site = await growthSites.getSite(siteId);
  if (!site) return null;
  const [payload, snapshot] = await Promise.all([
    readSetting(profileKey(site.id)),
    readSetting(snapshotKey(site.id))
  ]);
  return payload ? { site, ...payload, snapshot: snapshot || null } : null;
}

async function visibilityPrompts(siteId = null) {
  const current = await latest(siteId);
  return (current?.profile?.visibilityPrompts || []).filter(Boolean).slice(0, 20);
}

module.exports = {
  PROFILE_KEY,
  SNAPSHOT_KEY,
  profileKey,
  snapshotKey,
  compactPages,
  snapshotFromCrawl,
  diffSnapshots,
  fallbackProfile,
  refresh,
  latest,
  visibilityPrompts
};
