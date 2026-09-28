'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('production smoke covers real Phase 5 acceptance and Phase 6 export', () => {
  const source = read('scripts/ui-studio-production-smoke.js');
  assert.match(source, /renderWithChromium/);
  assert.match(source, /startRenderBatch/);
  assert.match(source, /acceptGeneration/);
  assert.match(source, /createDelivery/);
  assert.match(source, /deliveryExport/);
  assert.match(source, /phase6Status/);
  assert.match(source, /UI_STUDIO_PRODUCTION_SMOKE_PASSED/);
});

test('production smoke is opt-in, one-time and cleans temporary artifacts', () => {
  const source = read('scripts/ui-studio-production-smoke.js');
  const server = read('src/server.js');
  assert.match(source, /UI_STUDIO_PRODUCTION_SMOKE_ON_STARTUP/);
  assert.match(source, /previousPass/);
  assert.match(source, /cleanupProject/);
  assert.match(source, /deleteObject/);
  assert.match(server, /runUiStudioProductionSmoke/);
});

test('production smoke remains isolated from UGC implementation', () => {
  const source = read('scripts/ui-studio-production-smoke.js');
  assert.doesNotMatch(source, /ugcStudioService|ugcModelRouter|ugcProviderAdapters|ugcEngineRegistry/);
});
