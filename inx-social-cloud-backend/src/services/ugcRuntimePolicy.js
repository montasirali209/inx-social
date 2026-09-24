const UGC_RUNTIME_POLICY_VERSION = 'ugc-runtime-policy-v1';

const AD_WORKERS_PER_PROCESS = 1;
const SCENE_CONCURRENCY = 2;
const QUEUE_POLL_MS = 5_000;
const STALE_RENDER_MS = 5 * 60 * 1000;
const LOCAL_FINISH_RETRY_LIMIT = 2;

function snapshot() {
  return {
    version: UGC_RUNTIME_POLICY_VERSION,
    adWorkersPerProcess: AD_WORKERS_PER_PROCESS,
    sceneConcurrencyPerAd: SCENE_CONCURRENCY,
    queuePollMs: QUEUE_POLL_MS,
    staleRenderMs: STALE_RENDER_MS,
    localFinishRetryLimit: LOCAL_FINISH_RETRY_LIMIT,
    distributedClaiming: 'POSTGRES_FOR_UPDATE_SKIP_LOCKED',
    scalePolicy: 'Horizontal processes may claim different ads; one process renders one ad at a time.'
  };
}

module.exports = {
  UGC_RUNTIME_POLICY_VERSION,
  AD_WORKERS_PER_PROCESS,
  SCENE_CONCURRENCY,
  QUEUE_POLL_MS,
  STALE_RENDER_MS,
  LOCAL_FINISH_RETRY_LIMIT,
  snapshot
};
