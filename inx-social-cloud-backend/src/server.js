const app = require('./app');
const env = require('./config/env');
const { startSubscriptionLifecycle } = require('./services/subscriptionLifecycleService');
const { startAgentRuntime } = require('./services/agentRuntimeService');
const { startMediaRetention } = require('./services/mediaRetentionService');
const { startStockVideoRuntime } = require('./services/stockVideoStudioService');
const { startRuntime: startPostForMeRuntime } = require('./services/postForMeService');
const { startAnalyticsCacheRuntime } = require('./services/postForMeAnalyticsService');
const { startBulkCancellationRuntime } = require('./services/postForMePostMutationService');
const prisma = require('./db/prisma');
const { runStorageDiagnostics } = require('./services/storageDiagnosticsService');
const { startAgentAssetBucketBackfill } = require('./services/agentAssetBucketBackfillService');
const { runOneOffXTextSanitizer } = require('./services/oneOffXTextSanitizer');
const { runOneOffGrowthImageRepair } = require('./services/oneOffGrowthImageRepair');
const { startUGCStudioRuntime } = require('./services/ugcStudioService');
const { startAIPostCampaignRuntime } = require('./services/aiPostCampaignService');
const videoModelRegistry = require('./services/videoModelRegistryService');
const aiCredits = require('./services/aiCreditService');
const stripeService = require('./services/stripeService');
const ugcEngine = require('./services/ugcEngineService');
const { startGrowthAutopilot, stopGrowthAutopilot } = require('./services/growthAutopilotService');
const { runProductionSmoke: runUiStudioProductionSmoke } = require('../scripts/ui-studio-production-smoke');

async function verifyNextLandingUpstream() {
  if (!/^(?:1|true|yes|on)$/i.test(String(process.env.NEXT_LANDING_ENABLED || '').trim())) return;

  const origin = String(process.env.NEXT_LANDING_ORIGIN || '').trim().replace(/\/+$/, '');
  if (!origin) {
    console.warn('[landing-proxy] startup probe skipped: NEXT_LANDING_ORIGIN is missing; legacy fallback remains active');
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${origin}/health`, {
      headers: { 'user-agent': 'INXSocial-Landing-Startup-Probe/1.0' },
      signal: controller.signal
    });

    if (response.ok) {
      console.info('[landing-proxy] upstream healthy', { status: response.status });
    } else {
      console.warn('[landing-proxy] upstream health check failed; legacy fallback remains active', { status: response.status });
    }
  } catch (error) {
    console.warn('[landing-proxy] upstream unavailable at startup; legacy fallback remains active', { error: error?.message });
  } finally {
    clearTimeout(timer);
  }
}

const server = app.listen(env.port, () => {
  console.log(`INX Social Cloud Backend running on http://localhost:${env.port}`);
  startSubscriptionLifecycle();
  startAgentRuntime();
  startMediaRetention();
  startStockVideoRuntime();
  startPostForMeRuntime();
  startAnalyticsCacheRuntime();
  startBulkCancellationRuntime();
  startUGCStudioRuntime();
  void startAIPostCampaignRuntime();
  void videoModelRegistry.startRuntime()
    .then(snapshot => console.info('[VIDEO MODEL REGISTRY STARTUP]', JSON.stringify(snapshot)))
    .catch(error => console.warn('[VIDEO MODEL REGISTRY STARTUP] failed', { error: error?.message || String(error) }));
  console.info('[AI CREDIT CONFIG]', JSON.stringify(aiCredits.configurationSnapshot()));
  console.info('[STRIPE PLAN CONFIG]', JSON.stringify(stripeService.configurationSnapshot()));
  void ugcEngine.healthSnapshot().then(snapshot => console.info('[UGC ENGINE CONFIG]', JSON.stringify(snapshot)));
  void runStorageDiagnostics();
  startAgentAssetBucketBackfill();
  void verifyNextLandingUpstream();
  startGrowthAutopilot();
  setTimeout(() => {
    void runOneOffXTextSanitizer().catch((error) => console.error('[one-off-x-cleanup] failed', { error: error?.message || String(error) }));
  }, 3000).unref?.();
  setTimeout(() => {
    void runOneOffGrowthImageRepair().catch(error => console.error('[growth-image-repair] failed', { error: error?.message || String(error) }));
  }, 7000).unref?.();
  if (/^(?:1|true|yes|on)$/i.test(String(process.env.UI_STUDIO_PRODUCTION_SMOKE_ON_STARTUP || '').trim())) {
    setTimeout(() => {
      void runUiStudioProductionSmoke().catch(error => {
        console.error('[ui-studio-production-smoke] startup run failed', { error: error?.message || String(error) });
      });
    }, 5000).unref?.();
  }
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopGrowthAutopilot();
  console.info(`[shutdown] ${signal} received; draining HTTP connections`);
  const forced = setTimeout(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }, 25000);
  forced.unref?.();
  server.close(async () => {
    clearTimeout(forced);
    await prisma.$disconnect().catch(error => console.error('[shutdown] database disconnect failed', { error: error?.message }));
    process.exit(0);
  });
}

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });
