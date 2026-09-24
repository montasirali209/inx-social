# INXSocial UGC Engine — Phase 6 Studio UX, Generation Controls & Credits

## Scope

Phase 6 turns the existing UGC wizard controls into a versioned, backend-authoritative customer production contract.

It does not change:

- Phase 3 capability routing
- provider adapters or model IDs
- Phase 4 Creator V2
- Phase 5 creative-format grammar
- fixed UGC retail credit tables
- rendering, recovery, Media Library, editor, scheduler or publishing behavior

## Version

- Studio controls: `ugc-studio-controls-v1`
- UGC engine contract remains `1.3`
- Router remains `ugc-router-v1`
- Creator system remains `ugc-creators-v2`
- Creative format engine remains `ugc-formats-v1`

No database migration is required.

## Backend-authoritative controls

The backend now exposes one control snapshot for:

- supported durations
- supported variation counts
- Standard and Premium customer-facing descriptions
- fixed credit matrix
- customer-visible production rules
- quote-before-generation policy
- explicit confirmation policy
- background generation behavior

The UI consumes this contract instead of independently inventing tier descriptions and price behavior.

## Live quote

The estimate endpoint now returns:

- total credits
- credits per ad
- selected duration/count/quality
- selected production type and creative format
- quality-tier description
- duration guidance
- variation guidance
- current available credits
- balance after reservation
- shortfall when unaffordable
- one compatible affordable alternative when possible
- fixed pricing policy metadata

Quotes do not reserve or spend credits.

Campaign creation still performs a fresh credit check and reservation, so a stale UI quote cannot bypass balance enforcement.

## Customer workflow

The UGC flow is now:

Source → Brand → Ad style → Creator → Direction → Production → Review & credits → Finish

### Production

The customer selects only:

- 15 / 20 / 30 seconds
- 1 / 5 / 10 / 15 / 20 variations
- Standard / Premium

Provider/model routing remains automatic and hidden.

### Review & credits

Before generation, the customer sees:

- offer/campaign
- production type
- creative format
- creator / Auto casting
- variation count
- duration
- quality tier
- total credits
- per-ad price
- available balance
- balance after reservation

Generation cannot begin until the user explicitly chooses **Confirm & generate**.

If the selected setup is unaffordable, generation stays disabled. When possible, the backend supplies one affordable alternative, but it is never silently applied.

## Pricing invariants

Phase 6 preserves:

### Standard
- 15s: 100 credits
- 20s: 140 credits
- 30s: 210 credits

### Premium
- 15s: 180 credits
- 20s: 260 credits
- 30s: 390 credits

Creative format and creator choice do not change the fixed price.

## Customer/provider boundary

No customer-facing Phase 6 payload or control surface exposes provider/model names.

The customer chooses the experience. The Phase 3 router continues choosing the implementation.

## Acceptance criteria

Phase 6 is complete only when:

- Studio controls are versioned server-side
- live quotes use the current credit balance
- quote responses include affordability and balance-after-reservation
- campaign creation validates the same supported controls before reservation
- Standard/Premium descriptions are backend-derived
- creative format remains part of quote context
- an explicit review step exists before generation
- generation only starts after explicit confirmation
- unaffordable campaigns cannot start
- affordable alternatives require an explicit user click
- provider/model names remain hidden from the customer UI
- Phase 3 routing is unchanged
- Creator V2 is unchanged
- Phase 5 grammar is unchanged
- fixed credit tables are unchanged
- full repository CI passes before merge
- Railway production health reports `ugc-studio-controls-v1`
