const crypto = require('node:crypto');
const prisma = require('../db/prisma');

const EVENTS = new Set([
  'STUDIO_OPENED',
  'CREATE_STARTED',
  'SOURCE_COMPLETED',
  'BRAND_ANALYZED',
  'FORMAT_SELECTED',
  'CREATOR_SELECTED',
  'DIRECTION_READY',
  'GENERATION_STARTED',
  'GENERATION_COMPLETED',
  'GENERATION_FAILED',
  'EDITOR_OPENED',
  'EDITOR_SAVED',
  'REGENERATION_STARTED',
  'SCENE_REGENERATION_STARTED',
  'REASSEMBLY_STARTED',
  'SCHEDULER_HANDOFF'
]);

function clean(value, max = 300) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function safeMetadata(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const allowed = [
    'sourceType', 'campaignType', 'resolvedType', 'quality', 'duration', 'adCount',
    'creatorMode', 'avatarScope', 'step', 'status', 'credits', 'variationCount',
    'readyCount', 'failedCount', 'hasProductAssets', 'sceneCount', 'recoveryAction', 'renderQualityVersion'
  ];
  const output = {};
  for (const key of allowed) {
    if (!Object.hasOwn(input, key)) continue;
    const value = input[key];
    if (typeof value === 'boolean' || typeof value === 'number') output[key] = value;
    else output[key] = clean(value, 80);
  }
  return output;
}

async function track(userId, input = {}) {
  const event = clean(input.event, 80).toUpperCase();
  if (!EVENTS.has(event)) return false;
  try {
    await prisma.$executeRawUnsafe(
      'INSERT INTO "UGCStudioEvent" ("id","userId","event","stage","campaignId","adId","metadataJson","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)',
      crypto.randomUUID(),
      userId,
      event,
      clean(input.stage, 80) || null,
      clean(input.campaignId, 120) || null,
      clean(input.adId, 120) || null,
      JSON.stringify(safeMetadata(input.metadata))
    );
    return true;
  } catch (error) {
    console.warn('[UGC ANALYTICS]', clean(error?.message, 400));
    return false;
  }
}

function parseJson(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
}

function percentage(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((Number(numerator || 0) / Number(denominator)) * 100).toFixed(1));
}

async function adminSummary(days = 30) {
  const periodDays = Math.max(1, Math.min(180, Number(days || 30)));
  const rows = await prisma.$queryRawUnsafe(
    'SELECT "event","userId","campaignId","adId","metadataJson","createdAt" FROM "UGCStudioEvent" WHERE "createdAt" >= CURRENT_TIMESTAMP - ($1::int * INTERVAL \'1 day\') ORDER BY "createdAt" DESC LIMIT 25000',
    periodDays
  );

  const eventCounts = {};
  const eventUsers = {};
  const quality = {};
  const duration = {};
  const campaignType = {};
  const sourceType = {};
  const failures = {};
  for (const row of rows) {
    eventCounts[row.event] = (eventCounts[row.event] || 0) + 1;
    if (!eventUsers[row.event]) eventUsers[row.event] = new Set();
    eventUsers[row.event].add(row.userId);
    const meta = parseJson(row.metadataJson, {});
    if (row.event === 'GENERATION_STARTED') {
      if (meta.quality) quality[meta.quality] = (quality[meta.quality] || 0) + 1;
      if (meta.duration) duration[String(meta.duration)] = (duration[String(meta.duration)] || 0) + 1;
      if (meta.campaignType || meta.resolvedType) {
        const key = meta.resolvedType || meta.campaignType;
        campaignType[key] = (campaignType[key] || 0) + 1;
      }
      if (meta.sourceType) sourceType[meta.sourceType] = (sourceType[meta.sourceType] || 0) + 1;
    }
    if (row.event === 'GENERATION_FAILED') {
      const key = meta.status || 'FAILED';
      failures[key] = (failures[key] || 0) + 1;
    }
  }

  const unique = event => eventUsers[event]?.size || 0;
  const funnel = [
    ['STUDIO_OPENED', 'Studio opened'],
    ['CREATE_STARTED', 'Create started'],
    ['BRAND_ANALYZED', 'Brand understood'],
    ['CREATOR_SELECTED', 'Creator selected'],
    ['GENERATION_STARTED', 'Generation started'],
    ['GENERATION_COMPLETED', 'Generation completed'],
    ['SCHEDULER_HANDOFF', 'Sent to scheduler']
  ].map(([event, label], index, list) => {
    const users = unique(event);
    const previousUsers = index ? unique(list[index - 1][0]) : users;
    return {
      event,
      label,
      events: eventCounts[event] || 0,
      users,
      stepConversion: index ? percentage(users, previousUsers) : 100,
      fromStudio: percentage(users, unique('STUDIO_OPENED'))
    };
  });

  const campaignRows = await prisma.$queryRawUnsafe(
    'SELECT "status", COUNT(*)::int AS "count" FROM "UGCCampaign" WHERE "deletedAt" IS NULL AND "createdAt" >= CURRENT_TIMESTAMP - ($1::int * INTERVAL \'1 day\') GROUP BY "status"',
    periodDays
  );
  const statusCounts = Object.fromEntries(campaignRows.map(row => [row.status, Number(row.count)]));

  const generationRows = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int AS "count", COALESCE(SUM("creditsUsed"),0)::int AS "credits", COALESCE(SUM("providerCostUsd"),0)::float AS "providerCostUsd" FROM "AiGeneration" WHERE "contentType"=\'ugc_ad\' AND "createdAt" >= CURRENT_TIMESTAMP - ($1::int * INTERVAL \'1 day\')',
    periodDays
  );
  const generation = generationRows[0] || {};

  return {
    periodDays,
    totals: {
      studioOpens: eventCounts.STUDIO_OPENED || 0,
      uniqueStudioUsers: unique('STUDIO_OPENED'),
      campaignsStarted: eventCounts.GENERATION_STARTED || 0,
      campaignsCompleted: eventCounts.GENERATION_COMPLETED || 0,
      campaignsFailed: eventCounts.GENERATION_FAILED || 0,
      editorOpens: eventCounts.EDITOR_OPENED || 0,
      schedulerHandoffs: eventCounts.SCHEDULER_HANDOFF || 0,
      creditsUsed: Number(generation.credits || 0),
      providerCostUsd: Number(Number(generation.providerCostUsd || 0).toFixed(4)),
      generationRows: Number(generation.count || 0)
    },
    campaignStatuses: statusCounts,
    funnel,
    breakdowns: { quality, duration, campaignType, sourceType, failures },
    generatedAt: new Date().toISOString()
  };
}

module.exports = { EVENTS, track, adminSummary, safeMetadata };
