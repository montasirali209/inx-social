const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('the retired billing portal redirects into the authenticated React billing workspace', () => {
  const app = read('src/app.js');
  const env = read('src/config/env.js');

  assert.match(app, /\['\/portal', '\/portal\/', '\/portal\/index\.html'\]/);
  assert.match(app, /res\.redirect\(308, `\/app\/billing\$\{query\}`\)/);
  assert.match(app, /customerPortal: '\/app\/billing'/);
  assert.match(env, /\/app\/billing\?checkout=success/);
  assert.match(env, /\/app\/billing\?checkout=cancelled/);
  assert.match(env, /\/app\/billing`/);
});

test('sign-in defaults to the main app and securely permits nested app return paths', () => {
  const login = read('portal/login.html');

  assert.match(login, /function safeAppReturn\(value\)/);
  assert.match(login, /destination\.pathname\.startsWith\('\/app\/'\)/);
  assert.match(login, /destination\.origin!==location\.origin/);
  assert.match(login, /value\.startsWith\('\/\/'\)/);
  assert.match(login, /const safeReturn=safeAppReturn\(requestedReturn\)/);
  assert.match(login, /location\.href=safeReturn/);
  assert.doesNotMatch(login, /safeReturn\|\|'index\.html'/);
});

test('customer-facing account and deployment links use the in-app billing workspace', () => {
  const dataDeletion = read('public/data-deletion.html');
  const migration = read('DOMAIN_MIGRATION.md');
  const exampleEnv = read('.env.example');

  assert.match(dataDeletion, /href="\/app\/billing"/);
  assert.doesNotMatch(dataDeletion, /href="\/portal\/"/);
  assert.doesNotMatch(migration, /STRIPE_(?:SUCCESS|CANCEL|PORTAL_RETURN)_URL=https:\/\/www\.inxsocial\.co\.uk\/portal/);
  assert.doesNotMatch(exampleEnv, /STRIPE_(?:SUCCESS|CANCEL|PORTAL_RETURN)_URL=http:\/\/localhost:5050\/portal/);
});
