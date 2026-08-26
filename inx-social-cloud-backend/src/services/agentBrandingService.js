const axios = require('axios');
const prisma = require('../db/prisma');

const MAX_BRAND_BYTES = 1024 * 1024;
const TRUSTED_FACEBOOK_HOSTS = ['facebook.com', 'fbcdn.net', 'fbsbx.com'];

function strategyFor(plan) {
  try { return JSON.parse(plan?.strategyJson || '{}'); } catch (_) { return {}; }
}

function trustedFacebookImageUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:') return '';
    const host = url.hostname.toLowerCase();
    return TRUSTED_FACEBOOK_HOSTS.some(domain => host === domain || host.endsWith(`.${domain}`)) ? url.toString() : '';
  } catch (_) { return ''; }
}

function supportedMimeType(value) {
  const mimeType = String(value || '').split(';')[0].trim().toLowerCase();
  return ['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) ? mimeType : '';
}

async function selectedUploadedBrand(plan) {
  if (typeof prisma.agentAsset?.findFirst !== 'function') return null;
  const strategy = strategyFor(plan);
  const references = Array.isArray(strategy.referenceAssets) ? strategy.referenceAssets : [];
  const preferred = references.find(asset => String(asset.kind || '').toUpperCase() === 'LOGO')
    || references.find(asset => String(asset.kind || '').toUpperCase() === 'PROFILE');
  if (!preferred?.id) return null;
  const row = await prisma.agentAsset.findFirst({
    where: { id: String(preferred.id), userId: plan.userId, source: 'UPLOAD', status: 'READY', kind: { in: ['LOGO', 'PROFILE'] } },
    select: { id: true, data: true, mimeType: true }
  });
  if (!row?.data || row.data.length > MAX_BRAND_BYTES || !supportedMimeType(row.mimeType)) return null;
  return { id: row.id, data: Buffer.from(row.data), mimeType: supportedMimeType(row.mimeType), source: 'SELECTED_UPLOAD' };
}

async function connectedPageProfile(plan, dependencies = {}) {
  const strategy = strategyFor(plan);
  const page = (Array.isArray(strategy.pageTargets) ? strategy.pageTargets : []).find(item => trustedFacebookImageUrl(item?.picture));
  const url = trustedFacebookImageUrl(page?.picture);
  if (!url) return null;
  const http = dependencies.http || axios;
  try {
    const response = await http.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 3,
      maxContentLength: MAX_BRAND_BYTES,
      headers: { Accept: 'image/png,image/jpeg,image/webp' }
    });
    const data = Buffer.from(response.data || []);
    const mimeType = supportedMimeType(response.headers?.['content-type']);
    if (!data.length || data.length > MAX_BRAND_BYTES || !mimeType) return null;
    return { id: `page-profile:${page.id}`, data, mimeType, source: 'CONNECTED_PAGE_PROFILE', pageName: page.name || null };
  } catch (_) { return null; }
}

async function exactBrandMark(plan, dependencies = {}) {
  return (await selectedUploadedBrand(plan)) || connectedPageProfile(plan, dependencies);
}

async function visionAssets(userId, plan, dependencies = {}) {
  if (typeof prisma.agentAsset?.findMany !== 'function') return [];
  const strategy = strategyFor(plan);
  const ids = [...new Set((Array.isArray(strategy.referenceAssets) ? strategy.referenceAssets : []).map(asset => String(asset.id || '')).filter(Boolean))].slice(0, 4);
  const rows = ids.length ? await prisma.agentAsset.findMany({
    where: { userId, id: { in: ids }, status: 'READY', source: 'UPLOAD' },
    select: { id: true, mimeType: true, data: true },
    take: 4
  }) : [];
  const assets = rows.filter(row => row.data && row.data.length <= MAX_BRAND_BYTES && supportedMimeType(row.mimeType))
    .map(row => ({ id: row.id, mimeType: supportedMimeType(row.mimeType), base64: Buffer.from(row.data).toString('base64'), source: 'SELECTED_UPLOAD' }));
  if (assets.length < 4) {
    const profile = await connectedPageProfile(plan, dependencies);
    if (profile && !assets.some(asset => asset.id === profile.id)) assets.push({ id: profile.id, mimeType: profile.mimeType, base64: profile.data.toString('base64'), source: profile.source });
  }
  return assets.slice(0, 4);
}

module.exports = { MAX_BRAND_BYTES, strategyFor, trustedFacebookImageUrl, supportedMimeType, selectedUploadedBrand, connectedPageProfile, exactBrandMark, visionAssets };
