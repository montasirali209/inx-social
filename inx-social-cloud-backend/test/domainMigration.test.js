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

test('Google Search Console verification file is packaged unchanged', () => {
  const verificationFile = 'public/google7c26ec3b08d0dfff.html';
  assert.equal(fs.existsSync(path.join(root, verificationFile)), true, `${verificationFile} is missing`);
  assert.equal(read(verificationFile).trim(), 'google-site-verification: google7c26ec3b08d0dfff.html');
});

test('public pages use the canonical www.inxsocial.co.uk origin', () => {
  for (const file of [
    'public/landing.html',
    'public/privacy.html',
    'public/terms.html',
    'public/data-deletion.html',
    'public/social-media-scheduler.html',
    'public/social-media-analytics.html',
    'public/ai-social-media-tools.html',
    'public/pricing.html'
  ]) {
    const source = read(file);
    assert.match(source, /https:\/\/www\.inxsocial\.co\.uk/);
    assert.doesNotMatch(source, /https:\/\/social\.inaxx\.co\.uk/);
    assert.doesNotMatch(source, /app\.social\.inaxx\.co\.uk/);
    assert.doesNotMatch(source, /https:\/\/inaxx\.co\.uk\/inx-social\/data-deletion\.html/);
  }
});

test('browser and desktop callback paths remain distinct and documented', () => {
  const migration = read('DOMAIN_MIGRATION.md');
  assert.match(migration, /https:\/\/www\.inxsocial\.co\.uk\/studio\/facebook-callback\.html/);
  assert.match(migration, /https:\/\/www\.inxsocial\.co\.uk\/oauth-callback\.html/);
  assert.match(migration, /https:\/\/api\.social\.inaxx\.co\.uk\/health/);
});

test('legacy browser hosts permanently redirect safe navigation to the canonical host', () => {
  const source = read('src/app.js');
  assert.match(source, /CANONICAL_BROWSER_HOST = 'www\.inxsocial\.co\.uk'/);
  assert.match(source, /MIGRATION_BROWSER_HOSTS = new Set\(\['social\.inaxx\.co\.uk', 'inxsocial\.co\.uk'\]\)/);
  assert.match(source, /MIGRATION_BROWSER_HOSTS\.has\(host\) && isSafeNavigation && !isApiRequest/);
  assert.match(source, /res\.redirect\(308, destination\.toString\(\)\)/);
});

test('private and utility surfaces emit noindex robot headers before static files', () => {
  const source = read('src/app.js');
  for (const route of ['/admin', '/index.html', '/api', '/portal', '/studio', '/app', '/health', '/oauth-callback.html']) {
    assert.equal(source.includes(`'${route}'`), true, `${route} is missing from crawl controls`);
  }
  assert.match(source, /X-Robots-Tag', 'noindex, nofollow, noarchive'/);
});
