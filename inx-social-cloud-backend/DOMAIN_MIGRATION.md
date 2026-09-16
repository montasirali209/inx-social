# Canonical domain migration: www.inxsocial.co.uk

The browser product, landing page, legal pages, customer portal and Content
Studio use one canonical origin:

```text
https://www.inxsocial.co.uk
```

The previous browser origin, `https://social.inaxx.co.uk`, remains attached to
the Railway service during the migration. Remove it only after the new hostname,
provider callbacks and billing flow have been verified. The existing Windows
desktop release still uses `https://api.social.inaxx.co.uk` for backend API
calls, so keep that hostname available until a separately tested desktop release
changes it.

## Routes provided by this service

- `/` — product landing page
- `/portal/register.html` — account creation
- `/portal/login.html` — customer sign-in
- `/portal/` — account, subscription and privacy portal
- `/studio/` — browser Content Studio
- `/privacy.html` — privacy policy
- `/terms.html` — terms of service
- `/data-deletion.html` — self-service and email deletion instructions
- `/oauth-callback.html` — callback required by the Windows desktop app
- `/studio/facebook-callback.html` — callback required by browser Content Studio

## Safe order of external changes

1. Attach `www.inxsocial.co.uk` to the Railway `inx-social` service on port 8080.
2. Create the CNAME and verification records supplied by Railway at the DNS
   provider, then wait for `https://www.inxsocial.co.uk/` to return HTTP 200.
3. Add the new redirect URIs in each provider dashboard before removing the old
   ones. In Meta Facebook Login include:
   - `https://www.inxsocial.co.uk/studio/facebook-callback.html`
   - `https://www.inxsocial.co.uk/oauth-callback.html`
4. Set the Railway production variables:
   - `APP_URL=https://www.inxsocial.co.uk`
   - `PORTAL_URL=https://www.inxsocial.co.uk`
   - `STRIPE_SUCCESS_URL=https://www.inxsocial.co.uk/app/billing?checkout=success`
   - `STRIPE_CANCEL_URL=https://www.inxsocial.co.uk/app/billing?checkout=cancelled`
   - `STRIPE_PORTAL_RETURN_URL=https://www.inxsocial.co.uk/app/billing`
5. In Stripe Workbench/Webhooks, create or update the live webhook destination
   to `https://www.inxsocial.co.uk/api/billing/webhook`. Keep the same signing
   secret only when Stripe confirms it is the same endpoint; a newly created
   endpoint has a new `whsec_...` value that must replace
   `STRIPE_WEBHOOK_SECRET`.
6. Update Meta App Settings and other provider policy URLs to the canonical
   privacy, terms and data-deletion pages.
7. Verify the production routes and complete one test login, provider reconnect,
   Stripe checkout/portal return and successful webhook delivery.
8. Keep the previous browser hostname active during a transition period. When it
   is retired, configure a permanent path-preserving redirect to the new origin
   if the DNS/hosting provider supports one.

## Production verification

Open each URL in a private browser window and confirm a 200 response:

```text
https://www.inxsocial.co.uk/
https://www.inxsocial.co.uk/privacy.html
https://www.inxsocial.co.uk/terms.html
https://www.inxsocial.co.uk/data-deletion.html
https://www.inxsocial.co.uk/portal/login.html
https://www.inxsocial.co.uk/studio/
https://www.inxsocial.co.uk/oauth-callback.html
https://www.inxsocial.co.uk/studio/facebook-callback.html
https://api.social.inaxx.co.uk/health
```

Then perform one test sign-in, one Facebook Page reconnect, one Stripe test-mode
checkout/portal return, and confirm Stripe webhook deliveries return HTTP 200.
