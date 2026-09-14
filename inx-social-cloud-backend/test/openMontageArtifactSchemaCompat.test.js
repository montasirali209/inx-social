const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));

test('OpenMontage worker boots through the stock-footage compatibility entrypoint', () => {
  const dockerfile = read('openmontage-worker/Dockerfile');
  const compatibility = read('openmontage-worker/compat_bridge.py');
  const stockProfile = read('openmontage-worker/stock_compat_entry.py');

  assert.match(dockerfile, /git clone https:\/\/github\.com\/calesthio\/OpenMontage\.git OpenMontage/);
  assert.match(dockerfile, /ARG OPENMONTAGE_COMMIT=08e2151fa02de28a5d6a312b3d575692bf147ad7/);
  assert.match(dockerfile, /test "\$\(git rev-parse HEAD\)" = "\$OPENMONTAGE_COMMIT"/);
  assert.match(dockerfile, /test -z "\$\(git status --porcelain\)"/);
  assert.match(dockerfile, /COPY full_bridge\.py compat_bridge\.py stock_compat_entry\.py \/app\//);
  assert.match(dockerfile, /uvicorn stock_compat_entry:app/);
  assert.match(compatibility, /bridge\._capabilities = _compatible_capabilities/);
  assert.match(compatibility, /bridge\._selected_pipeline = _auto_pipeline/);
  assert.match(stockProfile, /STOCK_PIPELINE = "documentary-montage"/);
  assert.match(stockProfile, /real moving stock-footage montage/);
  assert.match(stockProfile, /force_ffmpeg=true/);
  assert.match(stockProfile, /small bottom-centred/);
  assert.match(compatibility, /@app\.get\("\/ready"\)/);
});

test('full worker leaves upstream OpenMontage schemas pipelines tools and renderers unpatched', () => {
  const dockerfile = read('openmontage-worker/Dockerfile');
  const bridge = read('openmontage-worker/full_bridge.py');

  assert.doesNotMatch(dockerfile, /overrides\//);
  assert.doesNotMatch(dockerfile, /pipeline_defs\/inx-stock-montage/);
  assert.doesNotMatch(dockerfile, /stock_sources\/__init__\.py/);
  assert.match(bridge, /from tools\.tool_registry import registry/);
  assert.match(bridge, /registry\.discover\(\)/);
  assert.match(bridge, /registry\.provider_menu\(\)/);
  assert.match(bridge, /from tools\.video\.stock_sources import source_catalog, source_summary/);
  assert.match(bridge, /ROOT\.joinpath\("skills"\)\.rglob\("\*\.md"\)/);
  assert.match(bridge, /ROOT \/ "pipeline_defs"/);

  assert.equal(exists('openmontage-worker/app_entry.py'), false);
  assert.equal(exists('openmontage-worker/overrides/stock_sources_init.py'), false);
  assert.equal(exists('openmontage-worker/overrides/remotion.config.ts'), false);
  assert.equal(exists('openmontage-worker/pipeline_defs/inx-stock-montage.yaml'), false);
});
