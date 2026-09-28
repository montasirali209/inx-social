'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('UI Studio Phase 6 persists delivery, mapping, regression, PR and approval state', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260928113000_add_ui_studio_phase6/migration.sql');
  assert.match(schema, /model UiDesignDelivery/);
  assert.match(schema, /deliveries\s+UiDesignDelivery\[\]/);
  assert.match(schema, /pullRequestNumber\s+Int\?/);
  assert.match(schema, /deploymentTriggeredAt\s+DateTime\?/);
  assert.match(migration, /CREATE TABLE "UiDesignDelivery"/);
  assert.match(migration, /UiDesignDelivery_projectId_fkey/);
  assert.match(migration, /UiDesignDelivery_generationId_fkey/);
});

test('Phase 6 export is a real ZIP package with a delivery manifest', () => {
  const delivery = require('../src/services/uiStudioDeliveryService');
  const zip = delivery.zipStore([
    { path: 'src/example.tsx', data: 'export default 1;\n' },
    { path: 'UI_STUDIO_DELIVERY.json', data: '{"ok":true}\n' }
  ]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.match(zip.toString('utf8'), /src\/example\.tsx/);
  assert.match(zip.toString('utf8'), /UI_STUDIO_DELIVERY\.json/);
});

test('Phase 6 enforces accepted-generation regression evidence before delivery', () => {
  const service = read('src/services/uiStudioDeliveryService.js');
  assert.match(service, /acceptedGenerationId/);
  assert.match(service, /minimumViewportScore/);
  assert.match(service, /compileVerified/);
  assert.match(service, /UI_STUDIO_PHASE6_RENDER_EVIDENCE_REQUIRED/);
  assert.match(service, /UI_STUDIO_PHASE6_VIEWPORT_GATE_FAILED/);
});

test('Phase 6 delivery is PR-first with separate approval and deployment actions', () => {
  const service = read('src/services/uiStudioDeliveryService.js');
  const routes = read('src/routes/adminRoutes.js');
  assert.match(service, /createPullRequest/);
  assert.match(service, /approveDelivery/);
  assert.match(service, /deployDelivery/);
  assert.match(service, /Human approval is required before deployment/);
  assert.match(routes, /phase6\/deliveries\/:deliveryId\/pr/);
  assert.match(routes, /phase6\/deliveries\/:deliveryId\/approve/);
  assert.match(routes, /phase6\/deliveries\/:deliveryId\/deploy/);
});

test('Phase 6 never performs silent live overwrite and remains isolated from UGC', () => {
  const service = read('src/services/uiStudioDeliveryService.js');
  assert.match(service, /automaticLiveOverwrite: false/);
  assert.doesNotMatch(service, /ugcStudioService|ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
  assert.doesNotMatch(service, /railway\.up|railway up|create_deployment|accept_deploy/);
});

test('Phase 6 admin exposes export, PR, approval and deployment controls', () => {
  const html = read('public/index.html');
  const js = read('public/ui-studio.js');
  const css = read('public/ui-studio.css');
  assert.match(html, /id="uiStudioPhase6CreateBtn"/);
  assert.match(html, /id="uiStudioPhase6PrBtn"/);
  assert.match(html, /id="uiStudioPhase6ApproveBtn"/);
  assert.match(html, /id="uiStudioPhase6DeployBtn"/);
  assert.match(js, /async function createPhase6Delivery/);
  assert.match(js, /async function createPhase6Pr/);
  assert.match(js, /async function approvePhase6Delivery/);
  assert.match(js, /async function deployPhase6Delivery/);
  assert.match(css, /\.ui-studio-phase6-panel/);
});
