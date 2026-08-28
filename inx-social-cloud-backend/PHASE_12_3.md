# Phase 12.3 — Governed Image Provider Recovery

## Confirmed causes

1. The review editor collected custom image instructions, exact overlay text and the selected quality, but `studio/web-adapter.js` discarded the payload and sent `{}` to the regeneration endpoint. Repeated retries therefore reused the same stored visual brief.
2. The administrator image policy was hard-coded to `OLLAMA_IMAGE`; the paid OpenAI image route could not be selected from Admin.
3. The first and second local prompts were too similar. A weak local model could repeat the same phone, interface and pseudo-text composition even after the visual reviewer rejected it.
4. The visual-quality gate correctly withheld both failed images. The visible `Aa` panel is the safe placeholder, not a missing browser image.

## Corrections

- Forward the complete customer regeneration payload.
- Strengthen the text-free, no-device, no-interface contract and force the second local attempt to use a visibly different composition.
- Add separate administrator controls for local and paid image generation.
- Support Local only, OpenAI preferred, and Local then OpenAI after rejection routes.
- Use the OpenAI Images API with an allowlisted GPT Image model only when the administrator enables paid images and a key is configured.
- Limit paid images per mission and audit the chosen generation route.
- Expose Premium to customers only while the administrator-approved paid route is available.
- Continue deterministic exact-logo and exact-text composition after generation.
- Keep the existing hard visual-quality gate for every provider.

No schema migration or Mac gateway change is required.
