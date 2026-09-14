# INXSocial Full OpenMontage Engine

This independently deployed service runs the **complete, unmodified upstream OpenMontage** checkout at pinned commit `08e2151fa02de28a5d6a312b3d575692bf147ad7`.

INXSocial does **not** replace or patch OpenMontage tools, skills, pipeline manifests, stock-source registries, provider selection, schemas, review gates or renderers. The integration lives only in `full_bridge.py`, outside `/opt/OpenMontage`, and turns INXSocial production requests into an agent-driven OpenMontage run.

## Runtime

The Docker image installs the upstream core requirements, Remotion, Piper TTS and HyperFrames runtime prerequisites. Provider-specific tools remain discoverable exactly as upstream ships them; each provider is available when its native dependency/API key requirements are satisfied.

The bridge uses an OpenAI Responses API orchestration agent because upstream OpenMontage is intentionally agent-first: the coding/production agent reads `AGENT_GUIDE.md`, pipeline manifests and stage skills, invokes native tools, writes checkpoints, performs review gates and renders the final production.

## API

All endpoints except `/health` require `Authorization: Bearer $OPENMONTAGE_INTERNAL_TOKEN`.

- `GET /health` — engine health and pinned upstream commit
- `GET /capabilities` — complete native pipeline/tool/provider/source discovery
- `GET /catalog` — pipeline and provider menu for the INXSocial UI
- `POST /jobs` — start a full native OpenMontage production; legacy Stock Video requests map to upstream `documentary-montage`
- `GET /jobs/{id}` — production stage, progress, result and audit events
- `GET /jobs/{id}/artifacts` — project artifact inventory
- `GET /jobs/{id}/artifact/{path}` — retrieve a project artifact
- `GET /jobs/{id}/output` — retrieve the reviewed final MP4
- `POST /jobs/{id}/cancel` — cooperative cancellation between native production steps

## Source and licence

OpenMontage is GNU AGPLv3. The engine service preserves the upstream source unchanged and exposes the pinned upstream commit in its runtime metadata. INXSocial-specific bridge code in this directory is distributed with the service source.
