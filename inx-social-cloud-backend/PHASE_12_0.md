# INX Social Phase 12.0 — Professional SaaS Foundation

Phase 12.0 establishes the product shell and data boundaries required for INX
Social to grow from a Facebook scheduler into a professional multi-platform
publishing SaaS.

## Customer workspace

- Dashboard remains an isolated, status-only view.
- Adds a prominent Create New Post entry point.
- Adds Content Calendar, Posts and Media Library workspaces.
- Renames Social Agent in navigation to AI Content Studio.
- Removes Activity Logs from customer navigation while retaining audit data.
- Does not add Inbox or Team Members.
- Places Connected Accounts & Pages after Settings.
- Keeps Billing & Plans in the customer portal.

## Posts workspace

The Posts view consolidates real local scheduler jobs, Meta schedule results and
AI Campaign Review posts. It supports All, Drafts, Awaiting Approval, Scheduled,
Published and Failed filters without generating placeholder metrics.

## Multi-platform foundation

The authenticated `/api/social-platforms` registry declares Facebook as LIVE and
Instagram, Threads, LinkedIn, TikTok, YouTube, Pinterest and X as PLANNED. Planned
connectors are visibly disabled and are never represented as connected.

The Prisma migration adds platform-neutral SocialConnection, SocialProfile,
SocialContent and SocialPublication records. Existing Facebook tables and workers
remain unchanged until each official connector is implemented and verified.

## Operational impact

- One additive database migration.
- No Railway variable changes.
- No Mac, Ollama, gateway or LaunchAgent changes.
- Existing Facebook Scheduler and Social Agent workflows remain active.
