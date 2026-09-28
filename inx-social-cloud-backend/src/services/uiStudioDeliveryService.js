'use strict';

const crypto = require('node:crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const objectStorage = require('./mediaObjectStorageService');
const uiStudioAnalysis = require('./uiStudioAnalysisService');

const DELIVERY_VERSION = 'ui-delivery-v1';
const TARGET_MODES = new Set(['EXPORT_ONLY', 'REPOSITORY']);
const MAX_EXPORT_BYTES = 8 * 1024 * 1024;

function publicError(message, status = 400, code = 'UI_STUDIO_PHASE6_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function safeParse(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (_) { return fallback; }
}

function slug(value) {
  return String(value || 'ui-studio')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'ui-studio';
}

function safeRelativePath(value, { allowEmpty = false } = {}) {
  const normalized = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalized) {
    if (allowEmpty) return '';
    throw publicError('Choose a valid repository path.', 400, 'UI_STUDIO_PHASE6_PATH_REQUIRED');
  }
  if (normalized.length > 300 || normalized.includes('\0')) {
    throw publicError('Repository path is too long or invalid.', 400, 'UI_STUDIO_PHASE6_PATH_INVALID');
  }
  const parts = normalized.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || !/^[A-Za-z0-9._@+ -]+$/.test(part))) {
    throw publicError('Repository paths must be relative and may not contain traversal segments.', 400, 'UI_STUDIO_PHASE6_PATH_INVALID');
  }
  return parts.join('/');
}

function normalizeRepository(value) {
  const repo = String(value || '').trim();
  if (!repo) return null;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw publicError('Repository must use owner/name format.', 400, 'UI_STUDIO_PHASE6_REPOSITORY_INVALID');
  }
  return repo;
}

function normalizeBranch(value, fallback = 'main') {
  const branch = String(value || fallback || 'main').trim();
  if (!branch || branch.length > 180 || branch.startsWith('/') || branch.endsWith('/') || branch.includes('..') || /[~^:?*\[\\\s]/.test(branch)) {
    throw publicError('Choose a valid Git branch name.', 400, 'UI_STUDIO_PHASE6_BRANCH_INVALID');
  }
  return branch;
}

function capabilityStatus() {
  const config = env.uiStudioDelivery || {};
  return {
    version: DELIVERY_VERSION,
    githubConfigured: Boolean(config.githubToken && config.apiBaseUrl),
    defaultRepository: config.repository || null,
    defaultBaseBranch: config.baseBranch || 'deployment/railway-postgres',
    defaultTargetDirectory: config.targetDirectory || '',
    approvalRequired: true,
    automaticLiveOverwrite: false,
    deploymentMode: 'PULL_REQUEST_REVIEW'
  };
}

function serializeDelivery(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    generationId: row.generationId,
    version: row.version || DELIVERY_VERSION,
    status: row.status,
    targetMode: row.targetMode,
    repository: row.repository || null,
    baseBranch: row.baseBranch || null,
    targetDirectory: row.targetDirectory || '',
    branchName: row.branchName || null,
    pullRequestNumber: row.pullRequestNumber || null,
    pullRequestUrl: row.pullRequestUrl || null,
    commitSha: row.commitSha || null,
    mergeSha: row.mergeSha || null,
    mapping: safeParse(row.mappingJson, []),
    regression: safeParse(row.regressionJson, null),
    artifactFileName: row.artifactFileName || null,
    artifactByteSize: Number(row.artifactByteSize || 0),
    artifactSha256: row.artifactSha256 || null,
    downloadUrl: row.artifactStorageKey
      ? `/api/admin/ui-studio/projects/${encodeURIComponent(row.projectId)}/phase6/deliveries/${encodeURIComponent(row.id)}/export`
      : null,
    approvedByUserId: row.approvedByUserId || null,
    approvedAt: row.approvedAt || null,
    deploymentTriggeredAt: row.deploymentTriggeredAt || null,
    errorMessage: row.errorMessage || null,
    createdByUserId: row.createdByUserId || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = crcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path.replace(/\\/g, '/'), 'utf8');
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data ?? ''), 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}

