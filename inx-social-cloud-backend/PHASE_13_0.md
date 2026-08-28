# Phase 13.0 — React SaaS Foundation

Phase 13.0 begins the route-by-route browser application migration using React
19, TypeScript, Vite and Tailwind CSS v4.

## Safety boundary

- The new application is served at `/app/`.
- The existing Studio remains available at `/studio/`.
- Existing API routes, authentication, Prisma data, publishing services and the
  protected Ollama gateway are unchanged.
- Railway builds the nested frontend and Express serves the production bundle.
- Client-side routing is registered only after every `/api/*` route.
- No Electron functionality is migrated or added.

## Phase gate

This phase contains the shared application shell and engineering foundation. It
does not replace Dashboard, Posts, Scheduler or any other production screen.
The first production screen will be migrated only after this foundation is
reviewed and approved.
