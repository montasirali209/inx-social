'use strict';

const crypto = require('crypto');
const prisma = require('../db/prisma');

const REGISTRY_KEY = 'growth_sites_v1';
const DEFAULT_ORIGIN = String(process.env.GROWTH_SITE_ORIGIN || 'https://www.inxsocial.co.uk').replace(/\/+$/, '');

function normaliseOrigin(value) {
  const url = new URL(String(value || DEFAULT_ORIGIN).trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Growth site origin must use http or https.');
  url.hash = '';
  url.search = '';
  url.pathname = '';
  return url.toString().replace(/\/+$/, '');
}

function siteIdForOrigin(origin) {
  return crypto.createHash('sha256').update(normaliseOrigin(origin).toLowerCase()).digest('hex').slice(0, 16);
}

function settingKey(base, siteId) {
  return String(base) + ':' + String(siteId || siteIdForOrigin(DEFAULT_ORIGIN));
}

async function readRegistry() {
  const row = await prisma.appSetting.findUnique({ where: { key: REGISTRY_KEY } });
  if (!row?.value) return null;
  try { return JSON.parse(row.value); } catch (_) { return null; }
}

async function writeRegistry(registry) {
  return prisma.appSetting.upsert({
    where: { key: REGISTRY_KEY },
    create: {
      key: REGISTRY_KEY,
      value: JSON.stringify(registry),
      description: 'Registered websites managed by the Growth SEO/GEO engine.'
    },
    update: {
      value: JSON.stringify(registry),
      description: 'Registered websites managed by the Growth SEO/GEO engine.'
    }
  });
}

function defaultSite() {
  const origin = normaliseOrigin(DEFAULT_ORIGIN);
  return {
    id: siteIdForOrigin(origin),
    origin,
    hostname: new URL(origin).hostname,
    status: 'ACTIVE',
    label: null,
    createdAt: null,
    updatedAt: null
  };
}

async function ensureDefaultSite() {
  const existing = await readRegistry();
  const current = existing && Array.isArray(existing.sites) ? existing : { version: 1, sites: [] };
  const wanted = defaultSite();
  const found = current.sites.find(site => site.id === wanted.id || normaliseOrigin(site.origin) === wanted.origin);
  if (found) return { ...wanted, ...found, origin: wanted.origin, hostname: wanted.hostname, status: found.status || 'ACTIVE' };

  const now = new Date().toISOString();
  const site = { ...wanted, createdAt: now, updatedAt: now };
  current.sites.push(site);
  current.updatedAt = now;
  await writeRegistry(current);
  return site;
}

async function listSites() {
  await ensureDefaultSite();
  const registry = await readRegistry();
  return (registry?.sites || []).map(site => ({
    ...site,
    origin: normaliseOrigin(site.origin),
    hostname: new URL(normaliseOrigin(site.origin)).hostname
  }));
}

async function getSite(siteId = null) {
  const sites = await listSites();
  if (!siteId) return sites.find(site => site.origin === DEFAULT_ORIGIN) || sites[0] || defaultSite();
  return sites.find(site => site.id === siteId) || null;
}

async function registerSite(input = {}) {
  const origin = normaliseOrigin(input.origin);
  const id = siteIdForOrigin(origin);
  const registry = (await readRegistry()) || { version: 1, sites: [] };
  const now = new Date().toISOString();
  const existingIndex = (registry.sites || []).findIndex(site => site.id === id);
  const next = {
    id,
    origin,
    hostname: new URL(origin).hostname,
    status: String(input.status || 'ACTIVE').toUpperCase(),
    label: input.label ? String(input.label).slice(0, 160) : null,
    createdAt: existingIndex >= 0 ? registry.sites[existingIndex].createdAt || now : now,
    updatedAt: now
  };
  if (!Array.isArray(registry.sites)) registry.sites = [];
  if (existingIndex >= 0) registry.sites[existingIndex] = next;
  else registry.sites.push(next);
  registry.updatedAt = now;
  await writeRegistry(registry);
  return next;
}

module.exports = {
  REGISTRY_KEY,
  DEFAULT_ORIGIN,
  normaliseOrigin,
  siteIdForOrigin,
  settingKey,
  defaultSite,
  ensureDefaultSite,
  listSites,
  getSite,
  registerSite
};
