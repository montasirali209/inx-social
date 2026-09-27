'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Website Media has versioned Prisma persistence and a deployable migration', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260927171500_add_website_media_manager/migration.sql');

  assert.match(schema, /model WebsiteMediaAsset/);
  assert.match(schema, /model WebsiteMediaVersion/);
  assert.match(schema, /currentVersionId/);
  assert.match(schema, /storageKey\s+String\s+@unique/);
  assert.match(migration, /CREATE TABLE "WebsiteMediaAsset"/);
  assert.match(migration, /CREATE TABLE "WebsiteMediaVersion"/);
  assert.match(migration, /ON DELETE SET NULL/);
});

test('Website Media exposes only protected admin mutations and public read delivery', () => {
  const admin = read('src/routes/adminRoutes.js');
  const app = read('src/app.js');
  const publicRoutes = read('src/routes/websiteMediaPublicRoutes.js');

  assert.match(admin, /router\.use\(requireAuth, requireAdmin\)/);
  assert.match(admin, /website-media\/:key\/upload', requireSuperAdmin/);
  assert.match(admin, /website-media\/:key', requireSuperAdmin, websiteMedia\.update/);
  assert.match(admin, /website-media\/:key\/restore\/:versionId', requireSuperAdmin/);
  assert.match(admin, /limit: '25mb'/);
  assert.match(app, /app\.use\('\/api\/website-media', websiteMediaPublicRoutes\)/);
  assert.match(publicRoutes, /router\.get\('\/:key\/content', controller\.content\)/);
});

test('Website Media uses stable named slots without coupling to UGC', () => {
  const service = read('src/services/websiteMediaService.js');

  for (const key of [
    'landing.hero.dashboard',
    'landing.dashboard.showcase',
    'landing.ai-studio.preview',
    'landing.social.preview',
    'seo.default.dashboard',
    'seo.default.ai-studio',
    'seo.ai-video.hero'
  ]) {
    assert.match(service, new RegExp(key.replaceAll('.', '\\.')));
  }

  assert.doesNotMatch(service, /ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry|ugcStudio/);
});

test('Website Media upload inspection preserves source bytes and reports quality metadata', async () => {
  const service = require('../src/services/websiteMediaService');
  const source = await sharp({
    create: { width: 640, height: 360, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } }
  }).png().toBuffer();

  const before = crypto.createHash('sha256').update(source).digest('hex');
  const metadata = await service.inspectUpload(source);
  const after = crypto.createHash('sha256').update(source).digest('hex');

  assert.equal(before, after);
  assert.equal(metadata.sha256, before);
  assert.equal(metadata.mimeType, 'image/png');
  assert.equal(metadata.width, 640);
  assert.equal(metadata.height, 360);

  const definition = service.definitionFor('landing.hero.dashboard');
  const warnings = service.qualityWarnings(definition, metadata);
  assert.ok(warnings.some(item => item.includes('2200px')));
});

test('Website Media is explicitly routed to Cloudflare R2', () => {
  const storage = read('src/services/mediaObjectStorageService.js');
  const service = read('src/services/websiteMediaService.js');

  assert.match(storage, /'website-media'/);
  assert.match(service, /cloudflareR2Configured/);
  assert.match(service, /PROVIDERS\.CLOUDFLARE_R2/);
  assert.match(service, /originalPreserved: true/);
});

test('Website Media public delivery is cacheable and uses content hashes as ETags', () => {
  const controller = read('src/controllers/websiteMediaPublicController.js');
  assert.match(controller, /If-None-Match|if-none-match/);
  assert.match(controller, /ETag/);
  assert.match(controller, /stale-while-revalidate=86400/);
  assert.match(controller, /X-Content-Type-Options/);
});
