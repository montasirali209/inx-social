const crypto = require('node:crypto');
const prisma = require('../db/prisma');
const contract = require('./ugcEngineContract');
const registry = require('./ugcEngineRegistry');
const skills = require('./ugcSkillEngine');
const router = require('./ugcModelRouter');
const creators = require('./ugcCreatorEngine');
const creativeFormats = require('./ugcCreativeFormats');
const studioControls = require('./ugcStudioControls');

const PROJECT_STATUSES = new Set(['PLANNED','RESERVING','QUEUED','RENDERING','READY','PARTIAL','FAILED','CANCELLED']);

function json(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
}

function clean(value, max = 300) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function publicProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaignId,
    engineVersion: row.engineVersion,
    contractVersion: row.contractVersion,
    status: row.status,
    fingerprint: row.fingerprint,
    brief: parseJson(row.briefJson, {}),
    actor: parseJson(row.actorJson, {}),
    skillsVersion: row.skillsVersion || null,
    skills: parseJson(row.skillsJson, {}),
    preflight: parseJson(row.preflightJson, {}),
    routerVersion: row.routerVersion || null,
    router: parseJson(row.routerJson, {}),
    productionPlan: parseJson(row.productionPlanJson, {}),
    routeDecision: parseJson(row.routeDecisionJson, {}),
    pricing: parseJson(row.pricingJson, {}),
    renderJobs: parseJson(row.renderJobsJson, []),
    qc: parseJson(row.qcJson, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function createProject(input) {
  const project = contract.buildEngineProject(input);
  const projectId = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    'INSERT INTO "UGCEngineProject" ("id","campaignId","userId","engineVersion","contractVersion","skillsVersion","routerVersion","status","fingerprint","briefJson","actorJson","skillsJson","preflightJson","routerJson","productionPlanJson","routeDecisionJson","pricingJson","renderJobsJson","qcJson","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("campaignId") DO UPDATE SET "engineVersion"=EXCLUDED."engineVersion","contractVersion"=EXCLUDED."contractVersion","skillsVersion"=EXCLUDED."skillsVersion","routerVersion"=EXCLUDED."routerVersion","status"=EXCLUDED."status","fingerprint"=EXCLUDED."fingerprint","briefJson"=EXCLUDED."briefJson","actorJson"=EXCLUDED."actorJson","skillsJson"=EXCLUDED."skillsJson","preflightJson"=EXCLUDED."preflightJson","routerJson"=EXCLUDED."routerJson","productionPlanJson"=EXCLUDED."productionPlanJson","routeDecisionJson"=EXCLUDED."routeDecisionJson","pricingJson"=EXCLUDED."pricingJson","renderJobsJson"=EXCLUDED."renderJobsJson","qcJson"=EXCLUDED."qcJson","updatedAt"=CURRENT_TIMESTAMP',
    projectId,
    project.campaignId,
    project.userId,
    project.engineVersion,
    project.contractVersion,
    project.skills?.version || skills.SKILLS_VERSION,
    project.router?.version || router.ROUTER_VERSION,
    project.status,
    project.fingerprint,
    json(project.brief),
    json(project.actor),
    json(project.skills?.decisions || {}),
    json(project.skills?.preflight || {}),
    json(project.router || {}),
    json(project.productionPlan),
    json(project.routeDecision),
    json(project.pricing),
    json(project.renderJobs),
    json(project.qc)
  );
  return getProject(project.userId, project.campaignId);
}

async function getProject(userId, campaignId) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT * FROM "UGCEngineProject" WHERE "campaignId"=$1 AND "userId"=$2 LIMIT 1',
    campaignId,
    userId
  );
  return publicProject(rows[0]);
}

async function updateStatus(userId, campaignId, status) {
  const next = clean(status, 30).toUpperCase();
  if (!PROJECT_STATUSES.has(next)) throw new Error('Unsupported UGC engine project status: ' + next);
  await prisma.$executeRawUnsafe(
    'UPDATE "UGCEngineProject" SET "status"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "campaignId"=$1 AND "userId"=$2',
    campaignId,
    userId,
    next
  );
}

