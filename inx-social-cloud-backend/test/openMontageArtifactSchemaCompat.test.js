const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('OpenMontage worker boots through the schema compatibility entrypoint', () => {
  const dockerfile = read('openmontage-worker/Dockerfile');
  assert.match(dockerfile, /COPY app_entry\.py \/app\/app_entry\.py/);
  assert.match(dockerfile, /uvicorn app_entry:app/);
});

test('schema adapter repairs strict OpenMontage checkpoint artifacts', () => {
  const adapter = read('openmontage-worker/app_entry.py');
  assert.match(adapter, /total_duration_seconds/);
  assert.match(adapter, /start_seconds/);
  assert.match(adapter, /end_seconds/);
  assert.match(adapter, /movement_alias/);
  assert.match(adapter, /asset_manifest/);
  assert.match(adapter, /edit_decisions/);
  assert.match(adapter, /documentary-montage/);
  assert.match(adapter, /worker\.write_stage = write_stage/);
});
