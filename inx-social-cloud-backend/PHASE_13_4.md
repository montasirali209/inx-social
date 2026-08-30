# Phase 13.4 — Functional React Content Calendar

This phase rebuilds Content Calendar as a first-class React, TypeScript and
Tailwind CSS v4 workspace aligned with the approved Dashboard and Bulk Scheduler.

- Month and agenda/list views are responsive and keyboard accessible.
- Status, Page, platform and text filters operate on retained publishing data.
- INX Social cloud jobs load for the complete account.
- Live Meta scheduled-post reconciliation runs only for the Page explicitly
  selected in the current calendar session, preventing large accounts from
  opening dozens of simultaneous Meta requests.
- Selected dates and available times hand off to the existing working Posts
  composer. Occupied retained schedule slots are disabled.
- Best-time recommendations remain unavailable until permitted live analytics
  provide sufficient evidence; the interface never invents engagement guidance.

No database migration, Railway variable, Mac gateway or Ollama change is required.
