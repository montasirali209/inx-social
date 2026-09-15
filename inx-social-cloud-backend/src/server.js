const app = require('./app');
const env = require('./config/env');
const { startSubscriptionLifecycle } = require('./services/subscriptionLifecycleService');
const { startMetaReelStatusReconciliation } = require('./services/metaReelStatusService');
const { startAgentRuntime } = require('./services/agentRuntimeService');
const { startMediaRetention } = require('./services/mediaRetentionService');
const { startWorker: startLinkedInPublishingWorker } = require('./services/linkedinPublishingService');
const { startStockVideoRuntime } = require('./services/stockVideoStudioService');
const prisma = require('./db/prisma');

const server = app.listen(env.port, () => {
  console.log(`INX Social Cloud Backend running on http://localhost:${env.port}`);
  startSubscriptionLifecycle();
  if (process.env.META_REEL_RECONCILIATION_ENABLED !== 'false') {
    startMetaReelStatusReconciliation();
  }
  startAgentRuntime();
  startMediaRetention();
  startLinkedInPublishingWorker();
  startStockVideoRuntime();
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
