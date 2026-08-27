# Phase 12.0.2 — Routed Model Recovery

Phase 12.0.2 fixes a mismatch between private-agent health checks and mission task routing.

- The health probe and the mission runtime now converge on Railway's verified `OLLAMA_MODEL`.
- If a saved per-task route names a model rejected by the private gateway, the task retries once with the verified configured model.
- A model-rejection message names the model actually attempted instead of incorrectly naming the health-check model.
- Model names read from Railway are trimmed and safely unquoted.
- Paid fallback remains disabled unless its existing explicit controls allow it.

No database migration, Mac gateway change, service restart, or new environment variable is required.
