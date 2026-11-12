# Clinic Booking API - Project Overview

<!-- blueprint:source-hash dff4990b8a2a7fdbb3a4376c253a40db33e6872b95b978cad63bda0498d22bf4 -->

> A persistent clinic appointment booking API and patient-facing booking page.

## Problem

Patients need to see and reserve available clinic appointment slots and receive a confirmation. The service must preserve bookings across requests and restarts, prevent concurrent double-booking, follow the exact API contract in `fsd.md`, and run over HTTPS.

## Users

- **Patient/demo user:** Views future availability, submits a name and email to book a slot, and sees confirmation.
- **Clinic operator/tester:** Replaces slots through the authenticated `POST /reset` endpoint and exercises the API with `X-API-Key`.

The initial service is for one clinic and has no patient or staff account system.

## Usage model

- Assessment/demo deployment using synthetic details and future demo slots, not real patient data or a production healthcare-compliance claim.
- Public patient-facing page; all API endpoints require the shared `X-API-Key`.
- Keep the API key server-side. Rate-limit booking attempts per email as specified.
- No payments, medical records, email/SMS delivery, patient accounts, or staff scheduling UI.
- `POST /reset` replaces all slots and deletes all bookings; keep it out of the patient UI.
- Scale and additional privacy/compliance requirements are not established.

## Features

1. **Building the persistent Level 1 booking flow** - Durable slot and booking API, slot replacement/listing, booking creation/lookup, and the page flow for choosing a seeded future slot and seeing confirmation.
2. **Securing and validating bookings** - Require API keys on all endpoints; validate and normalize booking fields and return contract-defined responses.
3. **Preventing double bookings and enabling cancellation** - Enforce atomic exclusive booking per slot and implement cancellation with slot release.
4. **Making retries safe and bookings pageable** - Replay idempotent requests and list bookings by email using oldest-first cursor pagination.
5. **Limiting booking attempts** - Limit each email to five booking attempts per minute, including failures, with the specified `429` and `Retry-After`.
6. **Deploying and verifying the live service** - Deploy the page and API over HTTPS on Vercel with MongoDB persistence, verify contract and persistence, then keep the submitted deployment unchanged.

## Data model

### Slot

- `id` (string, primary key) - Contract slot identifier.
- `provider` (string) - Provider display name.
- `start` (timestamp) - Slot start date-time.
- `end` (timestamp) - Slot end date-time.
- Availability is derived: a slot is unavailable while it has a confirmed booking.

### Booking

- `id` (string, primary key) - Unique booking reference.
- `slot_id` (string, foreign key to `Slot.id`) - Booked slot.
- `name` (string) - Trimmed patient name.
- `email` (string) - Trimmed, lowercase email.
- `status` (enum: `confirmed`, `cancelled`) - Current booking state.
- `created_at` (timestamp) - Creation time.
- At most one booking for a slot may be confirmed at once. A cancelled booking remains available for lookup/listing and releases the slot.

### Idempotency record

- `key` (string, unique) - `Idempotency-Key` value.
- `request_fingerprint` (string) - Identifies the request body associated with the key.
- `response_status` (integer) and `response_body` (JSON) - Original result to replay, including the same booking id.
- Retention and reset interaction: > TODO.

### Booking attempt

- `email` (string) - Email used for the attempt.
- `attempted_at` (timestamp) - Time of attempt; failed attempts count.
- Attempts are evaluated per email over the one-minute rate-limit window.

MongoDB is the authoritative persistent store. Unique indexes and transactions must protect booking uniqueness and state across concurrent Vercel instances.

## Tech stack

- **Next.js + TypeScript** - Patient page and server-side API handlers.
- **Vercel** - HTTPS hosting and serverless application runtime.
- **MongoDB** - Persistent slots, bookings, idempotency records, and rate-limit state.
- **npm** - Planned package manager; confirm with the implementation lockfile.
- **Server-side environment secrets** - API key and database credentials; exact variable names remain to be chosen.

## Monetization

Not applicable in v1; this is an assessment/demo service.

## UI/UX

The patient page shows future slots with provider and clearly formatted start/end times, lets a patient choose a slot and enter name/email, then shows the returned booking id and appointment details. Include loading, empty, validation, unavailable-slot, and service-error states. Keep it accessible, responsive, and keyboard operable. Refresh availability after booking. Seed a few clearly identified future demo slots.

The page does not expose `X-API-Key` and does not add patient account, booking management, or scheduling administration features.

## API contract

`fsd.md` is normative. Use its exact paths, fields, JSON response shapes, and status codes, without adding an API prefix:

- `POST /reset`
- `GET /slots` with optional exact-match `provider`
- `POST /bookings` with optional `Idempotency-Key`
- `GET /bookings/{id}`
- `DELETE /bookings/{id}`
- `GET /bookings?email={email}&limit={limit}&cursor={cursor}`

All API requests require `X-API-Key`. Booking errors use `{"error":"<message>"}`. Booking attempts are limited to five per email per minute, counting failures.

## Deployment

- **Application:** Next.js on Vercel, served over HTTPS.
- **Database:** MongoDB replica set with persistent data shared across function instances.
- **Secrets:** API key and database connection settings in Vercel environment configuration; never commit them or expose the API key to the browser.
- **Schema/data:** Run the idempotent seed command to create unique indexes and seed future demo slots.
- **Commands, environment variable names, health path, and final URL:** > TODO.
- Verify live API behavior and persistence across requests/restarts. Do not reset live data during verification without approval.
- After submission, keep the deployment running and do not change it until contacted.

## Open questions

- Confirm Vercel/MongoDB account access, secret provisioning, and deployed URL.
- Decide idempotency-record retention and how `POST /reset` invalidates records tied to deleted bookings.
- Define deployment commands, exact environment variable names, and a health/readiness path.
