# Canonical domain migration: social.inaxx.co.uk

The browser product, landing page, legal pages, customer portal and Content
Studio use one canonical origin:

```text
https://social.inaxx.co.uk
```

The existing Windows desktop release still uses `https://api.social.inaxx.co.uk`
for backend API calls. Keep that hostname attached to the Railway service until
a separately tested desktop release changes it.

## Routes provided by this service

- `/` — product landing page
- `/portal/register.html` — account creation
- `/portal/login.html` — customer sign-in
- `/portal/` — account, subscription and privacy portal
- `/studio/` — browser Content Studio
- `/privacy.html` — privacy policy previously hosted on the old site
- `/terms.html` — terms previously hosted on the old site
- `/data-deletion.html` — current self-service and email deletion instructions
- `/oauth-callback.html` — callback required by the Windows desktop app
- `/studio/facebook-callback.html` — callback required by browser Content Studio

## Safe order of external changes

1. Deploy this code while the existing domains still work.
2. In Railway, add `social.inaxx.co.uk` as a custom domain and copy the exact
   DNS target Railway displays.
3. In Meta Facebook Login settings, add this exact Valid OAuth Redirect URI:
   `https://social.inaxx.co.uk/studio/facebook-callback.html`.
4. Keep `https://social.inaxx.co.uk/oauth-callback.html` in Meta for the Windows
   desktop release.
5. In Railway variables set:
   - `APP_URL=https://social.inaxx.co.uk`
   - `PORTAL_URL=https://social.inaxx.co.uk`
   - `STRIPE_SUCCESS_URL=https://social.inaxx.co.uk/portal/?checkout=success`
   - `STRIPE_CANCEL_URL=https://social.inaxx.co.uk/portal/?checkout=cancelled`
   - `STRIPE_PORTAL_RETURN_URL=https://social.inaxx.co.uk/portal/`
6. In Stripe Workbench/Webhooks, create or update the live webhook destination
   to `https://social.inaxx.co.uk/api/billing/webhook`. Keep the same signing
   secret only if Stripe says it is the same endpoint; a newly created endpoint
   has a new `whsec_...` value which must replace `STRIPE_WEBHOOK_SECRET`.
7. Change the DNS record for `social.inaxx.co.uk` from the old website host to
   the Railway target. Do not remove the old content until HTTPS is active and
   every check below passes.
8. Update Meta App Settings URLs to the canonical policy pages. The currently
   submitted `https://inaxx.co.uk/inx-social/data-deletion.html` returns 404;
   replace it with `https://social.inaxx.co.uk/data-deletion.html`, or install a
   permanent redirect at `inaxx.co.uk` to the canonical page.
9. After verification, remove `app.social.inaxx.co.uk` from Railway if it is no
   longer wanted. There are no customer bookmarks to preserve at this stage.

## Production verification

Open each URL in a private browser window and confirm a 200 response:

```text
https://social.inaxx.co.uk/
https://social.inaxx.co.uk/privacy.html
https://social.inaxx.co.uk/terms.html
https://social.inaxx.co.uk/data-deletion.html
https://social.inaxx.co.uk/portal/login.html
https://social.inaxx.co.uk/studio/
https://social.inaxx.co.uk/oauth-callback.html
https://social.inaxx.co.uk/studio/facebook-callback.html
https://api.social.inaxx.co.uk/health
```

Then perform one test sign-in, one Facebook Page reconnect, one Stripe test-mode
checkout/portal return, and confirm Stripe webhook deliveries return HTTP 200.
