# Phase 13.1.3 — Posts Navigation

This shell refinement separates direct content creation from bulk video
scheduling in the React navigation.

- `Scheduler` is renamed to `Bulk Scheduler`.
- A distinct `Posts` menu is added between Content Calendar and Media Library.
- The redundant `Videos` menu is removed. Video files remain available through
  Bulk Scheduler, Posts and Media Library.
- Posts opens the existing working Posts workspace until its dedicated React
  screen is migrated from the customer-approved UI reference.

No database migration, environment variable, Mac gateway or Ollama change is
required.
