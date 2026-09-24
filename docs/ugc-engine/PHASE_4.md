# INXSocial UGC Engine — Phase 4 Creator System V2

## Scope

Phase 4 implements the Creator/Casting architecture from the original eight-phase UGC roadmap. It upgrades the existing reusable 52-person creator library rather than replacing it.

## Persistent creator profile

Every built-in, uploaded and generated creator uses the same versioned `ugc-creators-v2` profile:

- presentation and adult age band
- locale, language and accent
- niche/category metadata
- environment preferences
- wardrobe directions
- gesture directions
- voice identity
- compatible creator routes
- persistent reference quality state

The 52 existing system identities remain the canonical launch library. No creator is regenerated per campaign.

## References

The existing `UGCAvatar.referenceStorage*` fields remain the master identity reference so the working renderer is not broken.

Phase 4 adds `UGCAvatarReference` for persistent alternate references. Alternate references are reusable assets owned by the creator identity. The master reference remains authoritative for current single-reference provider paths.

Reference generation/repair policy is **repair once, reuse thereafter**. A campaign may materialize a missing master once, but it never intentionally regenerates an already healthy reference for each campaign.

## Casting V2

Auto casting is deterministic and uses:

- niche/category match
- locale/language
- presentation
- adult age band
- environment
- wardrobe
- gesture style
- route compatibility
- variation diversity
- existing reference readiness

A manually selected creator remains authoritative.

## Router compatibility

Creator profiles explicitly record compatibility with:

- HAILUO_STANDARD_V1
- OMNIHUMAN_CREATOR_V1
- KLING_OMNI_DYNAMIC_V1
- KLING_PREMIUM_V1

The router still owns model selection. Creator metadata informs casting and provides a compatibility contract; it does not expose provider names to customers.

## Engine contract

New campaigns use UGC contract **1.2** and persist Creator V2 actor snapshots in the engine fingerprint. Existing 1.0/1.1 projects remain readable and unchanged.

## Studio

The Creator step exposes the full creator library when requested, with search and filters across name, niche/category, presentation, adult age band and locale/accent. Featured creators remain the default compact view. Saved user creators remain reusable.

## Compatibility

Phase 4 does not change:

- Standard/Premium credit tables
- Hailuo Standard routing
- Phase 3 adaptive routing policy
- Media Library persistence
- background rendering/recovery
- editor regeneration
- scheduler handoff
- publishing


## Acceptance audit

Phase 4 is complete only when all of these invariants hold:

- the existing 52 system creators are upgraded in place rather than replaced
- system, generated and uploaded creators share the same Creator V2 metadata contract
- healthy master references are reused and are not regenerated per campaign
- alternate references are persistent creator-owned assets
- automatic casting uses the full library, while the Studio keeps a compact featured default
- user-facing creator payloads do not expose provider/model routing internals
- Phase 3 routing, credit tables, Media Library, editor regeneration, background recovery and scheduler integration remain unchanged
- the repository test/build gate passes on the final Phase 4 commit before merge
