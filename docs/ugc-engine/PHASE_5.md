# INXSocial UGC Engine — Phase 5 Creative Formats & Grammar

## Scope

Phase 5 adds the creative-format layer from the original eight-phase UGC Studio roadmap. It does not replace the existing production type, Creator V2, router, provider adapters, pricing, renderer, editor, Media Library, scheduler or publishing path.

Production type answers **how the ad is produced**:

- `AVATAR_EXPLAINER`
- `PRODUCT_SHOWCASE`

Creative format answers **how the ad tells the story**:

- Problem → Solution
- Product Demo
- Testimonial-style
- Unboxing
- Reaction
- Before / After
- Storytime
- Spokesperson
- Product-focused UGC
- Auto compatible mix

## Versioning

- Creative format engine: `ugc-formats-v1`
- UGC engine contract for new campaigns: `1.3`
- Existing contract 1.0 / 1.1 / 1.2 projects remain unchanged and readable.
- No database migration is required. Phase 5 is persisted in the existing campaign plan and versioned engine JSON snapshots.

## Deterministic grammar

Every format defines:

- ordered story beats
- permitted hook families
- CTA mode
- camera emphasis
- evidence/product requirements
- safety rules

The format engine resolves a format before the Creative Director runs. The Creative Director receives the required grammar, but cannot change the selected format. Scene planning deterministically distributes the grammar beats across the actual provider scene count.

The renderer boundary receives the resolved format, scene beats and format rules as part of the compiled scene prompt.

## Auto mode

`AUTO` does not mean one generic format.

It deterministically rotates through compatible formats across campaign variations. Compatibility is based on:

- production type
- availability of a real product reference
- verified transformation evidence

This gives multi-ad campaigns structural variety without changing provider routing or pricing.

## Evidence safeguards

### Testimonial-style

Testimonial-style is a conversational recommendation structure. It must not fabricate:

- first-person product use
- customer history
- customer results
- unverified claims

### Before / After

Before / After is blocked unless verified supplied evidence supports a transformation or measurable improvement. The system must not invent a starting state, outcome, metric or transformation.

### Product formats

Product Demo, Unboxing and Product-focused UGC require a real product reference and remain subject to exact product fidelity.

## Router compatibility

Creative format does not choose providers.

The existing Phase 3 router still selects routes from scene capability:

- Standard remains Hailuo
- Premium creator/CTA remains OmniHuman where compatible
- Premium product/lifestyle remains Seedance
- Kling Omni remains dynamic fallback
- Kling Premium remains compatibility route

Phase 5 changes story structure and scene intent only.

## Creator compatibility

Creator V2 remains authoritative for:

- casting
- identity
- locale/accent
- wardrobe
- environment
- gestures
- voice
- production-route compatibility
- persistent references

Phase 5 consumes Creator V2 decisions; it does not create a second creator system.

## Pricing

Phase 5 does not change fixed retail UGC credits:

- Standard: 15s 100 / 20s 140 / 30s 210
- Premium: 15s 180 / 20s 260 / 30s 390

## Studio

The existing **Ad style** step now has two separate choices:

1. production type
2. creative structure

Unavailable creative structures are visibly disabled when the current production type or evidence cannot support them.

## Acceptance invariants

Phase 5 is complete only when:

- format selection is validated before Creative Director planning
- format decisions survive the model router unchanged
- every scene carries deterministic story beats
- format decisions are included in the engine fingerprint
- Auto can mix compatible formats across variations
- explicit selection remains locked
- testimonial and before/after evidence safeguards are enforced
- product-dependent formats require real product references
- customer UI contains no provider/model names
- Phase 3 routing remains unchanged
- Phase 4 Creator V2 remains unchanged
- fixed UGC credit tables remain unchanged
- full repository CI passes before merge
- production startup reports contract 1.3 and `ugc-formats-v1`
