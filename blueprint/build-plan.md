# Build Plan

## Your features

- [x] 1. **Building the persistent Level 1 booking flow** - Implement the durable slots/bookings API, reset/list/create/lookup behavior, and the patient page for viewing seeded future slots, booking, and seeing confirmation.
- [ ] 2. **Securing and validating bookings** - Require `X-API-Key` on every API route and implement Level 2 validation, status codes, and name/email normalization.
- [ ] 3. **Preventing double bookings and enabling cancellation** - Enforce atomic one-active-booking-per-slot behavior under concurrency and implement the specified cancellation lifecycle.
- [ ] 4. **Making retries safe and bookings pageable** - Implement idempotency-key replay/conflict behavior and oldest-first email-filtered cursor pagination.
- [ ] 5. **Limiting booking attempts** - Enforce the Level 5 per-email rolling one-minute limit, including failed attempts, with `429` and integer-seconds `Retry-After`.
- [ ] 6. **Deploying and verifying the live service** - Deploy the complete page and API to HTTPS on Vercel with MongoDB persistence; verify the exact contract and data survival across requests/restarts, then keep the submitted deployment unchanged.
