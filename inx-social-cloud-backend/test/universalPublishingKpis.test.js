const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('universal publishing KPI source defines one status policy', () => {
  const source = read('frontend/src/lib/universal-publishing-kpis.ts');
  assert.match(source, /allPosts:\s*summary\.total \+ localDrafts/);
  assert.match(source, /drafts:\s*summary\.draft \+ localDrafts/);
  assert.match(source, /scheduled:\s*summary\.scheduled/);
  assert.match(source, /published:\s*summary\.published/);
  assert.match(source, /needsReview:\s*summary\.failed \+ summary\.awaitingUpload/);
  assert.match(source, /connectedAccounts:\s*facebookAccounts \+ activeSocialAccountCount/);
  assert.doesNotMatch(source, /needsReview:[^\n]*cancelled/i);
});

test('Dashboard Calendar and Posts consume the same KPI query', () => {
  const dashboard = read('frontend/src/components/dashboard/DashboardPage.tsx');
  const calendar = read('frontend/src/components/calendar/ContentCalendarPage.tsx');
  const posts = read('frontend/src/components/posts/PostPrimitives.tsx');
  for (const source of [dashboard, calendar, posts]) {
    assert.match(source, /universalPublishingKpiQueryKey/);
    assert.match(source, /fetchUniversalPublishingKpis/);
  }
  assert.match(dashboard, /Published via INXSocial/);
  assert.match(calendar, /Across all active platforms/);
  assert.match(posts, /All INXSocial publishing records/);
});

test('Media Library review KPI is explicitly asset-scoped', () => {
  const media = read('frontend/src/components/media-library/MediaPrimitives.tsx');
  assert.match(media, /Assets Needing Review/);
  assert.match(media, /Media assets needing attention/);
});

test('Media Library review KPI drills into the affected assets', () => {
  const primitives = read('frontend/src/components/media-library/MediaPrimitives.tsx');
  const tabs = read('frontend/src/components/media-library/MediaTabs.tsx');
  const data = read('frontend/src/data/mediaLibraryData.ts');
  const types = read('frontend/src/types/media-library.ts');
  assert.match(primitives, /inx-media-kpi-filter/);
  assert.match(primitives, /tab: 'needs_review'/);
  assert.match(tabs, /inx-media-kpi-filter/);
  assert.match(data, /id: 'needs_review', label: 'Needs Review'/);
  assert.match(types, /\| 'needs_review'/);
});
