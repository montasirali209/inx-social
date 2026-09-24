# INXSocial UGC Engine — Phase 3 Model Router and Provider Adapters

## Goal

Phase 3 separates model selection from UGC skills and from provider request syntax.

The customer still sees only product-level quality choices. Provider/model names remain internal.

## Router version

`ugc-router-v1`

The router is capability-based and runs after the Phase 2 skill plan but before campaign persistence and credit reservation.

## Production routing policy

### Standard

All Standard scenes continue through the existing Hailuo 2.3 route.

- route: `HAILUO_STANDARD_V1`
- adapter: `HAILUO_23`
- creator audio: Inworld TTS followed by configured Kling lip sync
- non-creator audio: Inworld TTS followed by local mux

This preserves the current cost-efficient production path.

### Premium creator

Premium creator-led scenes route to OmniHuman 1.5.

- route: `OMNIHUMAN_CREATOR_V1`
- adapter: `OMNIHUMAN_15`
- model: `bytedance:5@2`
- input: persistent creator reference + finished narration audio
- audio/lip sync: native audio-driven creator animation
- no second Kling lip-sync pass

This is used for creator/talking/testimonial/explainer scenes when a creator and narration are available.

### Premium product / lifestyle

Premium product-led scenes route to Seedance 2.5.

- route: `SEEDANCE_DYNAMIC_V1`
- adapter: `SEEDANCE_25`
- model: `bytedance:seedance@2.5`
- 720x1280
- reference-guided generation
- provider audio disabled
- the locked INXSocial narrator is muxed after video generation

### Dynamic fallback

The router registers Kling VIDEO 3.0 Omni Standard as the capability fallback for premium dynamic scenes.

- route: `KLING_OMNI_DYNAMIC_V1`
- adapter: `KLING_OMNI_30`
- model: `klingai:kling-video@o3-standard`

Fallback selection occurs before provider spend when the preferred route cannot satisfy required input/duration capabilities. Runtime generation errors do not automatically launch another expensive model request.

### Compatibility premium

The pre-Phase-3 premium route remains registered:

- route: `KLING_PREMIUM_V1`
- adapter: `KLING_LEGACY`

Existing campaigns and scenes using legacy `KLING` or `HAILUO` values remain renderable through adapter aliases.

## Rollback switch

`UGC_MODEL_ROUTER_MODE`

Allowed values:

- `adaptive` — Phase 3 policy
- `compatibility` — Standard uses Hailuo and Premium uses the previous Kling route

The production default is `adaptive`, but the compatibility switch can be set in Railway without changing customer data or reverting migrations.

## Provider adapter contract

Every provider adapter exposes structured capabilities:

- model identifier
- supported generation modes
- scene kinds
- duration range
- reference limits
- reference mode
- audio strategy
- native lip-sync capability
- output resolution/aspect ratio

The renderer calls one adapter interface instead of constructing provider-specific requests inline.

## Current adapters

### HAILUO_23

- image-to-video
- 6/10 second provider-safe scenes
- first-frame creator/product reference
- 720p vertical
- post-process audio

### KLING_LEGACY

Preserves existing Premium campaign compatibility.

### OMNIHUMAN_15

- image + audio -> avatar video
- creator/CTA scenes
- native audio-driven lip sync
- uses the persistent INXSocial creator reference and narrator audio directly

### SEEDANCE_25

- reference-guided product/lifestyle generation
- 4–30 second provider capability
- 720p vertical
- up to the model's reference-image capacity
- external locked narration is muxed after rendering

### KLING_OMNI_30

- general premium dynamic fallback
- 3–15 second scenes
- reference/image guided generation
- post-process audio where required

## Data provenance

Each new engine project stores:

- router version
- router mode
- full router snapshot
- per-scene route key
- adapter key
- provider/model
- selection reason
- reference role
- audio strategy
- native lip-sync flag
- duration constraints
- fallback candidates

The Phase 3 router snapshot is included in the engine fingerprint.

Final UGC media metadata also stores the router version and the per-scene route keys used to produce the video.

## Important safety behavior

1. Skills remain provider-agnostic.
2. Routing happens only after skill preflight passes.
3. Routing happens before credits are reserved.
4. Existing campaigns keep their stored routes.
5. No customer UI exposes provider/model names.
6. Runtime provider failure refunds through the existing generation lifecycle.
7. Runtime failures do not silently spend again on a second premium provider.
8. The compatibility mode remains available for operational rollback.

## Phase 3 acceptance gate

Before Phase 4:

1. CI must pass.
2. Router migration must apply successfully.
3. Production startup must report `ugc-router-v1`.
4. Standard route must remain Hailuo.
5. Premium creator route must resolve to OmniHuman in adaptive mode.
6. Premium product route must resolve to Seedance in adaptive mode.
7. Legacy HAILUO/KLING campaigns must remain renderable.
8. Standard/Premium credit tables must remain unchanged until the dedicated pricing phase.
9. Provider names must remain absent from customer-facing UGC UI.
10. Media Library output must retain route provenance.
