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
const { startUGCStudioRuntime } = require('./services/ugcStudioService');
const aiCredits = require('./services/aiCreditService');
const stripeService = require('./services/stripeService');

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
  console.info('[AI CREDIT CONFIG]', JSON.stringify(aiCredits.configurationSnapshot()));
  console.info('[STRIPE PLAN CONFIG]', JSON.stringify(stripeService.configurationSnapshot()));
  void runStorageDiagnostics();
  startAgentAssetBucketBackfill();
  void verifyNextLandingUpstream();
  setTimeout(() => {
    void runOneOffXTextSanitizer().catch((error) => console.error('[one-off-x-cleanup] failed', { error: error?.message || String(error) }));
  }, 3000).unref?.();
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
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
