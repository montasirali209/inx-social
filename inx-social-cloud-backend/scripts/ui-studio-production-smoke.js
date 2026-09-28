'use strict';

const crypto = require('node:crypto');
const prisma = require('../src/db/prisma');
const objectStorage = require('../src/services/mediaObjectStorageService');
const uiStudio = require('../src/services/uiStudioService');
const uiStudioAnalysis = require('../src/services/uiStudioAnalysisService');
const uiStudioCodegen = require('../src/services/uiStudioCodegenService');
const previewBuild = require('../src/services/uiStudioPreviewBuildService');
const convergence = require('../src/services/uiStudioConvergenceService');
const delivery = require('../src/services/uiStudioDeliveryService');

const PREFIX = '[ui-studio-production-smoke]';
const PROJECT_PREFIX = '__UI_STUDIO_SMOKE__';
const POLL_MS = 1500;
const TIMEOUT_MS = 4 * 60 * 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runId() {
  return String(process.env.UI_STUDIO_PRODUCTION_SMOKE_RUN_ID || 'phase6-e2e-20260928').trim().slice(0, 120);
}

function enabled() {
  return /^(?:1|true|yes|on)$/i.test(String(process.env.UI_STUDIO_PRODUCTION_SMOKE_ON_STARTUP || '').trim());
}

function projectTemplate() {
  return {
    name: PROJECT_PREFIX + runId(),
    framework: 'HTML_CSS',
    styling: 'PLAIN_CSS',
    outputType: 'FULL_PAGE'
  };
}

function generationTemplate(project) {
  const raw = {
    summary: 'Deterministic production smoke fixture for Phase 5 convergence and Phase 6 export.',
    entryFile: 'index.html',
    files: [
      {
        path: 'index.html',
        language: 'html',
        purpose: 'Smoke-test page entry.',
        content: `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="eyebrow">INXSocial UI Studio</div>
      <h1>Production convergence smoke test</h1>
      <p>Deterministic Browserless, R2, Postgres and delivery validation.</p>
      <div class="actions"><button>Primary action</button><span>Phase 5 → Phase 6</span></div>
    </section>
    <section class="grid">
      <article><b>Desktop</b><span>Responsive layout evidence</span></article>
      <article><b>Tablet</b><span>Regression-safe scoring</span></article>
      <article><b>Mobile</b><span>Immutable ZIP export</span></article>
    </section>
  </main>
</body>
</html>`
      },
      {
        path: 'styles.css',
        language: 'css',
        purpose: 'Responsive smoke-test styles.',
        content: `:root{font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#f8fafc}
*{box-sizing:border-box}
body{margin:0;background:linear-gradient(180deg,#f8fafc,#eef2ff);min-height:100vh}
.shell{width:min(1120px,calc(100% - 48px));margin:0 auto;padding:64px 0}
.hero{background:#fff;border:1px solid #dbe3ec;border-radius:24px;padding:48px;box-shadow:0 18px 60px rgba(15,23,42,.08)}
.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#0f766e}
h1{font-size:clamp(36px,6vw,72px);line-height:1.02;margin:14px 0 18px;max-width:900px}
p{font-size:18px;line-height:1.6;color:#475569;max-width:720px;margin:0}
.actions{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:28px}
button{border:0;border-radius:12px;background:#0f172a;color:#fff;padding:13px 18px;font-weight:800}
.actions span{font-size:13px;font-weight:700;color:#64748b}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:18px}
.grid article{background:#fff;border:1px solid #dbe3ec;border-radius:18px;padding:22px;min-height:120px}
.grid b{display:block;font-size:18px;margin-bottom:8px}
.grid span{font-size:13px;color:#64748b}
@media(max-width:900px){.shell{width:min(100% - 32px,760px);padding:40px 0}.hero{padding:34px}.grid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.shell{width:calc(100% - 24px);padding:24px 0}.hero{padding:24px;border-radius:18px}h1{font-size:38px}.grid{grid-template-columns:1fr}.grid article{min-height:94px}}`
      }
    ],
    componentTree: ['main.shell', 'section.hero', 'section.grid'],
    assetSlots: [],
    responsiveStrategy: {
      desktop: ['Three-column evidence grid'],
      tablet: ['Two-column evidence grid'],
      mobile: ['Single-column evidence grid'],
      breakpoints: [900, 560]
    },
    usageNotes: ['Production smoke fixture only.'],
    warnings: []
  };
  return uiStudioCodegen.normalizeGeneration(raw, project);
}

async function deleteObjects(rows) {
  const objects = rows.filter(item => item?.key);
  for (const item of objects) {
    await objectStorage.deleteObject(item.key, item.provider || null).catch(error => {
      console.warn(PREFIX, 'cleanup object failed', { key: item.key, error: error?.message });
    });
  }
}

async function cleanupProject(projectId) {
  if (!projectId) return;
  const project = await prisma.uiDesignProject.findUnique({
    where: { id: projectId },
    include: {
      references: true,
      renders: true,
      assetBindings: true,
      deliveries: true
    }
  });
  if (!project) return;

  const objects = [
    ...project.references.map(row => ({ key: row.storageKey, provider: row.storageProvider })),
    ...project.assetBindings.map(row => ({ key: row.storageKey, provider: row.storageProvider })),
    ...project.deliveries.map(row => ({ key: row.artifactStorageKey, provider: row.artifactStorageProvider })),
    ...project.renders.flatMap(row => [
      { key: row.previewStorageKey, provider: row.previewStorageProvider },
      { key: row.renderedStorageKey, provider: row.renderedStorageProvider },
      { key: row.diffStorageKey, provider: row.diffStorageProvider }
    ])
  ];
  await deleteObjects(objects);
  await prisma.uiDesignProject.delete({ where: { id: projectId } }).catch(() => {});
}

async function cleanupStaleSmokeProjects() {
  const projects = await prisma.uiDesignProject.findMany({
    where: { name: { startsWith: PROJECT_PREFIX } },
    select: { id: true, createdAt: true }
  });
  const cutoff = Date.now() - 20 * 60 * 1000;
  for (const project of projects) {
    if (new Date(project.createdAt).getTime() < cutoff) await cleanupProject(project.id);
  }
}

async function waitForBatch(projectId, batchId) {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const batch = await convergence.batchDetail(projectId, batchId);
    if (batch.status === 'COMPLETED') return batch;
    if (batch.status === 'FAILED') {
      const detail = (batch.renders || []).map(item => item.viewport + ':' + (item.errorMessage || 'failed')).join(' | ');
      throw new Error('Phase 5 batch failed: ' + detail);
    }
    await sleep(POLL_MS);
  }
  throw new Error('Phase 5 render batch timed out.');
}

