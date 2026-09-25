const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('completed publishable UGC campaign stays on Finish until the user leaves', () => {
  const wizard = read('frontend/src/components/ai-content-studio/UGCWizardModal.tsx');
  assert.doesNotMatch(wizard, /autoReturnedToStudio/);
  assert.match(wizard, /Your UGC campaign is ready/);
  assert.match(wizard, /You can leave this window at any time/);
  assert.doesNotMatch(wizard, /close automatically and take you back to UGC Studio/);
  assert.match(wizard, /Back to UGC Studio/);
});

test('UGC Studio supports selecting individual publishable videos across campaigns', () => {
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  assert.match(home, /selectedAdIds/);
  assert.match(home, /function toggleVideo/);
  assert.match(home, /function toggleCampaignReady/);
  assert.match(home, /qualityControl\?\.publishable/);
  assert.match(home, /Schedule Now/);
  assert.match(home, /Select ready videos to publish/);
});

test('one selected UGC video opens standard Posts composer with video and caption', () => {
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  const posts = read('frontend/src/components/posts/PostsPage.tsx');
  assert.match(home, /if \(selected\.length === 1\)/);
  assert.match(home, /navigate\('\/posts'/);
  assert.match(home, /standardComposer: true/);
  assert.match(home, /ugcCaption: item\.ad\.caption \|\| item\.ad\.script/);
  assert.match(home, /mediaLibraryAsset: item\.asset/);
  assert.match(posts, /ugcCaption\?: string/);
  assert.match(posts, /setCaption\(state\.ugcCaption\)/);
  assert.match(posts, /setPostType\(asset\.type === 'video' \? 'video' : 'image'\)/);
});

test('multiple selected UGC videos open Bulk Scheduler with per-video captions', () => {
  const home = read('frontend/src/components/ai-content-studio/UGCStudioHomeModal.tsx');
  assert.match(home, /navigate\('\/bulk-scheduler'/);
  assert.match(home, /mediaLibraryAssets: selected\.map/);
  assert.match(home, /contentType: 'VIDEO'/);
  assert.match(home, /caption: ad\.caption \|\| ad\.script/);
  assert.match(home, /selected\.length \+ ' selected UGC videos'/);
});

test('UGC Creative Director generates a separate social post caption rather than copying narration', () => {
  const skill = read('src/services/ugcSkillEngine.js');
  assert.match(skill, /function socialPostCaption/);
  assert.match(skill, /caption is the social-post caption that accompanies the finished video/);
  assert.match(skill, /never copy the full narration verbatim/);
  assert.match(skill, /no hashtag stuffing/);
  assert.match(skill, /caption: socialPostCaption/);
});

test('UGC still preserves burned-in video captions separately from social post caption', () => {
  const skill = read('src/services/ugcSkillEngine.js');
  assert.match(skill, /captions: captionsEnabled \? 'BURNED_IN_AFTER_ASSEMBLY' : 'OFF'/);
  assert.match(skill, /caption: socialPostCaption/);
});
