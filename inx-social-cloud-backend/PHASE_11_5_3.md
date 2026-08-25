# Phase 11.5.3 — Image Refinement and Quality Gate

This release makes Quality the default local image route and adds customer-directed image regeneration inside Campaign Review.

## Customer workflow

- The existing AI visual plan remains editable.
- The customer can add custom image instructions, choose Fast or Quality, and optionally provide exact overlay text.
- Quick-change controls help request a new concept, brand imagery, brighter styling, minimal styling, or removal of fake UI.
- The current image remains attached until its replacement passes visual review.
- Every replacement resets post approval.

## Image safety

- The image model generates a text-free, logo-free background layer.
- The selected uploaded logo and optional headline are composited afterward at 1080 x 1350, so the model cannot redraw their spelling.
- Quality generation privately routes to `x/flux2-klein:4b`; Fast remains available as a customer choice.
- Two failed visual reviews result in a `REJECTED` asset and `WAITING_MEDIA` post, never an approval-ready post.
- Earlier generated images without Phase 11.5.3 quality metadata must be regenerated once before approval or scheduling.
- Scheduling performs a final server-side quality-metadata check even if the browser is bypassed.

## Railway variable

Add or confirm:

```text
OLLAMA_QUALITY_IMAGE_MODEL=x/flux2-klein:4b
```

No new Mac service is required. The current gateway allowlist already contains `x/flux2-klein:4b`.
