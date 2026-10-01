const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('admin Customers exposes a per-customer Activity action and timeline', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');
  const css = read('public/admin.css');

  assert.match(js, /data-user-activity/);
  assert.match(js, /customerActivityPanel/);
  assert.match(js, /loadCustomerActivity/);
  assert.match(js, /\/api\/admin\/users\/.*\/activity/);
  assert.match(js, /Sign-ins & devices/);
  assert.match(js, /AI generations/);
  assert.match(js, /AI credits/);
  assert.match(html, /customer-dialog/);
  assert.match(css, /\.customer-activity-timeline/);
  assert.match(css, /\.customer-activity-event/);
});

test('customer activity endpoint aggregates operational sources without exposing secrets', () => {
  const routes = read('src/routes/adminRoutes.js');
  const controller = read('src/controllers/adminController.js');
  const service = read('src/services/customerActivityService.js');

  assert.match(routes, /router\.get\('\/users\/:id\/activity', userActivity\)/);
  assert.match(controller, /customerActivityService\.customerActivity/);
  assert.match(service, /prisma\.device\.findMany/);
  assert.match(service, /prisma\.socialConnection\.findMany/);
  assert.match(service, /prisma\.socialContent\.findMany/);
  assert.match(service, /prisma\.scheduleJob\.findMany/);
  assert.match(service, /prisma\.aiPostCampaign\.findMany/);
  assert.match(service, /prisma\.agentEvent\.findMany/);
  assert.match(service, /prisma\.agentAsset\.findMany/);
  assert.match(service, /prisma\.subscription\.findMany/);
  assert.match(service, /prisma\.emailLog\.findMany/);
  assert.match(service, /"AiGeneration"/);
  assert.match(service, /"AiCreditTransaction"/);
  assert.doesNotMatch(service, /encryptedAccessToken|encryptedRefreshToken|passwordHash|tokenHash/);
});

test('successful customer logins are audit logged for future activity history', () => {
  const auth = read('src/controllers/authController.js');
  assert.match(auth, /CUSTOMER_LOGIN_SUCCESS/);
  assert.match(auth, /entity: 'User'/);
  assert.match(auth, /userAgent:/);
  assert.match(auth, /ip:/);
});

test('admin asset cache versions include customer activity UI', () => {
  const html = read('public/index.html');
  assert.match(html, /admin\.css\?v=24/);
  assert.match(html, /admin\.js\?v=31/);
});
