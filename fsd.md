# Functional Specification: Clinic Booking API

## 1. Purpose

Build and deploy a clinic appointment-booking service with a simple web page. Patients can view available appointment slots, book a slot, receive a confirmation, and look up or manage their bookings.

The service must retain booking data between requests and be available over HTTPS. This document defines the required behavior in five progressive levels; later levels extend rather than replace earlier ones.

## 2. Scope

### In scope

- Listing available appointment slots.
- Creating and looking up bookings.
- API-key access control and request validation.
- Preventing concurrent bookings for the same slot.
- Cancelling bookings.
- Idempotent booking retries.
- Paginated booking history.
- Booking-abuse prevention.
- A patient-facing web page for viewing slots, booking, and viewing confirmation.
- Persistent storage and HTTPS deployment.

### Out of scope

- Payments, insurance processing, medical records, clinical advice, and staff scheduling tools.
- Patient accounts or identity verification beyond the booking contact details, unless added in a later revision.
- Sending email or SMS confirmations unless separately configured.

## 3. Users and primary workflow

**Patient:** Opens the booking page, chooses an available slot, enters their details, submits the booking, and sees a confirmation with a booking reference. They can look up, cancel, or list their bookings using the supported API.

**Clinic/operator:** Supplies appointment slots and configures the API key, rate limits, clinic timezone, and deployment settings.

### Web page

The page must:

1. Load and display currently available slots, including date, start time, duration, and timezone.
2. Allow the patient to select one slot and enter the required booking details.
3. Submit the booking and show a success confirmation with the booking reference and appointment details.
4. Show clear, actionable errors for unavailable slots, invalid details, and temporary service failures.
5. Refresh availability after a successful booking so the selected slot is no longer offered.
6. Work on common mobile and desktop screen sizes and communicate form labels and errors accessibly.

The web page must not expose a server-side API key in browser code. It should call a same-origin backend/proxy that attaches the key, or use another design that keeps privileged credentials secret.

## 4. Functional requirements by level

### Level 1 — Core booking

- **L1.1 Replace slots:** `POST /reset` deletes all bookings and replaces the complete slot list with the submitted list, including past slots. Return `200`.
- **L1.2 List slots:** `GET /slots` returns all slots in ascending `start` order. An optional `provider` query parameter filters by exact match.
- **L1.3 Book a slot:** `POST /bookings` creates a confirmed booking and returns `201` with the booking object.
- **L1.4 Look up a booking:** `GET /bookings/{id}` returns the booking or `404` if no booking has that id.
- **L1.5 Persist data:** Store slots and bookings durably so they remain available on subsequent requests and service restarts.

### Level 2 — Access control and validation

- **L2.1 API key:** Require `X-API-Key` on every request. A missing or incorrect key returns `401`.
- **L2.2 Validate booking input:** `slot_id`, `name`, and `email` are required and must be non-empty. Email must be valid. Missing/empty fields, invalid email, or a slot that has already started return `400`.
- **L2.3 Validate slot existence:** A booking for a nonexistent slot returns `404`.
- **L2.4 Normalize details:** Trim whitespace from `name` and `email`, and store `email` in lowercase.

### Level 3 — Concurrency and cancellation

- **L3.1 Exclusive booking:** A slot with an existing confirmed booking returns `409` to a new booking attempt. This must remain true under simultaneous requests; enforce it atomically in the persistent data layer.
- **L3.2 Cancel booking:** `DELETE /bookings/{id}` changes the booking status to `cancelled`, frees its slot, and returns the cancelled booking with `200`.
- **L3.3 Cancellation errors:** Return `404` if the booking id does not exist and `409` if the booking is already cancelled.

### Level 4 — Retry safety and pagination

- **L4.1 Idempotent booking:** `POST /bookings` optionally accepts `Idempotency-Key`. Repeating the same key with the same request body returns the same status code and booking `id`, without creating another booking.
- **L4.2 Key misuse:** Reusing an idempotency key with a different request body returns `422`.
- **L4.3 List bookings:** `GET /bookings?email={email}` returns that email's bookings in oldest-first order; matching ignores email case.
- **L4.4 Cursor pagination:** The optional `limit` defaults to `10` and must be from `1` through `50`; otherwise return `400`. Pass the returned `next_cursor` value as `cursor` to request the next page. The final page returns `"next_cursor": null`.

