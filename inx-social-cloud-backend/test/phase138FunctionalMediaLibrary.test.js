const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Media Library is a native responsive React workspace with the universal shell', () => {
  const router = read('frontend/src/router.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const topbar = read('frontend/src/components/layout/Topbar.tsx');
  const page = read('frontend/src/components/media-library/MediaLibraryPage.tsx');
  assert.match(router, /path: 'media-library'/);
  assert.match(sidebar, /reactPath: '\/media-library'/);
  assert.match(topbar, /'\/media-library'/);
  assert.match(page, /MediaGrid/);
  assert.match(page, /2xl:grid-cols-\[230px_minmax\(0,1fr\)_330px\]/);
  assert.doesNotMatch(page, /Summer Sale Post|Product Launch Reel|1,248/);
});

test('Media Library operations use authenticated owned backend endpoints', () => {
  const app = read('src/app.js');
  const routes = read('src/routes/studioRoutes.js');
  const controller = read('src/controllers/studioController.js');
  const service = read('src/services/mediaLibraryService.js');
  assert.match(routes, /express\.raw\(\{ type: \['image\/\*', 'video\/\*'\], limit: '100mb' \}\)/);
  assert.match(controller, /mediaLibrary\.workspace\(req\.user\.id, license\.plan\)/);
  assert.match(controller, /mediaLibrary\.verifyContentAccess\(req\.query\.access, req\.params\.id\)/);
  assert.match(service, /expiresIn: '20m'/);
  assert.match(service, /archivedAt: null/);
  assert.match(service, /STORAGE_LIMITS/);
  assert.match(service, /checksum/);
  assert.match(app, /access=\)\[\^&\]\+\/g, '\$1\[redacted\]'/);
});

test('selected library media can be attached to the real Posts composer', () => {
  const page = read('frontend/src/components/media-library/MediaLibraryPage.tsx');
  const posts = read('frontend/src/components/posts/PostsPage.tsx');
  assert.match(page, /navigate\(["']\/posts["'], \{ state: \{ mediaLibraryAsset: asset, scheduleMode \} \}\)/);
  assert.match(posts, /fetchMediaAssetFile\(asset\)/);
  assert.match(posts, /setMedia\(/);
  assert.match(posts, /setPostType\(asset\.type === 'video' \? 'video' : 'image'\)/);
});

test('Media Library schema and migration preserve folders and reusable file metadata', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260830170000_add_media_library/migration.sql');
  assert.match(schema, /model MediaFolder/);
  assert.match(schema, /durationSeconds/);
  assert.match(schema, /archivedAt/);
  assert.match(migration, /CREATE TABLE "MediaFolder"/);
  assert.match(migration, /ALTER TABLE "AgentAsset"/);
});
