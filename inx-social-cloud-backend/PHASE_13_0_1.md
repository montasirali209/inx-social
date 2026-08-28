# Phase 13.0.1 — React CI Deployment Recovery

Phase 13.0.1 corrects the deployment check introduced with the React foundation.

- GitHub Actions installs `frontend/package-lock.json` dependencies before the
  backend `npm run check` command invokes the frontend verification suite.
- Vitest uses one deterministic worker pool for the current one-file foundation
  test, avoiding queued child-process startup on Windows.
- Application behaviour, APIs, database schema, Railway variables and the Mac
  Ollama gateway are unchanged.
