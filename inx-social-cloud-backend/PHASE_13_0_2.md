# Phase 13.0.2 — Clean Install Dependency Recovery

GitHub CI exposed that `agentMediaService.js` directly imports `sharp`, while
the backend dependency manifest did not declare it. Existing developer machines
could hide this defect because an older `node_modules` directory already
contained Sharp.

Phase 13.0.2 declares and locks Sharp as a production dependency so clean GitHub
Actions and Railway installations contain the deterministic image-composition
runtime required by the Social Agent.
