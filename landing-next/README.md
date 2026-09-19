# INXSocial production landing — safe Next.js migration

This project is intentionally isolated from both the current Express-served production landing page and the older /marketing project.

## Visual parity rule
The current production landing markup, CSS, copy and assets are the source of truth. The first migration stage reuses the exact production body markup and stylesheet inside Next.js so framework migration cannot silently redesign the page.

## Stack
- Next.js
- React
- TypeScript
- Tailwind CSS toolchain (installed but not allowed to reset/reinterpret the approved production CSS during parity migration)
- Lenis for reduced-jank smooth scrolling
- Existing IntersectionObserver reveal behaviour preserved

## Fail-safe / rollback
1. The existing Express landing remains untouched.
2. This project deploys as a separate Railway service.
3. Production custom-domain traffic must not move until this service builds, passes /health and visual parity is checked.
4. Rollback is DNS/Railway-domain routing back to the existing inx-social service; no code rollback is required.
5. The old /marketing project is not used as the design source.

## Later componentisation
After visual parity, sections can be moved from the preserved markup into typed React components one at a time. Each conversion must preserve rendered geometry before the next section is migrated.