### Level 5 — Booking-abuse prevention

- **L5.1 Rate limit:** Allow at most 5 booking attempts per email per minute, counting failed attempts. The sixth attempt returns `429`; other email addresses are not affected.
- **L5.2 Retry interval:** Include `Retry-After` on `429`, as a whole number of seconds.

## 5. Exact API contract

The contract below follows the published [Clinic Booking API OpenAPI specification](https://koyaacademy.com/assessment-api/openapi.json). All requests and responses use JSON. Every request, including `/reset`, requires the `X-API-Key` header. Missing or incorrect keys return `401`.

| Method and path | Purpose | Success |
|---|---|---|
| `POST /reset` | Replace all slots and delete all bookings | `200 OK` |
| `GET /slots[?provider={provider}]` | List slots, optionally filtered by exact provider name | `200 OK` |
| `POST /bookings` | Create a booking; optional `Idempotency-Key` header | `201 Created` |
| `GET /bookings/{id}` | Get a booking | `200 OK` |
| `DELETE /bookings/{id}` | Cancel a booking and release its slot | `200 OK` |
| `GET /bookings?email={email}[&limit={limit}][&cursor={cursor}]` | List a person's bookings in pages | `200 OK` |

### Slot object

Every slot has these fields:

```json
{
  "id": "s1",
  "provider": "Dr Ade",
  "start": "2026-12-10T09:00:00Z",
  "end": "2026-12-10T09:30:00Z"
}
```

`start` and `end` are date-time strings. The `GET /slots` response is `{"slots":[...]}`; each returned slot includes `available` (`false` while the slot has a confirmed booking). Slots are sorted earliest `start` first.

### Reset request

`POST /reset` requires the following body and replaces the entire slot set:

```json
{
  "slots": [
    {
      "id": "s1",
      "provider": "Dr Ade",
      "start": "2026-12-10T09:00:00Z",
      "end": "2026-12-10T09:30:00Z"
    }
  ]
}
```

This operation deletes every booking. It is an API contract operation, not a patient-facing page feature.

### Booking request and response

`POST /bookings` requires the fields shown below. The published contract defines no phone number or nested `patient` object:

```json
{
  "slot_id": "s1",
  "name": "Ada Obi",
  "email": "ada@example.com"
}
```

A successful request returns `201` and a booking object:

```json
{
  "id": "booking-123",
  "slot_id": "s1",
  "name": "Ada Obi",
  "email": "ada@example.com",
  "status": "confirmed",
  "created_at": "2026-12-01T14:00:00Z"
}
```

The booking object always contains `id`, `slot_id`, `name`, `email`, `status`, and `created_at`. `status` is `confirmed` or `cancelled`; `created_at` is a date-time string.

### Booking list response

`GET /bookings` requires an `email` query parameter. It returns:

```json
{
  "bookings": [],
  "next_cursor": null
}
```

`bookings` contains booking objects. `next_cursor` is a string when another page is available and `null` on the last page. Bookings are oldest first.

### Error responses

Every error response uses this exact JSON shape:

```json
{
  "error": "human-readable message"
}
```

The specified status behavior is:

- `400 Bad Request` — missing/empty `slot_id`, `name`, or `email`; invalid email; slot already started; or `limit` outside 1–50.
- `401 Unauthorized` — missing or incorrect `X-API-Key`.
- `404 Not Found` — slot does not exist, or booking id does not exist.
- `409 Conflict` — slot already has a confirmed booking, or the booking was already cancelled.
- `422 Unprocessable Entity` — an `Idempotency-Key` was reused with a different request body.
- `429 Too Many Requests` — more than 5 booking attempts for the email within one minute; include integer-seconds `Retry-After`.

## 6. Data requirements

The persistent store must represent, at minimum:

- **Slot:** `id`, `provider`, `start`, and `end`.
- **Booking:** `id`, `slot_id`, `name`, `email`, `status` (`confirmed` or `cancelled`), and `created_at`.
- **Idempotency record:** key, request-body fingerprint, and original response needed to replay the same status code and booking id.
- **Rate-limit state:** booking attempt counts by email and time window, including failed attempts.

The data model must enforce no more than one confirmed booking per slot, including under concurrent requests. Cancelled bookings remain available for lookup/listing, but their slot becomes available. The `POST /reset` operation deletes all bookings and replaces the slot set.

## 7. Security, privacy, and reliability

- Use HTTPS for the deployed application and API.
- Keep API keys in server-side configuration or a secret manager; never commit them or embed privileged keys in frontend assets.
- Compare and validate credentials using established framework/library practices.
- Validate and bound all input, including pagination limits and request body size.
- Avoid logging API keys or unnecessary patient data.
- Require the API key on all API routes, including `/reset`. Do not add authentication requirements or alter endpoint behavior beyond the published contract.
- Keep the API key out of browser assets. If the public web page needs to call the API, use a same-origin server-side proxy that adds the key and forwards the exact API contract.
- Use a persistent database suitable for the hosting model. Serverless deployments must not depend on process memory or ephemeral local files for booking state.
- Make database writes transactional where required for booking, cancellation, and idempotency.
- Surface service errors clearly to clients while keeping internal diagnostics in protected logs.

## 8. Deployment and operations

- Deploy the web page and API to an HTTPS URL.
- Configure persistent database connectivity, API key secrets, clinic timezone, slot availability, rate limits, and allowed origins as environment-specific settings.
- Provide a health/readiness check that does not disclose secrets or patient data.
- Document the deployed URL, required configuration, and how to initialize or manage appointment slots.
- Verify that a booking remains present after a new request and after a service restart/redeployment.
- The deployment is not considered complete until the live HTTPS URL and persistent storage have been verified.

## 9. Acceptance criteria

1. `GET /slots` returns `{"slots":[...]}` sorted by ascending `start`; filtering by `provider` uses exact matching, and each slot has an `available` boolean.
2. `POST /reset` replaces all slots and deletes all bookings, returning `200`.
3. A valid `POST /bookings` returns `201` with the exact booking fields and persists for subsequent lookup and service restart.
4. All routes require `X-API-Key`; absent or incorrect keys return `401`.
5. Booking validation, normalization, and status codes match the contract: required non-empty fields, valid email, trimmed name/email, stored lowercase email, `400` for invalid input or started slot, and `404` for an unknown slot.
6. Concurrent attempts for one slot result in one confirmed booking and `409` for attempts after the slot is booked.
7. `GET /bookings/{id}` returns the booking or `404`; `DELETE /bookings/{id}` returns the cancelled booking, frees the slot, returns `404` for unknown ids, and `409` for an already-cancelled booking.
8. Repeating `POST /bookings` with the same idempotency key and body replays the original status and booking id; using that key with a different body returns `422`.
9. `GET /bookings?email=...` matches email case-insensitively, sorts oldest first, defaults to limit 10, accepts limits 1–50, and returns cursor pages with `next_cursor: null` on the last page.
10. The sixth booking attempt for the same email within one minute, including failed attempts, returns `429` with integer-seconds `Retry-After`; attempts for other emails are unaffected.
11. All errors use `{"error":"<message>"}` and the deployed page and API are reachable over HTTPS without exposing a privileged API key in frontend assets.

## 10. Assumptions and decisions to confirm

- Slot management is through the contract's `POST /reset` operation; it replaces all slots and deletes all bookings. The patient-facing page does not expose this destructive operation.
- Slot timestamps are supplied as date-time strings; the UI presents them in a clearly identified timezone.
- The API-key requirement applies to every API request. A patient-facing page must use a server-side proxy or equivalent secure arrangement so the key is not exposed in browser code.
- No email or SMS delivery is required for the initial confirmation; the web page and API response provide the confirmation.
