# INX Social Cloud Backend V1.4 - Admin UI Asset Fix

This build fixes the admin panel loading without CSS/JS.

## What changed

- Admin UI CSS and JavaScript are embedded directly into `public/index.html` so the panel cannot load as plain unstyled HTML.
- `/` redirects to `/admin`.
- `/admin` and `/admin/` both load the admin UI.
- Backend API, auth, Prisma schema, seed, and licence routes are unchanged from V1.3.

## Run

```cmd
cd inx-social-cloud-backend
copy .env.example .env
npm install --no-audit --no-fund
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Open:

```text
http://localhost:5050/admin
```

Default admin:

```text
admin@inxsocial.local
ChangeMe123!
```

## Do not update Prisma

This local SQLite backend is pinned to Prisma 5.22.0. Ignore the Prisma 7 update notice for this build.
