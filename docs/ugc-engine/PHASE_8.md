# INXSocial UGC Engine — Phase 8 Production Audit & Hardening

## Purpose

Phase 8 closes the original UGC Studio architecture roadmap by adding one production truth layer over all previously deployed phases.

It does not replace the renderer, router, creator system, creative grammar, Studio controls, Media Library or scheduler.

It proves those systems agree with each other.

## Versions

- Engine: `ugc-engine-v1`
- Contract: `1.3`
- Skills: `ugc-skills-v1`
- Router: `ugc-router-v1`
- Creator system: `ugc-creators-v2`
- Creative formats: `ugc-formats-v1`
- Studio controls: `ugc-studio-controls-v1`
- Render QC: `ugc-render-qc-v1`
- Runtime policy: `ugc-runtime-policy-v1`
- Production audit: `ugc-production-audit-v1`

No database migration is required.

## Final production architecture

```
Customer brief / website / product
  ↓
Brand understanding + evidence extraction
  ↓
Creative format grammar
  ↓
Creator casting
  ↓
UGC skills / creative direction
  ↓
Script timing + scene plan
  ↓
Preflight
  ↓
Model router
  ↓
Provider adapters
  ↓
Credit quote + explicit customer confirmation
  ↓
Credit reservation
  ↓
Background render queue
  ↓
Per-scene narration + video generation
  ↓
Lip-sync / audio mux where required
  ↓
Scene persistence
  ↓
Scene QC
  ↓
Final assembly
  ↓
Final MP4 QC
  ↓
Media Library
  ↓
UGC Editor
  ↓
Selective scene regeneration OR zero-credit final reassembly
  ↓
Publishability QC
  ↓
Bulk Scheduler
  ↓
Connected destinations / Content Calendar / publishing
```

Phase 8 continuously checks the persistence chain underneath that flow:

```
UGCCampaign
  ↕
UGCEngineProject
  ↕
UGCAd
  ↕
UGCScene
  ↕
AiGeneration
  ↕
AiCreditTransaction
  ↕
AgentAsset / Media Library
  ↕
Render QC / publishability
```

## Production audit

A versioned `ugc-production-audit-v1` audit can be generated for an owned campaign.

Authenticated owner diagnostic endpoint:

`GET /api/ai-content-studio/ugc/campaigns/:campaignId/audit`

The audit checks:

- campaign exists
- engine project exists
- campaign/engine ownership and IDs agree
- engine lifecycle status agrees with campaign lifecycle status
- confirmed variation count equals persisted UGC ads
- engine render-job count equals UGC ad count
- each ad has scenes
- each ad is linked to the current generation record
- each ad is represented in the engine render jobs
- reserved/used credits are non-negative and coherent
- completed paid generations finalize the exact reserved amount
- failed paid generations with a debit have a refund
- zero-credit reassembly remains zero-credit
- provider cost cannot be negative
- READY ads pass render QC
- READY ads have a Media Library asset
- the Media Library output is a READY AI video
- terminal campaigns contain only READY/FAILED variations
- active rendering is not beyond the stale threshold

The report includes a stage-oriented lifecycle frame from Brief through Publish Ready.

## Preserving the original engine contract

Phase 8 does not replace the original `qcJson` contract snapshot.

The persisted structure keeps the existing QC contract and adds:

```json
{
  "...existingQcContract": "...",
  "productionAuditVersion": "ugc-production-audit-v1",
  "productionAudit": {}
}
```

The planning fingerprint therefore remains immutable.

## Terminal-state audit persistence

Whenever a campaign reaches:

- READY
- PARTIAL
- FAILED

the current end-to-end production audit is written into the engine project.

A manual owner audit or admin operations audit can refresh it.

## Runtime policy

Phase 8 removes renderer magic numbers and centralizes them in `ugc-runtime-policy-v1`.

Production defaults remain deliberately unchanged:

