# Feature: Securing and validating bookings

**From build-plan:** feature 2
**Build attempt:** 1
**Branch:** feature/securing-and-validating-bookings
**Status:** verified

## Goal

Require the configured `X-API-Key` on every documented API route and enforce the Level 2 booking validation and normalization contract. Keep the public patient booking flow usable without exposing the API key to browser code.

## In scope

- Require `X-API-Key` for `POST /reset`, `GET /slots`, `POST /bookings`, and `GET /bookings/{id}`.
- Configure the server-only secret using `BOOKING_API_KEY`.
- Return `401` with the exact API error shape for a missing or incorrect request key.
- Validate booking fields, email syntax, and whether the selected slot has already started.
- Trim `name` and `email`, lowercase the email, and persist and return normalized values.
- Limit JSON request bodies for `POST /reset` and `POST /bookings` to 1 MiB (1,048,576 bytes); return `413` with the API error shape when exceeded.
- Preserve the patient page's refresh and booking interactions through server-side actions that reuse the booking logic, without sending the API key to the browser.
- Update `.env.example` with the new variable name and no credential value.

## Out of scope

- Exclusive booking under concurrent requests, cancellation, idempotency, booking pagination, and rate limiting; these belong to later planned features.
- Changing the documented API routes, successful response shapes, or status codes.
- Adding patient accounts or exposing `POST /reset` through the patient page.
- Public deployment or changing the database schema.
- Verifying that an email address has a real mailbox or sending confirmation messages.

## Build loop

- Follow the configured feature-level review and keep checkpoint commits disabled; `/complete` owns the final feature commit.
- Keep work on `feature/securing-and-validating-bookings`.
- Preserve the existing MongoDB-backed persistence and patient-facing experience.

## Build steps

- [x] Keep patient-page interactions server-side. Add server actions for refreshing slots and submitting a booking, and update the client form to use them instead of calling the API routes directly. Keep the actions limited to public patient operations and reuse shared booking logic; do not expose or pass the API key to the client.
  - **Done when:** The page still loads and refreshes slots, submits a booking, shows confirmation and actionable errors, and refreshes availability after success. No browser request or generated client asset contains `BOOKING_API_KEY`. `npm run typecheck` and `npm run build` pass.
- [x] Enforce Level 2 validation and request-body limits. For `POST /bookings`, reject malformed JSON, non-string or missing fields, and values that are empty after trimming where applicable with `400`; validate conventional single-address email syntax after trimming and lowercase normalization, without mailbox or DNS checks; reject a slot whose start is at or before the server's current time with `400`; and return `404` for an unknown slot. Preserve `slot_id` exactly for lookup. Store and return the trimmed name and lowercase trimmed email. Apply the 1 MiB byte limit to JSON bodies on `POST /bookings` and `POST /reset`, counting received bytes rather than trusting only `Content-Length`, and return `413` when exceeded. Keep errors in `{"error":"<message>"}` form.
  - **Done when:** Requests for each invalid booking case return `400`, an unknown slot returns `404`, a valid future-slot booking returns `201` with normalized fields, malformed JSON returns `400`, and oversized JSON bodies return `413`; an authenticated reset within the body limit still returns `200`. The patient action applies the same booking validation. `npm run typecheck` passes.
- [x] Protect all documented API routes with one shared server-side API-key check. Compare the supplied header to `BOOKING_API_KEY` without logging credentials; reject missing or incorrect request keys before parsing request bodies or accessing MongoDB. Fail closed with a generic `500` API error if the server secret is not configured. Do not expose the secret to the patient page or browser bundle.
  - **Done when:** Missing and incorrect keys produce `401` and the exact error JSON on all four routes, while a correct key preserves their documented successful behavior and error statuses. An unset server secret does not allow access and returns only a generic error. The client bundle contains no API key. `npm run typecheck` and `npm run build` pass.

## Files / areas

- `app/reset/route.ts`, `app/slots/route.ts`, `app/bookings/route.ts`, and `app/bookings/[id]/route.ts` for API authentication, request parsing, and contract responses.
- `app/actions/` for the server-side patient-page slot refresh and booking actions.
- `app/booking-form.tsx` and `app/page.tsx` for preserving the patient flow without browser access to the privileged key.
- `lib/` for shared API-key checking, booking validation, normalization, and MongoDB-backed operations.
- `.env.example` for documenting `BOOKING_API_KEY` without a value.
- `fsd.md` remains the normative route and response contract; do not edit it for this implementation.

## Data / contracts

- The API key is a single shared server-side secret configured by `BOOKING_API_KEY`; never use a `NEXT_PUBLIC_` variable, serialize the key, or log it. Compare credentials using Node's standard-library constant-time comparison facility, accounting for its equal-length requirement.
- Every documented API route requires the `X-API-Key` request header. A missing or incorrect key returns `401` and `{"error":"<message>"}`. Check authorization before JSON parsing or database access. A missing server-side secret is a configuration failure: fail closed with a generic `500` error and no internal details.
- Booking input requires string `slot_id`, `name`, and `email`. Treat missing, wrong-type, empty, or whitespace-only required values as `400`. Preserve `slot_id` exactly rather than trimming or case-folding it.
- Trim `name` and `email`; reject either if empty after trimming. Validate a conventional single email address syntactically after trimming, then store and return its lowercase form. Do not perform mailbox, DNS, or external validation.
- A slot with `start <= current server time` cannot be booked and returns `400`; a slot that does not exist returns `404`. A valid request for a future existing slot retains the Level 1 `201` booking response shape.
- Limit JSON request bodies on `POST /bookings` and `POST /reset` to 1,048,576 bytes. Enforce the received-byte limit even when `Content-Length` is absent or inaccurate. An oversized body returns `413` with the normal JSON error shape; malformed JSON returns `400`.
- Keep the public patient page's actions limited to listing slots and submitting a patient booking. Those server-side actions reuse the same booking validation and persistence logic but do not expose or accept the shared API key; they do not expose reset or administrative capabilities.
- Keep all existing success payloads, routes, database fields, and statuses unchanged. Do not add persisted fields or concurrency guarantees from Feature 3.

## Testing

- No automated test runner is configured. Do not claim automated tests.
- `npm run typecheck` passed during spec preparation. Run `npm run typecheck` and `npm run build` during implementation.
- Manually verify missing, incorrect, and correct API keys on each of the four routes; the booking validation cases and normalized persisted/returned values; unknown and already-started slots; malformed and over-limit request bodies; and the patient page booking/refresh flow.
- Manual API checks require the configured MongoDB connection and a local `BOOKING_API_KEY`. Do not reset or modify any shared or deployed database during verification.

## Notes for the AI

- `fsd.md` defines the exact API contract. Keep errors in `{"error":"<message>"}` form and do not alter documented successful response shapes or status codes.
- The patient page remains publicly usable for booking; its server actions are a separate same-origin user-facing path, not a way to expose or bypass the privileged API key for the documented API routes.
- Treat all booking details as untrusted text and render them as text. Keep validation errors associated with the form and announced through its existing accessible feedback.
- Do not add a dependency, change database schema, deploy the app, or implement later-level features as part of this work.
