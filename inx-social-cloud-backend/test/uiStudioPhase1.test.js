'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('UI Studio Phase 1 has project/reference persistence and migration', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260927211500_add_ui_studio_phase1/migration.sql');
  assert.match(schema, /model UiDesignProject/);
  assert.match(schema, /model UiDesignReference/);
  assert.match(schema, /references\s+UiDesignReference\[\]/);
  assert.match(migration, /CREATE TABLE "UiDesignProject"/);
  assert.match(migration, /CREATE TABLE "UiDesignReference"/);
  assert.match(migration, /ON DELETE CASCADE/);
});

test('UI Studio reference uploads preserve original source bytes', async () => {
  const service = require('../src/services/uiStudioService');
  const source = await sharp({
    create: { width: 2048, height: 1152, channels: 4, background: { r: 8, g: 24, b: 32, alpha: 1 } }
  }).png().toBuffer();
  const before = crypto.createHash('sha256').update(source).digest('hex');
  const metadata = await service.inspectUpload(source);
  const after = crypto.createHash('sha256').update(source).digest('hex');
  assert.equal(before, after);
  assert.equal(metadata.sha256, before);
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 1152);
  assert.equal(metadata.mimeType, 'image/png');
});

test('UI Studio is explicitly routed to R2 and isolated from UGC code', () => {
  const storage = read('src/services/mediaObjectStorageService.js');
  const service = read('src/services/uiStudioService.js');
  assert.match(storage, /'ui-studio'/);
  assert.match(service, /cloudflareR2Configured/);
  assert.match(service, /PROVIDERS\.CLOUDFLARE_R2/);
  assert.doesNotMatch(service, /ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
});

test('UI Studio admin API protects writes with Super Admin role', () => {
  const routes = read('src/routes/adminRoutes.js');
  assert.match(routes, /router\.use\(requireAuth, requireAdmin\)/);
  assert.match(routes, /ui-studio\/projects', uiStudio\.list/);
  assert.match(routes, /ui-studio\/projects', requireSuperAdmin, uiStudio\.create/);
  assert.match(routes, /references\/:viewport\/upload', requireSuperAdmin/);
  assert.match(routes, /limit: '50mb'/);
});

test('UI Studio has a dedicated admin portal, high-resolution viewer and upload history', () => {
  const html = read('public/index.html');
  const js = read('public/ui-studio.js');
  const css = read('public/ui-studio.css');
  assert.match(html, /data-page="uiStudio"/);
  assert.match(html, /id="uiStudioPage"/);
  assert.match(html, /id="uiStudioCreateDialog"/);
  assert.match(js, /window\.loadUiStudio/);
  assert.match(js, /uiStudioReferenceHistory/);
  assert.match(js, /Uploading original/);
  assert.match(css, /\.ui-studio-viewer/);
  assert.match(css, /\.ui-studio-project-grid/);
});

test('UI Studio upload code never rasterizes or recompresses the supplied source', () => {
  const service = read('src/services/uiStudioService.js');
  assert.match(service, /\.metadata\(\)/);
  assert.doesNotMatch(service, /\.resize\(|\.jpeg\(|\.webp\(|\.png\(|\.avif\(|\.toBuffer\(/);
});
