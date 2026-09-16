const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const read = name => fs.readFileSync(path.join(publicDir, name), 'utf8');

test('free social tools are indexable canonical acquisition pages', () => {
  const hub = read('free-social-media-tools.html');
  const captions = read('social-media-caption-generator.html');
  const planner = read('30-day-social-media-content-planner.html');
  for (const source of [hub, captions, planner]) {
    assert.match(source, /name="robots" content="index,follow/);
    assert.match(source, /rel="canonical" href="https:\/\/www\.inxsocial\.co\.uk\//);
    assert.match(source, /portal\/register\.html/);
  }
  assert.match(captions, /id="captionForm"/);
  assert.match(planner, /id="plannerForm"/);
});

test('growth tools stay zero-provider-cost and expose useful share/copy actions', () => {
  const script = read('growth-tools.js');
  assert.doesNotMatch(script, /fetch\s*\(/);
  assert.doesNotMatch(script, /\/api\//);
  assert.match(script, /navigator\.share/);
  assert.match(script, /navigator\.clipboard/);
  assert.match(script, /day <= 30/);
});

test('canonical sitemap and llms index include the free growth tools', () => {
  const sitemap = read('sitemap.xml');
  const llms = read('llms.txt');
  for (const slug of ['free-social-media-tools.html','social-media-caption-generator.html','30-day-social-media-content-planner.html']) {
    assert.match(sitemap, new RegExp(slug.replace('.', '\\.')));
    assert.match(llms, new RegExp(slug.replace('.', '\\.')));
  }
});
