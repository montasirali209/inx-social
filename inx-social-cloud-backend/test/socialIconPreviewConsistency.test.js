const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('shared platform icon system is used by Posts, Dashboard and Analytics', () => {
  const shared = read('frontend/src/components/ui/SocialPlatformIcon.tsx');
  const posts = read('frontend/src/components/posts/PostPrimitives.tsx');
  const dashboard = read('frontend/src/components/dashboard/PlatformIcon.tsx');
  const analyticsSelector = read('frontend/src/components/analytics/AnalyticsAccountSelector.tsx');
  const globalStyles = read('frontend/src/social-platform-icons.css');
  const main = read('frontend/src/main.tsx');

  for (const platform of ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'x']) {
    assert.match(shared, new RegExp(`${platform}:`));
  }
  assert.match(posts, /SocialPlatformIcon/);
  assert.match(dashboard, /SocialPlatformIcon/);
  assert.match(analyticsSelector, /SocialPlatformIcon/);
  assert.match(main, /social-platform-icons\.css/);
  assert.match(globalStyles, /aria-label="Facebook"/);
  assert.match(globalStyles, /aria-label="Instagram"/);
});

test('Post Preview never renders a broken INXSocial mark as a destination avatar', () => {
  const preview = read('frontend/src/components/posts/PostPreviewPanel.tsx');

  assert.doesNotMatch(preview, /\/assets\/inx-social-mark\.png/);
  assert.match(preview, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(preview, /UserRound/);
  assert.match(preview, /size-11 rounded-xl/);
});

test('Top Performing Posts uses selected analytics platform and refreshed row UI', () => {
  const card = read('frontend/src/components/analytics/TopPerformingPostsCard.tsx');
  const page = read('frontend/src/components/analytics/AnalyticsPage.tsx');

  assert.match(card, /platform: PlatformAnalytics\['platform'\]/);
  assert.match(card, /platform=\{platform\}/);
  assert.doesNotMatch(card, /platform="facebook"/);
  assert.match(card, /Trophy/);
  assert.match(card, /Interactions/);
  assert.match(page, /platform=\{view\.source\.platform\}/);
});
