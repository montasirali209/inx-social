# INXSocial Full OpenMontage Engine

This independently deployed service runs the **complete, unmodified upstream OpenMontage** checkout at pinned commit `08e2151fa02de28a5d6a312b3d575692bf147ad7`.

INXSocial does **not** replace or patch OpenMontage tools, skills, pipeline manifests, stock-source registries, provider selection, schemas, review gates or renderers. The integration lives only in `full_bridge.py` and `compat_bridge.py`, outside `/opt/OpenMontage`, and turns INXSocial production requests into agent-driven OpenMontage runs.

## Runtime

The Docker image installs the upstream core requirements, Remotion, Piper TTS and HyperFrames runtime prerequisites. Provider-specific tools remain discoverable exactly as upstream ships them; each provider is available when its native dependency/API key requirements are satisfied.

The bridge uses an OpenAI Responses API orchestration agent because upstream OpenMontage is intentionally agent-first: the production agent reads `AGENT_GUIDE.md`, pipeline manifests and stage skills, invokes native tools, writes checkpoints, performs review gates and renders the final production.

When INXSocial does not explicitly request a pipeline, the compatibility layer sends the job through **native automatic pipeline routing**. This means Stock Video Creator is no longer hard-wired to the old reduced documentary-only workflow; the agent can choose the best upstream pipeline for the brief while respecting the user's duration, format, narration and caption controls.

## API

`/health` and `/ready` are public service-health endpoints. All production/catalog endpoints require `Authorization: Bearer $OPENMONTAGE_INTERNAL_TOKEN`.

- `GET /health` — process health and pinned upstream commit
- `GET /ready` — verifies full pipeline/tool discovery before Railway marks the service healthy
- `GET /capabilities` — complete native pipeline/tool/provider/source discovery plus the legacy compatibility fields consumed by INXSocial
- `GET /catalog` — native pipeline and provider catalog
- `POST /jobs` — start a full native OpenMontage production with automatic routing unless a specific upstream pipeline is requested
- `GET /jobs/{id}` — production stage, progress, result and audit events
- `GET /jobs/{id}/artifacts` — project artifact inventory
- `GET /jobs/{id}/artifact/{path}` — retrieve a project artifact
- `GET /jobs/{id}/output` — retrieve the reviewed final MP4
- `POST /jobs/{id}/cancel` — cooperative cancellation between native production steps

## Source and licence

OpenMontage is GNU AGPLv3. The engine service preserves the upstream source unchanged and exposes the pinned upstream commit in its runtime metadata. INXSocial-specific bridge code in this directory is distributed with the service source.
