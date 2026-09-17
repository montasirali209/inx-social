const app = require('./app');
const env = require('./config/env');
const { startSubscriptionLifecycle } = require('./services/subscriptionLifecycleService');
const { startAgentRuntime } = require('./services/agentRuntimeService');
const { startMediaRetention } = require('./services/mediaRetentionService');
const { startStockVideoRuntime } = require('./services/stockVideoStudioService');
const { startRuntime: startPostForMeRuntime } = require('./services/postForMeService');
const prisma = require('./db/prisma');

const server = app.listen(env.port, () => {
  console.log(`INX Social Cloud Backend running on http://localhost:${env.port}`);
  startSubscriptionLifecycle();
  startAgentRuntime();
  startMediaRetention();
  startStockVideoRuntime();
  startPostForMeRuntime();
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
