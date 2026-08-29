# Phase 13.1.2 — Dashboard Viewport Refinement

This refinement makes `Create post` the primary Dashboard action and compacts
the premium dashboard so the complete desktop workspace is visible at normal
100% browser zoom on the supported desktop viewport.

The implementation reduces excess spacing rather than scaling the application,
so typography remains crisp, accessibility remains intact, and tablet/mobile
layouts continue to respond normally.

No database migration, environment variable, Mac gateway or Ollama change is
required.