async function linkGeneration(userId, campaignId, adSequence, adId, generationId) {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRawUnsafe(
      'SELECT * FROM "UGCEngineProject" WHERE "campaignId"=$1 AND "userId"=$2 FOR UPDATE',
      campaignId,
      userId
    );
    const row = rows[0];
    if (!row) throw new Error('UGC engine project not found for campaign ' + campaignId);
    const jobs = parseJson(row.renderJobsJson, []);
    const sequence = Number(adSequence);
    const index = jobs.findIndex(job => Number(job.adSequence) === sequence);
    if (index < 0) throw new Error('UGC engine render job not found for variation ' + sequence);
    jobs[index] = {
      ...jobs[index],
      adId,
      generationId,
      status: 'RESERVED'
    };
    await tx.$executeRawUnsafe(
      'UPDATE "UGCEngineProject" SET "renderJobsJson"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "campaignId"=$1 AND "userId"=$2',
      campaignId,
      userId,
      json(jobs)
    );
    return jobs[index];
  });
}

async function recordReroute(userId, campaignId, adSequence, adId, reroute = {}) {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRawUnsafe(
      'SELECT * FROM "UGCEngineProject" WHERE "campaignId"=$1 AND "userId"=$2 FOR UPDATE',
      campaignId,
      userId
    );
    const row = rows[0];
    if (!row) return null;
    const jobs = parseJson(row.renderJobsJson, []);
    const sequence = Number(adSequence);
    const index = jobs.findIndex(job => job.adId === adId || Number(job.adSequence) === sequence);
    if (index < 0) return null;
    const sceneRoutes = Array.isArray(reroute.sceneRoutes) ? reroute.sceneRoutes.map(item => ({
      sceneSequence: Number(item.sceneSequence),
      routeKey: clean(item.routeKey, 120),
      adapterKey: clean(item.adapterKey, 120),
      reason: clean(item.reason, 180)
    })) : [];
    const event = {
      routerVersion: clean(reroute.routerVersion || router.ROUTER_VERSION, 80),
      routerMode: clean(reroute.routerMode || router.routerMode(), 40),
      scope: clean(reroute.scope || 'REGENERATION', 40),
      sceneRoutes,
      createdAt: new Date().toISOString()
    };
    const history = Array.isArray(jobs[index].reroutes) ? jobs[index].reroutes.slice(-9) : [];
    jobs[index] = {
      ...jobs[index],
      latestReroute: event,
      reroutes: [...history, event]
    };
    await tx.$executeRawUnsafe(
      'UPDATE "UGCEngineProject" SET "renderJobsJson"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "campaignId"=$1 AND "userId"=$2',
      campaignId,
      userId,
      json(jobs)
    );
    return event;
  });
}

async function recordRenderStatus(userId, campaignId, adId, status, metadata = {}) {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRawUnsafe(
      'SELECT * FROM "UGCEngineProject" WHERE "campaignId"=$1 AND "userId"=$2 FOR UPDATE',
      campaignId,
      userId
    );
    const row = rows[0];
    if (!row) return null;
    const jobs = parseJson(row.renderJobsJson, []);
    const index = jobs.findIndex(job => job.adId === adId);
    if (index < 0) return null;
    jobs[index] = {
      ...jobs[index],
      status: clean(status, 40).toUpperCase(),
      updatedAt: new Date().toISOString(),
      ...(metadata && typeof metadata === 'object' ? { metadata } : {})
    };
    await tx.$executeRawUnsafe(
      'UPDATE "UGCEngineProject" SET "renderJobsJson"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "campaignId"=$1 AND "userId"=$2',
      campaignId,
      userId,
      json(jobs)
    );
    return jobs[index];
  });
}

async function healthSnapshot() {
  return {
    engineVersion: registry.ENGINE_VERSION,
    contractVersion: registry.CONTRACT_VERSION,
    skillsVersion: skills.SKILLS_VERSION,
    routerVersion: router.ROUTER_VERSION,
    creatorVersion: creators.CREATOR_PROFILE_VERSION,
    creativeFormatVersion: creativeFormats.CREATIVE_FORMAT_VERSION,
    studioControlsVersion: studioControls.STUDIO_CONTROLS_VERSION,
    creators: creators.creatorSystemSnapshot(),
    creativeFormats: creativeFormats.formatSnapshot(),
    router: router.routerSnapshot(),
    registry: registry.registrySnapshot(),
    statuses: [...PROJECT_STATUSES]
  };
}

module.exports = {
  PROJECT_STATUSES,
  publicProject,
  createProject,
  getProject,
  updateStatus,
  linkGeneration,
  recordReroute,
  recordRenderStatus,
  healthSnapshot
};
