const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`INX Social Cloud Backend running on http://localhost:${env.port}`);
});
