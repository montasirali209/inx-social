const RENDER_QUALITY_VERSION = 'ugc-render-qc-v1';

const BUSY = new Set(['RESERVING','QUEUED','RENDERING']);
const READY_SCENE = 'READY';
const RETRYABLE_SCENE = new Set(['FAILED','EDITED']);

function sceneCredits(ad, scene) {
  const adCredits = Math.max(1, Number(ad?.credits || 1));
  const adDuration = Math.max(1, Number(ad?.duration || 1));
  const duration = Math.max(1, Number(scene?.duration || 1));
  return Math.max(1, Math.ceil(adCredits * duration / adDuration));
}

function inspect({ ad = {}, scenes = [] } = {}) {
  const list = Array.isArray(scenes) ? scenes : [];
  const ready = list.filter(scene => scene.status === READY_SCENE && scene.videoStorageKey);
  const retryScenes = list.filter(scene => !(scene.status === READY_SCENE && scene.videoStorageKey));
  const missingStorage = list.filter(scene => scene.status === READY_SCENE && !scene.videoStorageKey);
  const busy = BUSY.has(String(ad.status || '').toUpperCase());
  const allScenesReady = list.length > 0 && ready.length === list.length;
  const outputLinked = Boolean(ad.mediaAssetId);
  const adReady = String(ad.status || '').toUpperCase() === 'READY';
  const publishable = adReady && allScenesReady && outputLinked && !ad.errorMessage;

  let recommendedAction = 'NONE';
  let recoveryLabel = '';
  if (busy) {
    recommendedAction = 'WAIT';
    recoveryLabel = 'Rendering is still in progress.';
  } else if (retryScenes.length) {
    recommendedAction = 'RETRY_SCENES';
    recoveryLabel = retryScenes.length === 1 ? 'Regenerate the affected scene.' : 'Regenerate only the affected scenes.';
  } else if (allScenesReady && (!outputLinked || !adReady)) {
    recommendedAction = 'REASSEMBLE';
    recoveryLabel = 'Rebuild the final video from the rendered scenes.';
  } else if (!list.length) {
    recommendedAction = 'BLOCKED';
    recoveryLabel = 'No renderable scenes are available.';
  } else if (!allScenesReady) {
    recommendedAction = 'RETRY_SCENES';
    recoveryLabel = 'Finish the incomplete scenes before assembly.';
  }

  const checks = [
    { id: 'SCENES_PRESENT', status: list.length ? 'PASS' : 'FAIL', detail: { count: list.length } },
    { id: 'SCENES_RENDERED', status: allScenesReady ? 'PASS' : busy ? 'PENDING' : 'FAIL', detail: { ready: ready.length, total: list.length } },
    { id: 'SCENE_STORAGE', status: missingStorage.length ? 'FAIL' : list.length ? 'PASS' : 'FAIL', detail: { missingSceneIds: missingStorage.map(scene => scene.id) } },
    { id: 'FINAL_ASSET_LINKED', status: outputLinked ? 'PASS' : adReady ? 'FAIL' : 'PENDING', detail: { mediaAssetId: ad.mediaAssetId || null } },
    { id: 'AD_ERROR_FREE', status: ad.errorMessage ? 'FAIL' : 'PASS', detail: { error: ad.errorMessage || null } },
    { id: 'PUBLISHABLE', status: publishable ? 'PASS' : busy ? 'PENDING' : 'FAIL' }
  ];

  return {
    version: RENDER_QUALITY_VERSION,
    status: publishable ? 'READY' : busy ? 'PROCESSING' : recommendedAction === 'REASSEMBLE' ? 'ASSEMBLY_REQUIRED' : recommendedAction === 'RETRY_SCENES' ? 'RECOVERY_REQUIRED' : 'BLOCKED',
    publishable,
    editable: !busy,
    allScenesReady,
    readySceneCount: ready.length,
    sceneCount: list.length,
    checks,
    recovery: {
      action: recommendedAction,
      label: recoveryLabel,
      sceneIds: retryScenes.map(scene => scene.id),
      scenes: retryScenes.map(scene => ({
        id: scene.id,
        sequence: Number(scene.sequence || 0),
        status: scene.status || '',
        credits: sceneCredits(ad, scene)
      })),
      reassemblyCredits: 0
    }
  };
}

function assertAssemblyReady(ad, scenes) {
  const report = inspect({ ad, scenes });
  if (!report.sceneCount || !report.allScenesReady) {
    const error = new Error('The final UGC video cannot be assembled until every scene has a completed render.');
    error.code = 'UGC_QC_SCENES_NOT_READY';
    error.qualityControl = report;
    throw error;
  }
  return report;
}

function validateFinalBuffer(data) {
  if (!Buffer.isBuffer(data) || data.length < 16 * 1024) {
    const error = new Error('The assembled UGC video output is incomplete.');
    error.code = 'UGC_QC_FINAL_VIDEO_INVALID';
    throw error;
  }
  const header = data.subarray(0, Math.min(data.length, 128));
  if (header.indexOf(Buffer.from('ftyp')) < 0) {
    const error = new Error('The assembled UGC output is not a valid MP4 file.');
    error.code = 'UGC_QC_FINAL_VIDEO_INVALID';
    throw error;
  }
  return {
    version: RENDER_QUALITY_VERSION,
    byteSize: data.length,
    container: 'MP4',
    valid: true
  };
}

function snapshot() {
  return {
    version: RENDER_QUALITY_VERSION,
    stages: ['SCENE_RENDER','SCENE_QC','ASSEMBLY','FINAL_QC','MEDIA_LIBRARY','EDITOR','PUBLISH_HANDOFF'],
    recoveryActions: ['WAIT','RETRY_SCENES','REASSEMBLE','NONE'],
    policies: {
      failedSceneIsolated: true,
      completedScenesReused: true,
      reassemblyUsesExistingScenes: true,
      reassemblyCredits: 0,
      publishRequiresReadyAsset: true
    }
  };
}

module.exports = {
  RENDER_QUALITY_VERSION,
  BUSY,
  inspect,
  assertAssemblyReady,
  validateFinalBuffer,
  sceneCredits,
  snapshot
};
