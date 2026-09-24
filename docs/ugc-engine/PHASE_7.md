# INXSocial UGC Engine — Phase 7 Rendering, QC, Recovery & Publishing Handoff

## Scope

Phase 7 hardens the existing UGC render pipeline. It does not replace the Phase 3 router, Phase 4 Creator V2, Phase 5 creative grammar or Phase 6 Studio controls.

The existing path remains:

Plan → Route → Render scenes → Assemble → Media Library → Editor → Scheduler

Phase 7 adds a versioned quality/recovery layer around that path.

## Version

- Render QC: `ugc-render-qc-v1`
- UGC engine contract remains `1.3`
- Router remains `ugc-router-v1`
- Creator system remains `ugc-creators-v2`
- Creative formats remain `ugc-formats-v1`
- Studio controls remain `ugc-studio-controls-v1`

No database migration is required.

## Scene-level failure isolation

A provider/TTS/lip-sync/download/storage failure is now attached to the exact `UGCScene`.

The affected scene becomes `FAILED` with its error message.

Already completed scenes remain `READY` and are reused.

This prevents an ad-level failure from hiding which scene actually needs attention.

## Assembly preflight

Final assembly cannot begin unless every scene:

- is `READY`
- has a persistent stored video key

If a stored scene file is missing at assembly time, that exact scene is converted to a recoverable failed scene instead of repeatedly attempting a broken final assembly.

## Final output QC

Before the final asset is persisted, the assembled output must pass the Phase 7 final buffer checks:

- non-trivial video size
- MP4 container marker present
- assembly completed successfully through FFmpeg

The Media Library asset stores the render-QC version and QC metadata in its generation metadata.

## Recovery classes

The QC contract classifies each ad as one of:

- `READY`
- `PROCESSING`
- `RECOVERY_REQUIRED`
- `ASSEMBLY_REQUIRED`
- `BLOCKED`

Recovery actions are:

### WAIT

The current render is still active.

### RETRY_SCENES

One or more scenes are failed, edited or otherwise incomplete.

The editor marks only those scenes as needing retry and preserves all completed scene renders.

Scene regeneration continues to use the existing proportional credit calculation.

### REASSEMBLE

All scene renders are healthy but the final video is missing/stale/failed.

The final video can be rebuilt using the stored scene renders.

Reassembly costs **0 generation credits** because no provider scene generation is performed.

### NONE

The ad is complete and publishable.

## Credit safety

Paid scene/ad regeneration continues to reserve credits through the existing credit service.

Zero-credit reassembly uses a separate local generation record with `reservedCredits = 0`.

The render worker only calls credit completion/refund when the current generation actually has positive reserved credits.

This prevents reassembly from accidentally completing or refunding the original ad credit amount.

## Editor integration

The UGC Editor now shows:

- Phase 7 QC state
- scene-ready count
- publishing readiness
- exact scenes requiring retry
- failed scene error message
- proportional scene-regeneration credits
- zero-credit **Reassemble final video** action when applicable
- full paid regeneration remains available separately

Voice, voice-delivery and creator changes now mark creator/CTA scenes as edited so selective regeneration cannot incorrectly treat them as assembly-only changes.

## Media Library

Final UGC assets remain normal Media Library `AI_VIDEO` assets.

Phase 7 adds render-QC metadata to the generation choice payload.

The final UGC ad is marked READY only after:

1. all scenes are ready
2. final assembly succeeds
3. final output QC succeeds
4. Media Library persistence succeeds

## Publishing handoff

UGC handoff to the scheduler is now explicitly typed as `VIDEO`, not `IMAGE`.

The Wizard and Editor only enable scheduling when:

- a Media Library asset is linked
- the Phase 7 QC report says `publishable: true`

An old/stale video may remain previewable while a regeneration/reassembly is running, but it cannot be scheduled as the current finished ad until QC passes.

## Worker recovery

The existing stale-render recovery remains in place.

If a worker disappears during scene generation, the ad can be requeued and incomplete scenes are rerendered.

Completed stored scenes remain reusable.

## Acceptance criteria

Phase 7 is complete only when:

- scene failures are isolated to the exact scene
- completed scenes are reused
- assembly is blocked when scene renders/storage are incomplete
- missing stored scene media becomes a scene-level recovery state
- final output passes MP4 QC before Media Library persistence
- zero-credit reassembly cannot touch paid credit completion/refund
- QC state is exposed to the customer-facing editor
- only affected scenes are highlighted for retry
- full regeneration remains available separately
- Media Library assets carry QC metadata
- scheduler handoff uses video semantics
- scheduling requires a QC-publishable asset
- Phase 3 routing remains unchanged
- Creator V2 remains unchanged
- Phase 5 grammar remains unchanged
- Phase 6 controls and fixed pricing remain unchanged
- full repository CI passes before merge
- Railway production startup reports `ugc-render-qc-v1`