function latestReferenceMap(references) {
  const latest = uiStudioAnalysis.latestReferences(references || []);
  return Object.fromEntries(latest.map(reference => [reference.viewport, reference]));
}

function generationFiles(generation) {
  const result = safeParse(generation?.generationJson, null);
  const files = Array.isArray(result?.files) ? result.files : [];
  if (!files.length) throw publicError('Accepted generation has no source files.', 422, 'UI_STUDIO_PHASE6_FILES_MISSING');
  return { result, files };
}

async function deliveryContext(projectId) {
  const project = await prisma.uiDesignProject.findUnique({
    where: { id: String(projectId || '').trim() },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 100 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
      deliveries: { orderBy: { createdAt: 'desc' }, take: 25 }
    }
  });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');
  const generation = project.acceptedGenerationId
    ? await prisma.uiDesignGeneration.findFirst({ where: { id: project.acceptedGenerationId, projectId: project.id } })
    : null;
  return { project, generation };
}

async function regressionGate(project, generation) {
  if (!generation || project.acceptedGenerationId !== generation.id) {
    throw publicError('Accept the Phase 5 best generation before creating a delivery.', 422, 'UI_STUDIO_PHASE6_ACCEPTED_REQUIRED');
  }
  if (generation.qualityStatus === 'REJECTED_REGRESSION' || generation.qualityStatus === 'RENDER_FAILED') {
    throw publicError('The accepted generation is not regression-safe.', 409, 'UI_STUDIO_PHASE6_REGRESSION_REJECTED');
  }
  const referenceMap = latestReferenceMap(project.references);
  const references = Object.values(referenceMap);
  if (!references.length) throw publicError('Current reference images are missing.', 422, 'UI_STUDIO_PHASE6_REFERENCES_REQUIRED');
  const fingerprint = uiStudioAnalysis.fingerprintReferences(references);
  const analysis = project.analyses[0] || null;
  if (!analysis || analysis.status !== 'COMPLETED' || analysis.sourceFingerprint !== fingerprint) {
    throw publicError('Re-run design analysis before delivery because the current references changed.', 422, 'UI_STUDIO_PHASE6_ANALYSIS_STALE');
  }
  if (generation.sourceFingerprint !== fingerprint || generation.sourceAnalysisId !== analysis.id) {
    throw publicError('The accepted generation is stale against the current references.', 422, 'UI_STUDIO_PHASE6_GENERATION_STALE');
  }
  const validation = safeParse(generation.validationJson, {});
  if (!validation.compileVerified || !Array.isArray(validation.checks) || !validation.checks.some(item => item.key === 'BUILD_COMPILE' && item.ok)) {
    throw publicError('The accepted generation must pass the real compile gate before delivery.', 422, 'UI_STUDIO_PHASE6_COMPILE_REQUIRED');
  }
  const scores = safeParse(generation.viewportScoresJson, {});
  const floor = Number(env.uiStudioConvergence?.minimumViewportScore || 78);
  const viewportResults = [];
  for (const viewport of Object.keys(referenceMap)) {
    const score = Number(scores?.[viewport]);
    viewportResults.push({ viewport, referenceId: referenceMap[viewport].id, score, passed: Number.isFinite(score) && score >= floor });
  }
  if (!viewportResults.every(item => item.passed)) {
    throw publicError(`Phase 6 regression gate requires every current viewport to score at least ${floor}.`, 409, 'UI_STUDIO_PHASE6_VIEWPORT_GATE_FAILED');
  }
  const renders = await prisma.uiDesignRender.findMany({
    where: {
      generationId: generation.id,
      referenceId: { in: references.map(item => item.id) },
      status: 'COMPLETED'
    },
    orderBy: { completedAt: 'desc' }
  });
  const renderedReferenceIds = new Set(renders.map(item => item.referenceId));
  if (references.some(item => !renderedReferenceIds.has(item.id))) {
    throw publicError('Run Phase 5 on every current viewport before delivery.', 422, 'UI_STUDIO_PHASE6_RENDER_EVIDENCE_REQUIRED');
  }
  return {
    passed: true,
    checkedAt: new Date().toISOString(),
    aggregateScore: Number(generation.aggregateScore),
    minimumViewportScore: floor,
    viewportResults,
    compileVerified: true,
    acceptedGenerationId: generation.id,
    sourceFingerprint: fingerprint
  };
}

