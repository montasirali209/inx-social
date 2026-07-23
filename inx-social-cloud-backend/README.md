# INX Social Cloud Backend 2.0.0

Node/Express/PostgreSQL backend for INX Social accounts, licences, Stripe billing, releases, Facebook Page workspaces, and the Phase 10 browser Cloud Studio.

## Phase 10 Cloud Studio

Cloud Studio is served at `/studio/`. It reuses the existing desktop renderer and therefore keeps the familiar Home, Pages, Auto Scheduler, Manual Scheduler, Health Check, Calendar, Analytics, Logs, and Settings screens.

It also reuses the existing:

- customer accounts and email verification;
- trial/subscription and plan limits;
- Stripe customer portal;
- connected Meta accounts and Facebook Pages;
- active Page selector;
- PostgreSQL database and Railway service;
- Meta scheduled-Reels publishing protocol.

The Electron desktop app remains version 14.0.2 and is not replaced or changed by this backend release.

### Video handling

Cloud Studio does not require paid permanent object storage. A selected browser video is:

1. prepared as a user-owned cloud job;
2. streamed to a random temporary server file;
3. streamed from the server to Meta using the selected Page's server-side encrypted token;
4. scheduled by Meta for the requested future time;
5. deleted from the server after success or failure.

The user must keep the Cloud Studio tab open until each upload is confirmed by Meta. Once Meta confirms the schedule, the browser may close and Meta retains the scheduled Reel. Page tokens and storage paths are never returned to the browser.

## Local setup

```cmd
copy .env.example .env
npm install
npm run prisma:generate
npx prisma migrate dev
npm run dev
```

Replace the example database URL and secrets first. Keep `TOKEN_ENCRYPTION_KEY` stable because it protects saved Meta tokens.

Open:

```text
http://localhost:5050/studio/
```

## Validation

```cmd
npm run check
npm test
```

In production use `npm run prisma:migrate:deploy`, never `prisma migrate dev`.

The additive Phase 10 migration is:

```text
prisma/migrations/20260723000000_add_cloud_studio_foundation/migration.sql
```

It adds cloud job lifecycle fields, temporary asset metadata, and per-user browser preferences. Existing desktop job rows receive `origin=DESKTOP` and remain compatible.

## Railway release settings

The repository includes `railway.toml`:

- Root Directory: `/inx-social-cloud-backend`
- Config file path: `/inx-social-cloud-backend/railway.toml`
- Healthcheck: `/health`
- Required stable secret: `TOKEN_ENCRYPTION_KEY`

The pre-deploy command applies committed Prisma migrations before the new backend becomes active.

## External approvals before production

Local testing, code review, and GitHub CI require no external-service change.

The following actions require the owner's approval:

1. Add the production callback below to Meta App Dashboard → Facebook Login → Valid OAuth Redirect URIs:

   ```text
   https://api.social.inaxx.co.uk/studio/facebook-callback.html
   ```

   This is required only for connecting additional Facebook accounts/Pages from the browser. Existing connected Pages can be tested without changing Meta.

2. Push or merge into the Railway production-connected branch. Auto-deploy will build the backend and apply the Phase 10 database migration. Review CI and the migration first.

No Stripe key, Stripe webhook, DNS, paid storage account, or Windows installer setting needs to change for Phase 10.

## Hardened Windows releases

The root GitHub Actions workflow keeps desktop release publishing separate from backend deployment:

- **Run workflow** builds a private test artifact.
- A matching version tag builds the hardened installer and waits at the `production-release` GitHub environment.

Configure the Windows certificate secrets and `RELEASE_API_KEY` before publishing a signed installer. Phase 10 does not remove the desktop download option.

Electron source cannot be made impossible to inspect. Server-side licences, Page ownership, encrypted Page tokens, plan limits, and authenticated release downloads remain authoritative.
