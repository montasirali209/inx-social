const app = require('./app');
const env = require('./config/env');
const { startSubscriptionLifecycle } = require('./services/subscriptionLifecycleService');

app.listen(env.port, () => {
  console.log(`INX Social Cloud Backend running on http://localhost:${env.port}`);
  startSubscriptionLifecycle();
});