function buildMapping(files, input = {}, defaults = {}) {
  const targetDirectory = safeRelativePath(
    input.targetDirectory != null ? input.targetDirectory : defaults.targetDirectory,
    { allowEmpty: true }
  );
  const sourcePaths = new Set(files.map(file => file.path));
  const overrides = new Map();
  for (const item of Array.isArray(input.mapping) ? input.mapping : []) {
    const sourcePath = safeRelativePath(item?.sourcePath);
    const targetPath = safeRelativePath(item?.targetPath);
    if (!sourcePaths.has(sourcePath)) throw publicError('Delivery mapping references an unknown generated file.', 400, 'UI_STUDIO_PHASE6_MAPPING_SOURCE_INVALID');
    overrides.set(sourcePath, targetPath);
  }
  const mapped = files.map(file => {
    const targetPath = overrides.get(file.path)
      || safeRelativePath([targetDirectory, file.path].filter(Boolean).join('/'));
    return { sourcePath: file.path, targetPath, content: String(file.content || '') };
  });
  const targets = mapped.map(item => item.targetPath);
  if (new Set(targets).size !== targets.length) {
    throw publicError('Two generated files map to the same repository path.', 409, 'UI_STUDIO_PHASE6_MAPPING_COLLISION');
  }
  return { targetDirectory, mapped };
}

async function storeExport(project, generation, mapping, regression) {
  const manifest = {
    version: DELIVERY_VERSION,
    project: { id: project.id, name: project.name, framework: project.framework, styling: project.styling, outputType: project.outputType },
    acceptedGenerationId: generation.id,
    aggregateScore: generation.aggregateScore,
    viewportScores: safeParse(generation.viewportScoresJson, {}),
    regression,
    mapping: mapping.map(item => ({ sourcePath: item.sourcePath, targetPath: item.targetPath }))
  };
  const zip = zipStore([
    ...mapping.map(item => ({ path: item.targetPath, data: item.content })),
    { path: 'UI_STUDIO_DELIVERY.json', data: JSON.stringify(manifest, null, 2) + '\n' }
  ]);
  if (zip.length > MAX_EXPORT_BYTES) {
    throw publicError('Delivery export exceeds the safe package size limit.', 413, 'UI_STUDIO_PHASE6_EXPORT_TOO_LARGE');
  }
  const status = objectStorage.providerStatus();
  if (!status.cloudflareR2Configured) throw publicError('Cloudflare R2 is required for delivery exports.', 503, 'UI_STUDIO_PHASE6_R2_REQUIRED');
  const fileName = `${slug(project.name)}-${generation.id.slice(-8)}.zip`;
  const stored = await objectStorage.persistBuffer({
    userId: 'delivery-' + project.id,
    data: zip,
    mimeType: 'application/zip',
    originalName: fileName,
    prefix: 'ui-studio'
  });
  if (stored.storageProvider !== objectStorage.PROVIDERS.CLOUDFLARE_R2 || !stored.storageKey) {
    if (stored.storageKey) await objectStorage.deleteObject(stored.storageKey, stored.storageProvider).catch(() => {});
    throw publicError('Delivery export could not be stored in Cloudflare R2.', 503, 'UI_STUDIO_PHASE6_R2_REQUIRED');
  }
  return {
    storageProvider: stored.storageProvider,
    storageKey: stored.storageKey,
    fileName,
    byteSize: zip.length,
    sha256: crypto.createHash('sha256').update(zip).digest('hex')
  };
}