async function previousPass(id) {
  return prisma.auditLog.findFirst({
    where: {
      action: 'UI_STUDIO_PRODUCTION_SMOKE_PASSED',
      entity: 'UiDesignSmoke',
      entityId: id
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function record(action, id, metadata) {
  await prisma.auditLog.create({
    data: {
      action,
      entity: 'UiDesignSmoke',
      entityId: id,
      metadata: JSON.stringify(metadata || {})
    }
  });
}

async function runProductionSmoke() {
  const id = runId();
  if (!enabled()) return { skipped: true, reason: 'disabled', runId: id };
  if (await previousPass(id)) {
    console.info(PREFIX, 'already passed', { runId: id });
    return { skipped: true, reason: 'already_passed', runId: id };
  }

  await cleanupStaleSmokeProjects();
  const startedAt = Date.now();
  let projectId = null;
  let deliveryId = null;

  console.info(PREFIX, 'starting', { runId: id });

  try {
    const created = await uiStudio.createProject(projectTemplate());
    projectId = created.id;

    const project = projectTemplate();
    project.id = projectId;
    const generation = generationTemplate(project);
    const viewportSpecs = [
      { viewport: 'DESKTOP', width: 1280, height: 800 },
      { viewport: 'TABLET', width: 820, height: 900 },
      { viewport: 'MOBILE', width: 390, height: 844 }
    ];

    const directRenderHashes = {};
    for (const spec of viewportSpecs) {
      const html = await previewBuild.buildPreviewHtml(generation, project, spec.width, spec.height, {});
      const png = await convergence.renderWithChromium(html, spec.width, spec.height);
      directRenderHashes[spec.viewport] = crypto.createHash('sha256').update(png).digest('hex');
      await uiStudio.uploadReference(projectId, spec.viewport, {
        data: png,
        originalName: 'smoke-' + spec.viewport.toLowerCase() + '.png'
      });
    }

    const references = await prisma.uiDesignReference.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
    const latestReferences = uiStudioAnalysis.latestReferences(references);
    const fingerprint = uiStudioAnalysis.fingerprintReferences(latestReferences);
    const analysisJson = {
      version: uiStudioAnalysis.ANALYSIS_VERSION,
      summary: 'Deterministic production smoke fixture.',
      confidence: 100,
      observations: ['Generated and reference output originate from the same deterministic HTML/CSS fixture.'],
      inferences: [],
      colorTokens: [],
      typography: [],
      spacingScalePx: [],
      radiusScalePx: [],
      effects: [],
      viewportAnalyses: viewportSpecs.map(spec => ({
        viewport: spec.viewport,
        sections: [],
        components: []
      })),
      responsivePlan: { desktop: [], tablet: [], mobile: [], breakpoints: [900, 560] },
      implementationPlan: [],
      warnings: []
    };
    const analysis = await prisma.uiDesignAnalysis.create({
      data: {
        projectId,
        status: 'COMPLETED',
        version: uiStudioAnalysis.ANALYSIS_VERSION,
        model: 'deterministic-production-smoke',
        sourceFingerprint: fingerprint,
        sourceReferencesJson: JSON.stringify(latestReferences.map(uiStudioAnalysis.sourceReferenceDescriptor)),
        analysisJson: JSON.stringify(analysisJson),
        completedAt: new Date()
      }
    });

    const validation = await uiStudioCodegen.validateGenerationBuild(generation, project);
    if (!validation.compileVerified) throw new Error('Deterministic smoke generation did not pass compile validation.');

    const generated = await prisma.uiDesignGeneration.create({
      data: {
        projectId,
        sourceAnalysisId: analysis.id,
        status: validation.ok ? 'READY' : 'READY_WITH_WARNINGS',
        version: uiStudioCodegen.GENERATION_VERSION,
        model: 'deterministic-production-smoke',
        framework: project.framework,
        styling: project.styling,
        outputType: project.outputType,
        sourceFingerprint: fingerprint,
        generationJson: JSON.stringify(generation),
        validationJson: JSON.stringify(validation),
        completedAt: new Date()
      }
    });

    const queued = await convergence.startRenderBatch(projectId, {
      generationId: generated.id,
      autoRepair: false
    });
    const batch = await waitForBatch(projectId, queued.batchId);
    const refreshedGeneration = await prisma.uiDesignGeneration.findUnique({ where: { id: generated.id } });
    const scores = JSON.parse(refreshedGeneration.viewportScoresJson || '{}');
    const viewportScores = Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, Number(value)]));
    const floor = Number(require('../src/config/env').uiStudioConvergence.minimumViewportScore || 78);

    for (const spec of viewportSpecs) {
      if (!Number.isFinite(viewportScores[spec.viewport]) || viewportScores[spec.viewport] < floor) {
        throw new Error('Viewport ' + spec.viewport + ' failed smoke regression floor with score ' + viewportScores[spec.viewport]);
      }
    }

    const bestProject = await prisma.uiDesignProject.findUnique({ where: { id: projectId } });
    if (bestProject.bestGenerationId !== generated.id) throw new Error('Phase 5 did not promote the deterministic generation as regression-safe best.');

    await convergence.acceptGeneration(projectId, generated.id);
    const createdDelivery = await delivery.createDelivery(projectId, { targetMode: 'EXPORT_ONLY' });
    deliveryId = createdDelivery.delivery.id;
    const exported = await delivery.deliveryExport(projectId, deliveryId);
    if (exported.data.readUInt32LE(0) !== 0x04034b50) throw new Error('Phase 6 export is not a valid ZIP local-header stream.');
    const exportHash = crypto.createHash('sha256').update(exported.data).digest('hex');
    if (exportHash !== createdDelivery.delivery.artifactSha256) throw new Error('Phase 6 export SHA-256 does not match persisted delivery metadata.');

    const phase6 = await delivery.phase6Status(projectId);
    if (!phase6.gate?.passed) throw new Error('Phase 6 regression gate did not pass after Phase 5 acceptance.');

    const result = {
      runId: id,
      projectId,
      batchId: batch.batchId,
      generationId: generated.id,
      deliveryId,
      aggregateScore: Number(refreshedGeneration.aggregateScore),
      viewportScores,
      directRenderHashes,
      exportBytes: exported.data.length,
      exportSha256: exportHash,
      rendererConfigured: convergence.rendererConfigured(),
      gatePassed: true,
      durationMs: Date.now() - startedAt
    };

    await record('UI_STUDIO_PRODUCTION_SMOKE_PASSED', id, result);
    console.info(PREFIX, 'PASSED', JSON.stringify(result));
    return result;
  } catch (error) {
    const failure = {
      runId: id,
      projectId,
      deliveryId,
      error: String(error?.stack || error?.message || error).slice(0, 5000),
      durationMs: Date.now() - startedAt
    };
    await record('UI_STUDIO_PRODUCTION_SMOKE_FAILED', id, failure).catch(() => {});
    console.error(PREFIX, 'FAILED', JSON.stringify(failure));
    throw error;
  } finally {
    await cleanupProject(projectId).catch(error => {
      console.warn(PREFIX, 'project cleanup failed', { projectId, error: error?.message });
    });
  }
}

if (require.main === module) {
  runProductionSmoke()
    .then(result => {
      console.log(PREFIX, 'result', JSON.stringify(result));
      return prisma.$disconnect();
    })
    .then(() => process.exit(0))
    .catch(async error => {
      console.error(PREFIX, 'fatal', error?.stack || error);
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    });
}

module.exports = {
  PREFIX,
  PROJECT_PREFIX,
  enabled,
  runId,
  generationTemplate,
  cleanupProject,
  runProductionSmoke
};
