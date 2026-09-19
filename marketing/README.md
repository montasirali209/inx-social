# INXSocial Marketing

Phase 1 establishes the independent public marketing application.

## Stack
Next.js App Router, React, TypeScript, Tailwind CSS 4, server-rendered metadata/robots/sitemap/JSON-LD, first-party analytics events, and a responsive design-token system.

## Development
```bash
npm install
npm run dev
```

## Production
Railway should use `/marketing` as the service root and `/marketing/railway.toml` as the config file.

The existing INXSocial application under `/app` is intentionally not modified by this package.
