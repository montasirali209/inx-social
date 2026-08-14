const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('canonical legal documents and desktop OAuth callback are packaged', () => {
  for (const file of [
    'public/privacy.html',
    'public/terms.html',
    'public/data-deletion.html',
    'public/oauth-callback.html'
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} is missing`);
  }
});

test('public pages use the canonical social.inaxx.co.uk origin', () => {
  for (const file of ['public/landing.html', 'public/privacy.html', 'public/terms.html', 'public/data-deletion.html']) {
    const source = read(file);
    assert.doesNotMatch(source, /app\.social\.inaxx\.co\.uk/);
    assert.doesNotMatch(source, /https:\/\/inaxx\.co\.uk\/inx-social\/data-deletion\.html/);
  }
});

test('browser and desktop callback paths remain distinct and documented', () => {
  const migration = read('DOMAIN_MIGRATION.md');
  assert.match(migration, /https:\/\/social\.inaxx\.co\.uk\/studio\/facebook-callback\.html/);
  assert.match(migration, /https:\/\/social\.inaxx\.co\.uk\/oauth-callback\.html/);
  assert.match(migration, /https:\/\/api\.social\.inaxx\.co\.uk\/health/);
});
