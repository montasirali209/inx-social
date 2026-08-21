const app = require('./app');
const env = require('./config/env');
const { startSubscriptionLifecycle } = require('./services/subscriptionLifecycleService');
const { startMetaReelStatusReconciliation } = require('./services/metaReelStatusService');
const { startAgentRuntime } = require('./services/agentRuntimeService');

app.listen(env.port, () => {
  console.log(`INX Social Cloud Backend running on http://localhost:${env.port}`);
  startSubscriptionLifecycle();
  if (process.env.META_REEL_RECONCILIATION_ENABLED !== 'false') {
    startMetaReelStatusReconciliation();
  }
  startAgentRuntime();
});
