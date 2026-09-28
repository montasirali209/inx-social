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
  assert.match(admin, /video\/mp4/);
  assert.match(admin, /video\/webm/);
  assert.match(admin, /limit: '120mb'/);
  assert.match(app, /app\.use\('\/api\/website-media', websiteMediaPublicRoutes\)/);
  assert.match(publicRoutes, /router\.get\('\/:key\/content', controller\.content\)/);
});

test('Website Media uses stable named slots without coupling to UGC', () => {
  const service = read('src/services/websiteMediaService.js');

  for (const key of [
    'landing.hero.dashboard',
    'landing.dashboard.showcase',
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
  assert.ok(warnings.some(item => item.includes('2400px')));
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
  assert.match(controller, /stale-while-revalidate=300/);
  assert.match(controller, /max-age=31536000, immutable/);
  assert.match(controller, /X-Content-Type-Options/);
});


test('Website Media video delivery supports browser byte ranges', () => {
  const service = require('../src/services/websiteMediaService');
  const controller = read('src/controllers/websiteMediaPublicController.js');

  assert.deepEqual(service.parseByteRange('bytes=0-999', 5000), {
    start: 0,
    end: 999,
    header: 'bytes=0-999',
    total: 5000
  });
  assert.deepEqual(service.parseByteRange('bytes=-500', 5000), {
    start: 4500,
    end: 4999,
    header: 'bytes=4500-4999',
    total: 5000
  });
  assert.match(controller, /Accept-Ranges/);
  assert.match(controller, /Content-Range/);
  assert.match(controller, /res\.status\(206\)/);
  assert.match(controller, /req\.headers\.range/);
});

test('Website Media has a dedicated admin navigation surface and editor', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');
  const css = read('public/admin.css');

  assert.match(html, /data-page="websiteMedia"/);
  assert.match(html, /id="websiteMediaPage"/);
  assert.match(html, /id="websiteMediaDialog"/);
  assert.match(html, /id="websiteMediaFile"/);
  assert.match(html, /id="websiteMediaVersionList"/);
  assert.match(js, /async function loadWebsiteMedia/);
  assert.match(js, /async function openWebsiteMediaEditor/);
  assert.match(js, /async function uploadWebsiteMedia/);
  assert.match(js, /async function restoreWebsiteMediaVersion/);
  assert.match(js, /#websiteMedia/);
  assert.match(css, /\.website-media-grid/);
  assert.match(css, /\.website-media-modal/);
});

test('Website Media editor preserves original uploads and warns about undersized sources', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');

  assert.match(html, /original file is preserved/i);
  assert.match(html, /PNG, JPEG, WebP or AVIF/);
  assert.match(js, /maxUploadBytes/);
  assert.match(js, /120\*1024\*1024/);
  assert.match(js, /recommendedMinWidth/);
  assert.match(js, /recommendedMinHeight/);
  assert.match(js, /Quality warning/);
  assert.match(js, /URL\.createObjectURL/);
  assert.doesNotMatch(js, /canvas\.toDataURL|toBlob\(/);
});

test('Historical Website Media versions can be previewed without restoring them first', () => {
  const service = read('src/services/websiteMediaService.js');
  const controller = read('src/controllers/websiteMediaPublicController.js');

  assert.match(service, /async function content\(key, versionId = ''\)/);
  assert.match(service, /assetId: asset\.id/);
  assert.match(controller, /websiteMedia\.content\(req\.params\.key, req\.query\.v\)/);
});

test('Website Media admin work remains isolated from UGC implementation', () => {
  const html = read('public/index.html');
  const js = read('public/admin.js');
  const service = read('src/services/websiteMediaService.js');

  const mediaSections = [html.match(/<section class="page hidden website-media-page"[\s\S]*?<section class="page hidden" id="settingsPage">/)?.[0] || '', service];
  for (const source of mediaSections) {
    assert.doesNotMatch(source, /ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
  }
  assert.match(js, /websiteMediaSelectedKey/);
});


test('Phase 3 Website Media slots have safe fallback chains for every live placement', () => {
  const service = read('src/services/websiteMediaService.js');

  assert.match(service, /key: 'landing\.hero\.dashboard'[\s\S]*fallbackUrl: '\/assets\/landing-dashboard-20260919\.webp'/);
  assert.match(service, /key: 'landing\.dashboard\.showcase'[\s\S]*fallbackUrl: '\/assets\/landing-dashboard-20260919\.webp'/);
  assert.match(service, /key: 'landing\.social\.preview'[\s\S]*fallbackUrl: '\/assets\/inxsocial-social-preview-v3\.jpg'/);
  assert.match(service, /key: 'seo\.default\.dashboard'[\s\S]*fallbackUrl: '\/assets\/landing-dashboard-20260919\.webp'/);
  assert.match(service, /key: 'seo\.default\.ai-studio'[\s\S]*fallbackUrl: '\/assets\/ai-content-studio-seo\.webp'/);
  assert.match(service, /key: 'seo\.ai-video\.hero'[\s\S]*fallbackKey: 'seo\.default\.ai-studio'/);
  assert.match(service, /async function resolveEffectiveSource/);
  assert.match(service, /WEBSITE_MEDIA_FALLBACK_CYCLE/);
});

test('Phase 3 homepage and SEO surfaces are wired to Website Media endpoints', () => {
  const landingBody = read('../landing-next/public/landing-body.html');
  const layout = read('../landing-next/app/layout.tsx');
  const seoPage = read('../landing-next/app/seo/[slug]/page.tsx');
  const videoModels = read('../landing-next/app/ai-video-models/page.tsx');
  const schema = read('../landing-next/public/schema.json');
  const legacyLanding = read('public/landing.html');
  const app = read('src/app.js');

  assert.match(landingBody, /\/api\/website-media\/landing\.hero\.dashboard\/content/);
  assert.match(landingBody, /\/api\/website-media\/landing\.dashboard\.showcase\/content/);
  assert.match(layout, /landingSocialPreview/);
  assert.match(layout, /landingHeroDashboard/);
  assert.match(seoPage, /seoHeroSlot\(slug\)/);
  assert.match(seoPage, /websiteMediaPath/);
  assert.match(videoModels, /seoAiVideoHero/);
  assert.match(schema, /\/api\/website-media\/landing\.social\.preview\/content/);
  assert.match(legacyLanding, /\/api\/website-media\/landing\.hero\.dashboard\/content/);
  assert.match(legacyLanding, /\/api\/website-media\/landing\.dashboard\.showcase\/content/);
  assert.match(app, /SEO_WEBSITE_MEDIA_KEYS/);
  assert.match(app, /mediaAbsoluteUrl/);
});

test('Phase 3 lets Super Admin revert a custom image without deleting its history', () => {
  const routes = read('src/routes/adminRoutes.js');
  const controller = read('src/controllers/websiteMediaAdminController.js');
  const service = read('src/services/websiteMediaService.js');
  const html = read('public/index.html');
  const js = read('public/admin.js');

  assert.match(routes, /website-media\/:key\/use-fallback/);
  assert.match(controller, /ADMIN_WEBSITE_MEDIA_USE_FALLBACK/);
  assert.match(service, /async function useFallback/);
  assert.match(service, /currentVersionId: null/);
  assert.match(html, /websiteMediaUseFallbackBtn/);
  assert.match(js, /useWebsiteMediaFallback/);
  assert.match(js, /Your uploaded versions will stay in history/);
});

test('Website Media manages the five homepage UGC video slots without a new database model', () => {
  const service = require('../src/services/websiteMediaService');
  const source = read('src/services/websiteMediaService.js');
  const routes = read('src/routes/adminRoutes.js');
  const admin = read('public/admin.js');
  const css = read('public/admin.css');

  for (const key of [
    'landing.ugc-studio.maya.video',
    'landing.ugc-studio.chloe.video',
    'landing.ugc-studio.sofia.video',
    'landing.ugc-studio.emma.video',
    'landing.ugc-studio.lily.video'
  ]) {
    assert.match(source, new RegExp(key.replaceAll('.', '\\.')));
    assert.equal(service.definitionFor(key).mediaType, 'VIDEO');
  }

  assert.deepEqual(service.videoFormat(Buffer.from([0,0,0,0,0x66,0x74,0x79,0x70,0,0,0,0]))?.mimeType, 'video/mp4');
  assert.deepEqual(service.videoFormat(Buffer.from([0x1a,0x45,0xdf,0xa3,0,0,0,0,0,0,0,0]))?.mimeType, 'video/webm');
  assert.match(routes, /video\/mp4/);
  assert.match(routes, /video\/webm/);
  assert.match(admin, /websiteMediaIsVideoSlot/);
  assert.match(admin, /<video/);
  assert.match(css, /website-media-modal-preview>video/);
});

test('UI Studio UGC export is mounted immediately before Pricing and reads videos from Website Media', () => {
  const page = read('../landing-next/app/page.tsx');
  const portal = read('../landing-next/components/UgcAdStudioPortal.tsx');
  const showcase = read('../landing-next/components/UgcAdStudioShowcase.tsx');
  const media = read('../landing-next/lib/website-media.ts');

  assert.match(page, /ugc-ad-studio-showcase-root/);
  assert.match(page, /<section class="pricing-section" id="pricing">/);
  assert.match(page, /UgcAdStudioPortal/);
  for (const constant of [
    'landingUgcMayaVideo',
    'landingUgcChloeVideo',
    'landingUgcSofiaVideo',
    'landingUgcEmmaVideo',
    'landingUgcLilyVideo'
  ]) {
    assert.match(portal, new RegExp(constant));
    assert.match(media, new RegExp(constant));
  }
  assert.match(showcase, /UGC AD STUDIO/);
  assert.match(showcase, /Turn any idea into/);
  assert.match(showcase, /Create a UGC Ad/);
  assert.match(showcase, /ActivePhone/);
  assert.match(showcase, /CreatorCard/);
});

test('Phase 3 does not modify the UGC generation system', () => {
  const app = read('src/app.js');
  const media = read('src/services/websiteMediaService.js');
  assert.doesNotMatch(media, /ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry|ugcStudio/);
  assert.match(app, /SEO_WEBSITE_MEDIA_KEYS/);
});
