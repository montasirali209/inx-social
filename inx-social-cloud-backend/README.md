# INX Social Cloud Backend 1.7.0

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

## Hardened Windows releases

The root GitHub Actions workflow has two separate release paths:

- **Run workflow** builds an installer for private testing and stores it as a temporary GitHub Actions artifact. It does not publish a GitHub Release or change the production backend.
- A tag such as `v14.0.0` must exactly match the root `package.json` version. It builds the hardened installer, requires a valid Windows code-signing certificate, and then waits at the `production-release` GitHub environment before publishing anything.

Configure these GitHub secrets before creating a production tag:

- Repository secret `WINDOWS_CERTIFICATE`: the code-signing `.pfx` supplied to electron-builder (base64 or another supported `CSC_LINK` value).
- Repository secret `WINDOWS_CERTIFICATE_PASSWORD`: the `.pfx` password.
- `production-release` environment secret `RELEASE_API_KEY`: the same long random value stored as `RELEASE_API_KEY` in Railway.

Add the repository owner as a required reviewer for the `production-release` environment. Approval permits the workflow to create or update the public GitHub Release and POST its version, SHA-256, size, and download URL to `/api/releases/publish`. Rejecting or leaving that approval pending does not change GitHub Releases or Railway data.

The customer portal only returns the installer URL after an authenticated licence check and records the download. Public `/api/releases/latest` metadata deliberately omits the storage URL. `LATEST_DESKTOP_VERSION` and `INSTALLER_URL` remain only as legacy fallbacks when no `DesktopRelease` row exists.

When a release is published with `minimumSupportedVersion`, device activation returns HTTP 426 for missing, invalid or older desktop versions. Leave this field empty during normal releases; raising it is a separate production decision because it locks older installed builds on their next licence check.

### Electron protection boundary

Electron source can never be made impossible to inspect. This build enables ASAR packaging, embedded ASAR integrity validation, `OnlyLoadAppFromAsar`, restricted Electron fuses, renderer sandboxing, IPC sender checks, a restrictive renderer Content Security Policy, and production DevTools blocking. A modified `app.asar` should terminate instead of running, and modifying a signed installer or executable invalidates its Windows signature.

Do not treat minification or obfuscation as a licence system. Subscription, device, Page and download permissions must remain authoritative in the backend. For stricter control over who can fetch the installer itself, replace the GitHub asset URL with short-lived signed URLs from private object storage; customers who can install the app will still be able to possess its files.