async function phase6Status(projectId) {
  const { project, generation } = await deliveryContext(projectId);
  let gate = null;
  if (generation) {
    try { gate = await regressionGate(project, generation); }
    catch (error) { gate = { passed: false, code: error.code || 'UI_STUDIO_PHASE6_GATE_FAILED', message: error.publicMessage || error.message }; }
  }
  return {
    ...capabilityStatus(),
    acceptedGenerationId: project.acceptedGenerationId || null,
    acceptedAt: project.acceptedAt || null,
    gate,
    deliveries: (project.deliveries || []).map(serializeDelivery)
  };
}

async function createDelivery(projectId, input = {}, createdByUserId = null) {
  const { project, generation } = await deliveryContext(projectId);
  const regression = await regressionGate(project, generation);
  const { result, files } = generationFiles(generation);
  const targetMode = String(input.targetMode || 'EXPORT_ONLY').trim().toUpperCase();
  if (!TARGET_MODES.has(targetMode)) throw publicError('Unsupported Phase 6 delivery mode.', 400, 'UI_STUDIO_PHASE6_MODE_INVALID');

  const config = env.uiStudioDelivery || {};
  const repository = targetMode === 'REPOSITORY' ? normalizeRepository(input.repository || config.repository) : null;
  const baseBranch = targetMode === 'REPOSITORY' ? normalizeBranch(input.baseBranch || config.baseBranch || 'deployment/railway-postgres') : null;
  if (targetMode === 'REPOSITORY' && !repository) {
    throw publicError('Choose a target GitHub repository before creating a repository delivery.', 422, 'UI_STUDIO_PHASE6_REPOSITORY_REQUIRED');
  }
  const mapped = buildMapping(files, input, { targetDirectory: config.targetDirectory || '' });
  const stored = await storeExport(project, generation, mapped.mapped, regression);
  const branchName = targetMode === 'REPOSITORY'
    ? `ui-studio/${slug(project.name)}-${crypto.randomBytes(4).toString('hex')}`
    : null;
  try {
    const row = await prisma.uiDesignDelivery.create({
      data: {
        projectId: project.id,
        generationId: generation.id,
        version: DELIVERY_VERSION,
        status: 'READY',
        targetMode,
        repository,
        baseBranch,
        targetDirectory: mapped.targetDirectory,
        branchName,
        mappingJson: JSON.stringify(mapped.mapped.map(item => ({ sourcePath: item.sourcePath, targetPath: item.targetPath }))),
        regressionJson: JSON.stringify(regression),
        artifactStorageProvider: stored.storageProvider,
        artifactStorageKey: stored.storageKey,
        artifactFileName: stored.fileName,
        artifactByteSize: BigInt(stored.byteSize),
        artifactSha256: stored.sha256,
        createdByUserId: createdByUserId ? String(createdByUserId) : null
      }
    });
    return { delivery: serializeDelivery(row), fileCount: result.files.length };
  } catch (error) {
    await objectStorage.deleteObject(stored.storageKey, stored.storageProvider).catch(() => {});
    throw error;
  }
}

async function deliveryExport(projectId, deliveryId) {
  const row = await prisma.uiDesignDelivery.findFirst({
    where: { id: String(deliveryId || '').trim(), projectId: String(projectId || '').trim() }
  });
  if (!row || !row.artifactStorageKey) throw publicError('Delivery export was not found.', 404, 'UI_STUDIO_PHASE6_EXPORT_NOT_FOUND');
  const data = await objectStorage.getBuffer(row.artifactStorageKey, null, row.artifactStorageProvider);
  return {
    data,
    fileName: row.artifactFileName || 'ui-studio-delivery.zip',
    sha256: row.artifactSha256
  };
}