- ad workers per process: 1
- concurrent scenes inside an ad: 2
- queue polling: every 5 seconds
- stale-render recovery threshold: 5 minutes
- distributed claiming: PostgreSQL `FOR UPDATE SKIP LOCKED`

This means one process does not duplicate the same ad.

If Railway is horizontally scaled later, multiple application processes can claim different queued ads safely.

Phase 8 does not increase provider concurrency automatically.

## Queue and recovery

Existing stale RENDERING recovery remains active.

A lost worker can cause the ad to return to QUEUED after the stale threshold.

Completed scene assets remain reusable.

Phase 8 additionally reports stale QUEUED/RENDERING work to administrators so a blocked queue cannot remain invisible.

## Credits

The production audit distinguishes normal paid generation from local final reassembly.

### Paid generation

1. Quote is shown before generation.
2. Customer explicitly confirms.
3. Credits are reserved/debited.
4. Successful render sets `creditsUsed` to the reserved amount.
5. Failed paid render creates the normal refund transaction.

### Scene regeneration

Only the selected scene is rerouted and regenerated.

Credits are proportional to the scene duration.

Healthy scenes stay reusable.

### Final reassembly

If every scene is already good but the final file needs rebuilding:

- provider: local
- reserved credits: 0
- used credits: 0
- no generation debit
- no completion/refund mutation on paid credits

## Provider cost

Provider cost is recorded on generation records.

Phase 8 checks that cost remains non-negative and exposes the 30-day total in Admin > AI & Automation.

The audit does not alter retail credit pricing.

## Admin operations

Admin endpoint:

`GET /api/admin/ugc-operations?limit=20`

Admin > AI & Automation now shows:

- overall UGC production health
- queued ads
- actively rendering ads
- stale work
- failed outputs visible for recovery
- oldest active update
- 30-day credits used
- 30-day provider cost
- recent terminal campaigns with production invariant issues

The admin view contains operational metadata only; it does not expose customer scripts/prompts.

## Analytics correction

`REASSEMBLY_STARTED` is now a recognized UGC operational event.

Privacy-safe reassembly metadata can include:

- scene count
- recovery action
- render-QC version

## Customer-facing behavior

The customer still sees provider-neutral controls.

They choose:

- source
- brand/product
- production type
- creative structure
- creator or Auto
- direction
- duration
- variation count
- Standard or Premium
- Review & credits
- Confirm & generate

The customer does not need to select Hailuo, OmniHuman, Seedance or Kling.

The router makes scene-level production decisions after planning/preflight.

## Failure behavior

### A scene fails

- exact scene becomes FAILED
- healthy scenes remain persisted
- editor marks only the affected scene NEEDS RETRY
- selective regeneration is available

### Final assembly fails

If all scene media is healthy:

- editor offers Reassemble final video
- cost is 0 credits
- no scene provider generation is repeated

### Stored scene media disappears

- the exact scene becomes recoverable
- the system does not repeatedly attempt broken assembly

### Worker disappears

- stale render recovery requeues the ad
- persisted completed scenes are reused

### Campaign state becomes inconsistent

- Phase 8 audit returns FAIL
- Admin operations shows the campaign as requiring invariant investigation

## Final audit acceptance criteria

Phase 8 is complete when:

- production audit is versioned
- runtime policy is versioned
- all previously deployed UGC versions remain unchanged
- audit reconciles campaign, engine, ads, scenes, generation, credits, QC and Media Library
- terminal audit is persisted without overwriting the initial QC contract
- owner audit endpoint is authenticated and ownership-scoped
- admin operational health uses the same audit service
- stale queue work is visible
- paid-generation refunds are audited
- zero-credit reassembly is audited
- Media Library reads remain metadata-only during audit
- UGC reassembly analytics are tracked
- queue/concurrency constants are centralized
- no provider concurrency is increased implicitly
- no database migration is required
- full repository CI passes
- Railway production starts with both `ugc-runtime-policy-v1` and `ugc-production-audit-v1`
- production `/health` returns 200
