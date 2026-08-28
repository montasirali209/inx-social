const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('review editor forwards customer image instructions instead of discarding them', () => {
  const adapter = read('studio/web-adapter.js');
  assert.match(adapter, /regenerateAgentCampaignPostImage: async \(campaignId, postId, payload = \{\}\)/);
  assert.match(adapter, /regenerate-image[^\n]+JSON\.stringify\(payload\)/);
});

test('Premium is customer-visible only through the capability-controlled option', () => {
  const html = read('studio/index.html');
  const app = read('studio/app.js');
  assert.match(html, /id="agentPostImagePremiumOption" value="IMAGE_PREMIUM" hidden/);
  assert.match(app, /imageWorker\?\.premiumAvailable === true/);
  assert.match(app, /premiumOption\.hidden = !premiumAvailable/);
});

test('administrator receives governed OpenAI image controls', () => {
  const admin = read('public/index.html');
  assert.match(admin, /Enable paid OpenAI image generation/);
  assert.match(admin, /Local first, then OpenAI after rejection/);
  assert.match(admin, /Maximum paid images per mission/);
  assert.match(admin, /imageQualityModel/);
});
