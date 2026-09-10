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
  const connectionOverrides = read('frontend/src/connection-icon-overrides.css');
  const main = read('frontend/src/main.tsx');

  for (const platform of ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'x']) {
    assert.match(shared, new RegExp(`${platform}:`));
  }
  assert.match(posts, /SocialPlatformIcon/);
  assert.match(dashboard, /SocialPlatformIcon/);
  assert.match(analyticsSelector, /SocialPlatformIcon/);
  assert.match(main, /social-platform-icons\.css/);
  assert.match(main, /connection-icon-overrides\.css/);
  assert.match(globalStyles, /aria-label="Facebook"/);
  assert.match(globalStyles, /aria-label="Instagram"/);
  assert.match(connectionOverrides, /size-10/);
  assert.match(connectionOverrides, /size-8/);
});

test('Post Preview uses a neutral full-width media placeholder and never renders a broken INXSocial avatar', () => {
  const preview = read('frontend/src/components/posts/PostPreviewPanel.tsx');

  assert.doesNotMatch(preview, /\/assets\/inx-social-mark\.png/);
  assert.match(preview, /setFailedPicture\(picture\)/);
  assert.match(preview, /failedPicture !== picture/);
  assert.match(preview, /UserRound/);
  assert.match(preview, /ImageIcon/);
  assert.match(preview, /h-56 w-full place-items-center/);
  assert.doesNotMatch(preview, /aspect-video max-h-56/);
  assert.doesNotMatch(preview, /ImageIcon[\s\S]{0,220}<PlatformIcon/);
  const platformIconUsages = preview.match(/<PlatformIcon/g) || [];
  assert.equal(platformIconUsages.length, 1, 'platform icons belong only in the preview platform tabs');
});

test('Bulk Scheduler uses the same destination selector component as Posts', () => {
  const selector = read('frontend/src/components/posts/DestinationSelector.tsx');
  const bulk = read('frontend/src/components/bulk-scheduler/PublishingDestinationsPanel.tsx');

  assert.match(selector, /mode\?: DestinationMode/);
  assert.match(selector, /Publishing destinations/);
  assert.match(bulk, /DestinationSelector/);
  assert.match(bulk, /mode="batch"/);
  assert.doesNotMatch(bulk, /DestinationCard/);
  assert.doesNotMatch(bulk, /PlatformFilterTabs/);
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
