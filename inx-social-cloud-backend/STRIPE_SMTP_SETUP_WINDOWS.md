# INX Social — SMTP and Stripe Setup on Windows

## 1. Update the database and dependencies

From the backend folder:

    npm install
    npm run prisma:generate
    npm run prisma:migrate

Migration name if prompted:

    phase6_smtp_stripe

Then:

    npm run seed

## 2. SMTP

Open `.env` and fill in:

    SMTP_HOST=your SMTP host
    SMTP_PORT=587
    SMTP_SECURE=false
    SMTP_REQUIRE_TLS=true
    SMTP_USER=no-reply@inaxx.co.uk
    SMTP_PASS=your mailbox/app password
    EMAIL_FROM="INX Social <no-reply@inaxx.co.uk>"
    EMAIL_REPLY_TO=contact@inaxx.co.uk

Use the exact SMTP settings supplied by your email provider. Restart the backend after changing `.env`.

## 3. Stripe products and prices

In Stripe test mode, create two recurring monthly prices:

- INX Social Starter — GBP 9.99/month
- INX Social Pro — GBP 15.99/month

Copy each `price_...` ID into `.env`:

    STRIPE_STARTER_PRICE_ID=price_...
    STRIPE_PRO_PRICE_ID=price_...

Also add your Stripe test secret key:

    STRIPE_SECRET_KEY=sk_test_...

## 4. Local webhook

Install and sign in to Stripe CLI, then run:

    stripe listen --forward-to localhost:5050/api/billing/webhook

Copy the printed `whsec_...` value into:

    STRIPE_WEBHOOK_SECRET=whsec_...

Restart the backend.

## 5. Start the backend

    npm start

Open:

    http://localhost:5050/portal/

Use a verified customer account and choose Starter or Pro. Stripe Checkout should open in test mode.

## 6. Test card

Use Stripe's documented test-card details in test mode. Do not enter real card information during development.

## 7. Production switch

Only after local testing:

- deploy the backend over HTTPS;
- replace test keys and price IDs with live values;
- create the live webhook endpoint;
- update all Stripe return URLs to `https://app.social.inaxx.co.uk` or your final portal address;
- use production SMTP credentials;
- set `NODE_ENV=production`.
