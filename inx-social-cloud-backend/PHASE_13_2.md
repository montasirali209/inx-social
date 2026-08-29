# Phase 13.2 — Functional React Bulk Scheduler

Phase 13.2 replaces the legacy Scheduler navigation target with a first-class React Bulk Scheduler at `/app/bulk-scheduler`.

## Customer experience

- Session-local destination selection with no global Active Page dependency.
- Honest platform filters for Facebook, Instagram, LinkedIn, TikTok, YouTube and X.
- Real connected Facebook Pages are selectable; planned connectors are never presented as live.
- Local multi-video and caption-file selection with caption matching guidance.
- Immediate, selected-time, next-slot and spread-across-days scheduling modes.
- Live browser upload progress, safe stop controls and per-destination results.
- Responsive destination cards, upload controls and result cards/tables.

## Deployment

This patch is cumulative over Phase 13.1.2 and includes the Phase 13.1.3 navigation refinement. It adds no database migration, Railway variable or Mac service change.
