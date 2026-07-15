INX SOCIAL AUTH PAGES DESIGN HOTFIX

This hotfix restores the polished customer Login and Create Account pages after Phase 6.1 replaced the shared portal stylesheet.

It adds a dedicated auth.css file so future Customer Portal and Stripe UI changes cannot remove the authentication-page design again.

UNCHANGED:
- Stripe Checkout
- Stripe webhooks
- Customer Portal dashboard
- Email verification
- Password reset
- Trial and licence logic
- Desktop login
- Admin panel

UPDATED:
- Create Account page
- Login page
- Responsive desktop/mobile design
- Confirm password and validation
- Login resend-verification action
- No development verification link
- Login email prefill after verification

APPLY:
1. Stop the backend.
2. Double-click APPLY_AUTH_PAGES_DESIGN_WINDOWS.bat
3. Start the backend.
4. Press Ctrl+F5 on both auth pages.
