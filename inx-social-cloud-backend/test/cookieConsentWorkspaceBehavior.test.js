const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('cookie settings does not float over authenticated workspace routes', () => {
  const consent = fs.readFileSync(path.join(root, 'public/analytics-consent.js'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'frontend/src/components/settings/SettingsPage.tsx'), 'utf8');

  assert.match(consent, /function isWorkspaceRoute\(\)/);
  assert.match(consent, /location\.pathname\.startsWith\('\/app\/'\)/);
  assert.match(consent, /if \(isWorkspaceRoute\(\)\) \{/);
  assert.match(consent, /existing\?\.remove\(\)/);
  assert.doesNotMatch(consent, /z-index:2147482999/);
  assert.match(settings, /Cookie preferences/);
  assert.match(settings, /inxCookieSettings/);
});

test('cookie consent banner remains phone-safe and accessible before a choice', () => {
  const consent = fs.readFileSync(path.join(root, 'public/analytics-consent.js'), 'utf8');
  assert.match(consent, /max-height:calc\(100dvh - 20px\)/);
  assert.match(consent, /env\(safe-area-inset-bottom\)/);
  assert.match(consent, /aria-label', 'Analytics cookie choice'/);
});
