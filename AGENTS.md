# INX Social repository instructions

## Release target

- Production deployments originate from `deployment/railway-postgres`.
- Create changes on a `codex/*` branch and deliver them through a pull request into `deployment/railway-postgres`.
- Never force-push, delete the production branch, or bypass required checks.
- Do not merge, publish, tag, or deploy when any required verification fails.
- Codex Cloud may check out an isolated `work` branch without a normal Git remote. Use the connected GitHub integration to create the release branch and pull request.

## Runtime and verification

Use Node.js 24 for repository verification. Before opening or merging a release pull request, run:

```bash
node --version
npm ci
npm run lint
npm run check:release
npm --prefix inx-social-cloud-backend ci
npm --prefix inx-social-cloud-backend/frontend ci
npm --prefix inx-social-cloud-backend run prisma:generate
npm --prefix inx-social-cloud-backend exec prisma validate
npm --prefix inx-social-cloud-backend run check
npm --prefix inx-social-cloud-backend test
npm --prefix inx-social-cloud-backend/ollama-gateway test
```

Stop immediately and report the exact failing command if any check fails.

## Safety

- Use test-only database URLs and credentials during verification.
- Never print, copy, commit, or repurpose production secrets.
- Do not commit `.env` files, local databases, generated archives, certificates, private keys, runtime state, or backups.
- Do not run production database migrations unless the task explicitly authorizes the migration and includes validation and rollback planning.
- Preserve unrelated user changes and avoid destructive Git operations.
- Keep tests isolated from inherited environment configuration by setting explicit test-only values before importing configuration-dependent modules.

## Handoff

Report the branch, commit, pull request, verification results, and deployment status. A successful code check is not a production deployment; confirm GitHub checks and Railway separately.
