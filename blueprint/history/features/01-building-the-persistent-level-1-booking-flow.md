# Feature: Building the persistent Level 1 booking flow

**From build-plan:** feature 1
**Build attempt:** 1
**Branch:** feature/building-the-persistent-level-1-booking-flow
**Status:** verified

## Goal

Deliver the first working vertical slice of the clinic booking product: durable Level 1 API operations and a patient page to view future demo slots, book one, and see confirmation. Follow the exact route names, JSON fields, and response contracts in `fsd.md`.

This feature establishes the Next.js + TypeScript and MongoDB foundation selected in the project plan. It does not deploy the app publicly.

## In scope

- Replace the starter package setup with a runnable Next.js + TypeScript app.
- Persist slots and bookings in MongoDB.
- Implement Level 1 routes: replace slots, list slots, create a booking, and look one up by id.
- Provide an idempotent command to seed a few future demo slots.
- Build the patient slot-list, booking form, and confirmation flow.
- Keep any future API key server-side; this feature does not yet enforce Level 2 authentication.

## Out of scope

- Public deployment. Do not expose the unauthenticated API or destructive `/reset` route to the internet; deployment follows the later security, validation, concurrency, retry, and rate-limit features.
- Level 2 API-key enforcement and detailed invalid-input behavior.
- Level 3 cancellation and concurrent-booking exclusivity.
- Level 4 idempotency and booking pagination.
- Level 5 rate limiting.
- Patient accounts, booking management UI, staff scheduling UI, or notifications.

## Build loop

- Use the configured Efficient workflow: implement and verify small steps, then present one feature-level review packet. Step checkpoint commits are disabled.
- Keep work on `feature/building-the-persistent-level-1-booking-flow`. `/complete` owns the final feature commit.
- Do not deploy as part of this feature.

## Build steps

- [x] Establish the Next.js + TypeScript app and MongoDB data foundation, including server-only connection configuration, unique indexes, and an idempotent seed command for a small set of future demo slots. Keep the existing API route contract and future feature fields representable.
  - **Done when:** `npm run build` succeeds; `npm run seed` creates required indexes and inserts future demo slots without duplicating them; no secret is committed or included in browser bundles.
- [x] Implement the Level 1 API at the exact paths in `fsd.md`: `POST /reset`, `GET /slots`, `POST /bookings`, and `GET /bookings/{id}`. Persist every read/write through MongoDB; make reset replace slots and delete bookings atomically in a transaction.
  - **Done when:** With configured MongoDB credentials, requests using the documented valid payloads return the exact JSON shapes and status codes in `fsd.md`; slots are earliest-first with derived `available`, booking creation returns `201`, lookup returns the same booking on a later request, and reset returns `200` while replacing the slots and removing bookings.
- [x] Build the patient page using the booking API behavior through server-side page actions or an equivalent same-origin server-side call path. Show providers and readable slot times, accept name/email for the selected slot, present the booking confirmation, and refresh availability after booking.
  - **Done when:** A user can complete the view-slot, book, and confirmation flow using persisted API data; the page has loading, empty, validation/unavailable, and service-error feedback; the API key is not exposed to browser code.

## Files / areas

- `package.json` and Next.js / TypeScript configuration for the application scripts and runtime.
- `app/page.tsx` and `app/actions/` for the patient page and its server-side booking flow.
- `app/reset/route.ts`, `app/slots/route.ts`, `app/bookings/route.ts`, and `app/bookings/[id]/route.ts` for the exact Level 1 API paths.
- `lib/` for server-only MongoDB access and shared booking/slot serialization.
- `scripts/seed-demo-slots.mjs` for unique indexes and idempotent future demo-slot setup.
- `.env.example` for names and purpose of required server-side settings, with no secret values.

MongoDB credentials are configured locally and must remain out of source control.

## Data / contracts

