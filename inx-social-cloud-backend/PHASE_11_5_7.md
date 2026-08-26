# Phase 11.5.5–11.5.7 — Reliable Social Manager Intelligence

This cumulative release is applied on top of Phase 11.5.4 and contains three verified stages.

## Phase 11.5.5 — Delivery integrity

- A content mission always assembles Campaign Review, including draft-only work.
- “Do not publish automatically” means approval is required; it no longer hides the result as an internal draft.
- Explicit mission wording such as “with an image” overrides a stale UI format choice.
- A mission cannot complete without the requested caption, connected Page, publishing decision and quality-approved media.
- Older completed plans with saved work but no campaign expose an **Open Campaign Review** recovery action.

## Phase 11.5.6 — Mission lifecycle

- Missing publishing intent opens one decision popup: use researched timing, show timing for approval, or save a draft.
- Hybrid always pauses in Campaign Review.
- Autopilot schedules only after ambiguity, artifact, visual-quality, Page and platform checks pass.
- Successfully scheduled Hybrid and Autopilot campaigns move to a separate **Completed missions** section and remain reopenable.
- Research-supported publishing times are used when no saved customer slots exist; occupied slots and timezone rules still apply.

## Phase 11.5.7 — Senior Social Strategy intelligence

- Short human instructions trigger the permanent professional workflow automatically.
- The workflow verifies Page identity, official facts, audience needs, competitor positioning gaps, social-search language, platform fit, creative relevance, accessibility and publishing evidence.
- Selected uploaded logos are preferred. Otherwise the exact connected Facebook Page profile image is fetched only from trusted Facebook image hosts and composited after generation.
- Competitor findings remain internal and are never copied into customer-facing work.
- Copy receives an expert-calibre quality score and one automatic repair attempt. A second failure is withheld rather than delivered.
- This is a transparent decision standard, not a claim that software has literal human employment history. Hidden chain-of-thought is never displayed or stored.

No additional Mac service changes are required after Phase 11.5.4. Existing text and image Ollama services, gateway and automatic LaunchAgents remain unchanged.
