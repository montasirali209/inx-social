# Phase 12.0.1 — Private Agent Provider Recovery

This hotfix makes the Railway-to-Mac Ollama route observable and safely recoverable.

- Authenticated gateway health check from Railway.
- Real bounded chat probe before a blocked mission is resumed.
- Safe diagnoses for public-route, token, model, engine, queue and timeout failures.
- Bounded task output with hidden Ollama thinking disabled.
- Independent 330-second task timeout for complex local inference.
- Saved missions resume from the blocked task after the provider probe passes.

No database migration, Mac service change or paid fallback is introduced.
