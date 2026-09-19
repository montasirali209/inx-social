const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

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