function githubConfigured() {
  const config = env.uiStudioDelivery || {};
  return Boolean(config.githubToken && config.apiBaseUrl);
}

async function github(method, path, data = undefined) {
  const config = env.uiStudioDelivery || {};
  if (!githubConfigured()) throw publicError('GitHub PR automation is not configured for UI Studio.', 503, 'UI_STUDIO_PHASE6_GITHUB_NOT_CONFIGURED');
  try {
    const response = await axios({
      method,
      url: config.apiBaseUrl.replace(/\/$/, '') + path,
      data,
      timeout: 30000,
      maxBodyLength: 12 * 1024 * 1024,
      headers: {
        Authorization: 'Bearer ' + config.githubToken,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'INXSocial-UI-Studio'
      }
    });
    return response.data;
  } catch (caught) {
    const status = Number(caught?.response?.status || 502);
    const detail = String(caught?.response?.data?.message || caught.message || 'GitHub request failed.').slice(0, 500);
    throw publicError('GitHub delivery failed: ' + detail, status >= 400 && status < 600 ? status : 502, 'UI_STUDIO_PHASE6_GITHUB_FAILED');
  }
}

function repoPath(repo) {
  const [owner, name] = String(repo || '').split('/');
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

async function deliveryWithGeneration(projectId, deliveryId) {
  const delivery = await prisma.uiDesignDelivery.findFirst({
    where: { id: String(deliveryId || '').trim(), projectId: String(projectId || '').trim() },
    include: { project: true, generation: true }
  });
  if (!delivery) throw publicError('Phase 6 delivery was not found.', 404, 'UI_STUDIO_PHASE6_DELIVERY_NOT_FOUND');
  if (delivery.project.acceptedGenerationId !== delivery.generationId) {
    throw publicError('This delivery is stale because another generation is now accepted.', 409, 'UI_STUDIO_PHASE6_DELIVERY_STALE');
  }
  return delivery;
}

async function createPullRequest(projectId, deliveryId) {
  const delivery = await deliveryWithGeneration(projectId, deliveryId);
  if (delivery.targetMode !== 'REPOSITORY' || !delivery.repository || !delivery.baseBranch || !delivery.branchName) {
    throw publicError('This delivery is export-only. Create a repository delivery to open a PR.', 409, 'UI_STUDIO_PHASE6_PR_MODE_REQUIRED');
  }
  if (delivery.pullRequestNumber) return serializeDelivery(delivery);
  const mapping = safeParse(delivery.mappingJson, []);
  const generation = generationFiles(delivery.generation);
  const fileMap = new Map(generation.files.map(file => [file.path, file]));
  const repo = repoPath(delivery.repository);
  try {
    const baseRef = await github('GET', repo + '/git/ref/heads/' + delivery.baseBranch.split('/').map(encodeURIComponent).join('/'));
    const baseSha = baseRef?.object?.sha;
    if (!baseSha) throw publicError('Could not resolve the target base branch.', 502, 'UI_STUDIO_PHASE6_BASE_REF_MISSING');
    const baseCommit = await github('GET', repo + '/git/commits/' + encodeURIComponent(baseSha));
    const baseTree = baseCommit?.tree?.sha;
    if (!baseTree) throw publicError('Could not resolve the target repository tree.', 502, 'UI_STUDIO_PHASE6_BASE_TREE_MISSING');

    const tree = [];
    for (const item of mapping) {
      const file = fileMap.get(item.sourcePath);
      if (!file) throw publicError('Delivery mapping no longer matches the accepted generation.', 409, 'UI_STUDIO_PHASE6_MAPPING_STALE');
      const blob = await github('POST', repo + '/git/blobs', { content: String(file.content || ''), encoding: 'utf-8' });
      tree.push({ path: item.targetPath, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const nextTree = await github('POST', repo + '/git/trees', { base_tree: baseTree, tree });
    const commit = await github('POST', repo + '/git/commits', {
      message: `UI Studio delivery: ${delivery.project.name}`,
      tree: nextTree.sha,
      parents: [baseSha]
    });
    await github('POST', repo + '/git/refs', { ref: 'refs/heads/' + delivery.branchName, sha: commit.sha });
    const pr = await github('POST', repo + '/pulls', {
      title: `UI Studio: ${delivery.project.name}`,
      head: delivery.branchName,
      base: delivery.baseBranch,
      body: [
        'UI Studio Phase 6 delivery.',
        '',
        `Accepted generation: ${delivery.generationId}`,
        `Aggregate visual score: ${delivery.generation.aggregateScore ?? 'n/a'}`,
        'Phase 5 regression gate: passed',
        '',
        'This PR requires explicit human approval. UI Studio does not silently overwrite the live application.'
      ].join('\n')
    });
    const updated = await prisma.uiDesignDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'PR_CREATED',
        commitSha: commit.sha,
        pullRequestNumber: Number(pr.number),
        pullRequestUrl: String(pr.html_url || ''),
        errorMessage: null
      }
    });
    return serializeDelivery(updated);
  } catch (error) {
    await prisma.uiDesignDelivery.update({
      where: { id: delivery.id },
      data: { errorMessage: String(error.publicMessage || error.message || 'PR creation failed.').slice(0, 1000) }
    }).catch(() => {});
    throw error;
  }
}

async function approveDelivery(projectId, deliveryId, approvedByUserId) {
  const delivery = await deliveryWithGeneration(projectId, deliveryId);
  if (delivery.status === 'DEPLOY_TRIGGERED') return serializeDelivery(delivery);
  if (delivery.targetMode === 'REPOSITORY' && !delivery.pullRequestNumber) {
    throw publicError('Create the delivery pull request before approving repository deployment.', 409, 'UI_STUDIO_PHASE6_PR_REQUIRED');
  }
  const updated = await prisma.uiDesignDelivery.update({
    where: { id: delivery.id },
    data: {
      status: 'APPROVED',
      approvedByUserId: approvedByUserId ? String(approvedByUserId) : null,
      approvedAt: new Date(),
      errorMessage: null
    }
  });
  return serializeDelivery(updated);
}

async function deployDelivery(projectId, deliveryId) {
  const delivery = await deliveryWithGeneration(projectId, deliveryId);
  if (delivery.targetMode !== 'REPOSITORY' || !delivery.pullRequestNumber) {
    throw publicError('Only an approved repository delivery can trigger deployment.', 409, 'UI_STUDIO_PHASE6_DEPLOY_REPOSITORY_REQUIRED');
  }
  if (!delivery.approvedAt || delivery.status !== 'APPROVED') {
    throw publicError('Human approval is required before deployment.', 409, 'UI_STUDIO_PHASE6_APPROVAL_REQUIRED');
  }
  const repo = repoPath(delivery.repository);
  const merged = await github('PUT', repo + '/pulls/' + Number(delivery.pullRequestNumber) + '/merge', {
    commit_title: `UI Studio delivery: ${delivery.project.name}`,
    merge_method: 'squash'
  });
  if (!merged?.merged) {
    throw publicError('GitHub did not merge the approved delivery PR.', 409, 'UI_STUDIO_PHASE6_MERGE_NOT_COMPLETED');
  }
  const updated = await prisma.uiDesignDelivery.update({
    where: { id: delivery.id },
    data: {
      status: 'DEPLOY_TRIGGERED',
      mergeSha: String(merged.sha || ''),
      deploymentTriggeredAt: new Date(),
      errorMessage: null
    }
  });
  return serializeDelivery(updated);
}

module.exports = {
  DELIVERY_VERSION,
  MAX_EXPORT_BYTES,
  capabilityStatus,
  serializeDelivery,
  zipStore,
  regressionGate,
  phase6Status,
  createDelivery,
  deliveryExport,
  createPullRequest,
  approveDelivery,
  deployDelivery
};
