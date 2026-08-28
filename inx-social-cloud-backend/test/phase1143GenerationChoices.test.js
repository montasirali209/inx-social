const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { buildPlan, mediaCatalog } = require('../src/services/socialAgentPlanner');

test('customer image choices use benefit labels and never expose underlying model names', () => {
  const choices = mediaCatalog('PRO').filter(item => item.kind === 'image');
  assert.deepEqual(choices.map(item => item.code), ['IMAGE_FAST', 'IMAGE_QUALITY']);
  assert.deepEqual(choices.map(item => item.label), ['Fast generation', 'Quality generation']);
  assert.doesNotMatch(JSON.stringify(choices), /z-image|flux|ollama/i);
});

test('Fast and Quality selections persist as private route codes', () => {
  const fast = buildPlan({ prompt: 'Create one Facebook image for our launch', contentOutput: 'IMAGE', mediaModel: 'IMAGE_FAST', subscriptionPlan: 'PRO' });
  const quality = buildPlan({ prompt: 'Create one Facebook image for our launch', contentOutput: 'IMAGE', mediaModel: 'IMAGE_QUALITY', subscriptionPlan: 'PRO' });
  assert.equal(fast.mediaModel, 'IMAGE_FAST');
  assert.equal(quality.mediaModel, 'IMAGE_QUALITY');
  assert.equal(fast.estimatedCredits, 0);
  assert.equal(quality.estimatedCredits, 0);
});

test('Studio fallback copy contains no private image or video model brand names', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'studio', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'studio', 'index.html'), 'utf8');
  assert.match(app, /Fast generation/);
  assert.match(app, /Quality generation/);
  assert.match(html, /Generation preference/);
  assert.match(html, /saves the generated work and pauses before publishing/);
  assert.doesNotMatch(`${app}\n${html}`, /x\/z-image|flux2|Wan 2\.2|LTX 2\.3/);
});

test('customer catalog uses neutral route codes for video choices too', () => {
  const choices = mediaCatalog('PRO').filter(item => ['template', 'generative-video'].includes(item.kind));
  assert.deepEqual(choices.map(item => item.code), ['VIDEO_FAST', 'VIDEO_QUALITY']);
  assert.doesNotMatch(JSON.stringify(choices), /WAN|LTX|OLLAMA|FLUX/i);
});

test('image runtime privately maps Fast and Quality choices to separate configured models', () => {
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'agentMediaService.js'), 'utf8');
  assert.match(service, /generationChoice === 'IMAGE_QUALITY' \? policy\.qualityModel : policy\.model/);
  assert.match(service, /model: resolveImageModel\(policy, generationChoice\)/);
});
