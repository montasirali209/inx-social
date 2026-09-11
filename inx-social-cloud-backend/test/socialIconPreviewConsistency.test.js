const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('one shared platform icon system is used throughout the React workspace', () => {
  const shared = read('frontend/src/components/ui/SocialPlatformIcon.tsx');
  const posts = read('frontend/src/components/posts/PostPrimitives.tsx');
  const dashboard = read('frontend/src/components/dashboard/PlatformIcon.tsx');
  const connectedPages = read('frontend/src/components/dashboard/ConnectedPagesCard.tsx');
  const publishingQueue = read('frontend/src/components/dashboard/PublishingQueueTable.tsx');
  const bulkScheduler = read('frontend/src/components/bulk-scheduler/PlatformMark.tsx');
  const analyticsSelector = read('frontend/src/components/analytics/AnalyticsAccountSelector.tsx');
  const connectedAccounts = read('frontend/src/components/connections/ConnectedAccountsPage.tsx');
  const settings = read('frontend/src/components/settings/SettingsCard.tsx');
  const connectionData = read('frontend/src/data/connectedAccountsData.ts');
  const main = read('frontend/src/main.tsx');

  for (const platform of ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'x']) {
    assert.match(shared, new RegExp(`${platform}:`));
  }
  assert.match(shared, /rounded-full/);
  assert.match(shared, /#3b7dc8/);
  assert.match(shared, /x: 'bg-\[#4fb4df\] text-white'/);
  assert.match(shared, /fill="#ff0000"/);
  assert.match(posts, /SocialPlatformIcon/);
  assert.match(dashboard, /SocialPlatformIcon/);
  assert.match(connectedPages, /SocialPlatformIcon/);
  assert.match(publishingQueue, /SocialPlatformIcon/);
  assert.match(bulkScheduler, /SocialPlatformIcon/);
  assert.match(analyticsSelector, /SocialPlatformIcon/);
  assert.match(connectedAccounts, /SocialPlatformIcon/);
  assert.match(settings, /SocialPlatformIcon/);
  assert.doesNotMatch(connectedAccounts, /\{meta\.mark\}/);
  assert.doesNotMatch(bulkScheduler, /mark: ['"]/);
  assert.doesNotMatch(publishingQueue, />f<\/span>/);
  assert.doesNotMatch(connectionData, /mark:|className:/);
  assert.doesNotMatch(main, /social-platform-icons\.css|connection-icon-overrides\.css/);
});

test('universal icons match the supplied circular branded reference', () => {
  const shared = read('frontend/src/components/ui/SocialPlatformIcon.tsx');

  assert.match(shared, /!rounded-full/);
  assert.match(shared, /facebook: 'bg-\[#3b7dc8\] text-white'/);
  assert.match(shared, /instagram: 'bg-\[radial-gradient/);
  assert.match(shared, /linkedin: 'bg-\[#0a66c2\] text-white'/);
  assert.match(shared, /youtube: 'bg-\[#ff0000\] text-white'/);
  assert.match(shared, /tiktok: 'border border-white\/15 bg-\[#010101\] text-white'/);
  assert.match(shared, /pinterest: 'bg-\[#e60023\] text-white'/);
  assert.match(shared, /x: 'bg-\[#4fb4df\] text-white'/);
  assert.match(shared, /fill="#25f4ee"/);
  assert.match(shared, /fill="#fe2c55"/);
  assert.match(shared, /fill="#ff0000"/);
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

test('destination and calendar cards keep platform branding separate from account thumbnails', () => {
  const selector = read('frontend/src/components/posts/DestinationSelector.tsx');
  const calendarCard = read('frontend/src/components/calendar/CalendarPostCard.tsx');
  const selectedDateCard = read('frontend/src/components/calendar/ScheduledVideoCard.tsx');

  assert.doesNotMatch(selector, /absolute -bottom-1 -right-1 size-5/);
  assert.match(selector, /PlatformIcon className="ml-auto size-6/);
  assert.match(calendarCard, /PlatformIcon className=\{`\$\{compact \? 'size-5' : 'size-6'\} ml-auto/);
  assert.match(calendarCard, /ImageIcon/);
  assert.match(selectedDateCard, /StatusBadge[\s\S]*PlatformIcon[\s\S]*More options/);
  assert.doesNotMatch(selectedDateCard, /<PlatformIcon[^>]*\/>\s*<span className="min-w-0 flex-1"/);
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
