# INX Social Cloud Backend 1.6.1

Node/Express backend for INX Social authentication, licences, billing, releases, and Facebook Page workspaces. The deployed database is PostgreSQL through Prisma 5.22.0.

## Local setup

```cmd
copy .env.example .env
npm install
npm run prisma:generate
npx prisma migrate dev
npm run seed
npm run dev
```

Replace the example database URL and secrets first. Keep `TOKEN_ENCRYPTION_KEY` stable because it protects saved Meta tokens.

## Validation

```cmd
npm run check
npm test
```

In production use `npm run prisma:migrate:deploy`, never `prisma migrate dev`.

## Railway release settings

The repository includes `railway.toml`. Configure the Railway service with:

- Root Directory: `/inx-social-cloud-backend`
- Config file path: `/inx-social-cloud-backend/railway.toml`
- Healthcheck: `/health`
- Required stable secret: `TOKEN_ENCRYPTION_KEY`

The pre-deploy command applies committed Prisma migrations before the new backend becomes active. Keep `TOKEN_ENCRYPTION_KEY` unchanged after Page tokens have been stored; changing it makes those encrypted tokens unreadable.
