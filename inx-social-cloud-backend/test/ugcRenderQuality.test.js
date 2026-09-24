const test = require('node:test');
const assert = require('node:assert/strict');

const qc = require('../src/services/ugcRenderQuality');

test('Phase 7 render QC is versioned and provider agnostic', () => {
  assert.equal(qc.RENDER_QUALITY_VERSION, 'ugc-render-qc-v1');
  const snapshot = qc.snapshot();
  assert.equal(snapshot.policies.failedSceneIsolated, true);
  assert.equal(snapshot.policies.completedScenesReused, true);
  assert.equal(snapshot.policies.reassemblyCredits, 0);
  assert.doesNotMatch(JSON.stringify(snapshot), /hailuo|kling|seedance|omnihuman|runware|minimax|bytedance/i);
});

test('Ready ad is publishable only with all scene storage and a final asset link', () => {
  const report = qc.inspect({
    ad: { status: 'READY', mediaAssetId: 'asset-1', credits: 100, duration: 15 },
    scenes: [
      { id: 's1', sequence: 1, status: 'READY', videoStorageKey: 'one.mp4', duration: 10 },
      { id: 's2', sequence: 2, status: 'READY', videoStorageKey: 'two.mp4', duration: 6 }
    ]
  });
  assert.equal(report.publishable, true);
  assert.equal(report.status, 'READY');
  assert.equal(report.recovery.action, 'NONE');
});

test('Scene failure recommends only selective scene recovery', () => {
  const report = qc.inspect({
    ad: { status: 'FAILED', mediaAssetId: null, credits: 140, duration: 20, errorMessage: 'scene failed' },
    scenes: [
      { id: 's1', sequence: 1, status: 'READY', videoStorageKey: 'one.mp4', duration: 10 },
      { id: 's2', sequence: 2, status: 'FAILED', videoStorageKey: null, duration: 10 }
    ]
  });
  assert.equal(report.recovery.action, 'RETRY_SCENES');
  assert.deepEqual(report.recovery.sceneIds, ['s2']);
  assert.equal(report.recovery.scenes[0].credits, 70);
  assert.equal(report.allScenesReady, false);
});

test('Assembly failure reuses completed scenes at zero reassembly credits', () => {
  const report = qc.inspect({
    ad: { status: 'FAILED', mediaAssetId: null, credits: 210, duration: 30, errorMessage: 'assembly failed' },
    scenes: [
      { id: 's1', sequence: 1, status: 'READY', videoStorageKey: 'one.mp4', duration: 10 },
      { id: 's2', sequence: 2, status: 'READY', videoStorageKey: 'two.mp4', duration: 10 },
      { id: 's3', sequence: 3, status: 'READY', videoStorageKey: 'three.mp4', duration: 10 }
    ]
  });
  assert.equal(report.recovery.action, 'REASSEMBLE');
  assert.equal(report.recovery.reassemblyCredits, 0);
  assert.equal(report.allScenesReady, true);
});

test('Edited rendered scene is selectively retryable', () => {
  const report = qc.inspect({
    ad: { status: 'EDITED', mediaAssetId: 'old', credits: 180, duration: 15 },
    scenes: [
      { id: 's1', sequence: 1, status: 'EDITED', videoStorageKey: 'old-one.mp4', duration: 15 }
    ]
  });
  assert.equal(report.publishable, false);
  assert.equal(report.recovery.action, 'RETRY_SCENES');
  assert.equal(report.recovery.scenes[0].credits, 180);
});

test('Final MP4 buffer QC rejects incomplete or non-MP4 output', () => {
  assert.throws(() => qc.validateFinalBuffer(Buffer.alloc(100)), error => error.code === 'UGC_QC_FINAL_VIDEO_INVALID');
  const fake = Buffer.alloc(20 * 1024);
  Buffer.from('ftyp').copy(fake, 4);
  const result = qc.validateFinalBuffer(fake);
  assert.equal(result.valid, true);
  assert.equal(result.container, 'MP4');
});

test('Assembly preflight blocks when a scene render is missing', () => {
  assert.throws(
    () => qc.assertAssemblyReady(
      { status: 'RENDERING', duration: 20, credits: 140 },
      [
        { id: 's1', sequence: 1, status: 'READY', videoStorageKey: 'one.mp4', duration: 10 },
        { id: 's2', sequence: 2, status: 'FAILED', duration: 10 }
      ]
    ),
    error => error.code === 'UGC_QC_SCENES_NOT_READY'
  );
});
