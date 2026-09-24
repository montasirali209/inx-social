# INXSocial UGC Engine — Phase 3.1 Hardening

## Purpose

Phase 3.1 closes regeneration and capability-validation gaps found during the post-deployment audit of Phase 3. It does not change customer-facing UGC quality tiers or pricing.

## Changes

### Regeneration routing

Every full-ad or single-scene regeneration now reruns the Phase 3 capability router before a new credit reservation.

This means an edited scene cannot blindly reuse a stale provider route. For example, a Premium creator scene that no longer has usable narration will no longer attempt the audio-driven OmniHuman route; it is re-evaluated before spend.

The current route decision is persisted back to the UGC scene and the ad plan used for final Media Library provenance.

### Runtime audit trail

Regeneration reroutes are recorded in the engine render-job metadata as bounded reroute history.

The initial engine contract, route snapshot and planning fingerprint remain immutable. Runtime reroutes therefore remain auditable without invalidating the original signed planning snapshot.

### Duration capabilities

The router now evaluates discrete duration capabilities, not only minimum/maximum bounds.

Hailuo Standard is therefore limited to its declared provider-safe 6-second and 10-second scene durations at the router boundary. Unsupported durations fail before provider spend.

### Production mode

Production should explicitly set:

- UGC_MODEL_ROUTER_MODE=adaptive
- RUNWARE_UGC_OMNIHUMAN_MODEL=bytedance:5@2
- RUNWARE_UGC_SEEDANCE_MODEL=bytedance:seedance@2.5
- RUNWARE_UGC_KLING_OMNI_MODEL=klingai:kling-video@o3-standard

The compatibility switch remains available by changing UGC_MODEL_ROUTER_MODE to compatibility.

## Acceptance gate

1. CI passes.
2. Standard 6s/10s scenes still route to Hailuo.
3. Unsupported Standard discrete durations fail before provider spend.
4. Full-ad regeneration reroutes before credit reservation.
5. Single-scene regeneration reroutes before credit reservation.
6. The scene route and ad plan provenance are updated after rerouting.
7. The original engine fingerprint and initial planning contract are not rewritten.
8. Railway runs with UGC_MODEL_ROUTER_MODE explicitly pinned to adaptive.
9. Production startup reports ugc-router-v1 in adaptive mode.