- **Slot:** `id`, `provider`, `start`, `end`. Store timestamps as BSON dates and serialize date-times in ISO 8601 form. `GET /slots` returns `{"slots":[...]}`; each slot has `available`, false while a confirmed booking exists. Sort by ascending `start`; optional `provider` filtering is an exact match.
- **Booking:** `id`, `slot_id`, `name`, `email`, `status`, `created_at`. Use a generated unique string id, initial status `confirmed`, and a server-generated UTC `created_at`. Return exactly those six fields. `POST /bookings` returns `201`; `GET /bookings/{id}` returns the booking or `404` with `{"error":"<message>"}`.
- **Reset:** Accept `{"slots":[{"id","provider","start","end"}]}`. Replace the full slot set and delete all bookings, including bookings for previous slots. Perform the replacement atomically. Return `200`; the OpenAPI contract defines no response body schema.
- **Booking input:** Accept `slot_id`, `name`, and `email` as specified in `fsd.md`. This feature handles the valid Level 1 request shape. Level 2 defines required-field, email, past-slot, normalization, and API-key behavior.
- API errors use the exact `{"error":"<message>"}` shape. Unknown slots return `404`. Do not add a prefix to any API route or alter contract field names.
- Level 1 does not require the API key yet. Keep the app local during this feature and do not deploy it publicly; Feature 2 adds authentication before any public exposure.
- Cancellation, unique-active-booking enforcement, idempotency, and rate-limit persistence are implemented by their later planned features, not approximated here.

## Testing

- `npm run build` and `npm run typecheck` passed during implementation; the user reports rerunning them successfully.
- The user reports `npm run seed` succeeded and confirmed the Level 1 API operations: slot listing, booking creation, subsequent lookup, availability update, and reset replacement/deletion.
- The user reports completing the patient flow in the browser, including confirmation and refreshed availability.
- No automated test runner is configured. The MongoDB and browser checks were manually exercised by the user; no browser automation is claimed.

## Notes for the AI

- `fsd.md` is normative. Do not invent extra API routes, fields, response wrappers, or status codes.
- `POST /reset` is destructive and must never appear in the patient UI.
- Treat all booking details as untrusted text; render them as text, not HTML.
- Keep MongoDB credentials in server-only code and environment variables.
- This feature is a local development milestone only. Public deployment waits until the later authentication and abuse-prevention features are complete.
- The overview's open question about how future idempotency records interact with reset belongs to the idempotency feature; do not invent that behavior here.


<!-- blueprint:completion {"schemaVersion":2,"specBytes":7097,"specSha256":"369b2d523b7a2a4a243d51c06cdaf2d337e48db2e4aec63bac1e2be95dc17010","branch":"refs/heads/feature/building-the-persistent-level-1-booking-flow","head":"43779ff1452ecdd5a87263e5044f26d1111477b9","baseRef":"refs/heads/main","baseCommit":"573495fe7458711300c3693216f1ece29a755b84","sourceTree":"88a355e9fb3140897044b904a6ea7b09eddd7219","landing":"local-merge","absentOptional":[]} -->

## Completed work

- Built the persistent Level 1 clinic booking flow with MongoDB-backed slot and booking logic.
- Implemented the patient-facing page plus `/slots`, `/bookings`, `/bookings/[id]`, and `/reset` routes.
- Verified the feature with the project’s build and typecheck commands.

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 43779ff1452ecdd5a87263e5044f26d1111477b9
**Base commit:** 573495fe7458711300c3693216f1ece29a755b84
**Base ref:** refs/heads/main
**Spec hash:** 369b2d523b7a2a4a243d51c06cdaf2d337e48db2e4aec63bac1e2be95dc17010
**Spec snapshot:** blueprint/.state/review-specs/43779ff1452ecdd5a87263e5044f26d1111477b9-369b2d523b7a2a4a243d51c06cdaf2d337e48db2e4aec63bac1e2be95dc17010.md
**Prepared by:** copilot
**Builder model:** unknown (runtime did not expose exact model)
**Requested reviewer:** copilot
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-11-12T09:10:38.442Z
**Reviewer adapter:** copilot
**Reviewer model:** unknown (runtime did not expose exact model)
**Reviewer context:** fresh session
**Actual execution:** manual
**Reviewed at:** 2026-11-12T12:48:55.771Z
**Workflow:** regular
**Check required:** no
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `npm run typecheck`: pass
- `npm run build`: pass

## Evidence

- TypeScript validation completed successfully with no reportable errors.
- Production build succeeded in Next.js with all current routes generating successfully.
- Review covered the current feature delta and the active Level 1 API contract in `fsd.md` plus the relevant MongoDB and route implementation.

## Findings

- None

## Remaining risk

- No automated test runner is configured; browser automation for the patient flow was not available in this review.

## Handoff

Review the active spec snapshot and the complete `573495fe7458711300c3693216f1ece29a755b84..43779ff1452ecdd5a87263e5044f26d1111477b9` delta in a fresh isolated session across quality, security, performance, and tests. Do not edit product code, accept findings, commit, or perform external actions. Write only `blueprint/context/findings.md` and this review receipt.

