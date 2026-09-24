# INXSocial UGC Engine — Phase 2 Skills Layer

## Goal

Phase 2 adds the intelligence layer between customer intent and the existing UGC renderer.

The renderer, credit schedule, provider registry and customer-facing Standard/Premium experience remain unchanged in this phase. The purpose is to make every new campaign pass through reusable, structured production skills before any provider render is created.

Skills return JSON-like structured decisions. Human-readable prompt text is compiled only at the renderer boundary.

## Skill version

`ugc-skills-v1`

The active skills version is persisted in each new `UGCEngineProject` and reported in startup diagnostics.

## Skills

### Brand Understanding

Creates a verified evidence package from the saved brand profile, supplied product/brief and product references.

The skill explicitly records a `VERIFIED_ONLY` claim policy and prohibits invented prices, testimonials, statistics, certifications and features.

### UGC Creative Director

Uses the configured reasoning model once per campaign to create structured campaign strategy and variations.

Output includes:
- campaign objective
- creative pacing
- camera approach
- materially different hooks/angles
- full scripts
- CTA/caption
- desired creator profile
- scene objectives and visual directions

The Creative Director never chooses provider/model names.

### Creator Casting

Maps each variation to an available INXSocial creator.

Rules:
- explicit user selection always wins
- automatic casting scores category, locale/language, presentation, age band and environment fit
- repetition is penalised so variations can use different suitable creators when the library allows it
- the skill never requests resemblance to a celebrity or identifiable real person

### Script Timing

Duration-specific speech budgets:
- 15 sec: target 28–34 words, hard maximum 36
- 20 sec: target 38–46 words, hard maximum 49
- 30 sec: target 58–66 words, hard maximum 70

The spoken CTA is preserved inside the hard budget where supplied.

Minimum speech rate remains 1x. The skill reserves a short visual tail so the final word is not cut by the requested ad duration.

### Scene Planning

Transforms Creative Director output into the exact scene count required by the current production route.

It preserves:
- provider duration
- actual playback duration
- campaign-type scene rules
- scene objective
- scene kind

AVATAR_EXPLAINER remains creator-led throughout. PRODUCT_SHOWCASE can use creator/product scene combinations.

### Creator Consistency

Structured identity lock for:
- face
- skin tone
- apparent age
- hair
- wardrobe
- voice identity
- environment continuity

It prohibits identity morphing, unexpected second people, wardrobe drift, face replacement and celebrity resemblance.

### Voice Consistency

Locks one creator voice/locale per ad and prohibits:
- voice switching between scenes
- announcer cadence
- intentionally slowed speech

### Product Fidelity

When product references exist, preserves:
- geometry
- packaging
- colour
- proportions
- visible branding
- physical scale

It prohibits product substitution, invented packaging/text, floating objects and impossible grip.

### Natural Motion

Requests real-time 1x creator motion with natural blinking, breathing, eye contact, head movement and purposeful gestures.

It explicitly prohibits slow motion, time stretching, frozen poses, excessive gestures and rubber-hand behavior.

### Camera Style

Uses vertical smartphone realism as the default production language rather than artificial glossy CGI.

### Ad Finishing

Defines:
- exact final duration
- speech tail
- captions behavior
- music mode
- narration priority
- audio normalization requirement
- 720p 9:16 MP4 output

### Quality Control Preflight

Runs before provider generation.

Current hard preflight checks:
- script completion within timing budget
- exact planned playback duration
- creator availability for creator scenes
- product-reference availability for product scenes

This is preflight only. Post-render visual/audio QC and automatic scene regeneration remain later-phase work.

## Storage

Phase 2 adds additive fields to `UGCEngineProject`:

- `skillsVersion`
- `skillsJson`
- `preflightJson`

No existing UGC table or field is removed.

The engine fingerprint now includes the skill decision snapshot, so later changes to skill behavior cannot silently rewrite what an existing campaign was planned to do.

## Provider compatibility

Phase 2 does not change routing.

Current production remains:

- Standard -> Hailuo-compatible route
- Premium -> Kling-compatible route
- creator narration -> configured Inworld route
- creator lip sync -> configured Kling lip-sync route
- final output -> 720p

Phase 3 will introduce the model-router/provider-adapter architecture on top of these structured skill decisions.

## Failure behavior

Creative Director model failure falls back to a deterministic campaign structure before provider spend.

Hard preflight failure stops campaign creation before credit reservation/provider video rendering.

## Phase 2 acceptance gate

Before Phase 3:

1. CI must pass.
2. Railway migration must succeed.
3. Startup diagnostics must report `ugc-skills-v1`.
4. Standard and Premium route IDs/credits must remain unchanged.
5. A new campaign must persist Brand, Director, Casting, Timing, Scene, Consistency, Voice, Product, Motion, Camera, Finishing and Preflight decisions.
6. Missing product references must fail before provider spend.
7. A 15-second plan must still resolve to exact 15-second playback.
8. Existing pre-Phase-2 campaigns must continue to render/read normally.
