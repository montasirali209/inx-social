const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const requiredAiLabels = [
  'AI Campaign',
  'Image Post',
  'Carousel Post',
  'AI Video / Reels',
  'Image-to-video',
  'Stock Video Creator',
  'UGC Ad Studio',
  'AI captions, rewrites, hashtags, CTA &amp; alt text',
];

test('every landing pricing tier names the complete AI creation suite', () => {
  for (const relative of ['public/landing.html', '../landing-next/public/landing-body.html']) {
    const source = read(relative);
    assert.equal((source.match(/class="plan-ai-suite"/g) || []).length, 5);
    assert.equal((source.match(/class="plan-ai-features"/g) || []).length, 5);
    assert.equal((source.match(/class="plan-credit-row"/g) || []).length, 5);
    assert.match(source, /Every plan includes the complete publishing workflow and the same AI creation suite/);
    for (const label of requiredAiLabels) {
      assert.equal((source.match(new RegExp(label.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&'), 'g')) || []).length >= 5, true, `${label} should be listed for every plan in ${relative}`);
    }
    assert.match(source, /20 shared AI credits for the 7-day trial/);
    assert.match(source, /150 shared AI credits \/ month/);
    assert.match(source, /500 shared AI credits \/ month/);
    assert.match(source, /1,200 shared AI credits \/ month/);
    assert.match(source, /2,500 shared AI credits \/ month/);
    assert.equal((source.match(/Extra credit packs in Billing &amp; Plans when available/g) || []).length, 4);
  }
});

test('dedicated pricing page describes the same AI suite and trial access', () => {
  const source = read('public/pricing.html');
  for (const label of ['AI Campaign', 'Image Post', 'Carousel Post', 'AI Video/Reels', 'image-to-video', 'Stock Video Creator', 'UGC Ad Studio']) {
    assert.match(source, new RegExp(label.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /20 shared AI credits during the trial/);
  assert.match(source, /complete AI creation suite/i);
});

test('landing pricing CSS includes a compact AI-suite treatment in both landing implementations', () => {
  for (const relative of ['public/landing-redesign.css', '../landing-next/styles/landing-redesign.css']) {
    const source = read(relative);
    assert.match(source, /\.plan-card \.plan-ai-suite/);
    assert.match(source, /\.plan-card \.plan-ai-features>li/);
    assert.match(source, /\.plan-card \.plan-credit-row/);
  }
});
