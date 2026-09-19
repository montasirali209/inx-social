const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');

test('Next landing cutover keeps an explicit kill switch and legacy fallback', () => {
  assert.match(appSource, /NEXT_LANDING_ENABLED/);
  assert.match(appSource, /NEXT_LANDING_ORIGIN/);
  assert.match(appSource, /app\.use\('\/_next'/);
  assert.match(appSource, /upstream unavailable; using legacy landing/);
  assert.match(appSource, /failed to read upstream HTML; using legacy landing/);
  assert.match(appSource, /X-INX-Landing', 'next'/);
  assert.match(appSource, /X-INX-Landing', 'legacy'/);
  assert.match(appSource, /return res\.type\('html'\)\.send\(landingDocument\)/);
});

test('Next landing proxy has a bounded upstream timeout', () => {
  assert.match(appSource, /setTimeout\(\(\) => controller\.abort\(\), 2500\)/);
  assert.match(appSource, /if \(!response\.ok\)/);
});

test('production startup verifies the private Next landing path without blocking legacy fallback', () => {
  assert.match(serverSource, /verifyNextLandingUpstream/);
  assert.match(serverSource, /\[landing-proxy\] upstream healthy/);
  assert.match(serverSource, /legacy fallback remains active/);
  assert.match(serverSource, /\$\{origin\}\/health/);
  assert.match(serverSource, /controller\.abort\(\), 2500/);
});
