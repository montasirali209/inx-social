const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('public SEO reflects the current seven-day commercial trial', () => {
  for (const page of [
    'public/social-media-scheduler.html',
    'public/bulk-social-media-scheduler.html',
    'public/social-media-content-calendar.html',
    'public/social-media-analytics.html',
    'public/ai-social-media-tools.html'
  ]) {
    const html = read(page);
    assert.doesNotMatch(html, /5-day trial/i, `${page} still contains the retired 5-day trial`);
  }
  const pricing = read('public/pricing.html');
  assert.match(pricing, /Trial — £0/);
  assert.match(pricing, /Seven days/);
  assert.match(pricing, /Creator — £18\.99\/month/);
  assert.match(pricing, /Agency — £99\.99\/month/);
});

test('analytics SEO matches publish-date reporting and measured live trends', () => {
  const page = read('public/social-media-analytics.html');
  assert.match(page, /Content Performance by Publish Date/);
  assert.match(page, /Live Performance Trend/);
  assert.match(page, /up to three selected connected account sources/i);
  assert.match(page, /does not fabricate earlier daily history/i);
  assert.doesNotMatch(page, /Post for Me-backed/i);
  assert.doesNotMatch(page, /Explore Pro analytics/i);
});

test('calendar SEO documents imported native publishing history', () => {
  const page = read('public/social-media-content-calendar.html');
  assert.match(page, /posts published natively outside INXSocial/i);
  assert.match(page, /Historical feed posts are read-only/i);
  assert.match(page, /needs-review/i);
});

test('homepage fallback and GEO file expose current platform and plan facts', () => {
  const landing = read('public/landing.html');
  const llms = read('public/llms.txt');
  for (const network of ['Facebook','Instagram','LinkedIn','TikTok','YouTube','Pinterest','Threads','Bluesky','X']) {
    assert.match(landing, new RegExp(network));
    assert.match(llms, new RegExp(network));
  }
  assert.match(llms, /Trial: £0 for 7 days/);
  assert.match(llms, /Creator: £18\.99\/month/);
  assert.match(llms, /Business: £59\.99\/month/);
  assert.match(llms, /Agency: £99\.99\/month/);
  assert.match(llms, /Content Performance by Publish Date/);
  assert.match(llms, /Live Performance Trend/);
});
