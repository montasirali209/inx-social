# INXSocial UGC Engine — Phase 0 + Phase 1

## Purpose

This phase establishes a safe architectural boundary around the existing production UGC Studio without changing the customer-facing generation flow.

The current UGC pipeline remains the source of truth for rendering. The new engine layer records a versioned production contract alongside each new campaign so later phases can add skills, model routing and quality-control logic without rewriting the working pipeline in place.

## Phase 0 — Production baseline

The following behavior is intentionally frozen by regression tests:

- UGC durations remain 15, 20 and 30 seconds.
- Standard pricing remains 100 / 140 / 210 credits.
- Premium pricing remains 180 / 260 / 390 credits.
- Built-in creators remain reusable without a creator-generation charge.
- Custom AI creator generation remains 5 credits.
- Standard video remains the existing MiniMax Hailuo 2.3 route.
- Premium video remains the existing Kling 3.0 Standard route.
- Creator narration remains Inworld TTS.
- Creator scenes continue through the configured Kling lip-sync route.
- Product/non-creator narration is muxed locally.
- Final output remains 720x1280.
- A 15-second Standard ad keeps provider-safe 10s + 6s rendering while final playback is 10s + 5s.
- Credits are reserved before rendering, completed after a successful final asset, and refunded on failure.
- Final UGC output is persisted to Media Library.
- Background generation, live progress, stale-worker recovery and scheduler handoff remain in place.
- Existing UGC campaigns created before the engine layer remain readable/renderable and do not require migration into the new contract.

## Phase 1 — Versioned engine contract

Every new UGC campaign receives one `UGCEngineProject` row keyed by campaign.

The project contains:

- **Creative brief** — source type, requested/resolved campaign type, target duration, brand/product references and requested quality.
- **Actor assignment** — creator mode, selected creator and the actor assigned to each variation.
- **Production plan** — variations, scenes, scripts, prompts, provider durations and final playback durations.
- **Route decision** — the exact internal route used for every scene, including video model, TTS model, lip-sync model, resolution and audio strategy.
- **Pricing snapshot** — retail credits per ad and total campaign credits.
- **Render jobs** — stable links from variation to UGC ad and `AiGeneration` records.
- **QC contract** — the checks future phases must execute before a render can be considered production-ready.
- **Fingerprint** — SHA-256 fingerprint of the immutable planning/routing/pricing snapshot.

The contract is versioned:

- Engine: `ugc-engine-v1`
- Contract: `1.0`

## Compatibility rule

The Phase 1 registry deliberately maps to the same provider configuration already used in production:

- `HAILUO_STANDARD_V1` -> configured Standard UGC model
- `KLING_PREMIUM_V1` -> configured Premium UGC model
- Narration -> configured UGC TTS model
- Creator lip-sync -> configured UGC lip-sync model

Changing the registry in later phases must be explicit and versioned. New models must not silently alter an older project snapshot.

## Lifecycle mapping

New campaign:

`PLANNED -> RESERVING -> QUEUED -> RENDERING -> READY | PARTIAL | FAILED`

The engine project tracks the campaign lifecycle while the existing `UGCCampaign`, `UGCAd`, `UGCScene`, `AiGeneration`, credit wallet and Media Library remain the operational runtime.

Regeneration replaces the active generation link for the affected variation without changing the original production contract fingerprint.

## Safety / rollback

This phase is additive.

- Existing UGC tables and fields are not removed.
- Existing rendering logic is still responsible for output.
- Existing campaigns do not depend on `UGCEngineProject`.
- Removing the engine layer can be done without deleting generated media or changing customer credits.
- Provider names remain internal; no new model terminology is exposed to customers.

## Gate before Phase 2

Phase 2 should not begin until:

1. CI passes.
2. Railway migration succeeds.
3. Startup logs report the expected engine/contract versions and current model registry.
4. One new Standard campaign creates an engine snapshot and renders through the unchanged Hailuo pipeline.
5. One Premium campaign creates an engine snapshot and renders through the unchanged Premium pipeline.
6. Credit reservation/refund and Media Library persistence remain unchanged.
7. Existing pre-engine campaigns still open and play normally.
